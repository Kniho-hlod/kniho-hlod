import { createVerifyToken, HttpError, Op, parseListQuery } from '@eleansphere/be-core';
import type { ModelRouteOverrides, ProjectPlugin, WhereOptions } from '@eleansphere/be-core';
import { bookFields, bookEntity, FRIEND_BOOK_QUERY, FRIENDS_PATH } from '@kniho-hlod/domain';
import type { FriendBook } from '@kniho-hlod/domain';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { Request } from 'express';
import type { CopyBook } from '../books/copy-book';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import type { FriendLibrary } from './friend-library';
import type { Friendships } from './friendships';

const CREATED = 201;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SHELF_FILTER = 'shelf';

export interface FriendLibraryPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  friendships: Friendships;
  friendLibrary: FriendLibrary;
  copyBook: CopyBook;
  /** `routes.book.enrich`: a copied book answers like any other of the reader's books. */
  bookDetails: NonNullable<ModelRouteOverrides['enrich']>;
}

/**
 * A friend's shared library: `GET /api/friends/:userId/books` (search, reading status, shelf,
 * sort, pages), `…/books/:bookId` and `…/shelves`. Only for friends of a reader who shares the
 * library, only the books not hidden from friends; anything else answers 404.
 * `POST …/books/:bookId/copy` puts a copy of the book in the reader's library (409 when they have
 * one with the same ISBN).
 */
export function createFriendLibraryPlugin({
  jwtSecret,
  registry,
  friendships,
  friendLibrary,
  copyBook,
  bookDetails,
}: FriendLibraryPluginOptions): ProjectPlugin {
  const books = () => registry.get(bookEntity.config.name);

  /** The friend whose library the request is for, once the reader may see it. */
  async function sharedLibraryOf(req: Request): Promise<string> {
    const friendId = String(req.params.userId);
    if (!(await friendships.sharesLibraryWith(friendId, String(req.user?.id)))) {
      throw new HttpError(NOT_FOUND, 'library not found');
    }
    return friendId;
  }

  async function sharedBook(req: Request) {
    const friendId = await sharedLibraryOf(req);
    const book = await books().findOne({
      where: { ...friendLibrary.sharedBooks(friendId), id: String(req.params.bookId) },
    });
    if (!book) throw new HttpError(NOT_FOUND, 'book not found');
    return book;
  }

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);

      app.get(
        `${FRIENDS_PATH}/:userId/books`,
        requireUser,
        asyncHandler(async (req, res) => {
          const friendId = await sharedLibraryOf(req);
          const list = parseListQuery(req.query, FRIEND_BOOK_QUERY, bookFields);
          const shelfId = list.customFilters[SHELF_FILTER];
          const onShelf: WhereOptions =
            shelfId === undefined
              ? {}
              : { id: await friendLibrary.bookIdsOnShelf(friendId, String(shelfId)) };
          const { rows, count } = await books().findAndCountAll({
            where: { [Op.and]: [list.where, friendLibrary.sharedBooks(friendId), onShelf] },
            order: list.order,
            limit: list.limit,
            offset: list.offset,
          });
          const page: PaginatedResponse<FriendBook> = {
            data: await friendLibrary.toFriendBooks(rows, String(req.user?.id)),
            total: count,
            page: list.page,
            limit: list.limit,
          };
          res.json(page);
        })
      );

      app.get(
        `${FRIENDS_PATH}/:userId/books/:bookId`,
        requireUser,
        asyncHandler(async (req, res) => {
          const book = await sharedBook(req);
          const [friendBook] = await friendLibrary.toFriendBooks([book], String(req.user?.id));
          res.json(friendBook);
        })
      );

      app.post(
        `${FRIENDS_PATH}/:userId/books/:bookId/copy`,
        requireUser,
        asyncHandler(async (req, res) => {
          const { book, created } = await copyBook(await sharedBook(req), String(req.user?.id));
          if (!created) throw new HttpError(CONFLICT, 'the reader has this book already');
          const [copy] = await bookDetails([book]);
          res.status(CREATED).json(copy);
        })
      );

      app.get(
        `${FRIENDS_PATH}/:userId/shelves`,
        requireUser,
        asyncHandler(async (req, res) => {
          res.json(await friendLibrary.shelves(await sharedLibraryOf(req)));
        })
      );
    },
  };
}
