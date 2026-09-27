import { bookEntity } from '@kniho-hlod/domain';
import type { FriendBookSummary } from '@kniho-hlod/domain';
import type { FileDto } from '@eleansphere/entity-core';
import type { BookCovers } from '../books/book-covers';
import type { ModelRegistry } from '../models-registry';

/** Books as a request or a borrowed loan shows them: title, author, cover. */
export type BookSummaries = (bookIds: string[]) => Promise<Map<string, FriendBookSummary>>;

export function createBookSummaries(
  registry: ModelRegistry,
  bookCovers: BookCovers
): BookSummaries {
  return async (bookIds) => {
    const ids = [...new Set(bookIds)];
    if (ids.length === 0) return new Map();
    const books = await registry
      .get(bookEntity.config.name)
      .findAll({ where: { id: ids }, attributes: ['id', 'title', 'author'] });
    const withCovers = await bookCovers.attach(books);
    return new Map(
      withCovers.map((book) => [
        String(book.id),
        {
          id: String(book.id),
          title: String(book.title),
          author: book.author === null || book.author === undefined ? null : String(book.author),
          cover: (book.cover as FileDto | null) ?? null,
        },
      ])
    );
  };
}
