import { createRequireRole, createVerifyToken, Op } from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import {
  ADMIN_ROLE,
  ADMIN_STATS_PATH,
  bookEntity,
  contactEntity,
  DEFAULT_FEEDBACK_STATUS,
  DEFAULT_TIMEZONE,
  feedbackEntity,
  loanEntity,
  NEW_USER_DAYS,
  readerToday,
  userEntity,
} from '@kniho-hlod/domain';
import type { AdminStats } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AdminStatsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  now?: () => Date;
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
          const newSince = new Date(now().getTime() - NEW_USER_DAYS * MILLISECONDS_PER_DAY);
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
          ] = await Promise.all([
            users.count(),
            users.count({ where: { createdAt: { [Op.gte]: newSince } } }),
            users.count({ where: { role: ADMIN_ROLE } }),
            users.count({ where: { emailReminders: true } }),
            registry.get(bookEntity.config.name).count(),
            registry.get(contactEntity.config.name).count(),
            loans.count({ where: { returnedAt: null } }),
            loans.count({ where: { returnedAt: null, dueAt: { [Op.lt]: today } } }),
            registry
              .get(feedbackEntity.config.name)
              .count({ where: { status: DEFAULT_FEEDBACK_STATUS } }),
          ]);

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
          };
          res.json(stats);
        })
      );
    },
  };
}
