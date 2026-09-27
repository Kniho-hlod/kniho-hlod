import type { Fields } from '@eleansphere/entity-core';

const TEXT_MAX_LENGTH = 2000;

/** What a reader writes (`POST /api/books/:id/comments`, `PATCH /api/comments/:id`). */
export const commentBodyFields = {
  text: { type: 'TEXT', required: true, maxLength: TEXT_MAX_LENGTH },
} as const satisfies Fields;

/**
 * A comment under a book, by its owner or a friend who sees the book. A deleted book or account
 * takes its comments along.
 */
export const commentFields = {
  bookId: {
    type: 'STRING',
    required: true,
    references: { model: 'book', onDelete: 'CASCADE' },
  },
  authorId: {
    type: 'STRING',
    required: true,
    references: { model: 'user', onDelete: 'CASCADE' },
  },
  ...commentBodyFields,
  /** When the author last changed the text; empty for a comment never edited. */
  editedAt: { type: 'DATE' },
} as const satisfies Fields;
