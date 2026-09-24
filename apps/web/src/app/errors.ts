import { ApiError } from '@eleansphere/entity-core';
import { translate } from './i18n';

const TOO_MANY_REQUESTS = 429;
const CONFLICT = 409;

/** A message for the user: known auth failures by status, anything else generic. */
export function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return translate('common.somethingWentWrong');
  if (err.status === TOO_MANY_REQUESTS) return translate('auth.tooManyAttempts');
  if (err.status === CONFLICT) return translate('auth.emailTaken');
  if (err.isAuthError) return translate('auth.invalidCredentials');
  return translate('common.somethingWentWrong');
}
