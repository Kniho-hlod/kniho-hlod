import { defineEntity } from '@eleansphere/entity-core';
import { shelfFields } from './fields';

/** Shelves are listed in the reader's order, equal positions alphabetically. */
export const SHELF_ORDER = 'sortOrder,name';

/**
 * The reader's own groupings of books — "Favourites", "To give away", "Kids' room". A book can
 * be on several shelves; see `bookShelfEntity`.
 */
export const shelfEntity = defineEntity({
  name: 'shelf',
  prefix: 'sh_',
  basePath: '/api/shelves',
  access: { read: 'owner', write: 'owner' },
  fields: shelfFields,
  query: {
    sort: ['sortOrder', 'name', 'createdAt'],
    defaultSort: SHELF_ORDER,
    search: ['name'],
  },
});

export type Shelf = InstanceType<typeof shelfEntity.Dto>;

/** A shelf as the API returns it: with how many books are on it. */
export type ShelfWithBooks = Shelf & { bookCount: number };

/** A shelf as the API attaches it to each of its books. */
export type ShelfSummary = Pick<Shelf, 'id' | 'name' | 'color'>;
