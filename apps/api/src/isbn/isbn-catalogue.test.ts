import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogueUnavailableError, createIsbnCatalogue } from './isbn-catalogue';

const ISBN = '9780306406157';
const OPEN_LIBRARY_EDITION = `https://openlibrary.org/isbn/${ISBN}.json`;
const OPEN_LIBRARY_AUTHORS = 'https://openlibrary.org/authors/';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const COVER_URL = 'https://covers.openlibrary.org/b/id/42-L.jpg';
const PNG_BYTES = Buffer.from('89504e470d0a1a0a', 'hex');
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

const notFound = () => new Response('Not found', { status: NOT_FOUND });
const noVolumes = () => Response.json({ totalItems: 0 });
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

  it('remembers an ISBN no catalogue knows', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: notFound, [GOOGLE_BOOKS]: noVolumes });
    const catalogue = createIsbnCatalogue({ fetch });

    expect(await catalogue.find(ISBN)).toBeNull();
    expect(await catalogue.find(ISBN)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers "unknown" when one catalogue lacks the ISBN and the other is out of quota', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: notFound, [GOOGLE_BOOKS]: quotaUsedUp });
    const catalogue = createIsbnCatalogue({ fetch });

    expect(await catalogue.find(ISBN)).toBeNull();
    await catalogue.find(ISBN);
    // Not remembered: Google Books might know the book once its quota is back.
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('reports when no catalogue can be reached', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY_EDITION]: outage, [GOOGLE_BOOKS]: quotaUsedUp });

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
    const imageFetch = fakeFetch({
      [COVER_URL]: () => new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } }),
    });
    const htmlFetch = fakeFetch({
      [COVER_URL]: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    });

    expect(await createIsbnCatalogue({ fetch: imageFetch }).fetchCover(entry)).toEqual({
      mimeType: 'image/png',
      bytes: PNG_BYTES,
    });
    expect(await createIsbnCatalogue({ fetch: htmlFetch }).fetchCover(entry)).toBeNull();
    expect(
      await createIsbnCatalogue({ fetch: imageFetch }).fetchCover({ ...entry, coverUrl: null })
    ).toBeNull();
  });
});
