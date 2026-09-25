import { defineEntity } from '@eleansphere/entity-core';
import { bookShelfFields } from './fields';

/**
 * Which book is on which shelf, once each. There is no CRUD for it: the API replaces a book's
 * shelves at once (`PUT /api/books/:id/shelves`).
 */
export const bookShelfEntity = defineEntity({
  name: 'bookShelf',
  prefix: 'bs_',
  basePath: '/api/book-shelves',
  access: { read: 'owner', write: 'owner' },
  fields: bookShelfFields,
  indexes: [{ fields: ['bookId', 'shelfId'], unique: true }],
});
