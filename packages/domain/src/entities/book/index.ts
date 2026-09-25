import { defineEntity, withFiles } from '@eleansphere/entity-core';
import type { FileDto } from '@eleansphere/entity-core';
import { FILE_REF_TYPES, FILE_ROLES } from '../../constants';
import { bookFields } from './fields';

export { findReadingDatesIssues } from './reading-dates';

/**
 * The reader's own books. Each belongs to the user who added it (`owner` access: nobody else
 * sees or changes it) and may have one cover image.
 */
export const bookEntity = defineEntity({
  name: 'book',
  prefix: 'bk_',
  basePath: '/api/books',
  access: { read: 'owner', write: 'owner' },
  fields: bookFields,
  query: {
    filter: { readingStatus: 'in', rating: 'range' },
    sort: ['title', 'author', 'publishedYear', 'rating', 'createdAt'],
    defaultSort: '-createdAt',
    search: ['title', 'author', 'isbn'],
  },
  extend: (Base) => class extends withFiles(Base, FILE_REF_TYPES.book, [FILE_ROLES.cover]) {},
});

export type Book = InstanceType<typeof bookEntity.Dto>;

/** A book as the API returns it: with its cover attached, or `null` without one. */
export type BookWithCover = Book & { cover: FileDto | null };
