import { bookFields } from '@kniho-hlod/domain';
import type { IsbnLookupResult } from '@kniho-hlod/domain';

/** What a catalogue knows about a book, in the shape of the book form. */
export type BookDetails = Omit<IsbnLookupResult, 'isbn' | 'hasCover'>;

export interface CatalogueEntry {
  details: BookDetails;
  /** Where the catalogue keeps the cover; only ever an HTTPS URL on the catalogue's own host. */
  coverUrl: string | null;
}

/** The parsed JSON, or `null` when the catalogue answers 404: it doesn't know the ISBN. */
export type FetchJson = <T>(url: string) => Promise<T | null>;

/** Asks one catalogue about an ISBN-13: its entry, `null` when unknown; throws when unreachable. */
export type CatalogueProvider = (
  isbn: string,
  fetchJson: FetchJson
) => Promise<CatalogueEntry | null>;

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

/** The URL over HTTPS when it points at one of `hosts`; anything else counts as no cover. */
export function trustedCoverUrl(url: string | undefined, hosts: readonly string[]): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    return hosts.includes(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}
