import { defaultFileAuthorizer } from '@eleansphere/be-core';
import type { FileAccessRequest, FileAuthorizer } from '@eleansphere/be-core';
import {
  ADMIN_ROLE,
  bookEntity,
  feedbackEntity,
  FILE_REF_TYPES,
  FILE_ROLES,
} from '@kniho-hlod/domain';
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

function isReportScreenshot(access: FileAccessRequest): boolean {
  return access.refType === FILE_REF_TYPES.feedback && access.role === FILE_ROLES.screenshot;
}

/**
 * A report's screenshot may show anything on the reader's screen: only the reporter and the
 * administrators see it, whatever visibility an older upload was stored with, and only the
 * reporter deletes it (administrators delete it with the report).
 */
function mayReachScreenshot(access: FileAccessRequest): boolean {
  const user = access.req.user;
  if (!user) return false;
  if (access.action === 'read' && user.role === ADMIN_ROLE) return true;
  return access.file?.ownerId === user.id;
}

/**
 * Uploads: a signed-in reader may upload their own avatar, the covers of their own books and a
 * screenshot to a report they sent (stored private: `storage.privateRoles`).
 * Reads and deletes follow be-core's defaults — public files for everyone, private files and
 * deletion for the uploader — except for report screenshots (`mayReachScreenshot`).
 */
export function createFileAuthorizer(registry: ModelRegistry): FileAuthorizer {
  async function ownsBook(userId: string, bookId: string | null): Promise<boolean> {
    if (!bookId) return false;
    const book = await registry
      .get(bookEntity.config.name)
      .findByPk(bookId, { attributes: ['ownerId'] });
    return book?.get('ownerId') === userId;
  }

  async function sentReport(userId: string, reportId: string | null): Promise<boolean> {
    if (!reportId) return false;
    const report = await registry
      .get(feedbackEntity.config.name)
      .findByPk(reportId, { attributes: ['reporterId'] });
    return report?.get('reporterId') === userId;
  }

  return async (access) => {
    if (access.action !== 'create') {
      if (isReportScreenshot(access)) return mayReachScreenshot(access);
      return defaultFileAuthorizer(access);
    }
    const userId = access.req.user?.id;
    if (userId === undefined) return false;
    if (isOwnAvatar(access, userId)) return true;
    if (isReportScreenshot(access)) return sentReport(userId, access.refId);
    return isBookCover(access) && ownsBook(userId, access.refId);
  };
}
