import { ApiClient } from '@eleansphere/entity-core';
import { isDateOnly } from '@eleansphere/schema';
import { RATING_MAX, RATING_MIN, READING_STATUSES } from '../constants';
import type { ReadingStatus } from '../constants';
import { fitInteger, fitText, parseYear } from '../catalogue/book-details';
import { bookFields } from '../entities/book/fields';
import { shelfFields } from '../entities/shelf/fields';
import { toIsbn13 } from '../isbn';

export const LIBRARY_IMPORT_PATH = '/api/library/import';
/** The most books one import request takes; the app sends a big library in parts. */
export const LIBRARY_IMPORT_MAX_BOOKS = 100;
/** The shelves one imported book may go on. */
const MAX_SHELVES_PER_BOOK = 10;

/** Where a table came from, as far as its columns tell. */
export type ImportFormat = 'goodreads' | 'table';

/** One book of an imported table, fitted to what a book holds. */
export interface ImportedBook {
  title: string;
  author: string | null;
  /** ISBN-13, or `null` when the table had no valid one. */
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  readingStatus: ReadingStatus;
  rating: number | null;
  /** `YYYY-MM-DD`, only for a book that is read. */
  finishedAt: string | null;
  review: string | null;
  notes: string | null;
  /** Names of the reader's shelves to put the book on, made when missing. */
  shelves: string[];
}

export interface ParsedLibrary {
  format: ImportFormat;
  books: ImportedBook[];
  /** Rows without a title, left out. */
  skippedRows: number;
}

export interface LibraryImportRequest {
  books: ImportedBook[];
}

export interface LibraryImportResult {
  /** Books put into the library. */
  created: number;
  /** Books the reader had already (the same ISBN, or the same title and author), left out. */
  duplicates: number;
  /** Shelves made for the imported books. */
  shelvesCreated: number;
}

type Column =
  | 'title'
  | 'author'
  | 'additionalAuthors'
  | 'isbn13'
  | 'isbn'
  | 'publisher'
  | 'year'
  | 'originalYear'
  | 'pages'
  | 'rating'
  | 'status'
  | 'dateRead'
  | 'review'
  | 'notes'
  | 'shelves';

/** Column headings as Goodreads, Databáze knih and hand-made tables name them, without accents. */
const HEADINGS: Readonly<Record<Column, readonly string[]>> = {
  title: ['title', 'nazev', 'nazev knihy', 'kniha', 'titul'],
  author: ['author', 'autor', 'autori', 'autor/autori'],
  additionalAuthors: ['additional authors', 'dalsi autori'],
  isbn13: ['isbn13', 'isbn-13', 'ean'],
  isbn: ['isbn', 'isbn10', 'isbn-10'],
  publisher: ['publisher', 'nakladatel', 'nakladatelstvi', 'vydavatel', 'vydavatelstvi'],
  year: ['year published', 'rok vydani', 'rok', 'vydano'],
  originalYear: ['original publication year', 'rok prvniho vydani'],
  pages: ['number of pages', 'pages', 'pocet stran', 'stran', 'stranky'],
  rating: ['my rating', 'rating', 'hodnoceni', 'moje hodnoceni'],
  status: ['exclusive shelf', 'status', 'stav', 'stav cteni'],
  dateRead: ['date read', 'precteno', 'datum precteni', 'precteno dne'],
  review: ['my review', 'review', 'recenze'],
  notes: ['private notes', 'notes', 'poznamka', 'poznamky', 'komentar', 'muj komentar'],
  shelves: ['bookshelves', 'shelves', 'policky', 'policka', 'police'],
};

/** Reading statuses as the tables write them, without accents. */
const STATUS_WORDS: Readonly<Record<string, ReadingStatus>> = {
  read: 'read',
  precteno: 'read',
  prectena: 'read',
  'currently-reading': 'reading',
  reading: 'reading',
  ctu: 'reading',
  'prave ctu': 'reading',
  rozecteno: 'reading',
  rozectena: 'reading',
  'to-read': 'want',
  want: 'want',
  'chci si precist': 'want',
  'chci cist': 'want',
};

