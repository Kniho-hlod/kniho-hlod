import { describe, expect, it } from 'vitest';
import { findReadingDatesIssues, readingDatesForStatus } from './reading-dates';

const TODAY = '2026-09-26';

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
      { path: 'finishedAt', code: 'min', params: { min: '2026-03-01' } },
    ]);
  });

  it('leaves a single date alone', () => {
    expect(findReadingDatesIssues({ startedAt: '2026-03-01' })).toEqual([]);
    expect(findReadingDatesIssues({ finishedAt: '2026-03-01', startedAt: null })).toEqual([]);
  });
});

describe('readingDatesForStatus', () => {
  it('dates the start of a book begun today, and the end of one finished today', () => {
    expect(readingDatesForStatus('reading', {}, TODAY)).toEqual({ startedAt: TODAY });
    expect(readingDatesForStatus('read', { startedAt: '2026-09-01' }, TODAY)).toEqual({
      finishedAt: TODAY,
    });
  });

  it('keeps the dates the reader already has', () => {
    expect(readingDatesForStatus('reading', { startedAt: '2026-09-01' }, TODAY)).toEqual({});
    expect(readingDatesForStatus('read', { finishedAt: '2026-09-20' }, TODAY)).toEqual({});
  });

  it('invents no start for a book marked read, and no dates for the other statuses', () => {
    expect(readingDatesForStatus('read', { startedAt: null }, TODAY)).toEqual({
      finishedAt: TODAY,
    });
    expect(readingDatesForStatus('want', {}, TODAY)).toEqual({});
    expect(readingDatesForStatus('none', {}, TODAY)).toEqual({});
  });
});
