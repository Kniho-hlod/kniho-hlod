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
  /**
   * Google Books API key. Without one, requests share Google's anonymous daily quota, which is
   * regularly used up (429) — the lookup then rests on Open Library alone.
   */
  googleBooksApiKey?: string;
}

/** The parsed JSON, or `null` when the catalogue answers 404: it doesn't know the ISBN. */
type FetchJson = <T>(url: string) => Promise<T | null>;
type CatalogueProvider = (isbn: string, fetchJson: FetchJson) => Promise<CatalogueEntry | null>;

const NOT_FOUND = 404;
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

const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/id';
/** Authors are separate records, fetched one by one; the first few names fill the form. */
const MAX_OPEN_LIBRARY_AUTHORS = 3;
/**
 * Open Library names languages by MARC code (`/languages/cze`); the book form keeps ISO 639-1.
 * A language not listed is left for the reader to fill in.
 */
const MARC_TO_ISO_639_1: Readonly<Record<string, string>> = {
  chi: 'zh',
  cze: 'cs',
  dan: 'da',
  dut: 'nl',
  eng: 'en',
  fin: 'fi',
  fre: 'fr',
  ger: 'de',
  hun: 'hu',
  ita: 'it',
  jpn: 'ja',
  nor: 'no',
  pol: 'pl',
  por: 'pt',
  rus: 'ru',
  slo: 'sk',
  spa: 'es',
  swe: 'sv',
  tur: 'tr',
  ukr: 'uk',
};
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

interface OpenLibraryRef {
  key?: string;
}

/** An edition record, as `/isbn/{isbn}.json` redirects to it. */
interface OpenLibraryEdition {
  title?: string;
  authors?: OpenLibraryRef[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  /** Cover ids; `-1` marks a removed cover. */
  covers?: number[];
  languages?: OpenLibraryRef[];
  description?: string | { value?: string };
}

function openLibraryCoverUrl(covers: number[] | undefined): string | undefined {
  const id = covers?.find((cover) => cover > 0);
  return id === undefined ? undefined : `${OPEN_LIBRARY_COVER_URL}/${id}-L.jpg`;
}

function openLibraryLanguage(languages: OpenLibraryRef[] | undefined): string | null {
  const code = languages?.[0]?.key?.split('/').pop();
  return code ? (MARC_TO_ISO_639_1[code] ?? null) : null;
}

function openLibraryDescription(description: OpenLibraryEdition['description']): string | null {
  const text = typeof description === 'string' ? description : description?.value;
  return fitText(bookFields.description, text);
}

/** The names behind keys such as `/authors/OL23919A`; a name that won't load is left out. */
function openLibraryAuthorNames(
  authors: OpenLibraryRef[] | undefined,
  fetchJson: FetchJson
): Promise<(string | undefined)[]> {
  const keys = (authors ?? [])
    .map((author) => author.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, MAX_OPEN_LIBRARY_AUTHORS);
  return Promise.all(
    keys.map(async (key) => {
      try {
        return (await fetchJson<{ name?: string }>(`${OPEN_LIBRARY_URL}${key}.json`))?.name;
      } catch {
        return undefined;
      }
    })
  );
}

const findInOpenLibrary: CatalogueProvider = async (isbn, fetchJson) => {
  const edition = await fetchJson<OpenLibraryEdition>(`${OPEN_LIBRARY_URL}/isbn/${isbn}.json`);
  const title = fitText(bookFields.title, edition?.title);
  if (!edition || !title) return null;
  return {
    details: {
      title,
      author: joinNames(await openLibraryAuthorNames(edition.authors, fetchJson)),
      publisher: fitText(bookFields.publisher, edition.publishers?.[0]),
      publishedYear: parseYear(edition.publish_date),
      pageCount: fitInteger(bookFields.pageCount, edition.number_of_pages),
      language: openLibraryLanguage(edition.languages),
      description: openLibraryDescription(edition.description),
    },
    coverUrl: trustedCoverUrl(openLibraryCoverUrl(edition.covers)),
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

function googleBooksUrl(isbn: string, apiKey: string | undefined): string {
  const url = new URL(GOOGLE_BOOKS_VOLUMES_URL);
  url.searchParams.set('q', `isbn:${isbn}`);
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

const findInGoogleBooks =
  (apiKey: string | undefined): CatalogueProvider =>
  async (isbn, fetchJson) => {
    const result = await fetchJson<{ items?: { volumeInfo?: GoogleBooksVolumeInfo }[] }>(
      googleBooksUrl(isbn, apiKey)
    );
    const volume = result?.items?.[0]?.volumeInfo;
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
  googleBooksApiKey,
}: IsbnCatalogueOptions = {}): IsbnCatalogue {
  /** Asked in order; the first that knows the ISBN answers. */
  const providers: readonly CatalogueProvider[] = [
    findInOpenLibrary,
    findInGoogleBooks(googleBooksApiKey),
  ];
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
    if (response.status === NOT_FOUND) return null;
    // The hostname only: the URL may carry an API key.
    if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`);
    return (await response.json()) as T;
  };

  async function find(isbn: string): Promise<CatalogueEntry | null> {
    const cached = cache.get(isbn);
    if (cached !== undefined) return cached;

    let failures = 0;
    for (const provider of providers) {
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
    if (failures === providers.length) throw new CatalogueUnavailableError();
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
