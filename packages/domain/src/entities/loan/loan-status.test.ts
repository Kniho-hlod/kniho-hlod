import { describe, expect, it } from 'vitest';
import { todayIn } from '@eleansphere/schema';
import { loanStatus } from './loan-status';

const DUE_SOON_DAYS = 7;
const status = (dueAt: string | null, today: string) =>
  loanStatus({ dueAt, returnedAt: null }, today, DUE_SOON_DAYS);

describe('loanStatus', () => {
  it('is returned once the book is back, whatever the dates', () => {
    expect(loanStatus({ dueAt: '2026-01-01', returnedAt: '2026-03-01' }, '2026-09-25')).toBe(
      'returned'
    );
  });

  it('is active without a due date', () => {
    expect(status(null, '2026-09-25')).toBe('active');
  });

  it('is due soon through the due date itself, and overdue the day after', () => {
    expect(status('2026-10-03', '2026-09-25')).toBe('active');
    expect(status('2026-10-02', '2026-09-25')).toBe('dueSoon');
    expect(status('2026-09-25', '2026-09-25')).toBe('dueSoon');
    expect(status('2026-09-24', '2026-09-25')).toBe('overdue');
  });

  it('counts across month and year ends', () => {
    expect(status('2026-02-28', '2026-03-01')).toBe('overdue');
    expect(status('2028-02-29', '2028-02-29')).toBe('dueSoon');
    expect(status('2026-03-02', '2026-02-23')).toBe('dueSoon');
    expect(status('2027-01-03', '2026-12-28')).toBe('dueSoon');
    expect(status('2027-01-05', '2026-12-28')).toBe('active');
  });

  it('is not shifted by daylight saving time', () => {
    // Prague moves its clocks on 2026-03-29 and 2026-10-25; a week still spans seven dates.
    expect(status('2026-04-04', '2026-03-28')).toBe('dueSoon');
    expect(status('2026-04-05', '2026-03-28')).toBe('active');
    expect(status('2026-10-31', '2026-10-24')).toBe('dueSoon');
    expect(status('2026-11-01', '2026-10-24')).toBe('active');
  });

  it('depends on the owner’s time zone through today', () => {
    // 23:30 UTC on the due date is already the next day in Prague, still the due date in New York.
    const instant = new Date('2026-09-25T23:30:00Z');
    expect(status('2026-09-25', todayIn('Europe/Prague', instant))).toBe('overdue');
    expect(status('2026-09-25', todayIn('America/New_York', instant))).toBe('dueSoon');
  });
});
