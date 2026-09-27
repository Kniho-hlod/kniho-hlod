import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale } from '@kniho-hlod/domain';
import { formatEmailDate } from './email-dates';
import { escapeHtml } from './escape-html';

export interface LoanRequestEmailData {
  /** The owner's language. */
  locale: Locale;
  requesterName: string;
  title: string;
  message: string | null;
  /** When the friend would bring it back. */
  dueAt: string | null;
  /** The web app's loans page, where the request waits. */
  loansUrl: string;
}

interface RequestCopy {
  subject(name: string, title: string): string;
  body(name: string, title: string): string;
  until(date: string): string;
  link: string;
  settings: string;
}

const COPY: Record<Locale, RequestCopy> = {
  cs: {
    subject: (name, title) => `${name} si chce půjčit „${title}“ — Kniho-hlod`,
    body: (name, title) => `${name} si od vás chce půjčit knihu „${title}“.`,
    until: (date) => `Navrhuje vrácení do ${date}.`,
    link: 'Odpovědět na žádost',
    settings: 'E-maily o žádostech vypnete v Nastavení účtu.',
  },
  en: {
    subject: (name, title) => `${name} would like to borrow “${title}” — Kniho-hlod`,
    body: (name, title) => `${name} would like to borrow “${title}” from you.`,
    until: (date) => `They suggest bringing it back by ${date}.`,
    link: 'Answer the request',
    settings: 'Turn these e-mails off in Account settings.',
  },
};

/** Tells an owner that a friend asks to borrow one of their books. */
export const loanRequestEmail: EmailTemplateFunction<LoanRequestEmailData> = (data) => {
  const copy = COPY[data.locale];
  const paragraphs = [
    copy.body(data.requesterName, data.title),
    ...(data.dueAt ? [copy.until(formatEmailDate(data.dueAt, data.locale))] : []),
  ];
  const quote = data.message
    ? `<blockquote style="white-space: pre-wrap">${escapeHtml(data.message)}</blockquote>`
    : '';
  return {
    subject: copy.subject(data.requesterName, data.title),
    text: [
      ...paragraphs,
      ...(data.message ? ['', data.message] : []),
      '',
      `${copy.link}: ${data.loansUrl}`,
      '',
      copy.settings,
    ].join('\n'),
    html: `
      ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n      ')}
      ${quote}
      <p><a href="${escapeHtml(data.loansUrl)}">${escapeHtml(copy.link)}</a></p>
      <p style="color: #6b7280; font-size: 13px">${escapeHtml(copy.settings)}</p>
    `,
  };
};
