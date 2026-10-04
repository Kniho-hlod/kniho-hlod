import {
  createRequireRole,
  createVerifyToken,
  Op,
  REFRESH_TOKEN_MODEL_NAME,
} from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import {
  ACCEPTED_FRIENDSHIP,
  ACTIVATED_BOOK_COUNT,
  ACTIVE_USER_DAYS,
  ADMIN_ROLE,
  ADMIN_STATS_PATH,
  bookEntity,
  contactEntity,
  DEFAULT_FEEDBACK_STATUS,
  DEFAULT_TIMEZONE,
  feedbackEntity,
  friendshipEntity,
  loanEntity,
  loanRequestEntity,
  NEW_USER_DAYS,
  readerToday,
  userEntity,
} from '@kniho-hlod/domain';
import type { AdminStats } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
/** The sample library's books, contacts and loans are only for show: the stats leave them out. */
const REAL_ROWS = { isSample: false };

export interface AdminStatsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  now?: () => Date;
}

/** The ids of the readers who signed in or renewed their session since then. */
async function activeUserIds(registry: ModelRegistry, since: Date): Promise<string[]> {
  // Every sign-in issues a refresh token, and so does every renewal: the access token lasts
  // minutes, so a reader who opens the app again gets a new one. They are revoked, never deleted.
  const rows = (await registry.get(REFRESH_TOKEN_MODEL_NAME).findAll({
    attributes: ['userId'],
    where: { createdAt: { [Op.gte]: since } },
    group: ['userId'],
    raw: true,
  })) as unknown as { userId: string }[];
  return rows.map(({ userId }) => String(userId));
}

/** How many readers have at least `ACTIVATED_BOOK_COUNT` books of their own. */
async function activatedUserCount(registry: ModelRegistry): Promise<number> {
  const counts = (await registry.get(bookEntity.config.name).count({
    where: REAL_ROWS,
    group: ['ownerId'],
  })) as unknown as { ownerId: string; count: number | string }[];
  return counts.filter(({ count }) => Number(count) >= ACTIVATED_BOOK_COUNT).length;
}

/** `GET /api/admin/stats` — the whole app in numbers, for administrators. */
export function createAdminStatsPlugin({
  jwtSecret,
  registry,
  now = () => new Date(),
}: AdminStatsPluginOptions): ProjectPlugin {
  return {
    registerRoutes(app) {
      app.get(
        ADMIN_STATS_PATH,
        createVerifyToken(jwtSecret),
        createRequireRole(ADMIN_ROLE),
        asyncHandler(async (_req, res) => {
          const users = registry.get(userEntity.config.name);
          const loans = registry.get(loanEntity.config.name);
          const daysAgo = (days: number) => new Date(now().getTime() - days * MILLISECONDS_PER_DAY);
          const newSince = daysAgo(NEW_USER_DAYS);
          const activeSince = daysAgo(ACTIVE_USER_DAYS);
          const today = readerToday(DEFAULT_TIMEZONE, now());
          const [
            userCount,
            newUsers,
            admins,
            remindersOn,
            books,
            contacts,
            lent,
            overdue,
            newFeedback,
            activeIds,
            activatedUsers,
            inviters,
            friendships,
            newLoans,
            loanRequests,
          ] = await Promise.all([
            users.count(),
            users.count({ where: { createdAt: { [Op.gte]: newSince } } }),
            users.count({ where: { role: ADMIN_ROLE } }),
            users.count({ where: { emailReminders: true } }),
            registry.get(bookEntity.config.name).count({ where: REAL_ROWS }),
            registry.get(contactEntity.config.name).count({ where: REAL_ROWS }),
            loans.count({ where: { ...REAL_ROWS, returnedAt: null } }),
            loans.count({ where: { ...REAL_ROWS, returnedAt: null, dueAt: { [Op.lt]: today } } }),
            registry
              .get(feedbackEntity.config.name)
              .count({ where: { status: DEFAULT_FEEDBACK_STATUS } }),
            activeUserIds(registry, activeSince),
            activatedUserCount(registry),
            users.count({ where: { inviteCode: { [Op.ne]: null } } }),
            registry
              .get(friendshipEntity.config.name)
              .count({ where: { status: ACCEPTED_FRIENDSHIP } }),
            loans.count({ where: { ...REAL_ROWS, createdAt: { [Op.gte]: newSince } } }),
            registry.get(loanRequestEntity.config.name).count(),
          ]);
          const returningUsers =
            activeIds.length === 0
              ? 0
              : await users.count({
                  where: { id: activeIds, createdAt: { [Op.lt]: activeSince } },
                });

          const stats: AdminStats = {
            users: userCount,
            newUsers,
            admins,
            remindersOn,
            books,
            contacts,
            lent,
            overdue,
            newFeedback,
            activeUsers: activeIds.length,
            returningUsers,
            activatedUsers,
            inviters,
            friendships,
            newLoans,
            loanRequests,
          };
          res.json(stats);
        })
      );
    },
  };
}
