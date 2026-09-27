import { daysBetween } from '@eleansphere/schema';
import { Op } from '@eleansphere/be-core';
import type { CoreInstance, EmailService } from '@eleansphere/be-core';
import {
  bookEntity,
  contactEntity,
  DEFAULT_LOCALE,
  LOCALES,
  loanEntity,
  loanReminderDue,
  LOANS_PAGE_PATH,
  readerToday,
  userEntity,
} from '@kniho-hlod/domain';
import type { Locale } from '@kniho-hlod/domain';
import { borrowedReminderEmail } from '../emails/borrowed-reminder';
import type { BorrowedBook } from '../emails/borrowed-reminder';

type Models = CoreInstance['models'];
type Row = InstanceType<Models[string]>;

const ACCOUNT_PATH = '/account';
const BORROWED_TAB_QUERY = '?tab=borrowed';

export interface BorrowerRemindersOptions {
  models: Models;
  emailService: EmailService;
  appBaseUrl: string;
  now?: () => Date;
}

export interface BorrowerRemindersResult {
  /** Friends e-mailed. */
  borrowers: number;
  /** Borrowed books those e-mails reminded of. */
  loans: number;
  /** Friends whose e-mail could not be sent; they are reminded on the next run. */
  failed: number;
}

interface DueBorrowedLoan {
  loan: Row;
  book: Omit<BorrowedBook, 'title' | 'ownerName'>;
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

function byUrgency(left: BorrowedBook, right: BorrowedBook): number {
  if (left.kind !== right.kind) return left.kind === 'overdue' ? -1 : 1;
  return left.dueAt.localeCompare(right.dueAt);
}

/** The borrower's open loans that call for a reminder today, by their own settings and day. */
function dueFor(borrower: Row, loans: Row[], now: Date): DueBorrowedLoan[] {
  const timezone = borrower.get('timezone');
  const today = readerToday(timezone, now);
  const daysBefore = Number(borrower.get('reminderDaysBefore'));
  return loans.flatMap((loan) => {
    const dueAt = loan.get('dueAt') as string;
    const lastSent = loan.get('lastBorrowerReminderSentAt') as Date | null;
    const remindedOn = lastSent ? readerToday(timezone, lastSent) : null;
    const kind = loanReminderDue({ dueAt }, today, daysBefore, remindedOn);
    return kind ? [{ loan, book: { dueAt, kind, days: Math.abs(daysBetween(today, dueAt)) } }] : [];
  });
}

/**
 * The daily reminder run for friends who borrowed a book (a loan to a contact linked to their
 * account): each who wants reminders gets one e-mail about the books due soon or overdue, by
 * their own settings, and the loans are marked (`lastBorrowerReminderSentAt`) apart from the
 * owner's reminders. Nobody else a book was lent to is ever e-mailed.
 */
export async function sendBorrowerReminders({
  models,
  emailService,
  appBaseUrl,
  now = () => new Date(),
}: BorrowerRemindersOptions): Promise<BorrowerRemindersResult> {
  const runAt = now();
  const result: BorrowerRemindersResult = { borrowers: 0, loans: 0, failed: 0 };
  const linked = await models[contactEntity.config.name].findAll({
    where: { linkedUserId: { [Op.ne]: null } },
    attributes: ['id', 'linkedUserId'],
  });
  if (linked.length === 0) return result;
  const borrowerOf = new Map(
    linked.map((contact) => [String(contact.get('id')), String(contact.get('linkedUserId'))])
  );
  const open = await models[loanEntity.config.name].findAll({
    where: {
      contactId: [...borrowerOf.keys()],
      returnedAt: null,
      dueAt: { [Op.ne]: null },
      isSample: false,
    },
  });
  if (open.length === 0) return result;
  const borrowers = await models[userEntity.config.name].findAll({
    where: {
      id: [...new Set(open.map((loan) => borrowerOf.get(String(loan.get('contactId')))))],
      emailReminders: true,
    },
  });
  const [books, owners] = await Promise.all([
    models[bookEntity.config.name].findAll({
      where: { id: open.map((loan) => String(loan.get('bookId'))) },
      attributes: ['id', 'title'],
    }),
    models[userEntity.config.name].findAll({
      where: { id: open.map((loan) => String(loan.get('ownerId'))) },
      attributes: ['id', 'displayName'],
    }),
  ]);
  const titles = new Map(books.map((book) => [String(book.get('id')), String(book.get('title'))]));
  const ownerNames = new Map(
    owners.map((owner) => [String(owner.get('id')), String(owner.get('displayName'))])
  );

  for (const borrower of borrowers) {
    const theirs = open.filter(
      (loan) => borrowerOf.get(String(loan.get('contactId'))) === borrower.get('id')
    );
    const due = dueFor(borrower, theirs, runAt);
    if (due.length === 0) continue;
    const email = borrowedReminderEmail({
      locale: toLocale(borrower.get('locale')),
      displayName: String(borrower.get('displayName')),
      books: due
        .map(({ loan, book }) => ({
          ...book,
          title: titles.get(String(loan.get('bookId'))) ?? '',
          ownerName: ownerNames.get(String(loan.get('ownerId'))) ?? '',
        }))
        .sort(byUrgency),
      borrowedUrl: `${appBaseUrl}${LOANS_PAGE_PATH}${BORROWED_TAB_QUERY}`,
      accountUrl: `${appBaseUrl}${ACCOUNT_PATH}`,
    });
    try {
      await emailService.send({ to: String(borrower.get('email')), ...email });
    } catch {
      // be-core has logged the failure; the loans stay unmarked for the next run.
      result.failed += 1;
      continue;
    }
    await models[loanEntity.config.name].update(
      { lastBorrowerReminderSentAt: runAt },
      { where: { id: due.map(({ loan }) => String(loan.get('id'))) } }
    );
    result.borrowers += 1;
    result.loans += due.length;
  }
  return result;
}
