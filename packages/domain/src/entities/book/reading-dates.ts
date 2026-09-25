import type { ValidationIssue } from '@eleansphere/schema';

interface ReadingDates {
  startedAt?: string | null;
  finishedAt?: string | null;
}

/**
 * A book can't be finished before it was started; checked only when both dates are present.
 * Dates are `YYYY-MM-DD`, which compare correctly as strings.
 */
export function findReadingDatesIssues({ startedAt, finishedAt }: ReadingDates): ValidationIssue[] {
  if (!startedAt || !finishedAt || finishedAt >= startedAt) return [];
  return [{ path: 'finishedAt', code: 'min', params: { min: startedAt } }];
}
