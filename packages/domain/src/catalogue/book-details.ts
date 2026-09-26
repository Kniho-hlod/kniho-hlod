import { bookFields } from '../entities/book/fields';
import type { IsbnLookupResult } from '../isbn';

/** What a catalogue knows about a book, in the shape of the book form. */
export type BookDetails = Omit<IsbnLookupResult, 'isbn' | 'hasCover'>;

/** The parsed JSON, or `null` when the catalogue answers 404: it doesn't know the ISBN. */
export type FetchJson = <T>(url: string) => Promise<T | null>;

/** A four-digit year anywhere in a date: `March 2012`, `2012-03-01`, `c2018`, `[2007]`. */
const YEAR_PATTERN = /(?<!\d)(\d{4})(?!\d)/;
const AUTHOR_SEPARATOR = ', ';

/**
 * MARC language codes (Open Library's `/languages/cze`, a library record's field 008) as the
 * ISO 639-1 codes the book form keeps. A language not listed is left for the reader to fill in.
 */
export const MARC_TO_ISO_639_1: Readonly<Record<string, string>> = {
  chi: 'zh',
  cze: 'cs',
  dan: 'da',
  dut: 'nl',
  eng: 'en',
  fin: 'fi',
  fre: 'fr',
  ger: 'de',
  hun: 'hu',
  ita: 'it',
  jpn: 'ja',
  nor: 'no',
  pol: 'pl',
  por: 'pt',
  rus: 'ru',
  slo: 'sk',
  spa: 'es',
  swe: 'sv',
  tur: 'tr',
  ukr: 'uk',
};

interface LengthLimited {
  maxLength?: number;
}

interface NumberRange {
  min?: number;
  max?: number;
}

/** Trimmed and cut to what the book field holds; empty text becomes `null`. */
export function fitText(field: LengthLimited, value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return field.maxLength === undefined ? text : text.slice(0, field.maxLength);
}

export function fitInteger(field: NumberRange, value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isInteger(value)) return null;
  if (field.min !== undefined && value < field.min) return null;
  if (field.max !== undefined && value > field.max) return null;
  return value;
}

export function parseYear(date: string | undefined): number | null {
  const match = date ? YEAR_PATTERN.exec(date) : null;
  return fitInteger(bookFields.publishedYear, match ? Number(match[1]) : null);
}

export function joinNames(names: readonly (string | undefined)[] | undefined): string | null {
  const present = (names ?? []).filter((name): name is string => Boolean(name?.trim()));
  return fitText(bookFields.author, present.join(AUTHOR_SEPARATOR));
}

function fillGaps(details: BookDetails, other: BookDetails): BookDetails {
  return {
    title: details.title,
    author: details.author ?? other.author,
    publisher: details.publisher ?? other.publisher,
    publishedYear: details.publishedYear ?? other.publishedYear,
    pageCount: details.pageCount ?? other.pageCount,
    language: details.language ?? other.language,
    description: details.description ?? other.description,
  };
}

/**
 * Several catalogues' details of one ISBN as one: each detail from the first catalogue that knows
 * it, the title always from the first. `null` when no catalogue knows the book.
 */
export function mergeBookDetails(catalogues: readonly (BookDetails | null)[]): BookDetails | null {
  const [first, ...others] = catalogues.filter((details) => details !== null);
  return first ? others.reduce(fillGaps, first) : null;
}
