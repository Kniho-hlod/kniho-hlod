import { addDays, compareDateOnly } from '@eleansphere/schema';
import { DUE_SOON_DAYS } from '../../constants';
import type { LoanStatus } from '../../constants';

interface LoanDates {
  dueAt?: string | null;
  returnedAt?: string | null;
}

/**
 * Where a loan stands on `today` — a `YYYY-MM-DD` date in the owner's time zone (`todayIn`):
 * `returned`; `overdue` once its due date has passed; `dueSoon` from `dueSoonDays` before the due
 * date through the due date itself; otherwise `active` (also when it has no due date).
 */
export function loanStatus(
  loan: LoanDates,
  today: string,
  dueSoonDays: number = DUE_SOON_DAYS
): LoanStatus {
  if (loan.returnedAt) return 'returned';
  if (!loan.dueAt) return 'active';
  if (compareDateOnly(loan.dueAt, today) < 0) return 'overdue';
  if (compareDateOnly(loan.dueAt, addDays(today, dueSoonDays)) <= 0) return 'dueSoon';
  return 'active';
}
