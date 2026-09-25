import {
  createVerifyToken,
  generateId,
  HttpError,
  Op,
  ValidationError,
} from '@eleansphere/be-core';
import type { ModelRouteOverrides, ProjectPlugin } from '@eleansphere/be-core';
import {
  bookEntity,
  BOOKS_PATH,
  bookShelfEntity,
  MAX_SHELVES_PER_BOOK,
  shelfEntity,
} from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;

const NOT_FOUND = 404;
const SHELF_IDS_FIELD = 'shelfIds';

export interface BookShelvesPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  /** Shapes the answer like every other book response (`routes.book.enrich`). */
  bookDetails: Enrich;
}

/** The body's `shelfIds`, each once. */
function readShelfIds(body: unknown): string[] {
  const shelfIds =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)[SHELF_IDS_FIELD]
      : undefined;
  if (!Array.isArray(shelfIds) || !shelfIds.every((id) => typeof id === 'string')) {
    throw new ValidationError([{ path: SHELF_IDS_FIELD, code: 'type' }]);
  }
  const uniqueIds = [...new Set(shelfIds)];
  if (uniqueIds.length > MAX_SHELVES_PER_BOOK) {
    throw new ValidationError([
      { path: SHELF_IDS_FIELD, code: 'max', params: { max: MAX_SHELVES_PER_BOOK } },
    ]);
  }
  return uniqueIds;
}

/**
 * `PUT /api/books/:id/shelves` — puts a book on exactly the given shelves, in one transaction.
 * Another reader's book is a 404; a shelf that isn't the reader's is a `reference` issue.
 */
export function createBookShelvesPlugin({
  jwtSecret,
  registry,
  bookDetails,
}: BookShelvesPluginOptions): ProjectPlugin {
  async function assertOwnShelves(shelfIds: string[], readerId: string): Promise<void> {
    if (shelfIds.length === 0) return;
    const ownShelves = await registry
      .get(shelfEntity.config.name)
      .count({ where: { id: shelfIds, ownerId: readerId } });
    if (ownShelves !== shelfIds.length) {
      throw new ValidationError([{ path: SHELF_IDS_FIELD, code: 'reference' }]);
    }
  }

  return {
    registerRoutes(app, sequelize) {
      app.put(
        `${BOOKS_PATH}/:id/shelves`,
        createVerifyToken(jwtSecret),
        asyncHandler(async (req, res) => {
          const shelfIds = readShelfIds(req.body);
          const readerId = String(req.user?.id);
          const book = await registry
            .get(bookEntity.config.name)
            .findOne({ where: { id: req.params.id, ownerId: readerId } });
          if (!book) throw new HttpError(NOT_FOUND, 'book not found');
          await assertOwnShelves(shelfIds, readerId);

          const bookId = String(book.get('id'));
          const pairings = registry.get(bookShelfEntity.config.name);
          await sequelize.transaction(async (transaction) => {
            // `NOT IN ()` would match nothing in SQL: with no shelves left, every pairing goes.
            const leaving =
              shelfIds.length === 0 ? { bookId } : { bookId, shelfId: { [Op.notIn]: shelfIds } };
            await pairings.destroy({ where: leaving, transaction });
            const staying = await pairings.findAll({
              where: { bookId },
              attributes: ['shelfId'],
              transaction,
            });
            const current = new Set(staying.map((pairing) => String(pairing.get('shelfId'))));
            const joining = shelfIds.filter((shelfId) => !current.has(shelfId));
            await pairings.bulkCreate(
              joining.map((shelfId) => ({
                id: generateId(bookShelfEntity.config.prefix),
                bookId,
                shelfId,
                ownerId: readerId,
              })),
              { transaction }
            );
          });

          const [updated] = await bookDetails([book]);
          res.json(updated);
        })
      );
    },
  };
}
