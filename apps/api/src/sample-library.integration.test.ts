import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sendLoanReminders } from './jobs/loan-reminders';
import { APP_BASE_URL, bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const CONFLICT = 409;

/** 10:00 UTC: the same calendar day in Prague. */
const NOW = new Date('2026-09-25T10:00:00Z');
const SAMPLE_BOOKS = 8;
const SAMPLE_CONTACTS = 2;
const ALL_ROWS = { limit: 200 };

interface Account {
  id: string;
  email: string;
  token: string;
}

describe('Onboarding and the sample library', () => {
  let app: TestApp;
  let registered = 0;

  const signUp = async (profile: object = {}): Promise<Account> => {
    registered += 1;
    const email = `reader-${registered}@kniho-hlod.test`;
    const { body } = await app.register(email);
    const account = { id: body.id, email, token: body.token };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  const as = ({ token }: Account) => ({
    get: (path: string, query: object = {}) =>
      app.api().get(path).query(query).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  beforeAll(async () => {
    app = await startTestApp({ now: () => NOW });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('greets a new reader with the tour until they finish it', async () => {
    const reader = await signUp();
    expect((await as(reader).get('/api/auth/me')).body.onboardedAt).toBeNull();

    const finished = await as(reader).patch('/api/auth/me', { onboardedAt: NOW.toISOString() });

    expect(finished.status).toBe(OK);
    expect(new Date(finished.body.onboardedAt)).toEqual(NOW);
    const signedIn = await app
      .api()
      .post('/api/auth/login')
      .send({ email: reader.email, password: PASSWORD });
    expect(new Date(signedIn.body.user.onboardedAt)).toEqual(NOW);
  });

  it('remembers the newest release notes a reader has seen', async () => {
    const reader = await signUp();
    expect((await as(reader).get('/api/auth/me')).body.lastSeenRelease).toBeNull();

    const seen = await as(reader).patch('/api/auth/me', { lastSeenRelease: '1.4' });
    const tooLong = await as(reader).patch('/api/auth/me', { lastSeenRelease: '1'.repeat(21) });

    expect(seen.body.lastSeenRelease).toBe('1.4');
    expect(tooLong.status).toBe(BAD_REQUEST);
    expect((await as(reader).get('/api/auth/me')).body.lastSeenRelease).toBe('1.4');
  });

  it('asks for a signed-in reader', async () => {
    expect((await app.api().get('/api/sample-library')).status).toBe(UNAUTHORIZED);
    expect((await app.api().post('/api/sample-library')).status).toBe(UNAUTHORIZED);
    expect((await app.api().delete('/api/sample-library')).status).toBe(UNAUTHORIZED);
  });

  it('fills an empty library with books, shelves, contacts and loans in every state', async () => {
    const reader = await signUp();
    expect((await as(reader).get('/api/sample-library')).body).toEqual({
      present: false,
      canFill: true,
    });

    const filled = await as(reader).post('/api/sample-library');

    expect(filled.status).toBe(CREATED);
    expect(filled.body).toEqual({ present: true, canFill: false });
    const books = (await as(reader).get('/api/books', ALL_ROWS)).body;
    expect(books.total).toBe(SAMPLE_BOOKS);
    expect(books.data[0]).toMatchObject({
      title: 'Saturnin',
      isSample: true,
      readingStatus: 'read',
      startedAt: '2026-07-27',
      finishedAt: '2026-08-11',
      activeLoan: { contact: { name: 'Petr Novák' } },
      shelves: [{ name: 'Oblíbené' }],
    });
    const shelves = (await as(reader).get('/api/shelves', ALL_ROWS)).body.data;
    expect(
      shelves.map(({ name, bookCount }: { name: string; bookCount: number }) => ({
        name,
        bookCount,
      }))
    ).toEqual([
      { name: 'Oblíbené', bookCount: 3 },
      { name: 'Klasika', bookCount: 4 },
      { name: 'Na dovolenou', bookCount: 2 },
    ]);
    expect((await as(reader).get('/api/contacts', ALL_ROWS)).body.total).toBe(SAMPLE_CONTACTS);
    expect((await as(reader).get('/api/stats')).body).toEqual({
      books: SAMPLE_BOOKS,
      reading: 1,
      contacts: SAMPLE_CONTACTS,
      lent: 2,
      overdue: 1,
      dueSoon: 1,
    });
  });

  it('speaks the reader’s language', async () => {
    const reader = await signUp({ locale: 'en' });

    await as(reader).post('/api/sample-library');

    const shelves = (await as(reader).get('/api/shelves', ALL_ROWS)).body.data;
    expect(shelves.map(({ name }: { name: string }) => name)).toEqual([
      'Favourites',
      'Classics',
      'Holiday reads',
    ]);
  });

  it('only goes into an empty library', async () => {
    const filledTwice = await signUp();
    await as(filledTwice).post('/api/sample-library');
    const withOwnShelf = await signUp();
    await as(withOwnShelf).post('/api/shelves', { name: 'Moje' });

    expect((await as(filledTwice).post('/api/sample-library')).status).toBe(CONFLICT);
    expect((await as(withOwnShelf).post('/api/sample-library')).status).toBe(CONFLICT);
    expect((await as(withOwnShelf).get('/api/sample-library')).body).toEqual({
      present: false,
      canFill: false,
    });
    expect((await as(filledTwice).get('/api/books')).body.total).toBe(SAMPLE_BOOKS);
  });

  it('fills a library once, even when asked twice at once', async () => {
    const reader = await signUp();

    const answers = await Promise.all([
      as(reader).post('/api/sample-library'),
      as(reader).post('/api/sample-library'),
    ]);

    expect(answers.map(({ status }) => status).sort()).toEqual([CREATED, CONFLICT]);
    expect((await as(reader).get('/api/books')).body.total).toBe(SAMPLE_BOOKS);
  });

  it('never reminds anyone of a sample loan', async () => {
    const reader = await signUp();
    await as(reader).post('/api/sample-library');

    await sendLoanReminders({
      models: app.core.models,
      emailService: app.core.emailService!,
      appBaseUrl: APP_BASE_URL,
      now: () => NOW,
    });

    expect(app.outbox.sent.filter(({ to }) => to === reader.email)).toEqual([]);
  });

  it('leaves the samples out of the administrators’ numbers', async () => {
    const reader = await signUp();
    await as(reader).post('/api/sample-library');
    await app.core.models.user.update({ role: 'admin' }, { where: { email: reader.email } });
    const admin = {
      ...reader,
      token: (
        await app.api().post('/api/auth/login').send({ email: reader.email, password: PASSWORD })
      ).body.token,
    };

    const stats = (await as(admin).get('/api/admin/stats')).body;
    const accounts = (await as(admin).get('/api/users', { q: reader.email })).body.data;

    expect(stats).toMatchObject({ books: 0, contacts: 0, lent: 0, overdue: 0 });
    expect(accounts).toMatchObject([{ email: reader.email, bookCount: 0 }]);
  });

  it('removes every sample and the loans of sample books and contacts, and nothing else', async () => {
    const reader = await signUp();
    await as(reader).post('/api/sample-library');
    const ownBook = (await as(reader).post('/api/books', { title: 'Moje kniha' })).body;
    const ownShelf = (await as(reader).post('/api/shelves', { name: 'Moje' })).body;
    await app
      .api()
      .put(`/api/books/${ownBook.id}/shelves`)
      .set('Authorization', bearer(reader.token))
      .send({ shelfIds: [ownShelf.id] });
    const sampleContact = (await as(reader).get('/api/contacts', ALL_ROWS)).body.data[0];
    await as(reader).post('/api/loans', {
      bookId: ownBook.id,
      contactId: sampleContact.id,
      lentAt: '2026-09-20',
    });

    const removed = await as(reader).delete('/api/sample-library');

    expect(removed.status).toBe(NO_CONTENT);
    const books = (await as(reader).get('/api/books', ALL_ROWS)).body;
    expect(books.data).toMatchObject([
      { id: ownBook.id, activeLoan: null, shelves: [{ id: ownShelf.id }] },
    ]);
    expect((await as(reader).get('/api/shelves', ALL_ROWS)).body.data).toMatchObject([
      { id: ownShelf.id },
    ]);
    expect((await as(reader).get('/api/contacts')).body.total).toBe(0);
    expect((await as(reader).get('/api/loans')).body.total).toBe(0);
    expect((await as(reader).get('/api/sample-library')).body).toEqual({
      present: false,
      canFill: false,
    });
  });

  it('removes only the reader’s own samples', async () => {
    const remover = await signUp();
    const neighbour = await signUp();
    await as(remover).post('/api/sample-library');
    await as(neighbour).post('/api/sample-library');

    await as(remover).delete('/api/sample-library');

    expect((await as(remover).get('/api/sample-library')).body).toEqual({
      present: false,
      canFill: true,
    });
    expect((await as(neighbour).get('/api/books')).body.total).toBe(SAMPLE_BOOKS);
  });

  it('keeps sample marks away from readers’ requests', async () => {
    const reader = await signUp();

    const book = await as(reader).post('/api/books', { title: 'Podvržená', isSample: true });

    expect(book.status).toBe(CREATED);
    expect(book.body.isSample).toBe(false);
    expect((await as(reader).get('/api/sample-library')).body.present).toBe(false);
  });
});
