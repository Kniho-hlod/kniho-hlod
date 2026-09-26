import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  APP_BASE_URL,
  bearer,
  PASSWORD,
  PNG_SIGNATURE,
  startTestApp,
} from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;

const USER_AGENT = 'Mozilla/5.0 (Test) KnihoHlodBrowser/1.0';
const REPORT = {
  kind: 'bug',
  message: 'Po uložení knihy zmizí obálka.\nStalo se to dvakrát.',
  pageUrl: '/books/bk_1/edit',
  appVersion: 'abc1234',
  viewport: '390×844',
};

interface Account {
  id: string;
  token: string;
}

describe('Feedback', () => {
  let app: TestApp;
  let admin: Account;
  let reader: Account;

  const signIn = async (email: string): Promise<Account> => {
    const { body } = await app.api().post('/api/auth/login').send({ email, password: PASSWORD });
    return { id: body.id, token: body.token };
  };

  const signUp = async (email: string): Promise<Account> => {
    const { body } = await app.register(email);
    return { id: body.id, token: body.token };
  };

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object) =>
      app
        .api()
        .post(path)
        .set('Authorization', bearer(token))
        .set('User-Agent', USER_AGENT)
        .send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  const uploadScreenshot = (account: Account, reportId: string) =>
    app
      .api()
      .post('/api/files')
      .set('Authorization', bearer(account.token))
      .field('refType', 'feedback')
      .field('refId', reportId)
      .field('role', 'screenshot')
      .attach('file', PNG_SIGNATURE, { filename: 'screenshot.png', contentType: 'image/png' });

  beforeAll(async () => {
    app = await startTestApp();
    await app.register('admin@kniho-hlod.test');
    await app.core.models.user.update(
      { role: 'admin', locale: 'en' },
      { where: { email: 'admin@kniho-hlod.test' } }
    );
    admin = await signIn('admin@kniho-hlod.test');
    reader = await signUp('reader@kniho-hlod.test');
  });

  beforeEach(() => app.outbox.clear());

  afterAll(async () => {
    await app?.close();
  });

  it('stores a report as the reader’s, with their browser, and e-mails the administrators', async () => {
    const res = await as(reader).post('/api/feedback', { ...REPORT, status: 'resolved' });

    expect(res.status).toBe(CREATED);
    expect(res.body).toMatchObject({
      ...REPORT,
      reporterId: reader.id,
      userAgent: USER_AGENT,
      status: 'new',
    });
    expect(res.body.id).toMatch(/^fb_/);

    expect(app.outbox.sent).toHaveLength(1);
    const [email] = app.outbox.sent;
    expect(email.to).toBe('admin@kniho-hlod.test');
    // In the administrator's language, quoting the message's first line.
    expect(email.subject).toBe('Bug: Po uložení knihy zmizí obálka. — Kniho-hlod');
    expect(email.text).toContain('reader@kniho-hlod.test');
    expect(email.text).toContain('Page: /books/bk_1/edit');
    expect(email.text).toContain(`${APP_BASE_URL}/admin/feedback`);
  });

  it('needs a signed-in reader and a message', async () => {
    expect((await app.api().post('/api/feedback').send(REPORT)).status).toBe(UNAUTHORIZED);

    const res = await as(reader).post('/api/feedback', { kind: 'bug', message: '' });

    expect(res.status).toBe(BAD_REQUEST);
    expect(res.body.issues).toEqual([expect.objectContaining({ path: 'message' })]);
    expect(app.outbox.sent).toHaveLength(0);
  });

  it('lists reports to administrators only, with the reporter and screenshot', async () => {
    const { body: report } = await as(reader).post('/api/feedback', {
      kind: 'idea',
      message: 'Řazení podle autora',
    });
    expect((await uploadScreenshot(reader, report.id)).status).toBe(CREATED);

    expect((await as(reader).get('/api/admin/feedback')).status).toBe(FORBIDDEN);
    const res = await as(admin).get('/api/admin/feedback').query({ kind: 'idea' });

    expect(res.status).toBe(OK);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: report.id,
      reporter: { id: reader.id, displayName: 'Reader', email: 'reader@kniho-hlod.test' },
      screenshot: { mimeType: 'image/png' },
    });
  });

  it('lets only the reporter attach a screenshot', async () => {
    const { body: report } = await as(reader).post('/api/feedback', REPORT);
    const stranger = await signUp('stranger@kniho-hlod.test');

    expect((await uploadScreenshot(stranger, report.id)).status).toBe(FORBIDDEN);
    expect((await uploadScreenshot(admin, report.id)).status).toBe(FORBIDDEN);
  });

  it('lets administrators resolve and delete reports, but nothing else', async () => {
    const { body: report } = await as(reader).post('/api/feedback', REPORT);
    await uploadScreenshot(reader, report.id);

    expect(
      (await as(reader).patch(`/api/admin/feedback/${report.id}`, { status: 'resolved' })).status
    ).toBe(FORBIDDEN);
    expect((await as(admin).post('/api/admin/feedback', REPORT)).status).toBe(FORBIDDEN);

    const resolved = await as(admin).patch(`/api/admin/feedback/${report.id}`, {
      status: 'resolved',
      message: 'Rewritten',
    });
    expect(resolved.status).toBe(OK);
    expect(resolved.body).toMatchObject({ status: 'resolved', message: REPORT.message });

    expect((await as(admin).delete(`/api/admin/feedback/${report.id}`)).status).toBe(NO_CONTENT);
    const { models } = app.core;
    expect(await models.File.count({ where: { refType: 'feedback', refId: report.id } })).toBe(0);
  });

  it('counts unresolved reports in the administrators’ stats', async () => {
    const unresolved = await app.core.models.feedback.count({ where: { status: 'new' } });

    const res = await as(admin).get('/api/admin/stats');

    expect(res.body.newFeedback).toBe(unresolved);
    expect(unresolved).toBeGreaterThan(0);
  });

  it('goes with the account that sent it', async () => {
    const leaving = await signUp('leaving@kniho-hlod.test');
    await as(leaving).post('/api/feedback', REPORT);

    const res = await app
      .api()
      .delete('/api/auth/me')
      .set('Authorization', bearer(leaving.token))
      .send({ password: PASSWORD });

    expect(res.status).toBe(NO_CONTENT);
    expect(await app.core.models.feedback.count({ where: { reporterId: leaving.id } })).toBe(0);
  });
});
