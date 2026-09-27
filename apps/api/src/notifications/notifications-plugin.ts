import { createVerifyToken, generateId, ValidationError } from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import { bookEntity, NOTIFICATIONS_PATH, notificationEntity } from '@kniho-hlod/domain';
import type { NotificationFeed, NotificationItem, NotificationKind } from '@kniho-hlod/domain';
import type { People } from '../friends/people';
import type { Transaction } from '../friends/friendships';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

/** How many notifications the bell lists; older ones stay counted until read. */
export const NOTIFICATION_FEED_LENGTH = 30;
const NO_CONTENT = 204;
const IDS_FIELD = 'ids';

export interface NewNotification {
  recipientId: string;
  actorId: string;
  kind: NotificationKind;
  /** The book it is about, for loan requests. */
  bookId?: string;
}

/** Puts a notification in a reader's bell. */
export type Notify = (notification: NewNotification, transaction?: Transaction) => Promise<void>;

export function createNotifier(registry: ModelRegistry): Notify {
  return async (notification, transaction) => {
    await registry
      .get(notificationEntity.config.name)
      .create(
        { ...notification, id: generateId(notificationEntity.config.prefix) },
        { transaction }
      );
  };
}

function bookOf(bookId: string | null, titles: Map<string, string>): NotificationItem['book'] {
  const title = bookId ? titles.get(bookId) : undefined;
  return bookId && title !== undefined ? { id: bookId, title } : null;
}

/** The body's `ids` (strings), or `undefined` for "all of them". */
function readIds(body: unknown): string[] | undefined {
  const ids =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)[IDS_FIELD]
      : undefined;
  if (ids === undefined) return undefined;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw new ValidationError([{ path: IDS_FIELD, code: 'type' }]);
  }
  return ids;
}

export interface NotificationsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
}

/**
 * `GET /api/notifications` — the reader's latest notifications with who did it, and how many are
 * unread. `POST /api/notifications/read` marks the given ones (or all) read.
 */
export function createNotificationsPlugin({
  jwtSecret,
  registry,
  people,
}: NotificationsPluginOptions): ProjectPlugin {
  const notifications = () => registry.get(notificationEntity.config.name);

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);

      app.get(
        NOTIFICATIONS_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const recipientId = String(req.user?.id);
          const [latest, unread] = await Promise.all([
            notifications().findAll({
              where: { recipientId },
              order: [['createdAt', 'DESC']],
              limit: NOTIFICATION_FEED_LENGTH,
            }),
            notifications().count({ where: { recipientId, readAt: null } }),
          ]);
          const actors = await people.summaries(
            latest.map((notification) => String(notification.get('actorId')))
          );
          const bookIds = [
            ...new Set(latest.flatMap((notification) => notification.get('bookId') ?? [])),
          ] as string[];
          const books =
            bookIds.length === 0
              ? []
              : await registry
                  .get(bookEntity.config.name)
                  .findAll({ where: { id: bookIds }, attributes: ['id', 'title'] });
          const titles = new Map(
            books.map((book) => [String(book.get('id')), String(book.get('title'))])
          );
          const data: NotificationItem[] = latest.flatMap((notification) => {
            const actor = actors.get(String(notification.get('actorId')));
            if (!actor) return [];
            return [
              {
                id: String(notification.get('id')),
                kind: notification.get('kind') as NotificationKind,
                actor,
                book: bookOf(notification.get('bookId') as string | null, titles),
                createdAt: (notification.get('createdAt') as Date).toISOString(),
                readAt: (notification.get('readAt') as Date | null)?.toISOString() ?? null,
              },
            ];
          });
          const feed: NotificationFeed = { data, unread };
          res.json(feed);
        })
      );

      app.post(
        `${NOTIFICATIONS_PATH}/read`,
        requireUser,
        asyncHandler(async (req, res) => {
          const ids = readIds(req.body);
          const recipientId = String(req.user?.id);
          await notifications().update(
            { readAt: new Date() },
            { where: { recipientId, readAt: null, ...(ids && { id: ids }) } }
          );
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
