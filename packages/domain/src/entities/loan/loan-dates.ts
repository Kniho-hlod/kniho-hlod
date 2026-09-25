import type { ValidationIssue } from '@eleansphere/schema';

interface LoanDates {
  lentAt?: string | null;
  dueAt?: string | null;
  returnedAt?: string | null;
}

function notBefore(path: keyof LoanDates, date: string | null | undefined, min: string) {
  return date && date < min ? [{ path, code: 'min' as const, params: { min } }] : [];
}

/**
 * A loan can't be due or returned before the day it was lent. Dates are `YYYY-MM-DD`, which
 * compare correctly as strings. Without `lentAt` there is nothing to compare with.
 */
export function findLoanDatesIssues({ lentAt, dueAt, returnedAt }: LoanDates): ValidationIssue[] {
  if (!lentAt) return [];
  return [...notBefore('dueAt', dueAt, lentAt), ...notBefore('returnedAt', returnedAt, lentAt)];
}