/** Goodreads' shelves that only say the reading status; the rest are the reader's own. */
const GOODREADS_STATUS_SHELVES = new Set(['read', 'currently-reading', 'to-read']);
const PERCENT_PER_STAR = 20;
const PERCENT_MAX = 100;
const HTML_BREAK = /<br\s*\/?>/gi;
const HTML_TAG = /<[^>]+>/g;
const DATE_PATTERNS: readonly RegExp[] = [
  /^(?<year>\d{4})[/-](?<month>\d{1,2})[/-](?<day>\d{1,2})/,
  /^(?<day>\d{1,2})\.\s*(?<month>\d{1,2})\.\s*(?<year>\d{4})/,
];

/** Lower case, accents and extra spaces gone: `Název knihy ` → `nazev knihy`. */
export function plainWords(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findColumns(heading: readonly string[]): Partial<Record<Column, number>> {
  const plain = heading.map(plainWords);
  const columns: Partial<Record<Column, number>> = {};
  for (const [column, names] of Object.entries(HEADINGS) as [Column, readonly string[]][]) {
    const index = plain.findIndex((name) => names.includes(name));
    if (index >= 0) columns[column] = index;
  }
  return columns;
}

function parseDate(value: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const parts = pattern.exec(value.trim())?.groups;
    if (!parts) continue;
    const date = [parts.year, parts.month!.padStart(2, '0'), parts.day!.padStart(2, '0')].join('-');
    if (isDateOnly(date)) return date;
  }
  return null;
}

/** Stars from 1 to 5; Goodreads' 0 is "not rated", a percentage counts 20 per star. */
function parseRating(value: string): number | null {
  const number = Number(value.trim().replace('%', '').replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) return null;
  const stars = number > RATING_MAX && number <= PERCENT_MAX ? number / PERCENT_PER_STAR : number;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(stars)));
}

function parseStatus(value: string): ReadingStatus | null {
  const plain = plainWords(value);
  return STATUS_WORDS[plain] ?? READING_STATUSES.find((status) => status === plain) ?? null;
}

