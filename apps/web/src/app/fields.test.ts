import { describe, it, expect } from 'vitest';
import { userFields } from '@kniho-hlod/domain';
import { pickFields } from './fields';

describe('pickFields', () => {
  it('keeps only the named fields, with their rules', () => {
    const signUpFields = pickFields(userFields, ['email', 'password']);

    expect(Object.keys(signUpFields)).toEqual(['email', 'password']);
    expect(signUpFields.password).toMatchObject({ minLength: 8, required: true });
  });
});
