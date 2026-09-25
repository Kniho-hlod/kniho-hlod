import { defaultFileAuthorizer } from '@eleansphere/be-core';
import type { FileAccessRequest, FileAuthorizer } from '@eleansphere/be-core';
import { bookEntity, FILE_REF_TYPES, FILE_ROLES } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

function isOwnAvatar(access: FileAccessRequest, userId: string): boolean {
  return (
    access.refType === FILE_REF_TYPES.user &&
    access.refId === userId &&
    access.role === FILE_ROLES.avatar
  );
}

function isBookCover(access: FileAccessRequest): boolean {
  return access.refType === FILE_REF_TYPES.book && access.role === FILE_ROLES.cover;
}

/**
 * Uploads: a signed-in reader may upload their own avatar and the covers of their own books.
 * Reads and deletes follow be-core's defaults: public files for everyone, private files and
 * deletion for the uploader.
 */
export function createFileAuthorizer(registry: ModelRegistry): FileAuthorizer {
  async function ownsBook(userId: string, bookId: string | null): Promise<boolean> {
    if (!bookId) return false;
    const book = await registry
      .get(bookEntity.config.name)
      .findByPk(bookId, { attributes: ['ownerId'] });
    return book?.get('ownerId') === userId;
  }

  return async (access) => {
    if (access.action !== 'create') return defaultFileAuthorizer(access);
    const userId = access.req.user?.id;
    if (userId === undefined) return false;
    if (isOwnAvatar(access, userId)) return true;
    return isBookCover(access) && ownsBook(userId, access.refId);
  };
}
