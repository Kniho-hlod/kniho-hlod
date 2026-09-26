import { defineEntity } from '@eleansphere/entity-core';
import { friendshipFields } from './fields';

/**
 * Two readers who are friends, or one asking the other. There is no CRUD for it: the API's
 * friends routes (`/api/friends`) ask, accept, decline and end friendships. One row per pair —
 * the API also checks the other order before creating one.
 */
export const friendshipEntity = defineEntity({
  name: 'friendship',
  prefix: 'fr_',
  basePath: '/api/friendships',
  access: { read: 'admin', write: 'admin' },
  fields: friendshipFields,
  indexes: [{ fields: ['requesterId', 'addresseeId'], unique: true }, { fields: ['addresseeId'] }],
});

export type Friendship = InstanceType<typeof friendshipEntity.Dto>;
