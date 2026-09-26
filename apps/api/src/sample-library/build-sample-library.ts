import { addDays } from '@eleansphere/schema';
import {
  bookEntity,
  bookShelfEntity,
  contactEntity,
  loanEntity,
  shelfEntity,
} from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import { SAMPLE_LOANS, SAMPLE_READING_DAYS_AGO } from './sample-library-content';
import type { SampleBook, SampleLibraryContent } from './sample-library-content';

const MILLISECONDS_PER_SECOND = 1000;

/** A row as the model stores it. */
export type SampleRow = Record<string, unknown>;

/** The rows to insert, in an order the foreign keys accept. */
export interface SampleLibraryRows {
  shelves: SampleRow[];
  books: SampleRow[];
  bookShelves: SampleRow[];
  contacts: SampleRow[];
  loans: SampleRow[];
}

export interface SampleLibraryOptions {
  ownerId: string;
  /** The reader's today (`YYYY-MM-DD`): every date is counted back or forward from it. */
  today: string;
  /** The moment of filling; books get creation times a second apart below it, to keep their order. */
  now: Date;
  /** A fresh id with the entity's prefix. */
  newId: (prefix: string) => string;
}

function readingDates(status: ReadingStatus, today: string): SampleRow {
  if (status === 'reading') {
    return { startedAt: addDays(today, -SAMPLE_READING_DAYS_AGO.reading) };
  }
  if (status === 'read') {
    return {
      startedAt: addDays(today, -SAMPLE_READING_DAYS_AGO.started),
      finishedAt: addDays(today, -SAMPLE_READING_DAYS_AGO.finished),
    };
  }
  return {};
}

function requireId(ids: Map<string, string>, key: string): string {
  const id = ids.get(key);
  if (!id) throw new Error(`The sample library has no "${key}"`);
  return id;
}

/**
 * The reader's sample library as rows: every one owned by the reader and marked `isSample`,
 * with dates relative to the reader's today.
 */
export function buildSampleLibrary(
  content: SampleLibraryContent,
  { ownerId, today, now, newId }: SampleLibraryOptions
): SampleLibraryRows {
  const owned = { ownerId, isSample: true };
  const shelfIds = new Map(
    content.shelves.map(({ key }) => [key, newId(shelfEntity.config.prefix)])
  );
  const bookIds = new Map(content.books.map(({ key }) => [key, newId(bookEntity.config.prefix)]));
  const contactIds = new Map(
    content.contacts.map(({ key }) => [key, newId(contactEntity.config.prefix)])
  );
  const toBookRow = ({ key, shelves: _shelves, ...book }: SampleBook, index: number) => ({
    ...owned,
    ...book,
    ...readingDates(book.readingStatus, today),
    id: requireId(bookIds, key),
    language: content.language,
    createdAt: new Date(now.getTime() - index * MILLISECONDS_PER_SECOND),
  });

  return {
    shelves: content.shelves.map(({ key, name, color }, sortOrder) => ({
      ...owned,
      id: requireId(shelfIds, key),
      name,
      color,
      sortOrder,
    })),
    books: content.books.map(toBookRow),
    bookShelves: content.books.flatMap(({ key, shelves }) =>
      shelves.map((shelf) => ({
        ...owned,
        id: newId(bookShelfEntity.config.prefix),
        bookId: requireId(bookIds, key),
        shelfId: requireId(shelfIds, shelf),
      }))
    ),
    contacts: content.contacts.map(({ key, name, note }) => ({
      ...owned,
      id: requireId(contactIds, key),
      name,
      note,
    })),
    loans: SAMPLE_LOANS.map((loan) => ({
      ...owned,
      id: newId(loanEntity.config.prefix),
      bookId: requireId(bookIds, loan.book),
      contactId: requireId(contactIds, loan.contact),
      lentAt: addDays(today, -loan.lentDaysAgo),
      dueAt: addDays(today, loan.dueInDays),
      returnedAt: loan.returnedDaysAgo === undefined ? null : addDays(today, -loan.returnedDaysAgo),
    })),
  };
}
