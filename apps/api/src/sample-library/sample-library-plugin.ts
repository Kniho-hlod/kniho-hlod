import { createVerifyToken, generateId, HttpError, Op } from '@eleansphere/be-core';
import type { ProjectPlugin, Sequelize, WhereOptions } from '@eleansphere/be-core';
import {
  bookEntity,
  bookShelfEntity,
  contactEntity,
  DEFAULT_LOCALE,
  LOCALES,
  loanEntity,
  readerToday,
  SAMPLE_LIBRARY_PATH,
  shelfEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { Locale, SampleLibraryState } from '@kniho-hlod/domain';
import type { BookCovers } from '../books/book-covers';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import { buildSampleLibrary } from './build-sample-library';
import { SAMPLE_LIBRARIES } from './sample-library-content';

/** Sequelize's transaction, which be-core doesn't re-export: what `sequelize.transaction()` opens. */
type Transaction = Awaited<ReturnType<Sequelize['transaction']>>;

const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const CONFLICT = 409;

/** Everything a reader's library holds; a loan always comes with a book and a contact. */
const LIBRARY_ENTITIES = [bookEntity, shelfEntity, contactEntity, loanEntity];
const SAMPLE_ROWS = { isSample: true };

export interface SampleLibraryPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  /** A removed sample book takes along a cover the reader may have given it. */
  bookCovers: BookCovers;
  /** The clock the sample dates count from, for tests. */
  now?: () => Date;
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

/**
 * `/api/sample-library` — the onboarding tour's sample library. `GET` tells whether it can go in
 * or is there to remove, `POST` puts it into an empty library (409 otherwise), `DELETE` removes
 * every sample row along with the loans of sample books and contacts.
 */
export function createSampleLibraryPlugin({
  jwtSecret,
  registry,
  bookCovers,
  now = () => new Date(),
}: SampleLibraryPluginOptions): ProjectPlugin {
  const model = (entity: (typeof LIBRARY_ENTITIES)[number] | typeof bookShelfEntity) =>
    registry.get(entity.config.name);

  /** One query after another: a transaction's connection runs one at a time. */
  async function countRows(
    ownerId: string,
    where: WhereOptions,
    transaction?: Transaction
  ): Promise<number> {
    let total = 0;
    for (const entity of LIBRARY_ENTITIES) {
      total += await model(entity).count({ where: { ...where, ownerId }, transaction });
    }
    return total;
  }

  async function stateOf(ownerId: string): Promise<SampleLibraryState> {
    const [samples, rows] = await Promise.all([
      countRows(ownerId, SAMPLE_ROWS),
      countRows(ownerId, {}),
    ]);
    return { present: samples > 0, canFill: rows === 0 };
  }

  async function fill(ownerId: string, transaction: Transaction): Promise<void> {
    // Locking the reader serializes two fills at once: the second finds the library full.
    const reader = await registry
      .get(userEntity.config.name)
      .findByPk(ownerId, { attributes: ['locale', 'timezone'], transaction, lock: true });
    if (!reader) throw new HttpError(NOT_FOUND, 'reader not found');
    if ((await countRows(ownerId, {}, transaction)) > 0) {
      throw new HttpError(CONFLICT, 'the sample library only goes into an empty library');
    }

    const rows = buildSampleLibrary(SAMPLE_LIBRARIES[toLocale(reader.get('locale'))], {
      ownerId,
      today: readerToday(reader.get('timezone'), now()),
      now: now(),
      newId: generateId,
    });
    await model(shelfEntity).bulkCreate(rows.shelves, { transaction });
    await model(bookEntity).bulkCreate(rows.books, { transaction });
    await model(bookShelfEntity).bulkCreate(rows.bookShelves, { transaction });
    await model(contactEntity).bulkCreate(rows.contacts, { transaction });
    await model(loanEntity).bulkCreate(rows.loans, { transaction });
  }

  /** Loans go first: they keep books and contacts from being deleted. */
  async function remove(ownerId: string, transaction: Transaction) {
    const owned = { ...SAMPLE_ROWS, ownerId };
    const books = await model(bookEntity).findAll({
      where: owned,
      attributes: ['id'],
      transaction,
    });
    const contacts = await model(contactEntity).findAll({
      where: owned,
      attributes: ['id'],
      transaction,
    });
    const bookIds = books.map((book) => String(book.get('id')));
    const contactIds = contacts.map((contact) => String(contact.get('id')));
    const loansOfSamples: WhereOptions[] = [
      SAMPLE_ROWS,
      ...(bookIds.length > 0 ? [{ bookId: bookIds }] : []),
      ...(contactIds.length > 0 ? [{ contactId: contactIds }] : []),
    ];

    await model(loanEntity).destroy({ where: { ownerId, [Op.or]: loansOfSamples }, transaction });
    // Pairings with shelves go with their book or shelf (`CASCADE`).
    for (const entity of [bookEntity, shelfEntity, contactEntity]) {
      await model(entity).destroy({ where: owned, transaction });
    }
    return books;
  }

  return {
    registerRoutes(app, sequelize) {
      const requireUser = createVerifyToken(jwtSecret);

      app.get(
        SAMPLE_LIBRARY_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          res.json(await stateOf(String(req.user?.id)));
        })
      );

      app.post(
        SAMPLE_LIBRARY_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const ownerId = String(req.user?.id);
          await sequelize.transaction((transaction) => fill(ownerId, transaction));
          res.status(CREATED).json(await stateOf(ownerId));
        })
      );

      app.delete(
        SAMPLE_LIBRARY_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const ownerId = String(req.user?.id);
          const removedBooks = await sequelize.transaction((transaction) =>
            remove(ownerId, transaction)
          );
          // Only once the rows are surely gone: a failed removal keeps its covers.
          await Promise.all(removedBooks.map((book) => bookCovers.removeWithBook(book, req)));
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
