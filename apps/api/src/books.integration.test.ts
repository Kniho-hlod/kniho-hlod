import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, PNG_SIGNATURE, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const KNOWN_ISBN = '9780306406157';
const UNKNOWN_ISBN = '9780804429573';
const COVER_URL = 'https://covers.openlibrary.org/b/id/42-L.jpg';
const OPEN_LIBRARY_ISBN = 'https://openlibrary.org/isbn/';
const OPEN_LIBRARY_AUTHOR = 'https://openlibrary.org/authors/OL1A.json';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
/** Big enough to count as a cover rather than a catalogue's "no image" placeholder. */
const CATALOGUE_COVER = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(4096)]);

/**
 * Open Library knows one book; Google Books knows none. Set `down` to make them both unreachable.
 */
function createFakeCatalogues() {
  const state = { down: false };
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (state.down) throw new Error('connect ECONNREFUSED');
    if (url.startsWith(OPEN_LIBRARY_ISBN)) {
      return url.includes(KNOWN_ISBN)
        ? Response.json({ title: 'Hobit', authors: [{ key: '/authors/OL1A' }], covers: [42] })
        : new Response('Not found', { status: 404 });
    }
    if (url === OPEN_LIBRARY_AUTHOR) return Response.json({ name: 'J. R. R. Tolkien' });
    if (url.startsWith(GOOGLE_BOOKS)) return Response.json({ totalItems: 0 });
    if (url === COVER_URL) {
      return new Response(CATALOGUE_COVER, { headers: { 'content-type': 'image/png' } });
    }
    throw new Error(`Unexpected request to ${url}`);
  };
  return { state, fetch };
}

