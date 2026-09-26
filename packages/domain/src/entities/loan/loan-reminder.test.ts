import { describe, expect, it } from 'vitest';
import { loanReminderDue } from './loan-reminder';

const DUE = '2026-10-10';
const loan = { dueAt: DUE, returnedAt: null };
const TWO_DAYS_BEFORE = 2;

describe('loanReminderDue', () => {
  it('reminds once, from the chosen number of days before the due date', () => {
    expect(loanReminderDue(loan, '2026-10-07', TWO_DAYS_BEFORE, null)).toBeNull();
    expect(loanReminderDue(loan, '2026-10-08', TWO_DAYS_BEFORE, null)).toBe('dueSoon');
    expect(loanReminderDue(loan, '2026-10-08', TWO_DAYS_BEFORE, '2026-10-08')).toBeNull();
    expect(loanReminderDue(loan, '2026-10-10', TWO_DAYS_BEFORE, '2026-10-08')).toBeNull();
  });

  it('still reminds on the due date when the loan was made too late for the notice', () => {
    expect(loanReminderDue(loan, DUE, TWO_DAYS_BEFORE, null)).toBe('dueSoon');
    // Days before: 0 means on the due date itself.
    expect(loanReminderDue(loan, '2026-10-09', 0, null)).toBeNull();
    expect(loanReminderDue(loan, DUE, 0, null)).toBe('dueSoon');
  });

  it('forgets a reminder from before the notice period, e.g. after the due date moved', () => {
    expect(loanReminderDue(loan, '2026-10-08', TWO_DAYS_BEFORE, '2026-09-20')).toBe('dueSoon');
  });

  it('reminds of an overdue book the day after, then weekly', () => {
    expect(loanReminderDue(loan, '2026-10-11', TWO_DAYS_BEFORE, '2026-10-08')).toBe('overdue');
    expect(loanReminderDue(loan, '2026-10-12', TWO_DAYS_BEFORE, '2026-10-11')).toBeNull();
    expect(loanReminderDue(loan, '2026-10-17', TWO_DAYS_BEFORE, '2026-10-11')).toBeNull();
    expect(loanReminderDue(loan, '2026-10-18', TWO_DAYS_BEFORE, '2026-10-11')).toBe('overdue');
  });

  it('never reminds of a returned loan or one without a due date', () => {
    expect(loanReminderDue({ ...loan, returnedAt: '2026-10-09' }, DUE, 2, null)).toBeNull();
    expect(loanReminderDue({ dueAt: null }, DUE, 2, null)).toBeNull();
  });
});
