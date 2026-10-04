import { describe, expect, it } from 'vitest';
import type { ImportedBook } from '@kniho-hlod/domain';
import { importBatches } from './import-batches';

const book = (title: string, notes: string | null = null): ImportedBook => ({
  title,
  author: null,
  isbn: null,
  publisher: null,
  publishedYear: null,
  pageCount: null,
  readingStatus: 'none',
  rating: null,
  finishedAt: null,
  review: null,
  notes,
  shelves: [],
});

describe('importBatches', () => {
  it('sends at most a hundred books at a time, in order', () => {
    const books = Array.from({ length: 250 }, (_, index) => book(`Kniha ${index}`));

    const batches = importBatches(books);

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(books);
  });

  it('keeps long notes from making a request too big', () => {
    const books = Array.from({ length: 40 }, (_, index) =>
      book(`Kniha ${index}`, 'x'.repeat(5000))
    );

    const batches = importBatches(books);

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) expect(JSON.stringify(batch).length).toBeLessThan(90_000);
  });

  it('sends nothing for an empty table', () => {
    expect(importBatches([])).toEqual([]);
  });
});
