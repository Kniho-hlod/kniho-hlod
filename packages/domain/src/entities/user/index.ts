import { defineEntity, withFiles } from '@eleansphere/entity-core';
import { FILE_REF_TYPES, FILE_ROLES } from '../../constants';
import type { UserRole } from '../../constants';
import { userFields } from './fields';

export const USERS_PATH = '/api/users';

/** `PUT /api/users/:id/role` */
export interface SetUserRoleRequest {
  role: UserRole;
}

/**
 * Accounts. Users manage themselves through `/api/auth` (registration, profile, password,
 * deletion). Administrators list accounts, change their role and delete them through
 * `/api/users`; nobody creates or edits an account there.
 */
export const userEntity = defineEntity({
  name: 'user',
  prefix: 'u_',
  basePath: USERS_PATH,
  access: { read: 'admin', write: 'admin' },
  fields: userFields,
  query: {
    filter: { role: 'eq' },
    sort: ['displayName', 'email', 'createdAt'],
    defaultSort: '-createdAt',
    search: ['displayName', 'email'],
  },
  extend: (Base) =>
    class extends withFiles(Base, FILE_REF_TYPES.user, [FILE_ROLES.avatar]) {
      /** Makes an account an administrator, or a reader again. Never the caller's own. */
      setRole(id: string, role: UserRole) {
        const request: SetUserRoleRequest = { role };
        return this.put<UserOverview>(
          `${this.basePath}/${encodeURIComponent(id)}/role`,
          request
        );
      }
    },
});

export type User = InstanceType<typeof userEntity.Dto>;

/** An account as administrators see it in `/api/users`: with the number of its books. */
export type UserOverview = User & { bookCount: number };
