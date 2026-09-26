import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMarcRecord, fixedLengthData } from '../test-support/marc-record';
import { CatalogueUnavailableError, createIsbnCatalogue } from './isbn-catalogue';

const ISBN = '9780306406157';
const CZECH_ISBN = '9788072037285';
const OPEN_LIBRARY_EDITION = `https://openlibrary.org/isbn/${ISBN}.json`;
const OPEN_LIBRARY_ISBN = 'https://openlibrary.org/isbn/';
const OPEN_LIBRARY_AUTHORS = 'https://openlibrary.org/authors/';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const KNIHOVNY_CZ_SEARCH = 'https://www.knihovny.cz/api/v1/search';
const COVER_URL = 'https://covers.openlibrary.org/b/id/42-L.jpg';
const KNIHOVNY_CZ_COVER_URL = `https://www.knihovny.cz/Cover/Show?isbn=${CZECH_ISBN}&size=large`;
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
/** Big enough to count as a cover rather than a catalogue's "no image" placeholder. */
const COVER_BYTES = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(4096)]);
const NOT_FOUND = 404;
const TOO_MANY_REQUESTS = 429;

type Answer = Response | Error;

/** A `fetch` answering by URL prefix; anything unexpected fails the test. */
function fakeFetch(answers: Record<string, (url: string) => Answer>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    const prefix = Object.keys(answers).find((candidate) => url.startsWith(candidate));
    if (!prefix) throw new Error(`Unexpected request to ${url}`);
    const answer = answers[prefix](url);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const AUTHOR_NAMES: Record<string, string> = {
  OL1A: 'J. R. R. Tolkien',
  OL2A: 'Jan Zábrana',
};

const openLibraryEdition = () =>
  Response.json({
    title: 'Hobit',
    authors: [{ key: '/authors/OL1A' }, { key: '/authors/OL2A' }],
    publishers: ['Argo'],
    publish_date: 'March 2012',
    number_of_pages: 320,
    covers: [-1, 42],
    languages: [{ key: '/languages/cze' }],
    description: { type: '/type/text', value: 'Cesta tam a zase zpátky.' },
  });

const openLibraryAuthor = (url: string) => {
  const key = url.slice(OPEN_LIBRARY_AUTHORS.length).replace('.json', '');
  const name = AUTHOR_NAMES[key];
  return name ? Response.json({ name }) : new Response('Not found', { status: NOT_FOUND });
};

const googleBooksHit = () =>
  Response.json({
    items: [
      {
        volumeInfo: {
          title: 'Hobit',
          authors: ['J. R. R. Tolkien'],
          publishedDate: '2012-03-01',
          language: 'cs',
          description: 'Cesta tam a zase zpátky.',
          imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&zoom=1' },
        },
      },
    ],
  });

/** Two libraries' records of one Czech edition, each knowing part of it, as knihovny.cz lists them. */
const libraryRecords = () =>
  Response.json({
    status: 'OK',
    resultCount: 2,
    records: [
      {
        title: 'Pán prstenů. Návrat krále /',
        primaryAuthors: ['J. R. R. Tolkien, 1892-1973'],
        publishers: ['Argo,'],
        publicationDates: ['c2007'],
        physicalDescriptions: ['476 s. : geneal. tabulky ; 22 cm'],
        isbns: ['80-7203-728-5 (váz.)'],
        rawData: { fullrecord: buildMarcRecord({ '008': fixedLengthData('cze') }) },
      },
      {
        title: 'Pán prstenů. 3. díl, Návrat krále',
        isbns: ['978-80-7203-728-5'],
        summary: ['Závěrečný díl trilogie.'],
      },
    ],
  });

const notFound = () => new Response('Not found', { status: NOT_FOUND });
const noVolumes = () => Response.json({ totalItems: 0 });
const noLibraryRecords = () => Response.json({ status: 'OK', resultCount: 0, records: [] });
const quotaUsedUp = () => new Response('{}', { status: TOO_MANY_REQUESTS });
const outage = () => new Error('connect ECONNREFUSED');

describe('ISBN catalogue', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps an Open Library edition and its authors into the book form', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: openLibraryEdition,
      [OPEN_LIBRARY_AUTHORS]: openLibraryAuthor,
    });

    const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

    expect(entry).toEqual({
      details: {
        title: 'Hobit',
        author: 'J. R. R. Tolkien, Jan Zábrana',
        publisher: 'Argo',
        publishedYear: 2012,
        pageCount: 320,
        language: 'cs',
        description: 'Cesta tam a zase zpátky.',
      },
      coverUrl: COVER_URL,
    });
  });

  it('keeps the book when an author record will not load', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: () =>
        Response.json({
          title: 'Hobit',
          authors: [{ key: '/authors/OL1A' }, { key: '/authors/MISSING' }],
        }),
      [OPEN_LIBRARY_AUTHORS]: openLibraryAuthor,
    });

    const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

    expect(entry?.details).toMatchObject({ title: 'Hobit', author: 'J. R. R. Tolkien' });
    expect(entry?.coverUrl).toBeNull();
  });

  it('falls back to Google Books, over HTTPS', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: notFound, [GOOGLE_BOOKS]: googleBooksHit });

    const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

    expect(entry?.details).toMatchObject({
      title: 'Hobit',
      publishedYear: 2012,
      language: 'cs',
      description: 'Cesta tam a zase zpátky.',
    });
    expect(entry?.coverUrl).toBe('https://books.google.com/books/content?id=x&zoom=1');
  });

  it('asks Google Books with the API key when there is one', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: notFound, [GOOGLE_BOOKS]: googleBooksHit });

    await createIsbnCatalogue({ fetch, googleBooksApiKey: 'test-key' }).find(ISBN);

    const googleUrl = new URL(String(fetch.mock.calls[1][0]));
    expect(googleUrl.searchParams.get('q')).toBe(`isbn:${ISBN}`);
    expect(googleUrl.searchParams.get('key')).toBe('test-key');
  });

  it('asks Google Books when Open Library is down', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: outage, [GOOGLE_BOOKS]: googleBooksHit });

    expect((await createIsbnCatalogue({ fetch }).find(ISBN))?.details.title).toBe('Hobit');
  });

  describe('the Czech libraries (knihovny.cz)', () => {
    it('are asked first for a Czech edition, their records merged and tidied', async () => {
      const fetch = fakeFetch({ [KNIHOVNY_CZ_SEARCH]: libraryRecords });

      const entry = await createIsbnCatalogue({ fetch }).find(CZECH_ISBN);

      expect(entry).toEqual({
        details: {
          title: 'Pán prstenů. Návrat krále',
          author: 'J. R. R. Tolkien',
          publisher: 'Argo',
          publishedYear: 2007,
          pageCount: 476,
          language: 'cs',
          description: 'Závěrečný díl trilogie.',
        },
        coverUrl: KNIHOVNY_CZ_COVER_URL,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      const searchUrl = new URL(String(fetch.mock.calls[0][0]));
      expect(searchUrl.searchParams.get('lookfor')).toBe(CZECH_ISBN);
      expect(searchUrl.searchParams.get('type')).toBe('ISN');
    });

    it('count only records catalogued under the very ISBN looked up', async () => {
      const fetch = fakeFetch({
        [KNIHOVNY_CZ_SEARCH]: () =>
          Response.json({
            status: 'OK',
            records: [{ title: 'Jiná kniha', isbns: ['978-80-7577-595-5'] }],
          }),
        [OPEN_LIBRARY_ISBN]: notFound,
        [GOOGLE_BOOKS]: noVolumes,
      });

      expect(await createIsbnCatalogue({ fetch }).find(CZECH_ISBN)).toBeNull();
    });

    it('are asked last for other books, after Open Library and Google Books', async () => {
      const fetch = fakeFetch({
        [OPEN_LIBRARY_EDITION]: notFound,
        [GOOGLE_BOOKS]: noVolumes,
        [KNIHOVNY_CZ_SEARCH]: () =>
          Response.json({
            status: 'OK',
            records: [{ title: 'Error-correction coding', isbns: ['0-306-40615-2'] }],
          }),
      });

      const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

      expect(entry?.details.title).toBe('Error-correction coding');
      expect(fetch.mock.calls.map(([url]) => new URL(String(url)).hostname)).toEqual([
        'openlibrary.org',
        'www.googleapis.com',
        'www.knihovny.cz',
      ]);
    });
  });

  it('remembers an ISBN no catalogue knows', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: notFound,
      [GOOGLE_BOOKS]: noVolumes,
      [KNIHOVNY_CZ_SEARCH]: noLibraryRecords,
    });
    const catalogue = createIsbnCatalogue({ fetch });

    expect(await catalogue.find(ISBN)).toBeNull();
    expect(await catalogue.find(ISBN)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('answers "unknown" when the catalogues lack the ISBN and one is out of quota', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: notFound,
      [GOOGLE_BOOKS]: quotaUsedUp,
      [KNIHOVNY_CZ_SEARCH]: noLibraryRecords,
    });
    const catalogue = createIsbnCatalogue({ fetch });

    expect(await catalogue.find(ISBN)).toBeNull();
    await catalogue.find(ISBN);
    // Not remembered: Google Books might know the book once its quota is back.
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('reports when no catalogue can be reached', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: outage,
      [GOOGLE_BOOKS]: quotaUsedUp,
      [KNIHOVNY_CZ_SEARCH]: outage,
    });

    await expect(createIsbnCatalogue({ fetch }).find(ISBN)).rejects.toBeInstanceOf(
      CatalogueUnavailableError
    );
  });

  it('ignores covers on hosts other than the catalogues’ own', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY_EDITION]: notFound,
      [GOOGLE_BOOKS]: () =>
        Response.json({
          items: [
            {
              volumeInfo: { title: 'Hobit', imageLinks: { thumbnail: 'https://evil.test/x.jpg' } },
            },
          ],
        }),
    });

    expect((await createIsbnCatalogue({ fetch }).find(ISBN))?.coverUrl).toBeNull();
  });

  it('downloads an image cover, and refuses anything else', async () => {
    const entry = { details: {} as never, coverUrl: COVER_URL };
    const image = (bytes: Buffer) => () =>
      new Response(bytes, { headers: { 'content-type': 'image/png' } });
    const imageFetch = fakeFetch({ [COVER_URL]: image(COVER_BYTES) });
    const placeholderFetch = fakeFetch({ [COVER_URL]: image(PNG_SIGNATURE) });
    const htmlFetch = fakeFetch({
      [COVER_URL]: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    });

    expect(await createIsbnCatalogue({ fetch: imageFetch }).fetchCover(entry)).toEqual({
      mimeType: 'image/png',
      bytes: COVER_BYTES,
    });
    // A tiny image is a catalogue's "no cover" placeholder, not a cover.
    expect(await createIsbnCatalogue({ fetch: placeholderFetch }).fetchCover(entry)).toBeNull();
    expect(await createIsbnCatalogue({ fetch: htmlFetch }).fetchCover(entry)).toBeNull();
    expect(
      await createIsbnCatalogue({ fetch: imageFetch }).fetchCover({ ...entry, coverUrl: null })
    ).toBeNull();
  });
});
