import { describe, it, expect } from 'vitest';
import { ApiError } from '@eleansphere/entity-core';
import { describeError } from './errors';
import { i18n } from './i18n';

describe('describeError', () => {
  const message = (key: string) => i18n.global.t(key);

  it.each([
    [401, 'auth.invalidCredentials'],
    [403, 'auth.invalidCredentials'],
    [409, 'auth.emailTaken'],
    [429, 'auth.tooManyAttempts'],
    [500, 'common.somethingWentWrong'],
  ])('describes HTTP %i with %s', (status, key) => {
    expect(describeError(new ApiError(status, 'Error'))).toBe(message(key));
  });

  it('falls back to a generic message for anything that is not an API error', () => {
    expect(describeError(new Error('offline'))).toBe(message('common.somethingWentWrong'));
  });
});
