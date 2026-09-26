import { ApiError } from '@eleansphere/entity-core';
import { findInKnihovnyCz, isCzechOrSlovakIsbn, mergeBookDetails } from '@kniho-hlod/domain';
import type { BookDetails, FetchJson, IsbnLookupResult } from '@kniho-hlod/domain';

const NOT_FOUND = 404;
const REQUEST_TIMEOUT_MS = 8_000;

/** Every catalogue answered, and none knows the ISBN. */
export class IsbnNotFoundError extends Error {
  constructor() {
    super('No catalogue knows this ISBN');
  }
}

/** JSON from a catalogue the browser asks itself; `null` when it answers 404. */
const fetchCatalogueJson: FetchJson = async <T>(url: string) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === NOT_FOUND) return null;
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`);
  return (await response.json()) as T;
};

/**
 * The Czech libraries' catalogue, asked from the reader's browser: knihovny.cz lets any web page
 * read its API but turns our server away.
 */
export function findInCzechLibraries(isbn: string): Promise<BookDetails | null> {
  return findInKnihovnyCz(isbn, fetchCatalogueJson);
}

/** Why neither the libraries nor the API's catalogues found the book. */
function lookupFailure(
  libraries: PromiseSettledResult<BookDetails | null>,
  catalogues: PromiseSettledResult<IsbnLookupResult>
): unknown {
  const cataloguesError = catalogues.status === 'rejected' ? catalogues.reason : undefined;
  const cataloguesAnswered =
    cataloguesError instanceof ApiError && cataloguesError.status === NOT_FOUND;
  // "Unknown" once anyone answered; otherwise the API's own reason (catalogues down, too many
  // lookups, offline) says more than the libraries' failure.
  return libraries.status === 'fulfilled' || cataloguesAnswered
    ? new IsbnNotFoundError()
    : cataloguesError;
}

/**
 * The Czech libraries' answer and the API's (Open Library, Google Books) as one. For Czech and
 * Slovak ISBNs the libraries' details come first, for others the API's; each fills in what the
 * other doesn't know. The cover comes from the API only: knihovny.cz doesn't let other web pages
 * read its images.
 */
export function combineLookups(
  isbn: string,
  libraries: PromiseSettledResult<BookDetails | null>,
  catalogues: PromiseSettledResult<IsbnLookupResult>
): IsbnLookupResult {
  const fromLibraries = libraries.status === 'fulfilled' ? libraries.value : null;
  const fromCatalogues = catalogues.status === 'fulfilled' ? catalogues.value : null;
  const details = mergeBookDetails(
    isCzechOrSlovakIsbn(isbn) ? [fromLibraries, fromCatalogues] : [fromCatalogues, fromLibraries]
  );
  if (!details) throw lookupFailure(libraries, catalogues);
  return { ...details, isbn, hasCover: fromCatalogues?.hasCover ?? false };
}
