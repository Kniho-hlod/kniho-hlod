import crypto from 'node:crypto';
import request from 'supertest';
import {
  createCore,
  createSequelize,
  MemoryEmailTransport,
  MemoryStorageAdapter,
} from '@eleansphere/be-core';
import type { CoreInstance } from '@eleansphere/be-core';
import { buildAppConfig } from '../app-config';
import type { AppConfigOverrides } from '../app-config';
import type { Environment } from '../env';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://kniho:kniho@localhost:5434/kniho';
export const APP_BASE_URL = 'https://app.test';
export const PASSWORD = 'correct-horse-battery';
/** The eight bytes a PNG starts with: enough for an upload to count as an image. */
export const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

export const testEnvironment: Environment = {
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
  rateLimits: 'on',
};

export const bearer = (token: string) => `Bearer ${token}`;

export interface RegisterOptions {
  displayName?: string;
  /** Default `true`: the reader has opened the link that confirms their address. */
  verified?: boolean;
}

/** What the e-mail confirming a new account's address links to. */
const VERIFY_LINK = `${APP_BASE_URL}/verify-email?token=`;

export interface TestApp {
  core: CoreInstance;
  /** The Postgres schema holding this app's tables. */
  schema: string;
  outbox: MemoryEmailTransport;
  api: () => ReturnType<typeof request>;
  /**
   * Registers a reader; the response body holds `token`, `refreshToken`, `id` and `user`. The
   * address counts as confirmed (and the confirmation e-mail is taken out of the outbox) unless
   * `verified: false`.
   */
  register: (email: string, options?: RegisterOptions) => Promise<request.Response>;
  /** Marks the reader's address as confirmed, as opening the e-mailed link does. */
  verifyEmail: (userId: string) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * A fresh API on a Postgres schema of its own (dropped again by `close`), with in-memory email
 * and files and without rate limits.
 */
export async function startTestApp(
  overrides: Omit<AppConfigOverrides, 'schema' | 'emailTransport'> = {}
): Promise<TestApp> {
  const schema = `test_${crypto.randomBytes(6).toString('hex')}`;
  const database = createSequelize({ databaseUrl: TEST_DATABASE_URL, ssl: false });
  const outbox = new MemoryEmailTransport();
  await database.query(`CREATE SCHEMA "${schema}"`);

  const core = await createCore(
    buildAppConfig(testEnvironment, {
      storageAdapter: new MemoryStorageAdapter(),
      rateLimit: 'off',
      passwordHashRounds: 4,
      ...overrides,
      schema,
      emailTransport: outbox,
    })
  );

  const api = () => request(core.app);
  const verifyEmail = async (userId: string) => {
    await core.sequelize.query(
      `UPDATE "${schema}"."users" SET "emailVerifiedAt" = now() WHERE "id" = :userId`,
      { replacements: { userId } }
    );
  };
  return {
    core,
    schema,
    outbox,
    api,
    async register(email, { displayName = 'Reader', verified = true } = {}) {
      const res = await api()
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, displayName });
      if (verified && res.status === 201) {
        await verifyEmail(String(res.body.id ?? res.body.user.id));
        const address = email.trim().toLowerCase();
        const confirmation = outbox.sent.findIndex(
          ({ to, text }) => to === address && text?.includes(VERIFY_LINK)
        );
        if (confirmation !== -1) outbox.sent.splice(confirmation, 1);
      }
      return res;
    },
    verifyEmail,
    async close() {
      await core.close();
      await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await database.close();
    },
  };
}
