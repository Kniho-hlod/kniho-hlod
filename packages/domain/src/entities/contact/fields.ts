import type { Fields } from '@eleansphere/entity-core';

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 40;
const NOTE_MAX_LENGTH = 2000;

export const contactFields = {
  name: { type: 'STRING', required: true, maxLength: NAME_MAX_LENGTH },
  email: { type: 'STRING', format: 'email', maxLength: EMAIL_MAX_LENGTH },
  phone: { type: 'STRING', maxLength: PHONE_MAX_LENGTH },
  note: { type: 'TEXT', maxLength: NOTE_MAX_LENGTH },
  /**
   * The contact's own account, once community lending links the two; set by the server only.
   * Declared now because the database creates tables once and never alters them.
   */
  linkedUserId: {
    type: 'STRING',
    readOnly: true,
    references: { model: 'user', onDelete: 'SET NULL' },
  },
} as const satisfies Fields;
