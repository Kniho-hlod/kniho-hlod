import { describe, expect, it } from 'vitest';
import { loanDue } from './loan-due';

const TODAY = '2026-09-26';
const OPEN = { returnedAt: null };

describe('loan due', () => {
  it('says a returned loan is returned, whatever its due date', () => {
    expect(loanDue({ dueAt: '2026-09-01', returnedAt: '2026-09-20' }, TODAY)).toEqual({
      status: 'returned',
    });
  });

  it('has no days left for a loan without a due date', () => {
    expect(loanDue({ ...OPEN, dueAt: null }, TODAY)).toEqual({ status: 'active', daysLeft: null });
  });

  it('counts the days past the due date', () => {
    expect(loanDue({ ...OPEN, dueAt: '2026-09-21' }, TODAY)).toEqual({
      status: 'overdue',
      daysOverdue: 5,
    });
  });

  it('is due soon on the due date itself', () => {
    expect(loanDue({ ...OPEN, dueAt: TODAY }, TODAY)).toEqual({ status: 'dueSoon', daysLeft: 0 });
  });

  it('counts the days left, soon or not', () => {
    expect(loanDue({ ...OPEN, dueAt: '2026-09-29' }, TODAY)).toEqual({
      status: 'dueSoon',
      daysLeft: 3,
    });
    expect(loanDue({ ...OPEN, dueAt: '2026-10-26' }, TODAY)).toEqual({
      status: 'active',
      daysLeft: 30,
    });
  });

  it('counts across the end of a month', () => {
    expect(loanDue({ ...OPEN, dueAt: '2026-10-01' }, TODAY)).toMatchObject({ daysLeft: 5 });
  });
});
