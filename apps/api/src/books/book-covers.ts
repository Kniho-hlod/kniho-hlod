import {
  attachFiles,
  FILE_ID_PREFIX,
  FILE_MODEL_NAME,
  generateId,
  removeStoredFile,
} from '@eleansphere/be-core';
import type { FileVisibility, ModelRouteOverrides, StorageAdapter } from '@eleansphere/be-core';
import { FILE_REF_TYPES, FILE_ROLES } from '@kniho-hlod/domain';
import type { Readable } from 'node:stream';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type BeforeDelete = NonNullable<ModelRouteOverrides['beforeDelete']>;

/** Where `attachFiles` puts a book's cover list before it is reduced to the single `cover`. */
const COVERS_KEY = 'covers';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/** `.webp` from `book/file_ab12.webp`; empty for a key without an extension. */
function extensionOf(storageKey: string): string {
  const name = storageKey.slice(storageKey.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

export interface BookCovers {
  /** `routes.book.enrich`: every book the API returns carries `cover` — its file, or `null`. */
  attach: Enrich;
  /** `routes.book.beforeDelete`: a deleted book takes its cover with it. */
  removeWithBook: BeforeDelete;
  /**
   * Gives a book a copy of another book's cover, owned by `ownerId` — a file of its own, since a
   * deleted book takes its cover along. Nothing happens when the source has no cover.
   */
  copy(fromBookId: string, toBookId: string, ownerId: string): Promise<void>;
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

    async copy(fromBookId, toBookId, ownerId) {
      const files = registry.get(FILE_MODEL_NAME);
      const source = await files.findOne({
        where: { refType: FILE_REF_TYPES.book, refId: fromBookId, role: FILE_ROLES.cover },
        order: [['createdAt', 'DESC']],
      });
      if (!source) return;
      const id = generateId(FILE_ID_PREFIX);
      // The file service's folder for uploads attached to a book: its `refType`.
      const storageKey = `${FILE_REF_TYPES.book}/${id}${extensionOf(String(source.get('storageKey')))}`;
      const bytes = await readAll(await storage.getStream(String(source.get('storageKey'))));
      const mimeType = String(source.get('mimeType'));
      const visibility = source.get('visibility') as FileVisibility;
      await storage.put(storageKey, bytes, {
        contentType: mimeType,
        contentLength: bytes.length,
        visibility,
      });
      await files.create({
        id,
        storageKey,
        originalName: source.get('originalName'),
        mimeType,
        size: bytes.length,
        checksum: source.get('checksum'),
        visibility,
        ownerId,
        refType: FILE_REF_TYPES.book,
        refId: toBookId,
        role: FILE_ROLES.cover,
      });
    },
  };
}
