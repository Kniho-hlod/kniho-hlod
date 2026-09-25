import { Op } from '@eleansphere/be-core';
import type { CustomFilterResolver, ModelRouteOverrides } from '@eleansphere/be-core';
import { bookShelfEntity, shelfEntity } from '@kniho-hlod/domain';
import type { ShelfSummary } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type Row = Record<string, unknown>;

/** The shelves' own order (`SHELF_ORDER`), as Sequelize sorts it. */
const SHELF_ORDER_COLUMNS: [string, string][] = [
  ['sortOrder', 'ASC'],
  ['name', 'ASC'],
];

export interface BookShelves {
  /** Adds `shelves` to each book (already plain objects: another enrich step ran first). */
  attachToBooks: (books: Row[]) => Promise<Row[]>;
  /** `routes.shelf.enrich`: each shelf carries `bookCount`, the books on it. */
  countBooks: Enrich;
  /** `routes.book.customFilters.shelf`: the books on the reader's shelf with that id. */
  shelfFilter: CustomFilterResolver;
}

export function createBookShelves(registry: ModelRegistry): BookShelves {
  const pairings = () => registry.get(bookShelfEntity.config.name);

  async function findShelfSummaries(shelfIds: string[]): Promise<ShelfSummary[]> {
    if (shelfIds.length === 0) return [];
    const shelves = await registry.get(shelfEntity.config.name).findAll({
      where: { id: shelfIds },
      attributes: ['id', 'name', 'color'],
      order: SHELF_ORDER_COLUMNS,
    });
    return shelves.map((shelf) => shelf.toJSON() as ShelfSummary);
  }

  return {
    async attachToBooks(books) {
      if (books.length === 0) return books;
      const onShelves = await pairings().findAll({
        where: { bookId: books.map((book) => String(book.id)) },
        attributes: ['bookId', 'shelfId'],
      });
      const shelfIdsByBook = new Map<string, Set<string>>();
      for (const pairing of onShelves) {
        const bookId = String(pairing.get('bookId'));
        const shelfIds = shelfIdsByBook.get(bookId) ?? new Set<string>();
        shelfIds.add(String(pairing.get('shelfId')));
        shelfIdsByBook.set(bookId, shelfIds);
      }
      const shelves = await findShelfSummaries([
        ...new Set(onShelves.map((pairing) => String(pairing.get('shelfId')))),
      ]);
      return books.map((book) => {
        const shelfIds = shelfIdsByBook.get(String(book.id));
        return { ...book, shelves: shelves.filter((shelf) => shelfIds?.has(shelf.id)) };
      });
    },

    async countBooks(shelves) {
      const rows = shelves.map((shelf) => shelf.toJSON() as Row);
      if (rows.length === 0) return [];
      const onShelves = await pairings().findAll({
        where: { shelfId: rows.map((row) => String(row.id)) },
        attributes: ['shelfId'],
      });
      const counts = new Map<string, number>();
      for (const pairing of onShelves) {
        const shelfId = String(pairing.get('shelfId'));
        counts.set(shelfId, (counts.get(shelfId) ?? 0) + 1);
      }
      return rows.map((row) => ({ ...row, bookCount: counts.get(String(row.id)) ?? 0 }));
    },

    async shelfFilter(shelfId, req) {
      const onShelf = await pairings().findAll({
        where: { shelfId: String(shelfId), ownerId: req.user?.id },
        attributes: ['bookId'],
      });
      // `IN ()` of an empty or foreign shelf matches no book, which is the right answer.
      return { id: { [Op.in]: onShelf.map((pairing) => String(pairing.get('bookId'))) } };
    },
  };
}
