import { deleteFilesOwnedBy, FILE_MODEL_NAME, HttpError } from '@eleansphere/be-core';
import type { AccessRule, ModelRouteOverrides, StorageAdapter } from '@eleansphere/be-core';
import { ADMIN_ROLE, bookEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type Row = Record<string, unknown>;

const FORBIDDEN = 403;
const DELETE_METHOD = 'DELETE';

/**
 * Of the writes, administrators may only delete accounts: an account is created by registering
 * and changed by its owner (`/api/auth/me`), or its role through `PUT /api/users/:id/role`.
 */
const onlyAdministratorsDeleting: AccessRule = (req) =>
  req.method === DELETE_METHOD && req.user?.role === ADMIN_ROLE;

export interface UserAccounts {
  /** `routes.user`: the administrators' `/api/users`. */
  routes: ModelRouteOverrides;
  /**
   * Each account with its number of books (`UserOverview`), as `GET /api/users` lists them; the
   * sample library's books don't count.
   */
  overview: Enrich;
}

/**
 * Accounts as administrators manage them. Deleting one takes its files along, as deleting one's
 * own account does, while the database cascades to its books, contacts, loans and shelves.
 */
export function createUserAccounts(registry: ModelRegistry, storage: StorageAdapter): UserAccounts {
  const overview: Enrich = async (users) => {
    const rows = users.map((user) => user.toJSON() as Row);
    if (rows.length === 0) return [];
    const books = await registry.get(bookEntity.config.name).findAll({
      where: { ownerId: rows.map((row) => String(row.id)), isSample: false },
      attributes: ['ownerId'],
    });
    const counts = new Map<string, number>();
    for (const book of books) {
      const ownerId = String(book.get('ownerId'));
      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    }
    return rows.map((row) => ({ ...row, bookCount: counts.get(String(row.id)) ?? 0 }));
  };

  const routes: ModelRouteOverrides = {
    access: { write: onlyAdministratorsDeleting },
    enrich: overview,
    async beforeDelete(user, req) {
      const userId = String(user.get('id'));
      if (userId === req.user?.id) {
        throw new HttpError(
          FORBIDDEN,
          'Administrators delete their own account from their profile'
        );
      }
      await deleteFilesOwnedBy(registry.get(FILE_MODEL_NAME), storage, userId);
    },
  };

  return { routes, overview };
}
