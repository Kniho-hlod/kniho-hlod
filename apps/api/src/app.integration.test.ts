import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  APP_BASE_URL,
  bearer,
  PASSWORD,
  PNG_SIGNATURE,
  startTestApp,
} from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;
const BCRYPT_TEST_ROUNDS = 4;

describe('Kniho-hlod API', () => {
  let app: TestApp;

  const api = () => app.api();
  const register = (email: string) => app.register(email);

  async function signInAsAdmin(): Promise<string> {
    await app.core.models.user.create({
      id: 'u_admin',
      email: 'admin@test.cz',
      displayName: 'Admin',
      password: await bcrypt.hash(PASSWORD, BCRYPT_TEST_ROUNDS),
      role: 'admin',
    });
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'admin@test.cz', password: PASSWORD });
    return res.body.token;
  }

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a reader with the default profile', async () => {
    const res = await register('reader@test.cz');

    expect(res.status).toBe(201);
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      displayName: 'Reader',
      role: 'user',
      locale: 'cs',
      timezone: 'Europe/Prague',
      emailReminders: true,
      reminderDaysBefore: 2,
    });
  });

  it('lets a reader change their profile, but not their role', async () => {
    const { body: session } = await register('profile@test.cz');

    const res = await api()
      .patch('/api/auth/me')
      .set('Authorization', bearer(session.token))
      .send({ locale: 'en', reminderDaysBefore: 5, role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ locale: 'en', reminderDaysBefore: 5, role: 'user' });
  });

  it('emails a password reset link into the web app', async () => {
    await register('forgot@test.cz');
    app.outbox.clear();

    await api().post('/api/auth/forgot-password').send({ email: 'forgot@test.cz' });

    await vi.waitFor(() => expect(app.outbox.sent).toHaveLength(1));
    expect(app.outbox.sent[0].text).toContain(`${APP_BASE_URL}/reset-password?token=`);
  });

  it('e-mails a new reader a link that confirms their address, in their language', async () => {
    app.outbox.clear();
    const { body: session } = await api()
      .post('/api/auth/register')
      .send({ email: 'New.Reader@Test.cz', password: PASSWORD, displayName: 'Nová', locale: 'en' });

    expect(session.user).toMatchObject({ email: 'new.reader@test.cz', emailVerifiedAt: null });
    expect(session.user).not.toHaveProperty('inviteCodeIssuedAt');
    const [email] = app.outbox.sent;
    expect(email).toMatchObject({
      to: 'new.reader@test.cz',
      subject: 'Confirm your email — Kniho-hlod',
    });
    expect(email.text).toContain('Hello Nová,');
    const link = new URL(/https:\S+/.exec(email.text ?? '')?.[0] ?? '');
    expect(`${link.origin}${link.pathname}`).toBe(`${APP_BASE_URL}/verify-email`);

    const verified = await api()
      .post('/api/auth/verify-email')
      .send({ token: link.searchParams.get('token') });
    expect(verified.status).toBe(200);
    expect(verified.body.emailVerifiedAt).toBeTypeOf('string');
    const me = await api().get('/api/auth/me').set('Authorization', bearer(session.token));
    expect(me.body.emailVerifiedAt).toBe(verified.body.emailVerifiedAt);
    // Nobody confirms an address by editing their profile.
    const patched = await api()
      .patch('/api/auth/me')
      .set('Authorization', bearer(session.token))
      .send({ emailVerifiedAt: null });
    expect(patched.body.emailVerifiedAt).toBe(verified.body.emailVerifiedAt);
  });

  it('lets only administrators manage announcements, and shows active ones to everyone', async () => {
    const adminToken = await signInAsAdmin();
    const { body: reader } = await register('announcements@test.cz');
    const now = Date.now();
    const announcement = {
      title: 'Planned maintenance',
      message: 'The app will be unavailable tonight.',
      activeFrom: new Date(now - DAY_MS).toISOString(),
      activeTo: new Date(now + DAY_MS).toISOString(),
    };

    const byReader = await api()
      .post('/api/system-notifications')
      .set('Authorization', bearer(reader.token))
      .send(announcement);
    expect(byReader.status).toBe(403);

    const invertedRange = await api()
      .post('/api/system-notifications')
      .set('Authorization', bearer(adminToken))
      .send({
        ...announcement,
        activeTo: announcement.activeFrom,
        activeFrom: announcement.activeTo,
      });
    expect(invertedRange.status).toBe(400);
    expect(invertedRange.body.issues).toEqual([
      { path: 'activeTo', code: 'min', params: { after: 'activeFrom' } },
    ]);

    const byAdmin = await api()
      .post('/api/system-notifications')
      .set('Authorization', bearer(adminToken))
      .send(announcement);
    expect(byAdmin.status).toBe(201);

    // One end sent alone is checked against the stored other.
    const endBeforeStart = await api()
      .patch(`/api/system-notifications/${byAdmin.body.id}`)
      .set('Authorization', bearer(adminToken))
      .send({ activeTo: new Date(now - 2 * DAY_MS).toISOString() });
    expect(endBeforeStart.status).toBe(400);

    const active = await api().get('/api/system-notifications/active');
    expect(active.status).toBe(200);
    expect(active.body.map((item: { title: string }) => item.title)).toContain(announcement.title);
  });

  it("accepts only the reader's own avatar", async () => {
    const { body: reader } = await register('avatar@test.cz');
    const upload = (fields: Record<string, string>) => {
      let call = api().post('/api/files').set('Authorization', bearer(reader.token));
      for (const [name, value] of Object.entries(fields)) call = call.field(name, value);
      return call.attach('file', PNG_SIGNATURE, { filename: 'me.png', contentType: 'image/png' });
    };

    expect((await upload({ refType: 'user', refId: reader.id, role: 'avatar' })).status).toBe(201);
    expect((await upload({ refType: 'user', refId: 'u_someone', role: 'avatar' })).status).toBe(
      403
    );
    expect((await upload({ refType: 'user', refId: reader.id, role: 'banner' })).status).toBe(403);
  });
});
