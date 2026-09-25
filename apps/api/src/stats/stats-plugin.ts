import { createVerifyToken } from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import { bookEntity, contactEntity, loanEntity, loanStatus, STATS_PATH } from '@kniho-hlod/domain';
import type { LibraryStats, LoanStatus, ReadingStatus } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import type { ReaderToday } from '../loans/reader-today';

const READING: ReadingStatus = 'reading';

export interface StatsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  readerToday: ReaderToday;
}

function countStatus(statuses: LoanStatus[], wanted: LoanStatus): number {
  return statuses.filter((status) => status === wanted).length;
}

/** `GET /api/stats` — the signed-in reader's library in numbers, for the dashboard. */
export function createStatsPlugin({
  jwtSecret,
  registry,
  readerToday,
}: StatsPluginOptions): ProjectPlugin {
  return {
    registerRoutes(app) {
      app.get(
        STATS_PATH,
        createVerifyToken(jwtSecret),
        asyncHandler(async (req, res) => {
          const ownerId = String(req.user?.id);
          const books = registry.get(bookEntity.config.name);
          const [bookCount, reading, contacts, activeLoans, today] = await Promise.all([
            books.count({ where: { ownerId } }),
            books.count({ where: { ownerId, readingStatus: READING } }),
            registry.get(contactEntity.config.name).count({ where: { ownerId } }),
            registry
              .get(loanEntity.config.name)
              .findAll({ where: { ownerId, returnedAt: null }, attributes: ['dueAt'] }),
            readerToday(ownerId),
          ]);
          const statuses = activeLoans.map((loan) =>
            loanStatus({ dueAt: loan.get('dueAt') as string | null }, today)
          );

          const stats: LibraryStats = {
            books: bookCount,
            reading,
            contacts,
            lent: activeLoans.length,
            overdue: countStatus(statuses, 'overdue'),
            dueSoon: countStatus(statuses, 'dueSoon'),
          };
          res.json(stats);
        })
      );
    },
  };
}
