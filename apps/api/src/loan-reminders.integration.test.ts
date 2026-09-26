import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EmailService } from '@eleansphere/be-core';
import { sendLoanReminders } from './jobs/loan-reminders';
import { APP_BASE_URL, bearer, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

/** 10:00 UTC: the same calendar day in Prague. */
const at = (date: string) => new Date(`${date}T10:00:00Z`);
const TODAY = '2026-09-25';
const LENT_AT = '2026-09-01';

const LENDER = 'lender@kniho-hlod.test';
const QUIET = 'quiet@kniho-hlod.test';
const ENGLISH = 'english@kniho-hlod.test';

interface Loan {
  title: string;
  author?: string;
  contact: string;
  dueAt?: string;
  returnedAt?: string;
}

describe('Loan reminders', () => {
  let app: TestApp;

  const signUp = async (email: string, profile: object = {}): Promise<string> => {
    const { token } = (await app.register(email)).body;
    await app.api().patch('/api/auth/me').set('Authorization', bearer(token)).send(profile);
    return token;
  };

  const lend = async (token: string, { title, author, contact, ...dates }: Loan) => {
    const post = (path: string, body: object) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body);
    const { body: book } = await post('/api/books', { title, author });
    const { body: person } = await post('/api/contacts', { name: contact });
    const res = await post('/api/loans', {
      bookId: book.id,
      contactId: person.id,
      lentAt: LENT_AT,
      ...dates,
    });
    expect(res.status).toBe(201);
  };

  const remind = (date: string, emailService?: EmailService) =>
    sendLoanReminders({
      models: app.core.models,
      emailService: emailService ?? app.core.emailService!,
      appBaseUrl: APP_BASE_URL,
      now: () => at(date),
    });

  const emailTo = (recipient: string) => app.outbox.sent.filter(({ to }) => to === recipient);

  beforeAll(async () => {
    app = await startTestApp({ now: () => at(TODAY) });
    const lender = await signUp(LENDER);
    const quiet = await signUp(QUIET, { emailReminders: false });
    const english = await signUp(ENGLISH, { locale: 'en', reminderDaysBefore: 0 });

    await lend(lender, {
      title: 'Hobit',
      author: 'J. R. R. Tolkien',
      contact: 'Anna',
      dueAt: '2026-09-27',
    });
    await lend(lender, { title: 'Duna', contact: 'Petr', dueAt: '2026-09-22' });
    await lend(lender, { title: 'Babička', contact: 'Eva', dueAt: '2026-10-20' });
    await lend(lender, {
      title: 'Krakatit',
      contact: 'Eva',
      dueAt: '2026-09-10',
      returnedAt: '2026-09-05',
    });
    await lend(lender, { title: 'Bez termínu', contact: 'Eva' });
    await lend(quiet, { title: 'Tichá kniha', contact: 'Jan', dueAt: '2026-09-20' });
    await lend(english, { title: 'The Hobbit', contact: 'Jane', dueAt: TODAY });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('e-mails each reader once about the loans due soon or overdue, in their language', async () => {
    app.outbox.clear();

    expect(await remind(TODAY)).toEqual({ readers: 2, loans: 3, failed: 0 });

    const [czech] = emailTo(LENDER);
    expect(czech.subject).toBe('Kniho-hlod: půjčené knihy po termínu');
    expect(czech.text).toContain(
      [
        '– Duna, půjčeno: Petr — termín byl 22. 9. 2026, 3 dny po termínu',
        '– Hobit (J. R. R. Tolkien), půjčeno: Anna — vrátit do 27. 9. 2026, za 2 dny',
      ].join('\n')
    );
    expect(czech.text).toContain(`${APP_BASE_URL}/loans`);
    expect(czech.html).toContain('<strong>Hobit (J. R. R. Tolkien)</strong>');

    const [english] = emailTo(ENGLISH);
    expect(english.subject).toBe('Kniho-hlod: lent books due back soon');
    expect(english.text).toContain('– The Hobbit, lent to Jane — due back today, Sep 25, 2026');

    expect(emailTo(QUIET)).toEqual([]);
  });

  it('sends nothing new on a second run the same day', async () => {
    app.outbox.clear();

    expect(await remind(TODAY)).toEqual({ readers: 0, loans: 0, failed: 0 });
    expect(app.outbox.sent).toEqual([]);
  });

  it('reminds again once a book turns overdue, and weekly after that', async () => {
    app.outbox.clear();

    // Hobit and The Hobbit are now past due; Duna was reminded of three days ago.
    expect(await remind('2026-09-28')).toEqual({ readers: 2, loans: 2, failed: 0 });
    expect(emailTo(LENDER)[0].text).toContain(
      'Hobit (J. R. R. Tolkien), půjčeno: Anna — termín byl'
    );
    expect(emailTo(LENDER)[0].text).not.toContain('Duna');
  });

  it('tries a reader again on the next run when their e-mail fails', async () => {
    const failing: EmailService = {
      send: async () => {
        throw new Error('SMTP down');
      },
    };

    // A week after Duna's last reminder.
    expect(await remind('2026-10-02', failing)).toEqual({ readers: 0, loans: 0, failed: 1 });
    app.outbox.clear();
    expect(await remind('2026-10-02')).toEqual({ readers: 1, loans: 1, failed: 0 });
    expect(emailTo(LENDER)[0].text).toContain('Duna, půjčeno: Petr');
  });
});
