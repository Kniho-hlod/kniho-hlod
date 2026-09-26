import { daysBetween } from '@eleansphere/schema';
import { loanStatus } from '@kniho-hlod/domain';

/**
 * Where a loan stands and how far off its due date is, in days — what its chip says ("in 3 days",
 * "5 days overdue") instead of a bare date the reader has to count to.
 */
export type LoanDue =
  | { status: 'returned' }
  | { status: 'active'; daysLeft: number | null }
  | { status: 'dueSoon'; daysLeft: number }
  | { status: 'overdue'; daysOverdue: number };

/** What `loanStatus` reads: an open loan (a book's `activeLoan`) may leave out `returnedAt`. */
type LoanDates = Parameters<typeof loanStatus>[0];

/** `daysLeft` is `null` for a loan without a due date. */
export function loanDue(loan: LoanDates, today: string): LoanDue {
  const status = loanStatus(loan, today);
  if (status === 'returned') return { status };
  if (!loan.dueAt) return { status: 'active', daysLeft: null };
  const daysLeft = daysBetween(today, loan.dueAt);
  if (status === 'overdue') return { status, daysOverdue: -daysLeft };
  return { status, daysLeft };
}
