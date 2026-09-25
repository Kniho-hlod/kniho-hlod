import { attachFiles, FILE_MODEL_NAME, removeStoredFile } from '@eleansphere/be-core';
import type { ModelRouteOverrides, StorageAdapter } from '@eleansphere/be-core';
import { FILE_REF_TYPES, FILE_ROLES } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type BeforeDelete = NonNullable<ModelRouteOverrides['beforeDelete']>;

/** Where `attachFiles` puts a book's cover list before it is reduced to the single `cover`. */
const COVERS_KEY = 'covers';

export interface BookCovers {
  /** `routes.book.enrich`: every book the API returns carries `cover` — its file, or `null`. */
  attach: Enrich;
  /** `routes.book.beforeDelete`: a deleted book takes its cover with it. */
  removeWithBook: BeforeDelete;
}

export function createBookCovers(registry: ModelRegistry, storage: StorageAdapter): BookCovers {
  return {
    async attach(books) {
      const rows = books.map((book) => ({
        id: String(book.get('id')),
        toJSON: () => book.toJSON(),
      }));
      const withCovers = await attachFiles(
        registry.get(FILE_MODEL_NAME),
        storage,
        FILE_REF_TYPES.book,
        rows,
        { role: FILE_ROLES.cover, as: COVERS_KEY }
      );
      return withCovers.map(({ [COVERS_KEY]: covers, ...book }) => ({
        ...book,
        cover: Array.isArray(covers) ? (covers[0] ?? null) : null,
      }));
    },

    async removeWithBook(book) {
      const covers = await registry.get(FILE_MODEL_NAME).findAll({
        where: { refType: FILE_REF_TYPES.book, refId: book.get('id'), role: FILE_ROLES.cover },
      });
      await Promise.all(covers.map((cover) => removeStoredFile(cover, storage)));
    },
  };
}
