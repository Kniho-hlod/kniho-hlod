import { defineEntity } from '@eleansphere/entity-core';
import type { BookWithDetails } from '../book';
import { wishFields } from './fields';

/** Where the reader's wishes live; the API also serves `POST {WISHES_PATH}/:id/fulfil` there. */
export const WISHES_PATH = '/api/wishes';

/**
 * The reader's wish list: books they would like to have and don't. Each belongs to the reader
 * (`owner` access); friends who see the reader's library see the list through their own routes
 * and may promise to give a book, which the reader never learns of.
 */
export const wishEntity = defineEntity({
  name: 'wish',
  prefix: 'wi_',
  basePath: WISHES_PATH,
  access: { read: 'owner', write: 'owner' },
  fields: wishFields,
  query: {
    sort: ['title', 'author', 'createdAt'],
    defaultSort: '-createdAt',
    search: ['title', 'author', 'isbn'],
  },
  extend: (Base) =>
    class extends Base {
      /** The reader got the book: it goes into the library and off the list. */
      fulfil(id: string) {
        return this.post<BookWithDetails>(`${this.basePath}/${encodeURIComponent(id)}/fulfil`, {});
      }
    },
});

export type Wish = InstanceType<typeof wishEntity.Dto>;
