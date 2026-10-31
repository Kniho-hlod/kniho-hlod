import path from 'node:path';
import { FILE_MODEL_NAME, fileStorageName } from '@eleansphere/be-core';
import type { CoreInstance, StorageAdapter } from '@eleansphere/be-core';
import { FILE_REF_TYPES, FILE_ROLES } from '@kniho-hlod/domain';

const PRIVATE = 'private';

/** The stored bytes, or `null` when the object is gone or can't be read. */
async function readAll(storage: StorageAdapter, key: string): Promise<Buffer | null> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of await storage.getStream(key)) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.warn(`Could not read ${key}: ${String(err)}`);
    return null;
  }
}

/**
 * Report screenshots used to be stored public, under a key anyone could see in the file list.
 * Moves each one still public to a new, unguessable key and makes it private, so the old address
 * stops working. Runs on startup; once nothing is left to move it is one query.
 * Returns how many it moved.
 */
export async function privatizeReportScreenshots(
  models: CoreInstance['models'],
  storage: StorageAdapter
): Promise<number> {
  const File = models[FILE_MODEL_NAME];
  if (!File) return 0;
  const screenshots = await File.findAll({
    where: { refType: FILE_REF_TYPES.feedback, role: FILE_ROLES.screenshot, visibility: 'public' },
  });
  let moved = 0;
  for (const screenshot of screenshots) {
    const id = String(screenshot.get('id'));
    const oldKey = String(screenshot.get('storageKey'));
    const newKey = path.posix.join(
      path.posix.dirname(oldKey),
      `${fileStorageName(id, PRIVATE)}${path.posix.extname(oldKey)}`
    );
    const bytes = await readAll(storage, oldKey);
    if (!bytes) {
      // Gone from the bucket: nobody can download it from the old key either.
      await screenshot.update({ visibility: PRIVATE });
      continue;
    }
    await storage.put(newKey, bytes, {
      contentType: String(screenshot.get('mimeType')),
      contentLength: bytes.length,
      visibility: PRIVATE,
    });
    await screenshot.update({ storageKey: newKey, visibility: PRIVATE });
    await storage.delete(oldKey);
    moved += 1;
  }
  return moved;
}
