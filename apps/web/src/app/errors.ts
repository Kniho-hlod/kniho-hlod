import { ApiError } from '@eleansphere/entity-core';
import { translate } from './i18n';
import { translateIssue } from './validation';

const TOO_MANY_REQUESTS = 429;
const CONFLICT = 409;

export interface ErrorMessages {
  /** What a 409 means where it happened: the e-mail is taken, the book is lent out, … */
  conflict?: string;
}

/**
 * A message for the user: known failures by status, a rejected value by its first validation
 * issue, anything else generic.
 */
export function describeError(err: unknown, messages: ErrorMessages = {}): string {
  if (!(err instanceof ApiError)) return translate('common.somethingWentWrong');
  if (err.status === TOO_MANY_REQUESTS) return translate('auth.tooManyAttempts');
  if (err.status === CONFLICT) return messages.conflict ?? translate('common.conflict');
  if (err.isAuthError) return translate('auth.invalidCredentials');
  const [firstIssue] = err.issues;
  if (firstIssue) return translateIssue(firstIssue);
  return translate('common.somethingWentWrong');
}
