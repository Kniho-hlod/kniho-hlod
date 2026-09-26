import type { Fields } from '@eleansphere/entity-core';
import { SAMPLE_FLAG_FIELD } from '../../sample-library';

const NOTE_MAX_LENGTH = 2000;

/**
 * A book lent to a contact. `returnedAt` stays empty while the book is out; the database allows
 * one such loan per book (see the index in `loanEntity`).
 */
export const loanFields = {
  /** A lent book can't be deleted; its returned loans go with it (see the API's book routes). */
  bookId: { type: 'STRING', required: true, references: { model: 'book' } },
  contactId: { type: 'STRING', required: true, references: { model: 'contact' } },
  lentAt: { type: 'DATEONLY', required: true },
  dueAt: { type: 'DATEONLY' },
  returnedAt: { type: 'DATEONLY' },
  note: { type: 'TEXT', maxLength: NOTE_MAX_LENGTH },
  /** When the owner was last reminded of the due date; kept by the reminder job. */
  lastReminderSentAt: { type: 'DATE', readOnly: true },
  isSample: SAMPLE_FLAG_FIELD,
} as const satisfies Fields;
