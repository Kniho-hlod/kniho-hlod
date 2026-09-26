import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale, LoanReminderKind } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

export interface RemindedLoan {
  title: string;
  author: string | null;
  contactName: string;
  dueAt: string;
  kind: LoanReminderKind;
  /** Days left until the due date (`dueSoon`), or days past it (`overdue`). */
  days: number;
}

export interface LoanReminderEmailData {
  locale: Locale;
  displayName: string;
  /** Overdue loans first, then the rest by due date. */
  loans: readonly RemindedLoan[];
  loansUrl: string;
  accountUrl: string;
}

interface ReminderCopy {
  subject(anyOverdue: boolean): string;
  greeting(displayName: string): string;
  intro: string;
  lentTo(contactName: string): string;
  /** When the book is due, e.g. "vrátit do 10. 10. 2026, za 2 dny". */
  due(loan: RemindedLoan, dueDate: string): string;
  loansLink: string;
  accountLink: string;
}

const APP_NAME = 'Kniho-hlod';
const CZECH_FEW_MAX = 4;

/** "1 den", "2 dny", "5 dní". */
function czechDays(count: number): string {
  if (count === 1) return '1 den';
  if (count > 1 && count <= CZECH_FEW_MAX) return `${count} dny`;
  return `${count} dní`;
}

function englishDays(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

const COPY: Record<Locale, ReminderCopy> = {
  cs: {
    subject: (anyOverdue) =>
      anyOverdue
        ? `${APP_NAME}: půjčené knihy po termínu`
        : `${APP_NAME}: blíží se vrácení půjčených knih`,
    greeting: (displayName) => `Dobrý den, ${displayName},`,
    intro: 'připomínáme knihy, které jste půjčili:',
    lentTo: (contactName) => `půjčeno: ${contactName}`,
    due: ({ kind, days }, dueDate) => {
      if (kind === 'overdue') return `termín byl ${dueDate}, ${czechDays(days)} po termínu`;
      return days === 0 ? `vrátit dnes, ${dueDate}` : `vrátit do ${dueDate}, za ${czechDays(days)}`;
    },
    loansLink: 'Výpůjčky',
    accountLink: 'Upomínky nastavíte nebo vypnete v účtu',
  },
  en: {
    subject: (anyOverdue) =>
      anyOverdue ? `${APP_NAME}: lent books overdue` : `${APP_NAME}: lent books due back soon`,
    greeting: (displayName) => `Hello ${displayName},`,
    intro: 'a reminder about books you lent:',
    lentTo: (contactName) => `lent to ${contactName}`,
    due: ({ kind, days }, dueDate) => {
      if (kind === 'overdue') return `was due back ${dueDate}, ${englishDays(days)} ago`;
      return days === 0
        ? `due back today, ${dueDate}`
        : `due back ${dueDate}, in ${englishDays(days)}`;
    },
    loansLink: 'Your loans',
    accountLink: 'Change or turn off reminders in your account',
  },
};

/** `2026-10-10` → "10. 10. 2026" or "Oct 10, 2026", as the app shows dates. */
function formatDate(date: string, locale: Locale): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

function bookLabel({ title, author }: RemindedLoan): string {
  return author ? `${title} (${author})` : title;
}

/** One e-mail per reader and day, listing every loan that needs their attention. */
export const loanReminderEmail: EmailTemplateFunction<LoanReminderEmailData> = ({
  locale,
  displayName,
  loans,
  loansUrl,
  accountUrl,
}) => {
  const copy = COPY[locale];
  const lines = loans.map((loan) => ({
    book: bookLabel(loan),
    details: `${copy.lentTo(loan.contactName)} — ${copy.due(loan, formatDate(loan.dueAt, locale))}`,
  }));
  return {
    subject: copy.subject(loans.some((loan) => loan.kind === 'overdue')),
    text: [
      copy.greeting(displayName),
      '',
      copy.intro,
      '',
      ...lines.map(({ book, details }) => `– ${book}, ${details}`),
      '',
      `${copy.loansLink}: ${loansUrl}`,
      '',
      `${copy.accountLink}: ${accountUrl}`,
    ].join('\n'),
    html: `
      <p>${escapeHtml(copy.greeting(displayName))}</p>
      <p>${escapeHtml(copy.intro)}</p>
      <ul>
        ${lines
          .map(
            ({ book, details }) =>
              `<li><strong>${escapeHtml(book)}</strong>, ${escapeHtml(details)}</li>`
          )
          .join('\n        ')}
      </ul>
      <p><a href="${escapeHtml(loansUrl)}">${escapeHtml(copy.loansLink)}</a></p>
      <p><a href="${escapeHtml(accountUrl)}">${escapeHtml(copy.accountLink)}</a></p>
    `,
  };
};
