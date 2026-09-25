import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import type { Book, IsbnLookupResult, ReadingStatus } from '@kniho-hlod/domain';

/** The book fields the form edits. Reading dates, notes and visibility arrive in a later phase. */
export const BOOK_FORM_FIELDS = [
  'title',
  'author',
  'isbn',
  'publisher',
  'publishedYear',
  'pageCount',
  'language',
  'description',
  'readingStatus',
  'rating',
] as const;

export interface BookFormState {
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  description: string | null;
  readingStatus: ReadingStatus;
  rating: number | null;
}

/** What happens to the cover when the form is saved. */
export type CoverChange =
  | { kind: 'keep' }
  | { kind: 'replace'; image: Blob; source: 'upload' | 'catalogue' }
  | { kind: 'remove'; fileId: string };

export const KEEP_COVER: CoverChange = { kind: 'keep' };

export function emptyBookForm(): BookFormState {
  return {
    title: '',
    author: null,
    isbn: null,
    publisher: null,
    publishedYear: null,
    pageCount: null,
    language: null,
    description: null,
    readingStatus: DEFAULT_READING_STATUS,
    rating: null,
  };
}

export function bookFormFrom(book: Book): BookFormState {
  return {
    title: book.title,
    author: book.author ?? null,
    isbn: book.isbn ?? null,
    publisher: book.publisher ?? null,
    publishedYear: book.publishedYear ?? null,
    pageCount: book.pageCount ?? null,
    language: book.language ?? null,
    description: book.description ?? null,
    readingStatus: book.readingStatus ?? DEFAULT_READING_STATUS,
    rating: book.rating ?? null,
  };
}

/**
 * The catalogue's answer filled into the form. What the catalogue doesn't know keeps what the reader
 * already typed; the reading status and rating are the reader's own and never change.
 */
export function withCatalogueDetails(form: BookFormState, found: IsbnLookupResult): BookFormState {
  return {
    ...form,
    isbn: found.isbn,
    title: found.title,
    author: found.author ?? form.author,
    publisher: found.publisher ?? form.publisher,
    publishedYear: found.publishedYear ?? form.publishedYear,
    pageCount: found.pageCount ?? form.pageCount,
    language: found.language ?? form.language,
    description: found.description ?? form.description,
  };
}

function trimmedOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The form as the API wants it: text trimmed, empty text as `null`. */
export function toBookPayload(form: BookFormState): BookFormState {
  return {
    ...form,
    title: form.title.trim(),
    author: trimmedOrNull(form.author),
    isbn: trimmedOrNull(form.isbn),
    publisher: trimmedOrNull(form.publisher),
    language: trimmedOrNull(form.language),
    description: trimmedOrNull(form.description),
  };
}
