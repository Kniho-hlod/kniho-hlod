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
  readerToday,
  userEntity,
} from '@kniho-hlod/domain';
import type { Locale, LoanReminderKind } from '@kniho-hlod/domain';
import { loanReminderEmail } from '../emails/loan-reminder';
import type { RemindedLoan } from '../emails/loan-reminder';

type Models = CoreInstance['models'];
type Row = InstanceType<Models[string]>;

const LOANS_PATH = '/loans';
const ACCOUNT_PATH = '/account';

export interface LoanRemindersOptions {
  models: Models;
  emailService: EmailService;
  /** The web app's origin, for the links in the e-mail. */
  appBaseUrl: string;
  now?: () => Date;
}

export interface LoanRemindersResult {
  /** Readers e-mailed. */
  readers: number;
  /** Loans those e-mails reminded of. */
  loans: number;
  /** Readers whose e-mail could not be sent; they are reminded on the next run. */
  failed: number;
}

interface DueLoan {
  loan: Row;
  kind: LoanReminderKind;
  /** Days left until the due date, or days past it. */
  days: number;
}

interface ReaderWithDueLoans {
  reader: Row;
  dueLoans: DueLoan[];
}

interface LoanNames {
  books: Map<string, Row>;
  contactNames: Map<string, string>;
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

function byUrgency(left: RemindedLoan, right: RemindedLoan): number {
  if (left.kind !== right.kind) return left.kind === 'overdue' ? -1 : 1;
  return left.dueAt.localeCompare(right.dueAt);
}

/** The reader's open loans that call for a reminder today, in the reader's time zone. */
function dueLoansOf(reader: Row, openLoans: Row[], now: Date): DueLoan[] {
  const timezone = reader.get('timezone');
  const today = readerToday(timezone, now);
  const daysBefore = Number(reader.get('reminderDaysBefore'));
  return openLoans
    .filter((loan) => loan.get('ownerId') === reader.get('id'))
    .flatMap((loan) => {
      const dueAt = loan.get('dueAt') as string;
      const lastSent = loan.get('lastReminderSentAt') as Date | null;
      const remindedOn = lastSent ? readerToday(timezone, lastSent) : null;
      const kind = loanReminderDue({ dueAt }, today, daysBefore, remindedOn);
      return kind ? [{ loan, kind, days: Math.abs(daysBetween(today, dueAt)) }] : [];
    });
}

/**
 * Every reader who wants reminders, with the loans that call for one today. The sample library's
 * loans are only for show and never remind anyone.
 */
async function findReadersWithDueLoans(models: Models, now: Date): Promise<ReaderWithDueLoans[]> {
  const openLoans = await models[loanEntity.config.name].findAll({
    where: { returnedAt: null, dueAt: { [Op.ne]: null }, isSample: false },
  });
  if (openLoans.length === 0) return [];
  const readers = await models[userEntity.config.name].findAll({
    where: {
      id: [...new Set(openLoans.map((loan) => loan.get('ownerId') as string))],
      emailReminders: true,
    },
  });
  return readers
    .map((reader) => ({ reader, dueLoans: dueLoansOf(reader, openLoans, now) }))
    .filter(({ dueLoans }) => dueLoans.length > 0);
}

/** Titles and names for the e-mails: the books and contacts of the loans being reminded of. */
async function loadNames(models: Models, loans: Row[]): Promise<LoanNames> {
  const [books, contacts] = await Promise.all([
    models[bookEntity.config.name].findAll({
      where: { id: loans.map((loan) => loan.get('bookId') as string) },
      attributes: ['id', 'title', 'author'],
    }),
    models[contactEntity.config.name].findAll({
      where: { id: loans.map((loan) => loan.get('contactId') as string) },
      attributes: ['id', 'name'],
    }),
  ]);
  return {
    books: new Map(books.map((book) => [book.get('id') as string, book])),
    contactNames: new Map(
      contacts.map((contact) => [contact.get('id') as string, String(contact.get('name'))])
    ),
  };
}

function toRemindedLoan({ loan, kind, days }: DueLoan, names: LoanNames): RemindedLoan {
  const book = names.books.get(loan.get('bookId') as string);
  return {
    title: String(book?.get('title') ?? ''),
    author: (book?.get('author') as string | null | undefined) ?? null,
    contactName: names.contactNames.get(loan.get('contactId') as string) ?? '',
    dueAt: loan.get('dueAt') as string,
    kind,
    days,
  };
}

/**
 * The daily reminder run: e-mails every reader who wants reminders about the books they lent that
 * are due soon or overdue (see `loanReminderDue`), then marks those loans as reminded. A second
 * run the same day sends nothing new; a reader whose e-mail fails is tried again on the next run.
 */
export async function sendLoanReminders({
  models,
  emailService,
  appBaseUrl,
  now = () => new Date(),
}: LoanRemindersOptions): Promise<LoanRemindersResult> {
  const runAt = now();
  const readers = await findReadersWithDueLoans(models, runAt);
  const names = await loadNames(
    models,
    readers.flatMap(({ dueLoans }) => dueLoans.map(({ loan }) => loan))
  );

  const result: LoanRemindersResult = { readers: 0, loans: 0, failed: 0 };
  for (const { reader, dueLoans } of readers) {
    const email = loanReminderEmail({
      locale: toLocale(reader.get('locale')),
      displayName: String(reader.get('displayName')),
      loans: dueLoans.map((dueLoan) => toRemindedLoan(dueLoan, names)).sort(byUrgency),
      loansUrl: `${appBaseUrl}${LOANS_PATH}`,
      accountUrl: `${appBaseUrl}${ACCOUNT_PATH}`,
    });
    try {
      await emailService.send({ to: String(reader.get('email')), ...email });
    } catch {
      // be-core has logged the failure; the loans stay unmarked for the next run.
      result.failed += 1;
      continue;
    }
    await models[loanEntity.config.name].update(
      { lastReminderSentAt: runAt },
      { where: { id: dueLoans.map(({ loan }) => loan.get('id') as string) } }
    );
    result.readers += 1;
    result.loans += dueLoans.length;
  }
  return result;
}
