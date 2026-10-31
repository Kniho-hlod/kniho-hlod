import { defineEntity } from '@eleansphere/entity-core';
import { wishReservationFields } from './fields';

/**
 * Friends' promises to give a wished-for book. There is no CRUD for them: the friend's wish-list
 * routes know both sides. The unique index keeps one giver per wish.
 */
export const wishReservationEntity = defineEntity({
  name: 'wishReservation',
  prefix: 'wr_',
  basePath: '/api/wish-reservation-rows',
  access: { read: 'admin', write: 'admin' },
  fields: wishReservationFields,
  indexes: [{ fields: ['wishId'], unique: true }, { fields: ['giverId'] }],
});
