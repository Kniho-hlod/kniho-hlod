import { defineEntity, withFiles } from '@eleansphere/entity-core';
import { FILE_REF_TYPES, FILE_ROLES } from '../../constants';
import { userFields } from './fields';

/**
 * Accounts. Users manage themselves through `/api/auth` (registration, profile, password,
 * deletion); the `/api/users` CRUD is reserved for administrators.
 */
export const userEntity = defineEntity({
  name: 'user',
  prefix: 'u_',
  basePath: '/api/users',
  access: { read: 'admin', write: 'admin' },
  fields: userFields,
  query: {
    filter: { role: 'eq' },
    sort: ['displayName', 'email', 'createdAt'],
    defaultSort: '-createdAt',
    search: ['displayName', 'email'],
  },
  extend: (Base) => class extends withFiles(Base, FILE_REF_TYPES.user, [FILE_ROLES.avatar]) {},
});

export type User = InstanceType<typeof userEntity.Dto>;
