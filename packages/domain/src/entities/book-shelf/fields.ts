import type { Fields } from '@eleansphere/entity-core';

/** Both sides cascade: a deleted book leaves its shelves, a deleted shelf lets go of its books. */
export const bookShelfFields = {
  bookId: { type: 'STRING', required: true, references: { model: 'book', onDelete: 'CASCADE' } },
  shelfId: {
    type: 'STRING',
    required: true,
    references: { model: 'shelf', onDelete: 'CASCADE' },
  },
} as const satisfies Fields;
