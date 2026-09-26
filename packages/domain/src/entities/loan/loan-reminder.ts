import { addDays, compareDateOnly } from '@eleansphere/schema';

/** While a book stays out past its due date, its owner is reminded again after this many days. */
export const OVERDUE_REMINDER_INTERVAL_DAYS = 7;

/** What a reminder says about a loan: its due date is near, or has passed. */
export type LoanReminderKind = 'dueSoon' | 'overdue';

interface RemindableLoan {
  dueAt?: string | null;
  returnedAt?: string | null;
}

function isRepeatDue(lastOverdueReminder: string | null, today: string): boolean {
  if (!lastOverdueReminder) return true;
  const nextReminder = addDays(lastOverdueReminder, OVERDUE_REMINDER_INTERVAL_DAYS);
  return compareDateOnly(today, nextReminder) >= 0;
}

/**
 * The reminder a loan's owner gets on `today`, or `null`. Dates are `YYYY-MM-DD` in the owner's
 * time zone; `remindedOn` is the day the last reminder about this loan went out.
 *
 * - `dueSoon` once, on any day from `daysBefore` days before the due date through the due date.
 * - `overdue` from the day after the due date, then every `OVERDUE_REMINDER_INTERVAL_DAYS` days
 *   while the book is still out.
 *
 * A loan without a due date, or returned, is never reminded of.
 */
export function loanReminderDue(
  loan: RemindableLoan,
  today: string,
  daysBefore: number,
  remindedOn: string | null
): LoanReminderKind | null {
  if (loan.returnedAt || !loan.dueAt) return null;
  if (compareDateOnly(today, loan.dueAt) > 0) {
    const lastOverdueReminder =
      remindedOn && compareDateOnly(remindedOn, loan.dueAt) > 0 ? remindedOn : null;
    return isRepeatDue(lastOverdueReminder, today) ? 'overdue' : null;
  }
  const remindFrom = addDays(loan.dueAt, -daysBefore);
  if (compareDateOnly(today, remindFrom) < 0) return null;
  const alreadyReminded = remindedOn !== null && compareDateOnly(remindedOn, remindFrom) >= 0;
  return alreadyReminded ? null : 'dueSoon';
}
