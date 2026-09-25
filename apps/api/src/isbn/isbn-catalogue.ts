import { bookFields } from '@kniho-hlod/domain';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { TtlCache } from './ttl-cache';

/** What a catalogue knows about a book, in the shape of the book form. */
export type BookDetails = Omit<IsbnLookupResult, 'isbn' | 'hasCover'>;

export interface CatalogueEntry {
  details: BookDetails;
  /** Where the catalogue keeps the cover; only ever a URL from {@link COVER_HOSTS}. */
  coverUrl: string | null;
}

export interface CoverImage {
  mimeType: string;
  bytes: Buffer;
}

export interface IsbnCatalogue {
  /**
   * What the catalogues know about an ISBN-13, or `null` when none has it. Throws
   * {@link CatalogueUnavailableError} when no catalogue could be asked at all.
   */
  find(isbn: string): Promise<CatalogueEntry | null>;
  /** The entry's cover image, or `null` when it has none or the download fails. */
  fetchCover(entry: CatalogueEntry): Promise<CoverImage | null>;
}

export class CatalogueUnavailableError extends Error {
  constructor() {
    super('No book catalogue could be reached');
  }
}

export interface IsbnCatalogueOptions {
  /** Replaced in tests, so no request leaves the machine. */
  fetch?: typeof fetch;
  /** Clock for the cache, for tests. */
  now?: () => number;
}

type FetchJson = <T>(url: string) => Promise<T>;
type CatalogueProvider = (isbn: string, fetchJson: FetchJson) => Promise<CatalogueEntry | null>;

const REQUEST_TIMEOUT_MS = 8_000;
/** Open Library asks API clients to identify themselves. */
const USER_AGENT = 'Kniho-hlod/1.0 (+https://github.com/Kniho-hlod/kniho-hlod)';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1_000;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/** Covers are only downloaded from the catalogues' own image hosts. */
const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];
const YEAR_PATTERN = /\b(\d{4})\b/;
const AUTHOR_SEPARATOR = ', ';

const OPEN_LIBRARY_BOOKS_URL = 'https://openlibrary.org/api/books';
const GOOGLE_BOOKS_VOLUMES_URL = 'https://www.googleapis.com/books/v1/volumes';

interface LengthLimited {
  maxLength?: number;
}

interface NumberRange {
  min?: number;
  max?: number;
}

/** Trimmed and cut to what the book field holds; empty text becomes `null`. */
function fitText(field: LengthLimited, value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return field.maxLength === undefined ? text : text.slice(0, field.maxLength);
}

function fitInteger(field: NumberRange, value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isInteger(value)) return null;
  if (field.min !== undefined && value < field.min) return null;
  if (field.max !== undefined && value > field.max) return null;
  return value;
}

function parseYear(date: string | undefined): number | null {
  const match = date ? YEAR_PATTERN.exec(date) : null;
  return fitInteger(bookFields.publishedYear, match ? Number(match[1]) : null);
}

function joinNames(names: readonly (string | undefined)[] | undefined): string | null {
  const present = (names ?? []).filter((name): name is string => Boolean(name?.trim()));
  return fitText(bookFields.author, present.join(AUTHOR_SEPARATOR));
}

/** A cover URL over HTTPS on one of {@link COVER_HOSTS}; anything else counts as no cover. */
function trustedCoverUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    return COVER_HOSTS.includes(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface OpenLibraryBook {
  title?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  cover?: { small?: string; medium?: string; large?: string };
}

const findInOpenLibrary: CatalogueProvider = async (isbn, fetchJson) => {
  const key = `ISBN:${isbn}`;
  const books = await fetchJson<Record<string, OpenLibraryBook>>(
    `${OPEN_LIBRARY_BOOKS_URL}?bibkeys=${key}&format=json&jscmd=data`
  );
  const book = books[key];
  const title = fitText(bookFields.title, book?.title);
  if (!book || !title) return null;
  return {
    details: {
      title,
      author: joinNames(book.authors?.map((author) => author.name)),
      publisher: fitText(bookFields.publisher, book.publishers?.[0]?.name),
      publishedYear: parseYear(book.publish_date),
      pageCount: fitInteger(bookFields.pageCount, book.number_of_pages),
      language: null,
      description: null,
    },
    coverUrl: trustedCoverUrl(book.cover?.large ?? book.cover?.medium),
  };
};

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  language?: string;
  description?: string;
  imageLinks?: { smallThumbnail?: string; thumbnail?: string };
}

const findInGoogleBooks: CatalogueProvider = async (isbn, fetchJson) => {
  const result = await fetchJson<{ items?: { volumeInfo?: GoogleBooksVolumeInfo }[] }>(
    `${GOOGLE_BOOKS_VOLUMES_URL}?q=isbn:${isbn}`
  );
  const volume = result.items?.[0]?.volumeInfo;
  const title = fitText(bookFields.title, volume?.title);
  if (!volume || !title) return null;
  return {
    details: {
      title,
      author: joinNames(volume.authors),
      publisher: fitText(bookFields.publisher, volume.publisher),
      publishedYear: parseYear(volume.publishedDate),
      pageCount: fitInteger(bookFields.pageCount, volume.pageCount),
      language: fitText(bookFields.language, volume.language),
      description: fitText(bookFields.description, volume.description),
    },
    coverUrl: trustedCoverUrl(volume.imageLinks?.thumbnail),
  };
};

/** Asked in order; the first that knows the ISBN answers. */
const PROVIDERS: readonly CatalogueProvider[] = [findInOpenLibrary, findInGoogleBooks];

function describeFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Looks books up by ISBN in Open Library, then Google Books, and remembers the answers (including
 * "unknown") for a while: the catalogues rate-limit, and the same ISBN is usually looked up twice —
 * once for the form, once for its cover.
 */
export function createIsbnCatalogue({
  fetch: fetchImpl = fetch,
  now,
}: IsbnCatalogueOptions = {}): IsbnCatalogue {
  const cache = new TtlCache<string, CatalogueEntry | null>({
    maxEntries: CACHE_MAX_ENTRIES,
    ttlMs: CACHE_TTL_MS,
    now,
  });

  const request = (url: string, accept: string) =>
    fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  const fetchJson: FetchJson = async <T>(url: string) => {
    const response = await request(url, 'application/json');
    if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`);
    return (await response.json()) as T;
  };

  async function find(isbn: string): Promise<CatalogueEntry | null> {
    const cached = cache.get(isbn);
    if (cached !== undefined) return cached;

    let failures = 0;
    for (const provider of PROVIDERS) {
      try {
        const entry = await provider(isbn, fetchJson);
        if (entry) {
          cache.set(isbn, entry);
          return entry;
        }
      } catch (err) {
        failures += 1;
        console.warn(`ISBN lookup of ${isbn} failed: ${describeFailure(err)}`);
      }
    }
    if (failures === PROVIDERS.length) throw new CatalogueUnavailableError();
    // "Unknown" is only remembered when every catalogue actually answered.
    if (failures === 0) cache.set(isbn, null);
    return null;
  }

  async function fetchCover(entry: CatalogueEntry): Promise<CoverImage | null> {
    if (!entry.coverUrl) return null;
    try {
      const response = await request(entry.coverUrl, 'image/*');
      const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (!response.ok || !COVER_MIME_TYPES.includes(mimeType)) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return null;
      return { mimeType, bytes };
    } catch (err) {
      console.warn(`Cover download from ${entry.coverUrl} failed: ${describeFailure(err)}`);
      return null;
    }
  }

  return { find, fetchCover };
}
