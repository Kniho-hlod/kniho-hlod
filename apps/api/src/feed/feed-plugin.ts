import { createVerifyToken, Op, parseListQuery, Sequelize } from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import {
  bookEntity,
  bookFields,
  DEFAULT_TIMEZONE,
  FEED_PATH,
  FEED_QUERY,
  FRIEND_COPIES_PATH,
  toIsbn13,
} from '@kniho-hlod/domain';
import type {
  FeedItem,
  FeedItemKind,
  FriendCopy,
  PersonSummary,
  ReadingStatus,
} from '@kniho-hlod/domain';
import type { FileDto, PaginatedResponse } from '@eleansphere/entity-core';
import type { BookCovers } from '../books/book-covers';
import type { CommentCounts } from '../comments/comment-counts';
import type { FriendLibrary } from '../friends/friend-library';
import type { Friendships } from '../friends/friendships';
import type { People } from '../friends/people';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

/** The reading statuses a friend's book shows in the feed with, and as what. */
const FEED_KINDS: Partial<Record<ReadingStatus, FeedItemKind>> = {
  reading: 'started',
  read: 'finished',
  want: 'wantsToRead',
};
const FEED_DATE = 'feedDate';

/**
 * The day a book is in the feed on: when it was finished or started, or when it was put on the
 * wish list. Books marked without a date count from their last change. Timestamps are read as
 * days in the app's time zone — a constant, never a reader's input.
 */
const dayOf = (column: string) => `("${column}" AT TIME ZONE '${DEFAULT_TIMEZONE}')::date`;
const FEED_DATE_SQL = Sequelize.literal(
  `CASE "readingStatus" WHEN 'read' THEN COALESCE("finishedAt", ${dayOf('updatedAt')}) ` +
    `WHEN 'reading' THEN COALESCE("startedAt", ${dayOf('updatedAt')}) ` +
    `ELSE ${dayOf('createdAt')} END`
);

type Plain = Record<string, unknown>;

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** A DATE column comes back as `YYYY-MM-DD`, or as a `Date` at midnight UTC from some drivers. */
function toDay(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export interface FeedPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  friendLibrary: FriendLibrary;
  bookCovers: BookCovers;
  commentCounts: CommentCounts;
}

/**
 * What friends read. `GET /api/feed` lists the books the reader's friends are reading, have
 * finished or want to read, newest first, a page at a time. `GET /api/friend-copies?isbn=` lists
 * friends' copies of one book, with their ratings and reviews. Both see only what a friend's
 * shared library shows — hiding a book or turning sharing off takes it out at once.
 */
export function createFeedPlugin({
  jwtSecret,
  registry,
  people,
  friendships,
  friendLibrary,
  bookCovers,
  commentCounts,
}: FeedPluginOptions): ProjectPlugin {
  const books = () => registry.get(bookEntity.config.name);

  /** The reader's friends who share their library. */
  async function sharingFriendsOf(readerId: string): Promise<string[]> {
    const friendIds = (await friendships.friendsOf(readerId)).map(({ friendId }) => friendId);
    return [...(await friendships.sharingAmong(friendIds))];
  }

  /** Every shared, unhidden, non-sample book of these friends. */
  const sharedBooksOf = (friendIds: string[]) =>
    friendIds.map((friendId) => friendLibrary.sharedBooks(friendId));

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);

      app.get(
        FEED_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const list = parseListQuery(req.query, FEED_QUERY, bookFields);
          const friendIds = await sharingFriendsOf(String(req.user?.id));
          if (friendIds.length === 0) {
            const empty: PaginatedResponse<FeedItem> = {
              data: [],
              total: 0,
              page: list.page,
              limit: list.limit,
            };
            res.json(empty);
            return;
          }
          const { rows, count } = await books().findAndCountAll({
            where: {
              [Op.or]: sharedBooksOf(friendIds),
              readingStatus: Object.keys(FEED_KINDS),
            },
            attributes: [
              'id',
              'ownerId',
              'title',
              'author',
              'readingStatus',
              'rating',
              'review',
              [FEED_DATE_SQL, FEED_DATE],
            ],
            order: [
              [FEED_DATE_SQL, 'DESC'],
              ['updatedAt', 'DESC'],
              ['id', 'DESC'],
            ],
            limit: list.limit,
            offset: list.offset,
          });
          const withCovers = await bookCovers.attach(rows);
          const [friends, comments] = await Promise.all([
            people.summaries(withCovers.map((book) => String(book.ownerId))),
            commentCounts(withCovers.map((book) => String(book.id))),
          ]);
          const page: PaginatedResponse<FeedItem> = {
            data: withCovers.flatMap((book: Plain): FeedItem[] => {
              const friend = friends.get(String(book.ownerId));
              const kind = FEED_KINDS[book.readingStatus as ReadingStatus];
              if (!friend || !kind) return [];
              const id = String(book.id);
              return [
                {
                  id,
                  kind,
                  on: toDay(book[FEED_DATE]),
                  friend,
                  book: {
                    id,
                    title: String(book.title),
                    author: stringOrNull(book.author),
                    cover: (book.cover as FileDto | null) ?? null,
                    rating: numberOrNull(book.rating),
                    review: stringOrNull(book.review),
                  },
                  commentCount: comments.get(id) ?? 0,
                },
              ];
            }),
            total: count,
            page: list.page,
            limit: list.limit,
          };
          res.json(page);
        })
      );

      app.get(
        FRIEND_COPIES_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const isbn = toIsbn13(String(req.query.isbn ?? ''));
          const friendIds = isbn ? await sharingFriendsOf(String(req.user?.id)) : [];
          if (!isbn || friendIds.length === 0) {
            res.json([]);
            return;
          }
          const copies = await books().findAll({
            where: { [Op.or]: sharedBooksOf(friendIds), isbn },
            attributes: ['id', 'ownerId', 'readingStatus', 'rating', 'review'],
            order: [['updatedAt', 'DESC']],
          });
          const [friends, comments] = await Promise.all([
            people.summaries(copies.map((book) => String(book.get('ownerId')))),
            commentCounts(copies.map((book) => String(book.get('id')))),
          ]);
          const byFriend = new Map<string, FriendCopy>();
          for (const book of copies) {
            const friend: PersonSummary | undefined = friends.get(String(book.get('ownerId')));
            // A friend with two copies shows once, with the one they touched last.
            if (!friend || byFriend.has(friend.id)) continue;
            const bookId = String(book.get('id'));
            byFriend.set(friend.id, {
              friend,
              bookId,
              readingStatus: book.get('readingStatus') as ReadingStatus,
              rating: numberOrNull(book.get('rating')),
              review: stringOrNull(book.get('review')),
              commentCount: comments.get(bookId) ?? 0,
            });
          }
          res.json([...byFriend.values()]);
        })
      );
    },
  };
}
