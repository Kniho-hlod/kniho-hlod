import { describe, expect, it, vi } from 'vitest';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { createShelfScan } from './shelf-scan';
import type { ShelfScanSources } from './shelf-scan';

const HOBIT: IsbnLookupResult = {
  isbn: '9780306406157',
  title: 'Hobit',
  author: 'J. R. R. Tolkien',
  publisher: null,
  publishedYear: null,
  pageCount: null,
  language: null,
  description: null,
  hasCover: false,
};
const OWNED_ISBN = '9788025712344';
const UNKNOWN_ISBN = '9788000000001';

function sources(): ShelfScanSources {
  return {
    lookUp: vi.fn(async (isbn: string) => {
      if (isbn === UNKNOWN_ISBN) throw new Error('unknown');
      return { ...HOBIT, isbn };
    }),
    findOwned: vi.fn(async (isbn: string) =>
      isbn === OWNED_ISBN ? { id: 'b1', title: 'Válka s mloky' } : null
    ),
    describeLookupError: () => 'Neznámé ISBN',
  };
}

describe('createShelfScan', () => {
  it('looks every new book up, newest first, and keeps out the ones the reader has', async () => {
    const shelf = createShelfScan(sources());

    expect(shelf.scan(HOBIT.isbn)).toBe('new');
    expect(shelf.scan(OWNED_ISBN)).toBe('new');
    expect(shelf.scan(UNKNOWN_ISBN)).toBe('new');
    expect(shelf.isLooking.value).toBe(true);
    await vi.waitFor(() => expect(shelf.isLooking.value).toBe(false));

    expect(shelf.books.value.map((book) => [book.isbn, book.state, book.title])).toEqual([
      [UNKNOWN_ISBN, 'unknown', ''],
      [OWNED_ISBN, 'owned', 'Válka s mloky'],
      [HOBIT.isbn, 'found', 'Hobit'],
    ]);
    expect(shelf.books.value[0]!.problem).toBe('Neznámé ISBN');
    expect(shelf.toAdd.value.map((book) => book.isbn)).toEqual([HOBIT.isbn]);
  });

  it('adds an unknown book once it has a title, and scans each book once', async () => {
    const from = sources();
    const shelf = createShelfScan(from);
    shelf.scan(UNKNOWN_ISBN);
    await vi.waitFor(() => expect(shelf.isLooking.value).toBe(false));

    shelf.books.value[0]!.title = 'Rukopis';
    expect(shelf.toAdd.value).toHaveLength(1);
    expect(shelf.scan(UNKNOWN_ISBN)).toBe('again');
    expect(from.lookUp).toHaveBeenCalledTimes(1);

    shelf.remove(UNKNOWN_ISBN);
    expect(shelf.books.value).toEqual([]);
  });
});
