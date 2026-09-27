import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale } from '@kniho-hlod/domain';
import { formatEmailDate } from './email-dates';
import { escapeHtml } from './escape-html';

/** The owner lent the book, due back then, or can't lend it now. */
export type LoanRequestAnswer = { kind: 'accepted'; dueAt: string | null } | { kind: 'declined' };

export interface LoanRequestAnswerEmailData {
  /** The friend's language. */
  locale: Locale;
  ownerName: string;
  title: string;
  answer: LoanRequestAnswer;
  /** What the friend has borrowed, or the friend's library. */
  linkUrl: string;
}

interface AnswerCopy {
  acceptedSubject(name: string, title: string): string;
  accepted(name: string, title: string): string;
  until(date: string): string;
  declinedSubject(title: string): string;
  declined(name: string, title: string): string;
  acceptedLink: string;
  declinedLink: string;
  settings: string;
}

const COPY: Record<Locale, AnswerCopy> = {
  cs: {
    acceptedSubject: (name, title) => `${name} vám půjčí „${title}“ — Kniho-hlod`,
    accepted: (name, title) =>
      `${name} vám půjčí knihu „${title}“. Domluvte se, jak si ji předáte.`,
    until: (date) => `Vrátit do ${date}.`,
    declinedSubject: (title) => `„${title}“ teď půjčit nejde — Kniho-hlod`,
    declined: (name, title) => `${name} vám knihu „${title}“ teď půjčit nemůže.`,
    acceptedLink: 'Co mám půjčené',
    declinedLink: 'Knihovna přítele',
    settings: 'E-maily o žádostech vypnete v Nastavení účtu.',
  },
  en: {
    acceptedSubject: (name, title) => `${name} will lend you “${title}” — Kniho-hlod`,
    accepted: (name, title) => `${name} will lend you “${title}”. Agree on how to hand it over.`,
    until: (date) => `Due back by ${date}.`,
    declinedSubject: (title) => `“${title}” can't be lent right now — Kniho-hlod`,
    declined: (name, title) => `${name} can't lend you “${title}” right now.`,
    acceptedLink: 'What I have borrowed',
    declinedLink: "Your friend's library",
    settings: 'Turn these e-mails off in Account settings.',
  },
};

/** Tells a friend how the owner answered their request to borrow a book. */
export const loanRequestAnswerEmail: EmailTemplateFunction<LoanRequestAnswerEmailData> = (data) => {
  const copy = COPY[data.locale];
  const { answer } = data;
  const isAccepted = answer.kind === 'accepted';
  const paragraphs =
    answer.kind === 'accepted'
      ? [
          copy.accepted(data.ownerName, data.title),
          ...(answer.dueAt ? [copy.until(formatEmailDate(answer.dueAt, data.locale))] : []),
        ]
      : [copy.declined(data.ownerName, data.title)];
  const link = isAccepted ? copy.acceptedLink : copy.declinedLink;
  return {
    subject: isAccepted
      ? copy.acceptedSubject(data.ownerName, data.title)
      : copy.declinedSubject(data.title),
    text: [...paragraphs, '', `${link}: ${data.linkUrl}`, '', copy.settings].join('\n'),
    html: `
      ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n      ')}
      <p><a href="${escapeHtml(data.linkUrl)}">${escapeHtml(link)}</a></p>
      <p style="color: #6b7280; font-size: 13px">${escapeHtml(copy.settings)}</p>
    `,
  };
};
