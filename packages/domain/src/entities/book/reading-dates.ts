import type { ValidationIssue } from '@eleansphere/schema';
import type { ReadingStatus } from '../../constants';

export interface ReadingDates {
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

/**
 * The dates a new reading status fills in: starting a book dates its start and finishing it
 * dates its end, both `today`. A date the reader already has is never overwritten, and a
 * finished book whose start is unknown stays without one.
 */
export function readingDatesForStatus(
  status: ReadingStatus,
  { startedAt, finishedAt }: ReadingDates,
  today: string
): ReadingDates {
  if (status === 'reading' && !startedAt) return { startedAt: today };
  if (status === 'read' && !finishedAt) return { finishedAt: today };
  return {};
}
