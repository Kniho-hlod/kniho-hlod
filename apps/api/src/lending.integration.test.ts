import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sendBorrowerReminders } from './jobs/borrower-reminders';
import { sendLoanReminders } from './jobs/loan-reminders';
import { APP_BASE_URL, bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const UNAUTHORIZED = 401;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

/** 10:00 UTC: the same calendar day in Prague. */
const at = (date: string) => new Date(`${date}T10:00:00Z`);
const TODAY = '2026-09-27';
const IN_TWO_DAYS = '2026-09-29';
const DEFAULT_DUE = '2026-10-27';

interface Account {
  id: string;
  email: string;
  token: string;
}

describe('Lending between friends', () => {
  let app: TestApp;
  let registered = 0;
  let owner: Account;
  let friend: Account;
  let otherFriend: Account;
  let stranger: Account;

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  const signUp = async (displayName: string, profile: object = {}): Promise<Account> => {
    registered += 1;
    const email = `lender-${registered}@kniho-hlod.test`;
    const { body } = await app
      .api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName });
    const account = { id: body.user.id, email, token: body.token };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  const befriend = async (inviter: Account, invited: Account) => {
    const { code } = (await as(inviter).get('/api/me/invite')).body;
    await as(invited).post(`/api/invites/${code}/accept`);
  };

  const addBook = async (title: string, book: object = {}) =>
    (await as(owner).post('/api/books', { title, ...book })).body.id as string;

  const ask = (who: Account, bookId: string, body: object = {}) =>
    as(who).post(`/api/friends/${owner.id}/books/${bookId}/requests`, body);

  const incomingFor = async (who: Account) =>
    (await as(who).get('/api/loan-requests')).body.incoming as { id: string }[];

  const emailsTo = (account: Account) => app.outbox.sent.filter(({ to }) => to === account.email);

  beforeAll(async () => {
    app = await startTestApp({ now: () => at(TODAY) });
    owner = await signUp('Olga', { shareLibrary: true });
    friend = await signUp('Pavel', { locale: 'en' });
    otherFriend = await signUp('Cyril');
    stranger = await signUp('Radek');
    await befriend(owner, friend);
    await befriend(owner, otherFriend);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    app.outbox.sent.length = 0;
  });

  it('lets a friend ask for a shared book at home, and tells the owner', async () => {
    const bookId = await addBook('Saturnin');

    const asked = await ask(friend, bookId, { message: 'Na dovolenou?', dueAt: '2026-10-10' });

    expect(asked.status).toBe(CREATED);
    expect(asked.body).toMatchObject({
      book: { id: bookId, title: 'Saturnin' },
      person: { id: owner.id, displayName: 'Olga' },
      message: 'Na dovolenou?',
      dueAt: '2026-10-10',
    });
    expect((await as(owner).get('/api/loan-requests')).body.incoming).toMatchObject([
      { id: asked.body.id, person: { id: friend.id }, book: { title: 'Saturnin' } },
    ]);
    expect((await as(friend).get('/api/loan-requests')).body.outgoing).toMatchObject([
      { id: asked.body.id },
    ]);
    expect(
      (await as(friend).get(`/api/friends/${owner.id}/books/${bookId}`)).body.myRequest
    ).toEqual({ id: asked.body.id });
    expect((await as(owner).get('/api/notifications')).body.data[0]).toMatchObject({
      kind: 'loanRequest',
      actor: { id: friend.id },
      book: { id: bookId, title: 'Saturnin' },
    });
    const [email] = emailsTo(owner);
    expect(email?.subject).toBe('Pavel si chce půjčit „Saturnin“ — Kniho-hlod');
    expect(email?.text).toContain('Na dovolenou?');
    expect(email?.text).toContain(`${APP_BASE_URL}/loans`);
  });

  it('refuses what a friend may not ask for', async () => {
    const hidden = await addBook('Deník', { visibility: 'private' });
    const shared = await addBook('Hobit');
    const lent = await addBook('Krakatit');
    const contact = (await as(owner).post('/api/contacts', { name: 'Soused' })).body;
    await as(owner).post('/api/loans', { bookId: lent, contactId: contact.id, lentAt: TODAY });

    expect((await ask(stranger, shared)).status).toBe(NOT_FOUND);
    expect((await ask(friend, hidden)).status).toBe(NOT_FOUND);
    expect((await ask(friend, lent)).status).toBe(CONFLICT);
    expect((await ask(friend, shared, { dueAt: '2026-09-01' })).status).toBe(BAD_REQUEST);
    expect((await ask(owner, shared)).status).toBe(NOT_FOUND);
    expect((await ask(friend, shared)).status).toBe(CREATED);
    expect((await ask(friend, shared)).status).toBe(CONFLICT);

    await as(owner).patch('/api/auth/me', { shareLibrary: false });
    const unshared = await addBook('Babička');
    expect((await ask(friend, unshared)).status).toBe(NOT_FOUND);
    await as(owner).patch('/api/auth/me', { shareLibrary: true });
  });

  it('lends the book on accepting: a loan to a linked contact, the others declined', async () => {
    const bookId = await addBook('Malý princ');
    const request = (await ask(friend, bookId, { dueAt: '2026-10-20' })).body;
    await ask(otherFriend, bookId);

    expect((await as(friend).post(`/api/loan-requests/${request.id}/accept`)).status).toBe(
      NOT_FOUND
    );
    const accepted = await as(owner).post(`/api/loan-requests/${request.id}/accept`);

    expect(accepted.status).toBe(NO_CONTENT);
    const loans = (await as(owner).get(`/api/loans?bookId=${bookId}`)).body.data;
    expect(loans).toMatchObject([
      { lentAt: TODAY, dueAt: '2026-10-20', contact: { name: 'Pavel' }, returnedAt: null },
    ]);
    const contacts = (await as(owner).get('/api/contacts?limit=200')).body.data;
    expect(contacts.filter(({ name }: { name: string }) => name === 'Pavel')).toMatchObject([
      { linkedUserId: friend.id },
    ]);
    expect((await as(friend).get('/api/borrowed')).body).toMatchObject([
      {
        id: loans[0].id,
        book: { title: 'Malý princ' },
        lender: { id: owner.id },
        dueAt: '2026-10-20',
      },
    ]);
    expect(await incomingFor(owner)).not.toContainEqual(
      expect.objectContaining({ id: request.id })
    );
    expect((await as(friend).get('/api/notifications')).body.data[0]).toMatchObject({
      kind: 'loanRequestAccepted',
      book: { title: 'Malý princ' },
    });
    expect((await as(otherFriend).get('/api/notifications')).body.data[0]).toMatchObject({
      kind: 'loanRequestDeclined',
      book: { title: 'Malý princ' },
    });
    expect(emailsTo(friend).map(({ subject }) => subject)).toContain(
      'Olga will lend you “Malý princ” — Kniho-hlod'
    );
    expect((await as(friend).get(`/api/friends/${owner.id}/books/${bookId}`)).body).toMatchObject({
      lent: { dueAt: '2026-10-20' },
      myRequest: null,
    });

    await as(owner).post(`/api/loans/${loans[0].id}/return`);
    expect((await as(friend).get('/api/borrowed')).body).toEqual([]);
  });

  it('reuses the contact the owner has for the friend, and links it', async () => {
    const reader = await signUp('Hana');
    await befriend(owner, reader);
    const known = (
      await as(owner).post('/api/contacts', {
        name: 'Hanka ze školy',
        email: reader.email.toUpperCase(),
      })
    ).body;
    const first = await addBook('Babička II');
    const second = await addBook('Babička III');

    for (const bookId of [first, second]) {
      const request = (await ask(reader, bookId)).body;
      expect((await as(owner).post(`/api/loan-requests/${request.id}/accept`)).status).toBe(
        NO_CONTENT
      );
    }

    const contact = (await as(owner).get(`/api/contacts/${known.id}`)).body;
    expect(contact).toMatchObject({ linkedUserId: reader.id, activeLoans: 2 });
    expect((await as(reader).get('/api/borrowed')).body).toHaveLength(2);
  });

  it('takes the due date the owner picks, the default otherwise, and checks it', async () => {
    const chosen = await addBook('Dune');
    const defaulted = await addBook('Nadace');
    const early = await addBook('Robot');
    const chosenRequest = (await ask(friend, chosen, { dueAt: '2026-10-20' })).body;
    const defaultedRequest = (await ask(friend, defaulted)).body;
    const earlyRequest = (await ask(friend, early)).body;

    await as(owner).post(`/api/loan-requests/${chosenRequest.id}/accept`, { dueAt: IN_TWO_DAYS });
    await as(owner).post(`/api/loan-requests/${defaultedRequest.id}/accept`);
    const tooEarly = await as(owner).post(`/api/loan-requests/${earlyRequest.id}/accept`, {
      dueAt: '2026-09-01',
    });

    expect(tooEarly.status).toBe(BAD_REQUEST);
    const borrowed = (await as(friend).get('/api/borrowed')).body;
    expect(borrowed).toContainEqual(
      expect.objectContaining({
        book: expect.objectContaining({ title: 'Dune' }),
        dueAt: IN_TWO_DAYS,
      })
    );
    expect(borrowed).toContainEqual(
      expect.objectContaining({
        book: expect.objectContaining({ title: 'Nadace' }),
        dueAt: DEFAULT_DUE,
      })
    );
  });

  it('refuses to lend a book that went out meanwhile', async () => {
    const bookId = await addBook('Stopař');
    const request = (await ask(friend, bookId)).body;
    const contact = (await as(owner).post('/api/contacts', { name: 'Někdo jiný' })).body;
    await as(owner).post('/api/loans', { bookId, contactId: contact.id, lentAt: TODAY });

    expect((await as(owner).post(`/api/loan-requests/${request.id}/accept`)).status).toBe(CONFLICT);
    expect(await incomingFor(owner)).toContainEqual(expect.objectContaining({ id: request.id }));
  });

  it('lets the owner decline and the friend take back, each only their own side', async () => {
    const bookId = await addBook('Tři muži ve člunu');
    const request = (await ask(friend, bookId)).body;

    expect((await as(friend).post(`/api/loan-requests/${request.id}/decline`)).status).toBe(
      NOT_FOUND
    );
    expect((await as(owner).post(`/api/loan-requests/${request.id}/decline`)).status).toBe(
      NO_CONTENT
    );
    expect((await as(friend).get('/api/notifications')).body.data[0]).toMatchObject({
      kind: 'loanRequestDeclined',
    });
    expect(emailsTo(friend).map(({ subject }) => subject)).toContain(
      "“Tři muži ve člunu” can't be lent right now — Kniho-hlod"
    );

    const again = (await ask(friend, bookId)).body;
    expect((await as(owner).post(`/api/loan-requests/${again.id}/cancel`)).status).toBe(NOT_FOUND);
    expect((await as(friend).post(`/api/loan-requests/${again.id}/cancel`)).status).toBe(
      NO_CONTENT
    );
    expect(await incomingFor(owner)).not.toContainEqual(expect.objectContaining({ id: again.id }));
  });

  it('drops the waiting requests when the friendship ends, keeping loans', async () => {
    const leaving = await signUp('Věra');
    await befriend(owner, leaving);
    const waiting = await addBook('Kytice');
    const lent = await addBook('Máj');
    await ask(leaving, waiting);
    const lentRequest = (await ask(leaving, lent)).body;
    await as(owner).post(`/api/loan-requests/${lentRequest.id}/accept`);

    await as(leaving).delete(`/api/friends/${owner.id}`);

    expect((await as(leaving).get('/api/loan-requests')).body.outgoing).toEqual([]);
    expect((await as(leaving).get('/api/borrowed')).body).toMatchObject([
      { book: { title: 'Máj' } },
    ]);
  });

  describe('reminders', () => {
    it('remind the friend of a borrowed book by their own settings, once a day', async () => {
      const reader = await signUp('Zdena', { reminderDaysBefore: 2 });
      const quiet = await signUp('Tichý', { emailReminders: false });
      await befriend(owner, reader);
      await befriend(owner, quiet);
      for (const [who, title] of [
        [reader, 'Válka s mloky'],
        [quiet, 'R.U.R.'],
      ] as const) {
        const bookId = await addBook(title);
        const request = (await ask(who, bookId)).body;
        await as(owner).post(`/api/loan-requests/${request.id}/accept`, { dueAt: IN_TWO_DAYS });
      }
      const run = () =>
        sendBorrowerReminders({
          models: app.core.models,
          emailService: app.core.emailService!,
          appBaseUrl: APP_BASE_URL,
          now: () => at(TODAY),
        });

      const first = await run();
      const second = await run();

      const remindersTo = (account: Account) =>
        emailsTo(account).filter(({ subject }) => subject.startsWith('Kniho-hlod:'));
      const reminders = remindersTo(reader);
      expect(reminders).toHaveLength(1);
      const [email] = reminders;
      expect(email?.subject).toBe('Kniho-hlod: blíží se vrácení knih');
      expect(email?.text).toContain('„Válka s mloky“ (Olga) — vrátit do');
      expect(email?.text).toContain(`${APP_BASE_URL}/loans?tab=borrowed`);
      expect(remindersTo(quiet)).toEqual([]);
      expect(first.borrowers).toBeGreaterThanOrEqual(1);
      expect(second).toEqual({ borrowers: 0, loans: 0, failed: 0 });

      await sendLoanReminders({
        models: app.core.models,
        emailService: app.core.emailService!,
        appBaseUrl: APP_BASE_URL,
        now: () => at(TODAY),
      });
      expect(
        emailsTo(owner)
          .map(({ text }) => text)
          .join('\n')
      ).toContain('Válka s mloky');
    });
  });

  it('asks for a signed-in reader', async () => {
    expect((await app.api().get('/api/loan-requests')).status).toBe(UNAUTHORIZED);
    expect((await app.api().get('/api/borrowed')).status).toBe(UNAUTHORIZED);
  });
});
