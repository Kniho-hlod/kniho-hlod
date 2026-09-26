import { bookFields } from '@kniho-hlod/domain';
import {
  fitInteger,
  fitText,
  joinNames,
  MARC_TO_ISO_639_1,
  parseYear,
  trustedCoverUrl,
} from './catalogue-entry';
import type { CatalogueProvider, FetchJson } from './catalogue-entry';

const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const COVER_HOST = 'covers.openlibrary.org';
const COVER_URL = `https://${COVER_HOST}/b/id`;
/** Authors are separate records, fetched one by one; the first few names fill the form. */
const MAX_AUTHORS = 3;

interface OpenLibraryRef {
  key?: string;
}

/** An edition record, as `/isbn/{isbn}.json` redirects to it. */
interface OpenLibraryEdition {
  title?: string;
  authors?: OpenLibraryRef[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  /** Cover ids; `-1` marks a removed cover. */
  covers?: number[];
  languages?: OpenLibraryRef[];
  description?: string | { value?: string };
}

function coverUrl(covers: number[] | undefined): string | undefined {
  const id = covers?.find((cover) => cover > 0);
  return id === undefined ? undefined : `${COVER_URL}/${id}-L.jpg`;
}

/** Languages are named by MARC code: `/languages/cze`. */
function language(languages: OpenLibraryRef[] | undefined): string | null {
  const code = languages?.[0]?.key?.split('/').pop();
  return code ? (MARC_TO_ISO_639_1[code] ?? null) : null;
}

function description(value: OpenLibraryEdition['description']): string | null {
  const text = typeof value === 'string' ? value : value?.value;
  return fitText(bookFields.description, text);
}

/** The names behind keys such as `/authors/OL23919A`; a name that won't load is left out. */
function authorNames(
  authors: OpenLibraryRef[] | undefined,
  fetchJson: FetchJson
): Promise<(string | undefined)[]> {
  const keys = (authors ?? [])
    .map((author) => author.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, MAX_AUTHORS);
  return Promise.all(
    keys.map(async (key) => {
      try {
        return (await fetchJson<{ name?: string }>(`${OPEN_LIBRARY_URL}${key}.json`))?.name;
      } catch {
        return undefined;
      }
    })
  );
}

/** Open Library: strong on English-language books, thin on Czech editions. */
export const findInOpenLibrary: CatalogueProvider = async (isbn, fetchJson) => {
  const edition = await fetchJson<OpenLibraryEdition>(`${OPEN_LIBRARY_URL}/isbn/${isbn}.json`);
  const title = fitText(bookFields.title, edition?.title);
  if (!edition || !title) return null;
  return {
    details: {
      title,
      author: joinNames(await authorNames(edition.authors, fetchJson)),
      publisher: fitText(bookFields.publisher, edition.publishers?.[0]),
      publishedYear: parseYear(edition.publish_date),
      pageCount: fitInteger(bookFields.pageCount, edition.number_of_pages),
      language: language(edition.languages),
      description: description(edition.description),
    },
    coverUrl: trustedCoverUrl(coverUrl(edition.covers), [COVER_HOST]),
  };
};
