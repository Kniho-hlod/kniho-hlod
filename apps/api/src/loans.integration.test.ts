import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

/** 10:00 UTC, so the same day in Prague: "today" for every reader below is 2026-09-25. */
const NOW = new Date('2026-09-25T10:00:00Z');
const TODAY = '2026-09-25';

const CREATED = 201;
const OK = 200;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

interface Reader {
  token: string;
}

describe('Loans', () => {
  let app: TestApp;
  let owner: Reader;
  let stranger: Reader;

  const as = (reader: Reader) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(reader.token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(reader.token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(reader.token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(reader.token)),
  });

  const createBook = async (reader: Reader, title: string): Promise<string> => {
    const res = await as(reader).post('/api/books', { title });
    expect(res.status).toBe(CREATED);
    return res.body.id;
  };

  const createContact = async (reader: Reader, name: string): Promise<string> => {
    const res = await as(reader).post('/api/contacts', { name });
    expect(res.status).toBe(CREATED);
    return res.body.id;
  };

  const lend = (reader: Reader, loan: Record<string, unknown>) =>
    as(reader).post('/api/loans', { lentAt: TODAY, ...loan });

  beforeAll(async () => {
    app = await startTestApp({ now: () => NOW });
    owner = (await app.register('lender@kniho-hlod.test')).body;
    stranger = (await app.register('stranger@kniho-hlod.test')).body;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('contacts', () => {
    it('lists the reader’s own contacts by name, searchable', async () => {
      await createContact(owner, 'Zdeněk');
      await createContact(owner, 'Anna');
      await createContact(stranger, 'Adam');

      const all = await as(owner).get('/api/contacts');
      expect(all.body.data.map((contact: { name: string }) => contact.name)).toEqual([
        'Anna',
        'Zdeněk',
      ]);
      expect(all.body.data[0].activeLoans).toBe(0);

      const found = await as(owner).get('/api/contacts').query({ q: 'zde' });
      expect(found.body.data.map((contact: { name: string }) => contact.name)).toEqual(['Zdeněk']);
    });

    it('never takes linkedUserId from a request', async () => {
      const res = await as(owner).post('/api/contacts', { name: 'Eva', linkedUserId: 'u_1' });
      expect(res.status).toBe(CREATED);
      expect(res.body.linkedUserId).toBeNull();
    });
  });

  describe('lending', () => {
    it('answers with the book and the contact', async () => {
      const bookId = await createBook(owner, 'Hobit');
      const contactId = await createContact(owner, 'Jana');

      const res = await lend(owner, { bookId, contactId, dueAt: '2026-10-25' });

      expect(res.status).toBe(CREATED);
      expect(res.body).toMatchObject({
        bookId,
        contactId,
        lentAt: TODAY,
        dueAt: '2026-10-25',
        returnedAt: null,
        book: { id: bookId, title: 'Hobit', author: null, cover: null },
        contact: { id: contactId, name: 'Jana' },
      });
    });

    it('refuses someone else’s book or contact', async () => {
      const foreignBook = await createBook(stranger, 'Cizí kniha');
      const contactId = await createContact(owner, 'Petr');

      const res = await lend(owner, { bookId: foreignBook, contactId });

      expect(res.status).toBe(BAD_REQUEST);
      expect(res.body.issues).toEqual([
        expect.objectContaining({ path: 'bookId', code: 'reference' }),
      ]);
    });

    it('refuses a due date before the day of lending, also in a partial update', async () => {
      const bookId = await createBook(owner, 'Duna');
      const contactId = await createContact(owner, 'Karel');

      const early = await lend(owner, { bookId, contactId, dueAt: '2026-09-24' });
      expect(early.status).toBe(BAD_REQUEST);
      expect(early.body.issues).toEqual([{ path: 'dueAt', code: 'min', params: { min: TODAY } }]);

      const { body: loan } = await lend(owner, { bookId, contactId });
      const patched = await as(owner).patch(`/api/loans/${loan.id}`, { dueAt: '2026-09-01' });
      expect(patched.status).toBe(BAD_REQUEST);
      expect(patched.body.issues).toEqual([{ path: 'dueAt', code: 'min', params: { min: TODAY } }]);
    });

    it('lends a book once at a time, even when two requests race', async () => {
      const bookId = await createBook(owner, 'Mistr a Markétka');
      const contactId = await createContact(owner, 'Lída');

      const answers = await Promise.all([
        lend(owner, { bookId, contactId }),
        lend(owner, { bookId, contactId }),
      ]);

      expect(answers.map((res) => res.status).sort()).toEqual([CREATED, CONFLICT]);
    });
  });

  describe('books and contacts with loans', () => {
    let bookId: string;
    let contactId: string;
    let loanId: string;

    beforeAll(async () => {
      bookId = await createBook(owner, 'Saturnin');
      contactId = await createContact(owner, 'Olga');
      loanId = (await lend(owner, { bookId, contactId, dueAt: '2026-10-01' })).body.id;
    });

    it('shows the active loan on the book and the count on the contact', async () => {
      const book = await as(owner).get(`/api/books/${bookId}`);
      expect(book.body.activeLoan).toEqual({
        id: loanId,
        lentAt: TODAY,
        dueAt: '2026-10-01',
        contact: { id: contactId, name: 'Olga' },
      });

      const contact = await as(owner).get(`/api/contacts/${contactId}`);
      expect(contact.body.activeLoans).toBe(1);
    });

    it('filters books by whether they are lent out', async () => {
      const lent = await as(owner).get('/api/books').query({ lent: 'true', q: 'Saturnin' });
      expect(lent.body.data.map((book: { id: string }) => book.id)).toEqual([bookId]);

      const atHome = await as(owner).get('/api/books').query({ lent: 'false', q: 'Saturnin' });
      expect(atHome.body.data).toEqual([]);

      expect((await as(owner).get('/api/books').query({ lent: 'maybe' })).status).toBe(BAD_REQUEST);
    });

    it('keeps a lent book and its borrower from being deleted', async () => {
      expect((await as(owner).delete(`/api/books/${bookId}`)).status).toBe(CONFLICT);
      expect((await as(owner).delete(`/api/contacts/${contactId}`)).status).toBe(CONFLICT);
    });
  });

  describe('returning', () => {
    it('marks the loan returned today, once', async () => {
      const bookId = await createBook(owner, 'Krakatit');
      const contactId = await createContact(owner, 'Tomáš');
      const { body: loan } = await lend(owner, { bookId, contactId, lentAt: '2026-09-01' });

      expect((await as(stranger).post(`/api/loans/${loan.id}/return`)).status).toBe(NOT_FOUND);

      const returned = await as(owner).post(`/api/loans/${loan.id}/return`);
      expect(returned.status).toBe(OK);
      expect(returned.body).toMatchObject({
        id: loan.id,
        returnedAt: TODAY,
        book: { title: 'Krakatit' },
        contact: { name: 'Tomáš' },
      });

      expect((await as(owner).post(`/api/loans/${loan.id}/return`)).status).toBe(CONFLICT);
      expect((await as(owner).get(`/api/books/${bookId}`)).body.activeLoan).toBeNull();
      expect((await lend(owner, { bookId, contactId })).status).toBe(CREATED);
    });

    it('takes the day from the request, but not one before the lending', async () => {
      const bookId = await createBook(owner, 'Válka s mloky');
      const contactId = await createContact(owner, 'Věra');
      const { body: loan } = await lend(owner, { bookId, contactId, lentAt: '2026-09-10' });

      const early = await as(owner).post(`/api/loans/${loan.id}/return`, {
        returnedAt: '2026-09-09',
      });
      expect(early.status).toBe(BAD_REQUEST);
      expect(early.body.issues).toEqual([
        { path: 'returnedAt', code: 'min', params: { min: '2026-09-10' } },
      ]);

      const malformed = await as(owner).post(`/api/loans/${loan.id}/return`, {
        returnedAt: 'yesterday',
      });
      expect(malformed.status).toBe(BAD_REQUEST);

      const onTime = await as(owner).post(`/api/loans/${loan.id}/return`, {
        returnedAt: '2026-09-20',
      });
      expect(onTime.body.returnedAt).toBe('2026-09-20');
    });

    it('lets a returned book and its borrower go, loan history included', async () => {
      const bookId = await createBook(owner, 'Bylo nás pět');
      const contactId = await createContact(owner, 'Péťa');
      const { body: loan } = await lend(owner, { bookId, contactId });
      await as(owner).post(`/api/loans/${loan.id}/return`);

      expect((await as(owner).delete(`/api/books/${bookId}`)).status).toBe(NO_CONTENT);
      expect((await as(owner).get(`/api/loans/${loan.id}`)).status).toBe(NOT_FOUND);
      expect((await as(owner).delete(`/api/contacts/${contactId}`)).status).toBe(NO_CONTENT);
    });
  });

  describe('stats', () => {
    it('counts the reader’s books, contacts and loans by how they stand today', async () => {
      const reader = (await app.register('stats@kniho-hlod.test')).body as Reader;
      const contactId = await createContact(reader, 'Soused');
      const dueDates = ['2026-09-20', '2026-09-25', '2026-10-02', '2026-12-24', null];
      for (const [index, dueAt] of dueDates.entries()) {
        const bookId = await createBook(reader, `Kniha ${index}`);
        expect(
          (await lend(reader, { bookId, contactId, lentAt: '2026-09-01', dueAt })).status
        ).toBe(CREATED);
      }
      await as(reader).post('/api/books', { title: 'Čtu', readingStatus: 'reading' });

      const stats = await as(reader).get('/api/stats');

      expect(stats.status).toBe(OK);
      expect(stats.body).toEqual({
        books: 6,
        reading: 1,
        contacts: 1,
        lent: 5,
        overdue: 1,
        dueSoon: 2,
      });
    });

    it('needs a signed-in reader', async () => {
      expect((await app.api().get('/api/stats')).status).toBe(401);
    });
  });
});
