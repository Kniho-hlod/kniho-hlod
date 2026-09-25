import { describe, expect, it } from 'vitest';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { emptyBookForm, shelvesChange, toBookPayload, withCatalogueDetails } from './book-form';

const FOUND: IsbnLookupResult = {
  isbn: '9780306406157',
  title: 'Hobit',
  author: 'J. R. R. Tolkien',
  publisher: null,
  publishedYear: 2012,
  pageCount: null,
  language: 'cs',
  description: null,
  hasCover: true,
};

describe('book form', () => {
  it('fills in what the catalogue knows and keeps the rest', () => {
    const typed = {
      ...emptyBookForm(),
      title: 'Hobbit',
      publisher: 'Argo',
      readingStatus: 'reading' as const,
      rating: 4,
    };

    expect(withCatalogueDetails(typed, FOUND)).toEqual({
      ...typed,
      isbn: '9780306406157',
      title: 'Hobit',
      author: 'J. R. R. Tolkien',
      publishedYear: 2012,
      language: 'cs',
    });
  });

  it('sends trimmed text, and empty text as null', () => {
    const form = {
      ...emptyBookForm(),
      title: '  Duna ',
      author: '   ',
      isbn: ' 978-0-306-40615-7 ',
    };

    expect(toBookPayload(form)).toMatchObject({
      title: 'Duna',
      author: null,
      isbn: '978-0-306-40615-7',
      description: null,
    });
  });

  it('sends cleared reading dates and blank notes as null', () => {
    const form = { ...emptyBookForm(), title: 'Duna', startedAt: '', notes: ' \n ' };

    expect(toBookPayload(form)).toMatchObject({ startedAt: null, finishedAt: null, notes: null });
  });

  it('changes the shelves only when the choice differs from the stored ones', () => {
    expect(shelvesChange(['sh_a', 'sh_b'], ['sh_b', 'sh_a'])).toEqual({ kind: 'keep' });
    expect(shelvesChange([], [])).toEqual({ kind: 'keep' });
    expect(shelvesChange(['sh_a'], ['sh_a', 'sh_b'])).toEqual({
      kind: 'set',
      shelfIds: ['sh_a', 'sh_b'],
    });
    expect(shelvesChange(['sh_a', 'sh_b'], [])).toEqual({ kind: 'set', shelfIds: [] });
  });
});
