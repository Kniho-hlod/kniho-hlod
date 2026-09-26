import { TtlCache } from './ttl-cache';
import type { FetchJson } from '@kniho-hlod/domain';
import type { CatalogueEntry, CatalogueProvider } from './catalogue-entry';
import { findInGoogleBooks } from './google-books';
import { findInOpenLibrary } from './open-library';

export type { CatalogueEntry } from './catalogue-entry';

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
   * regularly used up (429) — the lookup then rests on Open Library.
   */
  googleBooksApiKey?: string;
}

const NOT_FOUND = 404;
const REQUEST_TIMEOUT_MS = 8_000;
/** Open Library asks API clients to identify themselves; the others are told the same. */
const USER_AGENT = 'Kniho-hlod/1.0 (+https://github.com/Kniho-hlod/kniho-hlod)';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1_000;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
/** Smaller images are "no image" placeholders a catalogue may send instead of a cover. */
const MIN_COVER_BYTES = 3 * 1024;
const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** The details from the catalogue that knew the book first, the cover from a later one. */
function withCoverFrom(found: CatalogueEntry | null, entry: CatalogueEntry): CatalogueEntry {
  return found ? { details: found.details, coverUrl: entry.coverUrl } : entry;
}

function describeFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Looks books up by ISBN in Open Library, then Google Books, and remembers the answers (including
 * "unknown") for a while: the catalogues rate-limit, and the same ISBN is usually looked up twice,
 * once for the form and once for its cover.
 *
 * The Czech libraries' catalogue (knihovny.cz) turns our server away, so the app asks it from
 * the reader's browser (`findInKnihovnyCz` in the domain package) and comes here for the rest,
 * above all for a cover.
 */
export function createIsbnCatalogue({
  fetch: fetchImpl = fetch,
  now,
  googleBooksApiKey,
}: IsbnCatalogueOptions = {}): IsbnCatalogue {
  const findInGoogle = findInGoogleBooks(googleBooksApiKey);
  /**
   * Asked in order: the details come from the first that knows the ISBN, the cover from the first
   * that has one.
   */
  const providers: readonly CatalogueProvider[] = [findInOpenLibrary, findInGoogle];
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

    let found: CatalogueEntry | null = null;
    let failures = 0;
    for (const provider of providers) {
      try {
        const entry = await provider(isbn, fetchJson);
        if (entry) found = withCoverFrom(found, entry);
        if (found?.coverUrl) break;
      } catch (err) {
        failures += 1;
        console.warn(`ISBN lookup of ${isbn} failed: ${describeFailure(err)}`);
      }
    }
    if (found) {
      cache.set(isbn, found);
      return found;
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
      if (bytes.length < MIN_COVER_BYTES || bytes.length > MAX_COVER_BYTES) return null;
      return { mimeType, bytes };
    } catch (err) {
      console.warn(`Cover download from ${entry.coverUrl} failed: ${describeFailure(err)}`);
      return null;
    }
  }

  return { find, fetchCover };
}
