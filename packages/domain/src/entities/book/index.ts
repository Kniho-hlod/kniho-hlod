import { defineEntity, withFiles } from '@eleansphere/entity-core';
import type { FileDto } from '@eleansphere/entity-core';
import type { ActiveLoan } from '../loan';
import type { ShelfSummary } from '../shelf';
import { FILE_REF_TYPES, FILE_ROLES } from '../../constants';
import { bookFields } from './fields';

export { findReadingDatesIssues, readingDatesForStatus, type ReadingDates } from './reading-dates';

/** Where books live; the API also serves `PUT {BOOKS_PATH}/:id/shelves` there. */
export const BOOKS_PATH = '/api/books';

/** `PUT /api/books/:id/shelves`: the shelves the book is on from now on, replacing the old ones. */
export interface SetBookShelvesRequest {
  shelfIds: string[];
}

/**
 * The reader's own books. Each belongs to the user who added it (`owner` access: nobody else
 * sees or changes it) and may have one cover image.
 */
export const bookEntity = defineEntity({
  name: 'book',
  prefix: 'bk_',
  basePath: BOOKS_PATH,
  access: { read: 'owner', write: 'owner' },
  fields: bookFields,
  query: {
    filter: { readingStatus: 'in', rating: 'range', isbn: 'eq' },
    customFilters: {
      /** `true`: books out on a loan; `false`: books at home. */
      lent: 'BOOLEAN',
      /** A shelf id: the books on that shelf. */
      shelf: 'STRING',
    },
    sort: ['title', 'author', 'publishedYear', 'rating', 'createdAt'],
    defaultSort: '-createdAt',
    search: ['title', 'author', 'isbn'],
  },
  extend: (Base) =>
    class extends withFiles(Base, FILE_REF_TYPES.book, [FILE_ROLES.cover]) {
      /** Puts the book on exactly these shelves, taking it off any other. */
      setShelves(id: string, shelfIds: string[]) {
        const request: SetBookShelvesRequest = { shelfIds };
        return this.put<BookWithDetails>(
          `${this.basePath}/${encodeURIComponent(id)}/shelves`,
          request
        );
      }
    },
});

export type Book = InstanceType<typeof bookEntity.Dto>;

/**
 * A book as the API returns it: with its cover, the loan it is out on (`null` for none) and the
 * shelves it is on.
 */
export type BookWithDetails = Book & {
  cover: FileDto | null;
  activeLoan: ActiveLoan | null;
  shelves: ShelfSummary[];
};
