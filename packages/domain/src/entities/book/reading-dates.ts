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
 * The dates a new reading status fills in or clears. Starting a book dates its start and finishing
 * it dates its end, both `today`; a date the reader already has is never overwritten, and a
 * finished book whose start is unknown stays without one. Moving a book back clears what no
 * longer holds: a book being read again isn't finished, one not yet begun has no dates at all.
 */
export function readingDatesForStatus(
  status: ReadingStatus,
  { startedAt, finishedAt }: ReadingDates,
  today: string
): ReadingDates {
  if (status === 'reading') {
    return {
      ...(startedAt ? {} : { startedAt: today }),
      ...(finishedAt ? { finishedAt: null } : {}),
    };
  }
  if (status === 'read') return finishedAt ? {} : { finishedAt: today };
  return {
    ...(startedAt ? { startedAt: null } : {}),
    ...(finishedAt ? { finishedAt: null } : {}),
  };
}
