import type { ValidationIssue } from '@eleansphere/schema';

/** The longest ISBN as people type it: 13 digits and 4 hyphens. */
export const ISBN_INPUT_MAX_LENGTH = 17;

/** `format` of the validation issue an invalid ISBN produces. */
export const ISBN_FORMAT = 'isbn';

const ISBN_10_PATTERN = /^\d{9}[\dX]$/;
const ISBN_13_PATTERN = /^97[89]\d{10}$/;
const SEPARATORS = /[\s-]/g;

const ISBN_10_LENGTH = 10;
const ISBN_10_MODULUS = 11;
const ISBN_10_CHECK_X = 'X';
const ISBN_10_CHECK_X_VALUE = 10;
const ISBN_10_BODY_LENGTH = 9;

const ISBN_13_MODULUS = 10;
const ISBN_13_BODY_LENGTH = 12;
const ISBN_13_EVEN_POSITION_WEIGHT = 1;
const ISBN_13_ODD_POSITION_WEIGHT = 3;
/** The Bookland prefix every ISBN-10 gets when converted. */
const ISBN_10_TO_13_PREFIX = '978';

/** Separators removed and a final `x` upper-cased: `978-80-257 1234-5` → `9788025712345`. */
export function stripIsbn(input: string): string {
  return input.replace(SEPARATORS, '').toUpperCase();
}

function isbn10DigitValue(character: string): number {
  return character === ISBN_10_CHECK_X ? ISBN_10_CHECK_X_VALUE : Number(character);
}

export function isValidIsbn10(value: string): boolean {
  if (!ISBN_10_PATTERN.test(value)) return false;
  const weightedSum = [...value].reduce(
    (sum, character, index) => sum + isbn10DigitValue(character) * (ISBN_10_LENGTH - index),
    0
  );
  return weightedSum % ISBN_10_MODULUS === 0;
}

function isbn13CheckDigit(body: string): number {
  const weightedSum = [...body].reduce((sum, character, index) => {
    const weight = index % 2 === 0 ? ISBN_13_EVEN_POSITION_WEIGHT : ISBN_13_ODD_POSITION_WEIGHT;
    return sum + Number(character) * weight;
  }, 0);
  return (ISBN_13_MODULUS - (weightedSum % ISBN_13_MODULUS)) % ISBN_13_MODULUS;
}

export function isValidIsbn13(value: string): boolean {
  if (!ISBN_13_PATTERN.test(value)) return false;
  return (
    isbn13CheckDigit(value.slice(0, ISBN_13_BODY_LENGTH)) === Number(value[ISBN_13_BODY_LENGTH])
  );
}

/**
 * The ISBN-13 of any valid ISBN-10 or ISBN-13, separators removed — the form books are stored
 * and looked up in. `null` when the input is no valid ISBN.
 */
export function toIsbn13(input: string): string | null {
  const value = stripIsbn(input);
  if (isValidIsbn13(value)) return value;
  if (!isValidIsbn10(value)) return null;
  const body = ISBN_10_TO_13_PREFIX + value.slice(0, ISBN_10_BODY_LENGTH);
  return `${body}${isbn13CheckDigit(body)}`;
}

/** A book's ISBN, when it has one, must be a valid ISBN-10 or ISBN-13. */
export function findIsbnIssues({ isbn }: { isbn?: string | null }): ValidationIssue[] {
  if (!isbn || toIsbn13(isbn) !== null) return [];
  return [{ path: 'isbn', code: 'format', params: { format: ISBN_FORMAT } }];
}

/** What `GET /api/isbn/:isbn` found about a book, ready to prefill the book form. */
export interface IsbnLookupResult {
  /** The ISBN-13 the lookup ran with. */
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  /** ISO 639-1 code, e.g. `cs`, when the catalogue knows it. */
  language: string | null;
  description: string | null;
  /** Whether `GET /api/isbn/:isbn/cover` has an image to import. */
  hasCover: boolean;
}

/** A cover image from the catalogue, base64-encoded so it travels as JSON. */
export interface IsbnCover {
  mimeType: string;
  base64: string;
}
