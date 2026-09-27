import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale, LoanReminderKind } from '@kniho-hlod/domain';
import { dayCount, formatEmailDate } from './email-dates';
import { escapeHtml } from './escape-html';

export interface BorrowedBook {
  title: string;
  ownerName: string;
  dueAt: string;
  kind: LoanReminderKind;
  /** Days left until the due date (`dueSoon`), or days past it (`overdue`). */
  days: number;
}

export interface BorrowedReminderEmailData {
  locale: Locale;
  displayName: string;
  /** Overdue first, then by due date. */
  books: readonly BorrowedBook[];
  borrowedUrl: string;
  accountUrl: string;
}

interface BorrowedCopy {
  subject(anyOverdue: boolean): string;
  greeting(displayName: string): string;
  intro: string;
  overdue(book: BorrowedBook, dueDate: string): string;
  dueSoon(book: BorrowedBook, dueDate: string): string;
  borrowedLink: string;
  accountLink: string;
}

const APP_NAME = 'Kniho-hlod';

const COPY: Record<Locale, BorrowedCopy> = {
  cs: {
    subject: (anyOverdue) =>
      anyOverdue ? `${APP_NAME}: vypůjčené knihy po termínu` : `${APP_NAME}: blíží se vrácení knih`,
    greeting: (displayName) => `Dobrý den, ${displayName},`,
    intro: 'připomínáme knihy, které máte půjčené od přátel:',
    overdue: ({ title, ownerName, days }, dueDate) =>
      `„${title}“ (${ownerName}) — termín byl ${dueDate}, ${dayCount(days, 'cs')} po termínu`,
    dueSoon: ({ title, ownerName, days }, dueDate) =>
      days === 0
        ? `„${title}“ (${ownerName}) — vrátit dnes, ${dueDate}`
        : `„${title}“ (${ownerName}) — vrátit do ${dueDate}, za ${dayCount(days, 'cs')}`,
    borrowedLink: 'Co mám půjčené',
    accountLink: 'Upomínky nastavíte nebo vypnete v účtu',
  },
  en: {
    subject: (anyOverdue) =>
      anyOverdue
        ? `${APP_NAME}: borrowed books overdue`
        : `${APP_NAME}: borrowed books due back soon`,
    greeting: (displayName) => `Hello ${displayName},`,
    intro: 'a reminder about books you borrowed from friends:',
    overdue: ({ title, ownerName, days }, dueDate) =>
      `“${title}” (${ownerName}) — was due back ${dueDate}, ${dayCount(days, 'en')} ago`,
    dueSoon: ({ title, ownerName, days }, dueDate) =>
      days === 0
        ? `“${title}” (${ownerName}) — due back today, ${dueDate}`
        : `“${title}” (${ownerName}) — due back ${dueDate}, in ${dayCount(days, 'en')}`,
    borrowedLink: 'What I have borrowed',
    accountLink: 'Change or turn off reminders in your account',
  },
};

/** One e-mail per friend and day about the borrowed books due soon or overdue. */
export const borrowedReminderEmail: EmailTemplateFunction<BorrowedReminderEmailData> = ({
  locale,
  displayName,
  books,
  borrowedUrl,
  accountUrl,
}) => {
  const copy = COPY[locale];
  const lines = books.map((book) => copy[book.kind](book, formatEmailDate(book.dueAt, locale)));
  return {
    subject: copy.subject(books.some((book) => book.kind === 'overdue')),
    text: [
      copy.greeting(displayName),
      '',
      copy.intro,
      '',
      ...lines.map((line) => `– ${line}`),
      '',
      `${copy.borrowedLink}: ${borrowedUrl}`,
      '',
      `${copy.accountLink}: ${accountUrl}`,
    ].join('\n'),
    html: `
      <p>${escapeHtml(copy.greeting(displayName))}</p>
      <p>${escapeHtml(copy.intro)}</p>
      <ul>
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('\n        ')}
      </ul>
      <p><a href="${escapeHtml(borrowedUrl)}">${escapeHtml(copy.borrowedLink)}</a></p>
      <p><a href="${escapeHtml(accountUrl)}">${escapeHtml(copy.accountLink)}</a></p>
    `,
  };
};
