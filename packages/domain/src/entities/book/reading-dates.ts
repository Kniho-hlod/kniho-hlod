import type { ValidationIssue } from '@eleansphere/schema';

interface ReadingDates {
  startedAt?: string | null;
  finishedAt?: string | null;
}

/**
 * A book can't be finished before it was started. Checked only when both dates are present, so a
 * partial update of one of them is left to the other's stored value. Dates are `YYYY-MM-DD`,
 * which compare correctly as strings.
 */
export function findReadingDatesIssues({ startedAt, finishedAt }: ReadingDates): ValidationIssue[] {
  if (!startedAt || !finishedAt || finishedAt >= startedAt) return [];
  return [{ path: 'finishedAt', code: 'min', params: { after: 'startedAt' } }];
}
