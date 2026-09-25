import { describe, expect, it } from 'vitest';
import { findLoanDatesIssues } from './loan-dates';

describe('findLoanDatesIssues', () => {
  it('accepts due and return dates on or after the day of lending', () => {
    expect(
      findLoanDatesIssues({ lentAt: '2026-09-01', dueAt: '2026-09-01', returnedAt: '2026-09-20' })
    ).toEqual([]);
  });

  it('rejects a due or return date before the day of lending', () => {
    expect(
      findLoanDatesIssues({ lentAt: '2026-09-10', dueAt: '2026-09-09', returnedAt: '2026-08-31' })
    ).toEqual([
      { path: 'dueAt', code: 'min', params: { min: '2026-09-10' } },
      { path: 'returnedAt', code: 'min', params: { min: '2026-09-10' } },
    ]);
  });

  it('leaves dates alone without a lending date to compare with', () => {
    expect(findLoanDatesIssues({ dueAt: '2026-09-09', returnedAt: null })).toEqual([]);
  });
});
