import { defineEntity } from '@eleansphere/entity-core';
import { notificationFields } from './fields';

/**
 * The bell's notifications. There is no CRUD for them: the server creates them and the reader
 * reads and marks them through `/api/notifications`.
 */
export const notificationEntity = defineEntity({
  name: 'notification',
  prefix: 'nt_',
  basePath: '/api/notification-rows',
  access: { read: 'admin', write: 'admin' },
  fields: notificationFields,
  indexes: [{ fields: ['recipientId'] }],
});
