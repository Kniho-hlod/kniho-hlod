import type { Fields } from '@eleansphere/entity-core';

/**
 * A friend's promise to give the reader a wished-for book. A deleted wish or account takes it
 * along. The wish's owner never sees it; the other friends see only that someone gives it.
 */
export const wishReservationFields = {
  wishId: {
    type: 'STRING',
    required: true,
    references: { model: 'wish', onDelete: 'CASCADE' },
  },
  giverId: {
    type: 'STRING',
    required: true,
    references: { model: 'user', onDelete: 'CASCADE' },
  },
} as const satisfies Fields;
