import type { Fields } from '@eleansphere/entity-core';
import {
  BOOK_VISIBILITIES,
  DEFAULT_BOOK_VISIBILITY,
  DEFAULT_READING_STATUS,
  RATING_MAX,
  RATING_MIN,
  READING_STATUSES,
} from '../../constants';
import { ISBN_INPUT_MAX_LENGTH } from '../../isbn';
import { SAMPLE_FLAG_FIELD } from '../../sample-library';

const TITLE_MAX_LENGTH = 300;
const AUTHOR_MAX_LENGTH = 300;
const PUBLISHER_MAX_LENGTH = 200;
/** Room for any BCP 47 language tag; catalogues send ISO 639-1 codes such as `cs`. */
const LANGUAGE_MAX_LENGTH = 35;
const LONG_TEXT_MAX_LENGTH = 5000;
const PUBLISHED_YEAR_MIN = 1000;
const PUBLISHED_YEAR_MAX = 2100;
const PAGE_COUNT_MIN = 1;
const PAGE_COUNT_MAX = 100_000;

/**
 * Every column a book will need, including those the app shows only in later phases (reading
 * dates, notes, visibility), declared before the API had migrations. A new column now needs one.
 */
export const bookFields = {
  title: { type: 'STRING', required: true, maxLength: TITLE_MAX_LENGTH },
  author: { type: 'STRING', maxLength: AUTHOR_MAX_LENGTH },
  /** Accepted with hyphens; the API stores it as ISBN-13 (see `toIsbn13`). */
  isbn: { type: 'STRING', maxLength: ISBN_INPUT_MAX_LENGTH },
  publisher: { type: 'STRING', maxLength: PUBLISHER_MAX_LENGTH },
  publishedYear: { type: 'INTEGER', min: PUBLISHED_YEAR_MIN, max: PUBLISHED_YEAR_MAX },
  pageCount: { type: 'INTEGER', min: PAGE_COUNT_MIN, max: PAGE_COUNT_MAX },
  language: { type: 'STRING', maxLength: LANGUAGE_MAX_LENGTH },
  description: { type: 'TEXT', maxLength: LONG_TEXT_MAX_LENGTH },
  readingStatus: { type: 'ENUM', values: READING_STATUSES, default: DEFAULT_READING_STATUS },
  rating: { type: 'INTEGER', min: RATING_MIN, max: RATING_MAX },
  startedAt: { type: 'DATEONLY' },
  finishedAt: { type: 'DATEONLY' },
  notes: { type: 'TEXT', maxLength: LONG_TEXT_MAX_LENGTH },
  visibility: { type: 'ENUM', values: BOOK_VISIBILITIES, default: DEFAULT_BOOK_VISIBILITY },
  isSample: SAMPLE_FLAG_FIELD,
} as const satisfies Fields;
