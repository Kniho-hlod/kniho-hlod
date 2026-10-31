import type { Fields } from '@eleansphere/entity-core';
import { ISBN_INPUT_MAX_LENGTH } from '../../isbn';

const TITLE_MAX_LENGTH = 300;
const AUTHOR_MAX_LENGTH = 300;
export const WISH_NOTE_MAX_LENGTH = 500;

/** A book the reader would like to have: what it is, and a word for friends (edition, why). */
export const wishFields = {
  title: { type: 'STRING', required: true, maxLength: TITLE_MAX_LENGTH },
  author: { type: 'STRING', maxLength: AUTHOR_MAX_LENGTH },
  /** Accepted with hyphens; the API stores it as ISBN-13, as for books. */
  isbn: { type: 'STRING', maxLength: ISBN_INPUT_MAX_LENGTH },
  note: { type: 'TEXT', maxLength: WISH_NOTE_MAX_LENGTH },
} as const satisfies Fields;
