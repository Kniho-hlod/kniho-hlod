import { generateId } from '@eleansphere/be-core';
import { bookEntity } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { BookCovers } from './book-covers';

type Row = InstanceType<ModelClass>;

/** What a copy takes over: the book itself, never what its reader made of it. */
const COPIED_FIELDS = [
  'title',
  'author',
  'isbn',
  'publisher',
  'publishedYear',
  'pageCount',
  'language',
  'description',
] as const;
const WANT_TO_READ: ReadingStatus = 'want';

export interface BookCopy {
  book: Row;
  /** `false`: the reader had the book (the same ISBN) already, and that one is returned. */
  created: boolean;
}

/**
 * Puts another reader's book in the reader's library as one they want to read: its details and
 * cover, but not the rating, review, notes, dates or shelves. A book with an ISBN the reader
 * already has is not copied again.
 */
export type CopyBook = (source: Row, readerId: string) => Promise<BookCopy>;

export function createCopyBook(registry: ModelRegistry, bookCovers: BookCovers): CopyBook {
  const books = () => registry.get(bookEntity.config.name);

  return async (source, readerId) => {
    const isbn = source.get('isbn') as string | null;
    if (isbn) {
      const existing = await books().findOne({
        where: { ownerId: readerId, isbn },
        order: [['createdAt', 'ASC']],
      });
      if (existing) return { book: existing, created: false };
    }
    const details = Object.fromEntries(COPIED_FIELDS.map((field) => [field, source.get(field)]));
    const book = await books().create({
      ...details,
      id: generateId(bookEntity.config.prefix),
      ownerId: readerId,
      readingStatus: WANT_TO_READ,
    });
    await bookCovers.copy(String(source.get('id')), String(book.get('id')), readerId);
    return { book, created: true };
  };
}
