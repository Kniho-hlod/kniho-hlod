import crypto from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createCore,
  createSequelize,
  MemoryEmailTransport,
  MemoryStorageAdapter,
} from '@eleansphere/be-core';
import type { CoreInstance } from '@eleansphere/be-core';
import { buildAppConfig } from './app-config';
import type { Environment } from './env';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://kniho:kniho@localhost:5434/kniho';
const APP_BASE_URL = 'https://app.test';
const PASSWORD = 'correct-horse-battery';
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const DAY_MS = 24 * 60 * 60 * 1000;
const BCRYPT_TEST_ROUNDS = 4;

const environment: Environment = {
  isProduction: false,
  port: 0,
  databaseUrl: TEST_DATABASE_URL,
  databaseSsl: false,
  jwtSecret: 'integration-test-secret-of-sufficient-length',
  appBaseUrl: APP_BASE_URL,
  corsOrigins: [APP_BASE_URL],
  trustProxy: undefined,
  emailFrom: 'Kniho-hlod <noreply@test.cz>',
  email: { kind: 'log' },
  storage: { kind: 'memory' },
};

describe('Kniho-hlod API', () => {
  const schema = `test_${crypto.randomBytes(6).toString('hex')}`;
  const database = createSequelize({ databaseUrl: TEST_DATABASE_URL, ssl: false });
  const outbox = new MemoryEmailTransport();
  let core: CoreInstance;

  const api = () => request(core.app);
  const register = (email: string) =>
    api().post('/api/auth/register').send({ email, password: PASSWORD, displayName: 'Reader' });
  const bearer = (token: string) => `Bearer ${token}`;

  async function signInAsAdmin(): Promise<string> {
    await core.models.user.create({
      id: 'u_admin',
      email: 'admin@test.cz',
      displayName: 'Admin',
      password: await bcrypt.hash(PASSWORD, BCRYPT_TEST_ROUNDS),
      role: 'admin',
    });
    const res = await api().post('/api/auth/login').send({ email: 'admin@test.cz', password: PASSWORD });
    return res.body.token;
  }

  beforeAll(async () => {
    await database.query(`CREATE SCHEMA "${schema}"`);
    core = await createCore(
      buildAppConfig(environment, {
        schema,
        emailTransport: outbox,
        storageAdapter: new MemoryStorageAdapter(),
        rateLimit: 'off',
      })
    );
  });

  afterAll(async () => {
    await core?.close();
    await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await database.close();
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
    outbox.clear();

    await api().post('/api/auth/forgot-password').send({ email: 'forgot@test.cz' });

    await vi.waitFor(() => expect(outbox.sent).toHaveLength(1));
    expect(outbox.sent[0].text).toContain(`${APP_BASE_URL}/reset-password?token=`);
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
      .send({ ...announcement, activeTo: announcement.activeFrom, activeFrom: announcement.activeTo });
    expect(invertedRange.status).toBe(400);
    expect(invertedRange.body.issues).toEqual([
      { path: 'activeTo', code: 'min', params: { after: 'activeFrom' } },
    ]);

    const byAdmin = await api()
      .post('/api/system-notifications')
      .set('Authorization', bearer(adminToken))
      .send(announcement);
    expect(byAdmin.status).toBe(201);

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

  it('keeps the user CRUD routes unmounted', async () => {
    const { body: reader } = await register('crud@test.cz');

    const res = await api().get('/api/users').set('Authorization', bearer(reader.token));

    expect(res.status).toBe(404);
  });
});
