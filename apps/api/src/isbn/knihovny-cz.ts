import { bookFields, toIsbn13 } from '@kniho-hlod/domain';
import { fitInteger, fitText, joinNames, parseYear, trustedCoverUrl } from './catalogue-entry';
import type { CatalogueProvider } from './catalogue-entry';
import { marcLanguage } from './marc-record';

const HOST = 'www.knihovny.cz';
const SEARCH_URL = `https://${HOST}/api/v1/search`;
/** knihovny.cz's search type for ISBNs and ISSNs; it matches an ISBN-10 record by its ISBN-13 too. */
const ISBN_SEARCH_TYPE = 'ISN';
/** Several libraries often catalogue the same edition; each record may fill in other fields. */
const MAX_RECORDS = 5;
const RECORD_FIELDS = [
  'title',
  'primaryAuthors',
  'publishers',
  'publicationDates',
  'physicalDescriptions',
  'isbns',
  'summary',
  // The MARC record, for the language: the `languages` field is empty in most records.
  'rawData',
];
const SEARCH_OK = 'OK';
const MAX_AUTHORS = 3;
const COVER_URL = `https://${HOST}/Cover/Show`;
const COVER_SIZE = 'large';

/** Library headings name authors with their life dates: `J. R. R. Tolkien, 1892-1973`. */
const LIFE_DATES = /,\s*\d{3,4}-(?:\d{3,4})?\s*$/;
/** Cataloguing punctuation left at the end of a field: `Argo,`, `Temný les /`. */
const TRAILING_PUNCTUATION = /[\s,;:/=]+$/;
/** The page count in a physical description: `476 s. : il.`, `596 stran ; 20 cm`, `xii, 422 p.` */
const PAGE_COUNT = /\[?(\d+)\]?\s*(?:s\.|str\.|stran|p\.|pages)/i;

interface LibraryRecord {
  title?: string;
  primaryAuthors?: string[];
  publishers?: string[];
  publicationDates?: string[];
  physicalDescriptions?: string[];
  /** As catalogued: `978-80-7203-728-5`, `80-7203-728-5 (váz.)`. */
  isbns?: string[];
  summary?: string[];
  rawData?: { fullrecord?: string };
}

interface SearchResult {
  status?: string;
  records?: LibraryRecord[];
}

function searchUrl(isbn: string): string {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('lookfor', isbn);
  url.searchParams.set('type', ISBN_SEARCH_TYPE);
  url.searchParams.set('limit', String(MAX_RECORDS));
  for (const field of RECORD_FIELDS) url.searchParams.append('field[]', field);
  return url.toString();
}

function withoutPunctuation(text: string | undefined): string | undefined {
  return text?.replace(TRAILING_PUNCTUATION, '');
}

function catalogues(record: LibraryRecord, isbn: string): boolean {
  return (record.isbns ?? []).some((catalogued) => toIsbn13(catalogued.split(' ')[0]) === isbn);
}

function authorOf(record: LibraryRecord): string | null {
  const names = record.primaryAuthors
    ?.slice(0, MAX_AUTHORS)
    .map((name) => name.replace(LIFE_DATES, ''));
  return joinNames(names);
}

function pageCountOf(record: LibraryRecord): number | null {
  const match = PAGE_COUNT.exec(record.physicalDescriptions?.[0] ?? '');
  return fitInteger(bookFields.pageCount, match ? Number(match[1]) : null);
}

/** Each detail from the first record that has it. */
function firstKnown<T>(
  records: LibraryRecord[],
  read: (record: LibraryRecord) => T | null
): T | null {
  for (const record of records) {
    const value = read(record);
    if (value !== null) return value;
  }
  return null;
}

/**
 * knihovny.cz, the joint catalogue of Czech libraries: nearly every Czech and Slovak edition,
 * with covers from obalkyknih.cz. A book without a cover gets a small placeholder image there,
 * which the cover download recognises by its size.
 */
export const findInKnihovnyCz: CatalogueProvider = async (isbn, fetchJson) => {
  const result = await fetchJson<SearchResult>(searchUrl(isbn));
  if (!result) return null;
  if (result.status !== SEARCH_OK) throw new Error(`${HOST} answered ${result.status}`);
  // The search is forgiving; only records catalogued under this very ISBN count.
  const records = (result.records ?? []).filter((record) => catalogues(record, isbn));
  const title = firstKnown(records, (record) =>
    fitText(bookFields.title, withoutPunctuation(record.title))
  );
  if (!title) return null;
  return {
    details: {
      title,
      author: firstKnown(records, authorOf),
      publisher: firstKnown(records, (record) =>
        fitText(bookFields.publisher, withoutPunctuation(record.publishers?.[0]))
      ),
      publishedYear: firstKnown(records, (record) => parseYear(record.publicationDates?.[0])),
      pageCount: firstKnown(records, pageCountOf),
      language: firstKnown(records, (record) => marcLanguage(record.rawData?.fullrecord)),
      description: firstKnown(records, (record) =>
        fitText(bookFields.description, record.summary?.[0])
      ),
    },
    coverUrl: trustedCoverUrl(`${COVER_URL}?isbn=${isbn}&size=${COVER_SIZE}`, [HOST]),
  };
};
