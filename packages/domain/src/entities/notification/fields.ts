import type { Fields } from '@eleansphere/entity-core';
import { NOTIFICATION_KINDS } from '../../constants';

const READER = {
  type: 'STRING',
  required: true,
  references: { model: 'user', onDelete: 'CASCADE' },
} as const;

/** Something that happened to a reader (`recipientId`) because of another (`actorId`). */
export const notificationFields = {
  recipientId: READER,
  actorId: READER,
  kind: { type: 'ENUM', values: NOTIFICATION_KINDS, required: true },
  /** The book it is about, for loan requests; a deleted book takes its notifications along. */
  bookId: { type: 'STRING', references: { model: 'book', onDelete: 'CASCADE' } },
  readAt: { type: 'DATE' },
} as const satisfies Fields;
