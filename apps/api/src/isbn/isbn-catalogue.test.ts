import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogueUnavailableError, createIsbnCatalogue } from './isbn-catalogue';

const ISBN = '9780306406157';
const OPEN_LIBRARY = 'https://openlibrary.org/api/books';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const COVER_URL = 'https://covers.openlibrary.org/b/id/42-L.jpg';
const PNG_BYTES = Buffer.from('89504e470d0a1a0a', 'hex');

type Answer = Response | Error;

/** A `fetch` answering by URL prefix; anything unexpected fails the test. */
function fakeFetch(answers: Record<string, () => Answer>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    const prefix = Object.keys(answers).find((candidate) => url.startsWith(candidate));
    if (!prefix) throw new Error(`Unexpected request to ${url}`);
    const answer = answers[prefix]();
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const openLibraryHit = () =>
  Response.json({
    [`ISBN:${ISBN}`]: {
      title: 'Hobit',
      authors: [{ name: 'J. R. R. Tolkien' }, { name: 'Jan Zábrana' }],
      publishers: [{ name: 'Argo' }],
      publish_date: 'March 2012',
      number_of_pages: 320,
      cover: { medium: 'https://covers.openlibrary.org/b/id/42-M.jpg', large: COVER_URL },
    },
  });

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

const noAnswer = () => Response.json({});
const noVolumes = () => Response.json({ totalItems: 0 });
const outage = () => new Error('connect ECONNREFUSED');

describe('ISBN catalogue', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps an Open Library record into the book form', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: openLibraryHit });

    const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

    expect(entry).toEqual({
      details: {
        title: 'Hobit',
        author: 'J. R. R. Tolkien, Jan Zábrana',
        publisher: 'Argo',
        publishedYear: 2012,
        pageCount: 320,
        language: null,
        description: null,
      },
      coverUrl: COVER_URL,
    });
  });

  it('falls back to Google Books, over HTTPS', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: noAnswer, [GOOGLE_BOOKS]: googleBooksHit });

    const entry = await createIsbnCatalogue({ fetch }).find(ISBN);

    expect(entry?.details).toMatchObject({
      title: 'Hobit',
      publishedYear: 2012,
      language: 'cs',
      description: 'Cesta tam a zase zpátky.',
    });
    expect(entry?.coverUrl).toBe('https://books.google.com/books/content?id=x&zoom=1');
  });

  it('asks Google Books when Open Library is down', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: outage, [GOOGLE_BOOKS]: googleBooksHit });

    expect((await createIsbnCatalogue({ fetch }).find(ISBN))?.details.title).toBe('Hobit');
  });

  it('remembers an ISBN no catalogue knows', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: noAnswer, [GOOGLE_BOOKS]: noVolumes });
    const catalogue = createIsbnCatalogue({ fetch });

    expect(await catalogue.find(ISBN)).toBeNull();
    expect(await catalogue.find(ISBN)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not remember "unknown" while a catalogue is down', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: outage, [GOOGLE_BOOKS]: noVolumes });
    const catalogue = createIsbnCatalogue({ fetch });

    await catalogue.find(ISBN);
    await catalogue.find(ISBN);

    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('reports when no catalogue can be reached', async () => {
    const fetch = fakeFetch({ [OPEN_LIBRARY]: outage, [GOOGLE_BOOKS]: outage });

    await expect(createIsbnCatalogue({ fetch }).find(ISBN)).rejects.toBeInstanceOf(
      CatalogueUnavailableError
    );
  });

  it('ignores covers on hosts other than the catalogues’ own', async () => {
    const fetch = fakeFetch({
      [OPEN_LIBRARY]: () =>
        Response.json({
          [`ISBN:${ISBN}`]: { title: 'Hobit', cover: { large: 'https://evil.test/x.jpg' } },
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