describe('Books', () => {
  const catalogues = createFakeCatalogues();
  let app: TestApp;

  const signIn = async (email: string) => (await app.register(email)).body as { token: string };
  const createBook = (token: string, book: Record<string, unknown>) =>
    app.api().post('/api/books').set('Authorization', bearer(token)).send(book);

  beforeAll(async () => {
    app = await startTestApp({ fetch: catalogues.fetch });
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    catalogues.state.down = false;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it("stores the ISBN as ISBN-13 and the reader's defaults", async () => {
    const { token } = await signIn('isbn@test.cz');

    const res = await createBook(token, { title: 'Operating Systems', isbn: '0-306-40615-2' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      isbn: KNOWN_ISBN,
      readingStatus: 'none',
      visibility: 'private',
      cover: null,
    });
  });

  it('rejects an invalid ISBN and reading dates out of order', async () => {
    const { token } = await signIn('invalid@test.cz');

    const badIsbn = await createBook(token, { title: 'X', isbn: '978-0-306-40615-8' });
    const badDates = await createBook(token, {
      title: 'X',
      startedAt: '2026-05-02',
      finishedAt: '2026-05-01',
    });

    expect(badIsbn.status).toBe(400);
    expect(badIsbn.body.issues).toEqual([
      { path: 'isbn', code: 'format', params: { format: 'isbn' } },
    ]);
    expect(badDates.status).toBe(400);
    expect(badDates.body.issues).toEqual([
      { path: 'finishedAt', code: 'min', params: { min: '2026-05-02' } },
    ]);

    // A partial update is checked against the date already stored.
    const { body: started } = await createBook(token, { title: 'X', startedAt: '2026-05-02' });
    const badPatch = await app
      .api()
      .patch(`/api/books/${started.id}`)
      .set('Authorization', bearer(token))
      .send({ finishedAt: '2026-05-01' });
    expect(badPatch.status).toBe(400);
    expect(badPatch.body.issues).toEqual([
      { path: 'finishedAt', code: 'min', params: { min: '2026-05-02' } },
    ]);
  });

  it("keeps each reader's books to themselves", async () => {
    const owner = await signIn('owner@test.cz');
    const stranger = await signIn('stranger@test.cz');
    const { body: book } = await createBook(owner.token, { title: 'Mine' });
    const auth = bearer(stranger.token);

    const list = await app.api().get('/api/books').set('Authorization', auth);
    const read = await app.api().get(`/api/books/${book.id}`).set('Authorization', auth);
    const update = await app
      .api()
      .patch(`/api/books/${book.id}`)
      .set('Authorization', auth)
      .send({ title: 'Stolen' });
    const remove = await app.api().delete(`/api/books/${book.id}`).set('Authorization', auth);

    expect(list.body.total).toBe(0);
    expect([read.status, update.status, remove.status]).toEqual([404, 404, 404]);
  });

  it('searches, filters and pages the list', async () => {
    const { token } = await signIn('lists@test.cz');
    await createBook(token, {
      title: 'Hobit',
      author: 'Tolkien',
      readingStatus: 'read',
      rating: 5,
    });
    await createBook(token, {
      title: 'Duna',
      author: 'Herbert',
      readingStatus: 'reading',
      rating: 3,
    });
    await createBook(token, { title: 'Babička', author: 'Němcová', readingStatus: 'want' });
    const list = (query: Record<string, string | number>) =>
      app.api().get('/api/books').query(query).set('Authorization', bearer(token));
    const titles = (res: { body: { data: { title: string }[] } }) =>
      res.body.data.map((book) => book.title).sort();

    expect(titles(await list({ q: 'tolk' }))).toEqual(['Hobit']);
    expect(titles(await list({ readingStatus: 'read,reading' }))).toEqual(['Duna', 'Hobit']);
    expect(titles(await list({ 'rating[gte]': 4 }))).toEqual(['Hobit']);

    const firstPage = await list({ limit: 2, page: 1, sort: 'title' });
    expect(firstPage.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(titles(firstPage)).toEqual(['Babička', 'Duna']);
  });

  it("takes covers only for the reader's own books, and deletes them with the book", async () => {
    const owner = await signIn('covers@test.cz');
    const stranger = await signIn('cover-thief@test.cz');
    const { body: book } = await createBook(owner.token, { title: 'With a cover' });
    const uploadCover = (token: string) =>
      app
        .api()
        .post('/api/files')
        .set('Authorization', bearer(token))
        .field('refType', 'book')
        .field('refId', book.id)
        .field('role', 'cover')
        .attach('file', PNG_SIGNATURE, { filename: 'cover.png', contentType: 'image/png' });

    expect((await uploadCover(stranger.token)).status).toBe(403);
    expect((await uploadCover(owner.token)).status).toBe(201);

    const withCover = await app
      .api()
      .get(`/api/books/${book.id}`)
      .set('Authorization', bearer(owner.token));
    expect(withCover.body.cover).toMatchObject({
      refId: book.id,
      role: 'cover',
      mimeType: 'image/png',
    });

    await app.api().delete(`/api/books/${book.id}`).set('Authorization', bearer(owner.token));
    expect(await app.core.models.File.count({ where: { refId: book.id } })).toBe(0);
  });

  describe('ISBN lookup', () => {
    it('needs a signed-in reader', async () => {
      expect((await app.api().get(`/api/isbn/${KNOWN_ISBN}`)).status).toBe(401);
    });

    it('finds a book in the catalogues, from any way of writing its ISBN', async () => {
      const { token } = await signIn('lookup@test.cz');

      const res = await app
        .api()
        .get('/api/isbn/0-306-40615-2')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isbn: KNOWN_ISBN,
        title: 'Hobit',
        author: 'J. R. R. Tolkien',
        hasCover: true,
      });
    });

    it('answers 400 for no ISBN, 404 for an unknown one, 503 without catalogues', async () => {
      const { token } = await signIn('lookup-errors@test.cz');
      const lookUp = (isbn: string) =>
        app.api().get(`/api/isbn/${isbn}`).set('Authorization', bearer(token));

      expect((await lookUp('12345')).status).toBe(400);
      expect((await lookUp(UNKNOWN_ISBN)).status).toBe(404);
      catalogues.state.down = true;
      expect((await lookUp('9791090636071')).status).toBe(503);
    });

    it("hands over the catalogue's cover as base64", async () => {
      const { token } = await signIn('lookup-cover@test.cz');

      const res = await app
        .api()
        .get(`/api/isbn/${KNOWN_ISBN}/cover`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        mimeType: 'image/png',
        base64: CATALOGUE_COVER.toString('base64'),
      });
    });
  });
});
