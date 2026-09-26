import type { Fields } from '@eleansphere/entity-core';
import { DEFAULT_FRIENDSHIP_STATUS, FRIENDSHIP_STATUSES } from '../../constants';

const READER = {
  type: 'STRING',
  required: true,
  references: { model: 'user', onDelete: 'CASCADE' },
} as const;

/** Two readers: the one who asked and the one asked. A deleted account ends its friendships. */
export const friendshipFields = {
  requesterId: READER,
  addresseeId: READER,
  status: { type: 'ENUM', values: FRIENDSHIP_STATUSES, default: DEFAULT_FRIENDSHIP_STATUS },
  acceptedAt: { type: 'DATE' },
} as const satisfies Fields;
