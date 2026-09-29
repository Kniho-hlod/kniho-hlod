import {
  bookEntity,
  bookShelfEntity,
  DEFAULT_BOOK_VISIBILITY,
  DEFAULT_LOAN_REQUEST_STATUS,
  loanEntity,
  loanRequestEntity,
  shelfEntity,
} from '@kniho-hlod/domain';
import type {
  FriendBook,
  FriendBookSummary,
  FriendShelf,
  ReadingStatus,
  ShelfColor,
} from '@kniho-hlod/domain';
import type { FileDto } from '@eleansphere/entity-core';
import type { BookCovers } from '../books/book-covers';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { BookShelves } from '../shelves/book-shelves';

type Row = InstanceType<ModelClass>;
type Plain = Record<string, unknown>;

/**
 * Which of a friend's books their friends see. A type, not an interface: Sequelize's where-clause
 * types only take object types without declared members.
 */
export type SharedBooksWhere = {
  ownerId: string;
  visibility: typeof DEFAULT_BOOK_VISIBILITY;
  isSample: false;
};

const READING: ReadingStatus = 'reading';
/** How many of a friend's current books the friends list shows. */
export const READING_NOW_PER_FRIEND = 3;
const SHELF_ORDER_COLUMNS: [string, string][] = [
  ['sortOrder', 'ASC'],
  ['name', 'ASC'],
];

export interface FriendLibrary {
  /** The friend's books their friends may see: not hidden and not the tour's samples. */
  sharedBooks(friendId: string): SharedBooksWhere;
  /**
   * Books as a friend (`readerId`) sees them: details, cover, shelves, at home or not, the
   * reader's own waiting request and own copy — nothing private.
   */
  toFriendBooks(books: Row[], readerId: string): Promise<FriendBook[]>;
  /** What each of these (sharing) friends is reading now, a few books each. */
  readingNow(friendIds: string[]): Promise<Map<string, FriendBookSummary[]>>;
  /** The friend's shelves that hold shared books, in the friend's order. */
  shelves(friendId: string): Promise<FriendShelf[]>;
  /** The shared books on one of the friend's shelves. */
  bookIdsOnShelf(friendId: string, shelfId: string): Promise<string[]>;
}

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** The fields a friend may see — listed one by one, so a new private column never leaks. */
function toFriendBook(
  book: Plain,
  lentUntil: Map<string, string | null>,
  myRequests: Map<string, string>,
  myCopies: Map<string, string>
): FriendBook {
  const id = String(book.id);
  const isbn = stringOrNull(book.isbn);
  const myCopyId = isbn === null ? undefined : myCopies.get(isbn);
  return {
    id,
    title: String(book.title),
    author: stringOrNull(book.author),
    cover: (book.cover as FileDto | null) ?? null,
    isbn,
    publisher: stringOrNull(book.publisher),
    publishedYear: numberOrNull(book.publishedYear),
    pageCount: numberOrNull(book.pageCount),
    language: stringOrNull(book.language),
    description: stringOrNull(book.description),
    readingStatus: book.readingStatus as ReadingStatus,
    rating: numberOrNull(book.rating),
    review: stringOrNull(book.review),
    startedAt: stringOrNull(book.startedAt),
    finishedAt: stringOrNull(book.finishedAt),
    shelves: (book.shelves as FriendShelf[]).map(({ id: shelfId, name, color }) => ({
      id: shelfId,
      name,
      color,
    })),
    lent: lentUntil.has(id) ? { dueAt: lentUntil.get(id) ?? null } : null,
    myRequest: myRequests.has(id) ? { id: myRequests.get(id) ?? '' } : null,
    myCopy: myCopyId === undefined ? null : { id: myCopyId },
  };
}

