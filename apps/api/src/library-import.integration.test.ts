import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const PAYLOAD_TOO_LARGE = 413;
const ALL_ROWS = { limit: 200 };

interface Account {
  id: string;
  token: string;
}

const READ_BOOK = {
  title: 'Válka s mloky',
  author: 'Karel Čapek',
  isbn: '9788025712344',
  publisher: 'Argo',
  publishedYear: 2009,
  pageCount: 256,
  readingStatus: 'read',
  rating: 4,
  finishedAt: '2024-03-05',
  review: 'Skvělá kniha',
  notes: 'Půjčit Petrovi',
  shelves: ['Klasika', 'Sci-fi'],
};

describe('Importing a library', () => {
  let app: TestApp;
  let registered = 0;

  const signUp = async (): Promise<Account> => {
    registered += 1;
    const { body } = await app.register(`importer-${registered}@kniho-hlod.test`);
    return { id: body.id, token: body.token };
  };

  const as = ({ token }: Account) => ({
    get: (path: string, query: object = {}) =>
      app.api().get(path).query(query).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
  });

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('puts the books into the library, on their shelves, made when missing', async () => {
    const reader = await signUp();
    const { body: shelf } = await as(reader).post('/api/shelves', { name: 'klasika' });

    const res = await as(reader).post('/api/library/import', {
      books: [READ_BOOK, { title: 'R.U.R.', readingStatus: 'want', shelves: ['Sci-fi'] }],
    });

    expect(res.status).toBe(OK);
    expect(res.body).toEqual({ created: 2, duplicates: 0, shelvesCreated: 1 });
    const books = (await as(reader).get('/api/books', { ...ALL_ROWS, sort: 'createdAt' })).body
      .data;
    expect(books.map((book: { title: string }) => book.title)).toEqual(['Válka s mloky', 'R.U.R.']);
    expect(books[0]).toMatchObject({
      isbn: '9788025712344',
      readingStatus: 'read',
      rating: 4,
      finishedAt: '2024-03-05',
      notes: 'Půjčit Petrovi',
    });
    expect(books[0].shelves.map((pinned: { id: string }) => pinned.id)).toContain(shelf.id);
    expect(books[0].shelves).toHaveLength(2);
    const shelves = (await as(reader).get('/api/shelves', ALL_ROWS)).body.data;
    expect(shelves.map((each: { name: string }) => each.name).sort()).toEqual([
      'Sci-fi',
      'klasika',
    ]);
  });

  it('leaves out the books the reader has, by ISBN or by title and author', async () => {
    const reader = await signUp();
    await as(reader).post('/api/books', { title: 'Krakatit', author: 'Karel Čapek' });
    await as(reader).post('/api/library/import', { books: [READ_BOOK] });

    const res = await as(reader).post('/api/library/import', {
      books: [
        { title: 'Jiný název', isbn: '80-257-1234-6' },
        { title: 'KRAKATIT', author: 'karel capek' },
        { title: 'Bílá nemoc' },
        { title: 'Bílá nemoc' },
      ],
    });

    expect(res.body).toEqual({ created: 1, duplicates: 3, shelvesCreated: 0 });
    expect((await as(reader).get('/api/books', ALL_ROWS)).body.total).toBe(3);
  });

  it('drops what does not fit a book and refuses what is not a list of books', async () => {
    const reader = await signUp();

    const fitted = await as(reader).post('/api/library/import', {
      books: [
        { title: 'Matka', rating: 11, isbn: 'nonsense', readingStatus: 'lost' },
        { title: '' },
      ],
    });
    expect(fitted.body).toEqual({ created: 1, duplicates: 0, shelvesCreated: 0 });
    const [book] = (await as(reader).get('/api/books', ALL_ROWS)).body.data;
    expect(book).toMatchObject({ title: 'Matka', rating: null, isbn: null, readingStatus: 'none' });

    expect((await as(reader).post('/api/library/import', { books: 'all' })).status).toBe(
      BAD_REQUEST
    );
    const tooMany = Array.from({ length: 101 }, (_, index) => ({ title: `Kniha ${index}` }));
    expect((await as(reader).post('/api/library/import', { books: tooMany })).status).toBe(
      PAYLOAD_TOO_LARGE
    );
    expect((await app.api().post('/api/library/import').send({ books: [] })).status).toBe(
      UNAUTHORIZED
    );
  });

  it('imports into the reader’s own library only', async () => {
    const [first, second] = [await signUp(), await signUp()];
    await as(first).post('/api/library/import', { books: [READ_BOOK] });

    const res = await as(second).post('/api/library/import', { books: [READ_BOOK] });

    expect(res.body.created).toBe(1);
    expect((await as(first).get('/api/books', ALL_ROWS)).body.total).toBe(1);
  });
});
