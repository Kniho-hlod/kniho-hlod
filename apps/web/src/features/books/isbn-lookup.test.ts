import { describe, expect, it } from 'vitest';
import { ApiError } from '@eleansphere/entity-core';
import type { BookDetails, IsbnLookupResult } from '@kniho-hlod/domain';
import { combineLookups, IsbnNotFoundError } from './isbn-lookup';

const CZECH_ISBN = '9788072037285';
const OTHER_ISBN = '9780306406157';

const LIBRARIES: BookDetails = {
  title: 'Pán prstenů. Návrat krále',
  author: 'J. R. R. Tolkien',
  publisher: 'Argo',
  publishedYear: 2007,
  pageCount: 476,
  language: 'cs',
  description: null,
};

const catalogues = (isbn: string): IsbnLookupResult => ({
  isbn,
  title: 'Návrat krále',
  author: 'John Ronald Reuel Tolkien',
  publisher: null,
  publishedYear: 2007,
  pageCount: 480,
  language: 'cs',
  description: 'Závěrečný díl trilogie.',
  hasCover: true,
});

const found = <T>(value: T): PromiseSettledResult<T> => ({ status: 'fulfilled', value });
const failed = (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason });
const unknownToApi = failed(new ApiError(404, 'Not Found'));
const apiCataloguesDown = new ApiError(503, 'Service Unavailable');

describe('combineLookups', () => {
  it('puts the Czech libraries first for a Czech ISBN, with the API’s cover', () => {
    expect(combineLookups(CZECH_ISBN, found(LIBRARIES), found(catalogues(CZECH_ISBN)))).toEqual({
      ...LIBRARIES,
      isbn: CZECH_ISBN,
      description: 'Závěrečný díl trilogie.',
      hasCover: true,
    });
  });

  it('puts the API’s catalogues first for other ISBNs', () => {
    expect(combineLookups(OTHER_ISBN, found(LIBRARIES), found(catalogues(OTHER_ISBN)))).toEqual({
      ...catalogues(OTHER_ISBN),
      publisher: 'Argo',
    });
  });

  it('has no cover when only the libraries know the book', () => {
    expect(combineLookups(CZECH_ISBN, found(LIBRARIES), unknownToApi)).toEqual({
      ...LIBRARIES,
      isbn: CZECH_ISBN,
      hasCover: false,
    });
    expect(combineLookups(CZECH_ISBN, found(LIBRARIES), failed(apiCataloguesDown)).title).toBe(
      LIBRARIES.title
    );
  });

  it('does without the libraries when they can’t be reached', () => {
    expect(
      combineLookups(
        CZECH_ISBN,
        failed(new TypeError('Failed to fetch')),
        found(catalogues(CZECH_ISBN))
      )
    ).toEqual(catalogues(CZECH_ISBN));
  });

  it('reports "unknown" once any catalogue answered that it doesn’t know the ISBN', () => {
    const lookUp =
      (
        libraries: PromiseSettledResult<BookDetails | null>,
        api: PromiseSettledResult<IsbnLookupResult>
      ) =>
      () =>
        combineLookups(CZECH_ISBN, libraries, api);

    expect(lookUp(found(null), unknownToApi)).toThrow(IsbnNotFoundError);
    expect(lookUp(found(null), failed(apiCataloguesDown))).toThrow(IsbnNotFoundError);
    expect(lookUp(failed(new TypeError('Failed to fetch')), unknownToApi)).toThrow(
      IsbnNotFoundError
    );
  });

  it('passes the API’s error on when no catalogue could answer', () => {
    expect(() =>
      combineLookups(
        CZECH_ISBN,
        failed(new TypeError('Failed to fetch')),
        failed(apiCataloguesDown)
      )
    ).toThrow(apiCataloguesDown);
  });
});
