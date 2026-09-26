import { describe, expect, it } from 'vitest';
import { mergeBookDetails } from './book-details';
import type { BookDetails } from './book-details';

const LIBRARIES: BookDetails = {
  title: 'Pán prstenů. Návrat krále',
  author: 'J. R. R. Tolkien',
  publisher: 'Argo',
  publishedYear: 2007,
  pageCount: 476,
  language: 'cs',
  description: null,
};

const GOOGLE: BookDetails = {
  title: 'Návrat krále',
  author: 'John Ronald Reuel Tolkien',
  publisher: null,
  publishedYear: 2007,
  pageCount: 480,
  language: 'cs',
  description: 'Závěrečný díl trilogie.',
};

describe('mergeBookDetails', () => {
  it('takes each detail from the first catalogue that knows it', () => {
    expect(mergeBookDetails([LIBRARIES, GOOGLE])).toEqual({
      ...LIBRARIES,
      description: 'Závěrečný díl trilogie.',
    });
    expect(mergeBookDetails([GOOGLE, LIBRARIES])).toEqual({ ...GOOGLE, publisher: 'Argo' });
  });

  it('skips catalogues that don’t know the book', () => {
    expect(mergeBookDetails([null, GOOGLE])).toEqual(GOOGLE);
    expect(mergeBookDetails([null, null])).toBeNull();
    expect(mergeBookDetails([])).toBeNull();
  });
});
