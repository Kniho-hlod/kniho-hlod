import type { Fields } from '@eleansphere/entity-core';
import { DEFAULT_RECOMMENDATION_STATUS, RECOMMENDATION_STATUSES } from '../../constants';

const MESSAGE_MAX_LENGTH = 500;

const READER = {
  type: 'STRING',
  required: true,
  references: { model: 'user', onDelete: 'CASCADE' },
} as const;

/** What a reader writes to the friends they recommend a book to (`POST /api/recommendations`). */
export const recommendationBodyFields = {
  message: { type: 'TEXT', maxLength: MESSAGE_MAX_LENGTH },
} as const satisfies Fields;

/**
 * A book one reader recommended to a friend. The book and both readers cascade: a deleted book or
 * account takes its recommendations along. `bookCopyId` is the book the friend's library got.
 */
export const recommendationFields = {
  bookId: {
    type: 'STRING',
    required: true,
    references: { model: 'book', onDelete: 'CASCADE' },
  },
  senderId: READER,
  recipientId: READER,
  ...recommendationBodyFields,
  status: {
    type: 'ENUM',
    values: RECOMMENDATION_STATUSES,
    default: DEFAULT_RECOMMENDATION_STATUS,
  },
  bookCopyId: { type: 'STRING', references: { model: 'book', onDelete: 'SET NULL' } },
  answeredAt: { type: 'DATE' },
} as const satisfies Fields;