/** Goodreads writes ISBNs as `="0451526538"` so spreadsheets keep the leading zero. */
function parseIsbn(value: string | undefined): string | null {
  return value ? toIsbn13(value.replace(/[="]/g, '')) : null;
}

function parseInteger(value: string | undefined): number | null {
  const digits = value?.trim();
  return digits && /^\d+$/.test(digits) ? Number(digits) : null;
}

function fromHtml(value: string | undefined): string | undefined {
  return value?.replace(HTML_BREAK, '\n').replace(HTML_TAG, '');
}

function fitShelfNames(names: readonly string[], format: ImportFormat): string[] {
  const fitted = names
    .map((name) => fitText(shelfFields.name, name))
    .filter((name): name is string => name !== null)
    .filter((name) => format !== 'goodreads' || !GOODREADS_STATUS_SHELVES.has(name));
  const unique = new Map<string, string>();
  for (const name of fitted) if (!unique.has(plainWords(name))) unique.set(plainWords(name), name);
  return [...unique.values()].slice(0, MAX_SHELVES_PER_BOOK);
}

function parseShelves(value: string | undefined, format: ImportFormat): string[] {
  return fitShelfNames((value ?? '').split(/[,;]/), format);
}

/**
 * A spreadsheet of books — a Goodreads export, a Databáze knih export or any table with a title
 * column — as books to import. `null` when no column holds titles.
 */
export function readLibraryTable(rows: readonly (readonly string[])[]): ParsedLibrary | null {
  const [heading, ...body] = rows;
  if (!heading) return null;
  const columns = findColumns(heading);
  if (columns.title === undefined) return null;
  const format: ImportFormat =
    columns.status !== undefined && columns.isbn13 !== undefined ? 'goodreads' : 'table';

  const books: ImportedBook[] = [];
  let skippedRows = 0;
  for (const row of body) {
    const cell = (column: Column) => {
      const index = columns[column];
      return index === undefined ? undefined : row[index];
    };
    const title = fitText(bookFields.title, cell('title'));
    if (!title) {
      skippedRows += 1;
      continue;
    }
    const authors = [cell('author'), ...(cell('additionalAuthors') ?? '').split(',')]
      .map((name) => name?.trim())
      .filter((name): name is string => Boolean(name));
    const status = parseStatus(cell('status') ?? '');
    const finishedAt = parseDate(cell('dateRead') ?? '');
    const readingStatus = status ?? (finishedAt ? 'read' : 'none');
    books.push({
      title,
      author: fitText(bookFields.author, [...new Set(authors)].join(', ')),
      isbn: parseIsbn(cell('isbn13')) ?? parseIsbn(cell('isbn')),
      publisher: fitText(bookFields.publisher, cell('publisher')),
      publishedYear: parseYear(cell('year')) ?? parseYear(cell('originalYear')),
      pageCount: fitInteger(bookFields.pageCount, parseInteger(cell('pages'))),
      readingStatus,
      rating: parseRating(cell('rating') ?? ''),
      finishedAt: readingStatus === 'read' ? finishedAt : null,
      review: fitText(bookFields.review, fromHtml(cell('review'))),
      notes: fitText(bookFields.notes, fromHtml(cell('notes'))),
      shelves: parseShelves(cell('shelves'), format),
    });
  }
  return { format, books, skippedRows };
}

function textOrNull(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * A book as an import request sent it, checked again on the server: whatever doesn't fit a book
 * is dropped. `null` without a title.
 */
export function fitImportedBook(input: unknown): ImportedBook | null {
  if (typeof input !== 'object' || input === null) return null;
  const book = input as Record<string, unknown>;
  const title = fitText(bookFields.title, textOrNull(book.title));
  if (!title) return null;
  const readingStatus = READING_STATUSES.find((status) => status === book.readingStatus) ?? 'none';
  const rating = fitInteger(bookFields.rating, numberOrNull(book.rating));
  const finishedAt = textOrNull(book.finishedAt);
  return {
    title,
    author: fitText(bookFields.author, textOrNull(book.author)),
    isbn: parseIsbn(textOrNull(book.isbn)),
    publisher: fitText(bookFields.publisher, textOrNull(book.publisher)),
    publishedYear: fitInteger(bookFields.publishedYear, numberOrNull(book.publishedYear)),
    pageCount: fitInteger(bookFields.pageCount, numberOrNull(book.pageCount)),
    readingStatus,
    rating,
    finishedAt:
      readingStatus === 'read' && finishedAt && isDateOnly(finishedAt) ? finishedAt : null,
    review: fitText(bookFields.review, textOrNull(book.review)),
    notes: fitText(bookFields.notes, textOrNull(book.notes)),
    shelves: Array.isArray(book.shelves)
      ? fitShelfNames(
          book.shelves.filter((name): name is string => typeof name === 'string'),
          'table'
        )
      : [],
  };
}

/**
 * What makes two books the same for an import: the same ISBN, or the same title and author.
 * A book is a duplicate when any of its keys is taken.
 */
export function importKeys(book: {
  title: string;
  author?: string | null;
  isbn?: string | null;
}): string[] {
  const isbn = book.isbn ? toIsbn13(book.isbn) : null;
  const titleAndAuthor = `${plainWords(book.title)}|${plainWords(book.author ?? '')}`;
  return isbn ? [isbn, titleAndAuthor] : [titleAndAuthor];
}

export class LibraryImportService extends ApiClient {
  /** Up to `LIBRARY_IMPORT_MAX_BOOKS` books; ones the reader has already are left out. */
  import(books: ImportedBook[]): Promise<LibraryImportResult> {
    return this.post<LibraryImportResult>(LIBRARY_IMPORT_PATH, { books });
  }
}
