import { describe, it, expect } from 'vitest';
import { ApiError } from '@eleansphere/entity-core';
import { describeError } from './errors';
import { i18n } from './i18n';

describe('describeError', () => {
  const message = (key: string) => i18n.global.t(key);

  it.each([
    [401, 'auth.invalidCredentials'],
    [403, 'auth.invalidCredentials'],
    [409, 'common.conflict'],
    [429, 'auth.tooManyAttempts'],
    [500, 'common.somethingWentWrong'],
  ])('describes HTTP %i with %s', (status, key) => {
    expect(describeError(new ApiError(status, 'Error'))).toBe(message(key));
  });

  it('names a conflict the way the caller knows it', () => {
    const taken = message('auth.emailTaken');
    expect(describeError(new ApiError(409, 'Conflict'), { conflict: taken })).toBe(taken);
  });

  it('describes a rejected value by its first validation issue', () => {
    const rejected = new ApiError(400, 'Bad Request', {
      issues: [{ path: 'title', code: 'required' }],
    });
    expect(describeError(rejected)).toBe(message('validation.required'));
  });

  it('falls back to a generic message for anything that is not an API error', () => {
    expect(describeError(new Error('offline'))).toBe(message('common.somethingWentWrong'));
  });
});
