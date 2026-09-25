import { describe, expect, it } from 'vitest';
import { findReadingDatesIssues } from './reading-dates';

describe('findReadingDatesIssues', () => {
  it('accepts a book finished on or after the day it was started', () => {
    expect(findReadingDatesIssues({ startedAt: '2026-03-01', finishedAt: '2026-03-01' })).toEqual(
      []
    );
    expect(findReadingDatesIssues({ startedAt: '2026-03-01', finishedAt: '2026-04-10' })).toEqual(
      []
    );
  });

  it('rejects a book finished before it was started', () => {
    expect(findReadingDatesIssues({ startedAt: '2026-03-01', finishedAt: '2026-02-28' })).toEqual([
      { path: 'finishedAt', code: 'min', params: { after: 'startedAt' } },
    ]);
  });

  it('leaves a single date alone', () => {
    expect(findReadingDatesIssues({ startedAt: '2026-03-01' })).toEqual([]);
    expect(findReadingDatesIssues({ finishedAt: '2026-03-01', startedAt: null })).toEqual([]);
  });
});
