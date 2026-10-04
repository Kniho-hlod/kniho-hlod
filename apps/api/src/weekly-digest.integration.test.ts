import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sendWeeklyDigests } from './jobs/weekly-digest';
import { APP_BASE_URL, bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A Sunday, noon in Prague; the friends' books date from the Thursday before. */
const SUNDAY = new Date('2030-01-06T11:00:00Z');
const THURSDAY = '2030-01-03';

interface Account {
  id: string;
  email: string;
  token: string;
}

describe('The weekly e-mail', () => {
  let app: TestApp;
  let registered = 0;
  let reader: Account;
  let english: Account;
  let quiet: Account;
  let sharer: Account;
  let private_: Account;
  let stranger: Account;
  const sunday = SUNDAY;

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
  });

  const signUp = async (displayName: string, profile: object = {}): Promise<Account> => {
    registered += 1;
    const email = `digest-${registered}@kniho-hlod.test`;
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

  const send = (at: Date) =>
    sendWeeklyDigests({
      models: app.core.models,
      emailService: app.core.emailService!,
      appBaseUrl: APP_BASE_URL,
      now: () => at,
    });

  const emailTo = ({ email }: Account) => app.outbox.sent.filter(({ to }) => to === email);

  beforeAll(async () => {
    app = await startTestApp();
    reader = await signUp('Věra');
    english = await signUp('Jane', { locale: 'en' });
    quiet = await signUp('Tichá', { weeklyDigest: false });
    sharer = await signUp('Jana', { shareLibrary: true });
    private_ = await signUp('Karel');
    stranger = await signUp('Radek', { shareLibrary: true });
    for (const friend of [reader, english, quiet]) await befriend(sharer, friend);
    await befriend(reader, private_);

    await as(sharer).post('/api/books', {
      title: 'Duna',
      author: 'Frank Herbert',
      readingStatus: 'read',
      startedAt: '2030-01-01',
      finishedAt: THURSDAY,
      rating: 5,
    });
    await as(sharer).post('/api/books', { title: 'Hobit', readingStatus: 'reading' });
    await as(sharer).post('/api/books', { title: 'Babička', readingStatus: 'want' });
    await as(sharer).post('/api/books', { title: 'Nečtená', readingStatus: 'none' });
    await as(sharer).post('/api/books', {
      title: 'Skrytá',
      readingStatus: 'reading',
      visibility: 'private',
    });
    await as(private_).post('/api/books', { title: 'Soukromá', readingStatus: 'reading' });
    await as(stranger).post('/api/books', { title: 'Cizí', readingStatus: 'reading' });
    await as(stranger).post('/api/friends/invitations', { email: reader.email });
    // As if the books had been added and changed that Thursday.
    await app.core.sequelize.query(
      `UPDATE "${app.schema}"."books" SET "createdAt" = $1, "updatedAt" = $1`,
      { bind: [`${THURSDAY}T12:00:00Z`] }
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('waits for Sunday', async () => {
    app.outbox.clear();

    expect(await send(new Date(sunday.getTime() - DAY_MS))).toEqual({ readers: 0, failed: 0 });
    expect(app.outbox.sent).toEqual([]);
  });

  it('tells each reader what their sharing friends read and what waits for them', async () => {
    app.outbox.clear();

    expect(await send(sunday)).toEqual({ readers: 2, failed: 0 });

    const [czech] = emailTo(reader);
    expect(czech.subject).toBe('Kniho-hlod: co je nového u přátel');
    expect(czech.text).toContain('– Jana má dočteno „Duna“ (Frank Herbert), hodnocení 5/5');
    expect(czech.text).toContain('– Jana čte „Hobit“');
    expect(czech.text).toContain('– Jana si chce přečíst „Babička“');
    for (const hidden of ['Nečtená', 'Skrytá', 'Soukromá', 'Cizí']) {
      expect(czech.text).not.toContain(hidden);
    }
    expect(czech.text).toContain('V aplikaci na vás čeká:\n\n– 1 žádost o přátelství');
    expect(czech.text).toContain(`${APP_BASE_URL}/friends?tab=feed`);
    expect(czech.text).toContain(`${APP_BASE_URL}/account`);
    expect(czech.html).toContain('<li>Jana čte „Hobit“</li>');

    const [inEnglish] = emailTo(english);
    expect(inEnglish.subject).toBe('Kniho-hlod: what your friends are reading');
    expect(inEnglish.text).toContain('– Jana finished “Duna” (Frank Herbert), rated 5/5');
    expect(inEnglish.text).not.toContain('Waiting for you');

    // The e-mail turned off, and nothing to tell the ones whose friends don't share.
    expect(emailTo(quiet)).toEqual([]);
    expect(emailTo(sharer)).toEqual([]);
    expect(emailTo(stranger)).toEqual([]);
  });

  it('sends nothing more the same week', async () => {
    app.outbox.clear();

    expect(await send(sunday)).toEqual({ readers: 0, failed: 0 });
    expect(await send(new Date(sunday.getTime() + 3 * DAY_MS))).toEqual({ readers: 0, failed: 0 });
    expect(app.outbox.sent).toEqual([]);
  });

  it('a week later tells only what is new', async () => {
    app.outbox.clear();
    const nextSunday = new Date(sunday.getTime() + 7 * DAY_MS);

    // The friend request still waits; the books were in last week's e-mail.
    expect(await send(nextSunday)).toEqual({ readers: 1, failed: 0 });
    const [czech] = emailTo(reader);
    expect(czech.text).not.toContain('Jana');
    expect(czech.text).toContain('Dobrý den, Věra,\n\nv aplikaci na vás čeká:');
  });
});
