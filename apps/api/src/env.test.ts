import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLOW_MISSING_SERVICES_FLAG, readEnvironment } from './env';

const BASE_VARIABLES = {
  APP_BASE_URL: 'https://kniho-hlod.example',
  DATABASE_URL: 'postgres://kniho:kniho@localhost:5432/kniho',
  JWT_SECRET: 'a-test-secret-that-is-long-enough-for-the-check',
};

const PRODUCTION_WITHOUT_SERVICES = { ...BASE_VARIABLES, NODE_ENV: 'production' };

describe('readEnvironment in production', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses to start without email and file storage, naming both', () => {
    expect(() => readEnvironment(PRODUCTION_WITHOUT_SERVICES)).toThrow(
      /RESEND_API_KEY or SMTP_HOST.*R2_\*.*ALLOW_MISSING_EMAIL_AND_STORAGE=true/
    );
  });

  it('starts without them when the flag is set, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const environment = readEnvironment({
      ...PRODUCTION_WITHOUT_SERVICES,
      [ALLOW_MISSING_SERVICES_FLAG]: 'true',
    });

    expect(environment.email.kind).toBe('log');
    expect(environment.storage.kind).toBe('memory');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not accept anything but "true" as the flag', () => {
    expect(() =>
      readEnvironment({ ...PRODUCTION_WITHOUT_SERVICES, [ALLOW_MISSING_SERVICES_FLAG]: '1' })
    ).toThrow(/Production needs/);
  });

  it('checks nothing outside production', () => {
    expect(readEnvironment(BASE_VARIABLES).isProduction).toBe(false);
  });
});
