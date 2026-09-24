import { defaultFileAuthorizer } from '@eleansphere/be-core';
import type { FileAuthorizer } from '@eleansphere/be-core';
import { FILE_REF_TYPES, FILE_ROLES } from '@kniho-hlod/domain';

/**
 * Uploads: a signed-in user may upload only their own avatar (book covers arrive with books).
 * Reads and deletes follow be-core's defaults: public files for everyone, private files and
 * deletion for the uploader.
 */
export const authorizeFileAccess: FileAuthorizer = (access) => {
  if (access.action !== 'create') return defaultFileAuthorizer(access);
  const userId = access.req.user?.id;
  return (
    userId !== undefined &&
    access.refType === FILE_REF_TYPES.user &&
    access.refId === userId &&
    access.role === FILE_ROLES.avatar
  );
};
