import { createVerifyToken, generateId, HttpError } from '@eleansphere/be-core';
import type { ProjectPlugin, Sequelize } from '@eleansphere/be-core';
import {
  bookEntity,
  bookShelfEntity,
  fitImportedBook,
  importKeys,
  LIBRARY_IMPORT_MAX_BOOKS,
  LIBRARY_IMPORT_PATH,
  plainWords,
  shelfEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { ImportedBook, LibraryImportResult } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

/** Sequelize's transaction, which be-core doesn't re-export: what `sequelize.transaction()` opens. */
type Transaction = Awaited<ReturnType<Sequelize['transaction']>>;

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const PAYLOAD_TOO_LARGE = 413;
const MILLISECONDS_PER_SECOND = 1000;

export interface LibraryImportPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  now?: () => Date;
}

/**
 * `POST /api/library/import` — books from another app's export (read in the browser) into the
 * reader's library, up to `LIBRARY_IMPORT_MAX_BOOKS` at a time, in one transaction. Books the
 * reader has already are left out; missing shelves are made.
 */
export function createLibraryImportPlugin({
  jwtSecret,
  registry,
  now = () => new Date(),
}: LibraryImportPluginOptions): ProjectPlugin {
  const model = (entity: typeof bookEntity | typeof shelfEntity | typeof bookShelfEntity) =>
    registry.get(entity.config.name);

  async function takenKeys(ownerId: string, transaction: Transaction): Promise<Set<string>> {
    const books = await model(bookEntity).findAll({
      where: { ownerId },
      attributes: ['title', 'author', 'isbn'],
      transaction,
    });
    return new Set(
      books.flatMap((book) =>
        importKeys({
          title: String(book.get('title')),
          author: book.get('author') as string | null,
          isbn: book.get('isbn') as string | null,
        })
      )
    );
  }

  /** The reader's shelves by name, letter case and accents aside, the missing ones made. */
  async function shelfIdsByName(
    ownerId: string,
    names: string[],
    transaction: Transaction
  ): Promise<{ ids: Map<string, string>; created: number }> {
    const shelves = await model(shelfEntity).findAll({
      where: { ownerId },
      attributes: ['id', 'name', 'sortOrder'],
      transaction,
    });
    const ids = new Map(
      shelves.map((shelf) => [plainWords(String(shelf.get('name'))), String(shelf.get('id'))])
    );
    let sortOrder = Math.max(-1, ...shelves.map((shelf) => Number(shelf.get('sortOrder')))) + 1;
    const rows = [];
    for (const name of names) {
      const key = plainWords(name);
      if (ids.has(key)) continue;
      const id = generateId(shelfEntity.config.prefix);
      ids.set(key, id);
      rows.push({ id, ownerId, name, sortOrder });
      sortOrder += 1;
    }
    await model(shelfEntity).bulkCreate(rows, { transaction });
    return { ids, created: rows.length };
  }

  async function importBooks(
    ownerId: string,
    books: ImportedBook[],
    transaction: Transaction
  ): Promise<LibraryImportResult> {
    // Locking the reader serializes two imports at once: the second sees the first one's books.
    const reader = await registry
      .get(userEntity.config.name)
      .findByPk(ownerId, { attributes: ['id'], transaction, lock: true });
    if (!reader) throw new HttpError(NOT_FOUND, 'reader not found');

    const taken = await takenKeys(ownerId, transaction);
    const fresh = books.filter((book) => {
      const keys = importKeys(book);
      if (keys.some((key) => taken.has(key))) return false;
      for (const key of keys) taken.add(key);
      return true;
    });
    const shelves = await shelfIdsByName(
      ownerId,
      fresh.flatMap((book) => book.shelves),
      transaction
    );

    // A second apart, newest last, so the library lists them in the table's order.
    const startedAt = now().getTime() - fresh.length * MILLISECONDS_PER_SECOND;
    const bookRows = fresh.map(({ shelves: _shelves, ...book }, index) => ({
      ...book,
      id: generateId(bookEntity.config.prefix),
      ownerId,
      createdAt: new Date(startedAt + index * MILLISECONDS_PER_SECOND),
    }));
    const pairings = fresh.flatMap((book, index) =>
      book.shelves.map((name) => ({
        id: generateId(bookShelfEntity.config.prefix),
        ownerId,
        bookId: bookRows[index]!.id,
        shelfId: shelves.ids.get(plainWords(name))!,
      }))
    );
    await model(bookEntity).bulkCreate(bookRows, { transaction });
    await model(bookShelfEntity).bulkCreate(pairings, { transaction });
    return {
      created: fresh.length,
      duplicates: books.length - fresh.length,
      shelvesCreated: shelves.created,
    };
  }

  return {
    registerRoutes(app, sequelize) {
      app.post(
        LIBRARY_IMPORT_PATH,
        createVerifyToken(jwtSecret),
        asyncHandler(async (req, res) => {
          const { books } = (req.body ?? {}) as { books?: unknown };
          if (!Array.isArray(books)) throw new HttpError(BAD_REQUEST, 'books must be a list');
          if (books.length > LIBRARY_IMPORT_MAX_BOOKS) {
            throw new HttpError(
              PAYLOAD_TOO_LARGE,
              `at most ${LIBRARY_IMPORT_MAX_BOOKS} books at a time`
            );
          }
          const fitted = books
            .map(fitImportedBook)
            .filter((book): book is ImportedBook => book !== null);
          const ownerId = String(req.user?.id);
          const result = await sequelize.transaction((transaction) =>
            importBooks(ownerId, fitted, transaction)
          );
          res.json(result);
        })
      );
    },
  };
}
