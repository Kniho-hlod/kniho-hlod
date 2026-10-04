import { LIBRARY_IMPORT_MAX_BOOKS } from '@kniho-hlod/domain';
import type { ImportedBook } from '@kniho-hlod/domain';

/** Well under the 100 kB the API reads from one request, notes and reviews included. */
const MAX_BATCH_BYTES = 80_000;

/** Books split into requests the API takes: at most `LIBRARY_IMPORT_MAX_BOOKS` and ~80 kB each. */
export function importBatches(books: readonly ImportedBook[]): ImportedBook[][] {
  const encoder = new TextEncoder();
  const batches: ImportedBook[][] = [];
  let batch: ImportedBook[] = [];
  let bytes = 0;
  for (const book of books) {
    const size = encoder.encode(JSON.stringify(book)).length;
    if (
      batch.length > 0 &&
      (batch.length >= LIBRARY_IMPORT_MAX_BOOKS || bytes + size > MAX_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(book);
    bytes += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}
