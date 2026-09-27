import type { Fields } from '@eleansphere/entity-core';
import { DEFAULT_LOAN_REQUEST_STATUS, LOAN_REQUEST_STATUSES } from '../../constants';

const MESSAGE_MAX_LENGTH = 1000;

const READER = {
  type: 'STRING',
  required: true,
  references: { model: 'user', onDelete: 'CASCADE' },
} as const;

/** What a friend sends with a request (`POST /api/friends/:userId/books/:bookId/requests`). */
export const loanRequestBodyFields = {
  message: { type: 'TEXT', maxLength: MESSAGE_MAX_LENGTH },
  /** When the friend would bring the book back. */
  dueAt: { type: 'DATEONLY' },
} as const satisfies Fields;

/**
 * A friend asking to borrow a book. The book and both readers cascade: a deleted book or account
 * takes its requests along. `loanId` is the loan an accepted request became.
 */
export const loanRequestFields = {
  bookId: {
    type: 'STRING',
    required: true,
    references: { model: 'book', onDelete: 'CASCADE' },
  },
  requesterId: READER,
  /** The book's owner, who answers. */
  lenderId: READER,
  ...loanRequestBodyFields,
  status: { type: 'ENUM', values: LOAN_REQUEST_STATUSES, default: DEFAULT_LOAN_REQUEST_STATUS },
  loanId: { type: 'STRING', references: { model: 'loan', onDelete: 'SET NULL' } },
  answeredAt: { type: 'DATE' },
} as const satisfies Fields;