export function createFriendLibrary(
  registry: ModelRegistry,
  bookCovers: BookCovers,
  bookShelves: BookShelves
): FriendLibrary {
  const books = () => registry.get(bookEntity.config.name);

  function sharedBooks(friendId: string): SharedBooksWhere {
    return { ownerId: friendId, visibility: DEFAULT_BOOK_VISIBILITY, isSample: false };
  }

  /** Due dates of the books out on a loan, by book; a book at home isn't in it. */
  async function lentUntil(bookIds: string[]): Promise<Map<string, string | null>> {
    if (bookIds.length === 0) return new Map();
    const open = await registry
      .get(loanEntity.config.name)
      .findAll({ where: { bookId: bookIds, returnedAt: null }, attributes: ['bookId', 'dueAt'] });
    return new Map(
      open.map((loan) => [String(loan.get('bookId')), stringOrNull(loan.get('dueAt'))])
    );
  }

  /** The reader's requests still waiting for an answer, by book. */
  async function waitingRequests(
    bookIds: string[],
    readerId: string
  ): Promise<Map<string, string>> {
    const waiting = await registry.get(loanRequestEntity.config.name).findAll({
      where: { bookId: bookIds, requesterId: readerId, status: DEFAULT_LOAN_REQUEST_STATUS },
      attributes: ['id', 'bookId'],
    });
    return new Map(
      waiting.map((request) => [String(request.get('bookId')), String(request.get('id'))])
    );
  }

  /** The reader's own books with these ISBNs: the book id by ISBN. */
  async function copiesByIsbn(isbns: string[], readerId: string): Promise<Map<string, string>> {
    if (isbns.length === 0) return new Map();
    const own = await books().findAll({
      where: { ownerId: readerId, isbn: isbns },
      attributes: ['id', 'isbn'],
      order: [['createdAt', 'ASC']],
    });
    const byIsbn = new Map<string, string>();
    for (const book of own) {
      const isbn = String(book.get('isbn'));
      if (!byIsbn.has(isbn)) byIsbn.set(isbn, String(book.get('id')));
    }
    return byIsbn;
  }

  async function sharedBookIds(friendId: string): Promise<string[]> {
    const shared = await books().findAll({ where: sharedBooks(friendId), attributes: ['id'] });
    return shared.map((book) => String(book.get('id')));
  }

  return {
    sharedBooks,

    async toFriendBooks(rows, readerId) {
      if (rows.length === 0) return [];
      const bookIds = rows.map((book) => String(book.get('id')));
      const withShelves = await bookShelves.attachToBooks(await bookCovers.attach(rows));
      const isbns = rows.flatMap((book) => (book.get('isbn') as string | null) ?? []);
      const [lent, myRequests, myCopies] = await Promise.all([
        lentUntil(bookIds),
        waitingRequests(bookIds, readerId),
        copiesByIsbn([...new Set(isbns)], readerId),
      ]);
      return withShelves.map((book) => toFriendBook(book, lent, myRequests, myCopies));
    },

    async readingNow(friendIds) {
      const byFriend = new Map<string, FriendBookSummary[]>();
      if (friendIds.length === 0) return byFriend;
      const reading = await books().findAll({
        where: {
          ownerId: friendIds,
          readingStatus: READING,
          visibility: DEFAULT_BOOK_VISIBILITY,
          isSample: false,
        },
        attributes: ['id', 'ownerId', 'title', 'author'],
        order: [['updatedAt', 'DESC']],
      });
      const withCovers = await bookCovers.attach(reading);
      for (const book of withCovers) {
        const friendId = String(book.ownerId);
        const list = byFriend.get(friendId) ?? [];
        if (list.length >= READING_NOW_PER_FRIEND) continue;
        list.push({
          id: String(book.id),
          title: String(book.title),
          author: stringOrNull(book.author),
          cover: (book.cover as FileDto | null) ?? null,
        });
        byFriend.set(friendId, list);
      }
      return byFriend;
    },

    async shelves(friendId) {
      const bookIds = await sharedBookIds(friendId);
      if (bookIds.length === 0) return [];
      const pairings = await registry
        .get(bookShelfEntity.config.name)
        .findAll({ where: { bookId: bookIds }, attributes: ['shelfId'] });
      const counts = new Map<string, number>();
      for (const pairing of pairings) {
        const shelfId = String(pairing.get('shelfId'));
        counts.set(shelfId, (counts.get(shelfId) ?? 0) + 1);
      }
      if (counts.size === 0) return [];
      const shelves = await registry.get(shelfEntity.config.name).findAll({
        where: { id: [...counts.keys()], ownerId: friendId },
        attributes: ['id', 'name', 'color'],
        order: SHELF_ORDER_COLUMNS,
      });
      return shelves.map((shelf) => ({
        id: String(shelf.get('id')),
        name: String(shelf.get('name')),
        color: shelf.get('color') as ShelfColor,
        bookCount: counts.get(String(shelf.get('id'))) ?? 0,
      }));
    },

    async bookIdsOnShelf(friendId, shelfId) {
      const pairings = await registry
        .get(bookShelfEntity.config.name)
        .findAll({ where: { shelfId, ownerId: friendId }, attributes: ['bookId'] });
      return pairings.map((pairing) => String(pairing.get('bookId')));
    },
  };
}
