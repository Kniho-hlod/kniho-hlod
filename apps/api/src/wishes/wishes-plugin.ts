import { createVerifyToken, generateId, HttpError } from '@eleansphere/be-core';
import type { ModelRouteOverrides, ProjectPlugin } from '@eleansphere/be-core';
import {
  bookEntity,
  FRIENDS_PATH,
  WISHES_PATH,
  wishEntity,
  wishReservationEntity,
} from '@kniho-hlod/domain';
import type { FriendWish, WishGift } from '@kniho-hlod/domain';
import type { Request } from 'express';
import type { Friendships } from '../friends/friendships';
import { asyncHandler } from '../http/async-handler';
import type { ModelClass, ModelRegistry } from '../models-registry';

const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const CONFLICT = 409;

type Row = InstanceType<ModelClass>;

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export interface WishesPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  friendships: Friendships;
  /** `routes.book.enrich`: a book from a wish answers like any other of the reader's books. */
  bookDetails: NonNullable<ModelRouteOverrides['enrich']>;
}

/**
 * Wish lists. A reader keeps their own through the CRUD routes at `/api/wishes`, and
 * `POST /api/wishes/:id/fulfil` puts a wish they got into the library and takes it off the list.
 * Friends who see the reader's library (`shareLibrary`) read the list at
 * `GET /api/friends/:userId/wishes` and promise to give a book with `PUT …/wishes/:wishId/gift`
 * (409 when another friend has; `DELETE` takes the promise back). The promise is the friends'
 * secret: the wish's owner never sees it, the other friends only that someone gives the book.
 */
export function createWishesPlugin({
  jwtSecret,
  registry,
  friendships,
  bookDetails,
}: WishesPluginOptions): ProjectPlugin {
  const wishes = () => registry.get(wishEntity.config.name);
  const gifts = () => registry.get(wishReservationEntity.config.name);
  const books = () => registry.get(bookEntity.config.name);

  /** The friend whose list the request is for, once the reader may see it. */
  async function sharedListOf(req: Request): Promise<string> {
    const friendId = String(req.params.userId);
    if (!(await friendships.sharesLibraryWith(friendId, String(req.user?.id)))) {
      throw new HttpError(NOT_FOUND, 'wish list not found');
    }
    return friendId;
  }

  async function friendWish(req: Request): Promise<Row> {
    const friendId = await sharedListOf(req);
    const wish = await wishes().findOne({
      where: { id: String(req.params.wishId), ownerId: friendId },
    });
    if (!wish) throw new HttpError(NOT_FOUND, 'wish not found');
    return wish;
  }

  /** Wishes as a friend (`readerId`) sees them: who gives each, and the reader's own copy. */
  async function toFriendWishes(rows: Row[], readerId: string): Promise<FriendWish[]> {
    if (rows.length === 0) return [];
    const isbns = [...new Set(rows.flatMap((wish) => (wish.get('isbn') as string | null) ?? []))];
    const [promised, copies] = await Promise.all([
      gifts().findAll({
        where: { wishId: rows.map((wish) => String(wish.get('id'))) },
        attributes: ['wishId', 'giverId'],
      }),
      isbns.length === 0
        ? Promise.resolve([])
        : books().findAll({
            where: { ownerId: readerId, isbn: isbns },
            attributes: ['id', 'isbn'],
            order: [['createdAt', 'ASC']],
          }),
    ]);
    const giverOf = new Map(
      promised.map((gift) => [String(gift.get('wishId')), String(gift.get('giverId'))])
    );
    const copyOf = new Map<string, string>();
    for (const book of copies) {
      const isbn = String(book.get('isbn'));
      if (!copyOf.has(isbn)) copyOf.set(isbn, String(book.get('id')));
    }
    return rows.map((wish) => {
      const id = String(wish.get('id'));
      const isbn = stringOrNull(wish.get('isbn'));
      const giverId = giverOf.get(id);
      const gift: WishGift =
        giverId === undefined ? null : giverId === readerId ? 'mine' : 'someoneElse';
      const copyId = isbn === null ? undefined : copyOf.get(isbn);
      return {
        id,
        title: String(wish.get('title')),
        author: stringOrNull(wish.get('author')),
        isbn,
        note: stringOrNull(wish.get('note')),
        addedAt: (wish.get('createdAt') as Date).toISOString(),
        gift,
        myCopy: copyId === undefined ? null : { id: copyId },
      };
    });
  }

  return {
    registerRoutes(app, sequelize) {
      const requireUser = createVerifyToken(jwtSecret);

      app.post(
        `${WISHES_PATH}/:id/fulfil`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const wish = await wishes().findOne({
            where: { id: String(req.params.id), ownerId: readerId },
          });
          if (!wish) throw new HttpError(NOT_FOUND, 'wish not found');
          const book = await sequelize.transaction(async (transaction) => {
            const created = await books().create(
              {
                id: generateId(bookEntity.config.prefix),
                ownerId: readerId,
                title: wish.get('title'),
                author: wish.get('author'),
                isbn: wish.get('isbn'),
              },
              { transaction }
            );
            await wish.destroy({ transaction });
            return created;
          });
          const [details] = await bookDetails([book]);
          res.status(CREATED).json(details);
        })
      );

      app.get(
        `${FRIENDS_PATH}/:userId/wishes`,
        requireUser,
        asyncHandler(async (req, res) => {
          const friendId = await sharedListOf(req);
          const rows = await wishes().findAll({
            where: { ownerId: friendId },
            order: [
              ['createdAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });
          res.json(await toFriendWishes(rows, String(req.user?.id)));
        })
      );

      app.put(
        `${FRIENDS_PATH}/:userId/wishes/:wishId/gift`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const wish = await friendWish(req);
          const wishId = String(wish.get('id'));
          const promised = await gifts().findOne({ where: { wishId } });
          if (promised && promised.get('giverId') !== readerId) {
            throw new HttpError(CONFLICT, 'another friend gives this book');
          }
          // Two friends at once: the unique index lets one in and answers the other 409.
          if (!promised) {
            await gifts().create({
              id: generateId(wishReservationEntity.config.prefix),
              wishId,
              giverId: readerId,
            });
          }
          const [answer] = await toFriendWishes([wish], readerId);
          res.json(answer);
        })
      );

      app.delete(
        `${FRIENDS_PATH}/:userId/wishes/:wishId/gift`,
        requireUser,
        asyncHandler(async (req, res) => {
          const wish = await friendWish(req);
          await gifts().destroy({
            where: { wishId: String(wish.get('id')), giverId: String(req.user?.id) },
          });
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
