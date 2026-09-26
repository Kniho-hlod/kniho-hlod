import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { FeedbackKind, Locale } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

export interface FeedbackReportEmailData {
  /** The administrator's language. */
  locale: Locale;
  kind: FeedbackKind;
  message: string;
  reporterName: string;
  reporterEmail: string;
  pageUrl: string | null;
  appVersion: string | null;
  viewport: string | null;
  userAgent: string | null;
  /** The administration's list of reports. */
  inboxUrl: string;
}

interface ReportCopy {
  kinds: Record<FeedbackKind, string>;
  from(reporter: string): string;
  page: string;
  version: string;
  window: string;
  browser: string;
  inboxLink: string;
}

const APP_NAME = 'Kniho-hlod';
/** How much of the message the subject line quotes. */
const SUBJECT_EXCERPT_LENGTH = 60;

const COPY: Record<Locale, ReportCopy> = {
  cs: {
    kinds: { bug: 'Chyba', idea: 'Nápad', other: 'Zpětná vazba' },
    from: (reporter) => `Nové hlášení od ${reporter}:`,
    page: 'Stránka',
    version: 'Verze',
    window: 'Okno',
    browser: 'Prohlížeč',
    inboxLink: 'Otevřít hlášení ve správě',
  },
  en: {
    kinds: { bug: 'Bug', idea: 'Idea', other: 'Feedback' },
    from: (reporter) => `A new report from ${reporter}:`,
    page: 'Page',
    version: 'Version',
    window: 'Window',
    browser: 'Browser',
    inboxLink: 'Open the reports in administration',
  },
};

/** The message's first line, cut to fit a subject. */
function excerpt(message: string): string {
  const firstLine = message.trim().split('\n')[0].trim();
  return firstLine.length > SUBJECT_EXCERPT_LENGTH
    ? `${firstLine.slice(0, SUBJECT_EXCERPT_LENGTH - 1)}…`
    : firstLine;
}

/** Tells an administrator a reader has sent a report, with what the app knows about where from. */
export const feedbackReportEmail: EmailTemplateFunction<FeedbackReportEmailData> = (data) => {
  const copy = COPY[data.locale];
  const reporter = `${data.reporterName} (${data.reporterEmail})`;
  const email = escapeHtml(data.reporterEmail);
  const reporterHtml = `${escapeHtml(data.reporterName)} (<a href="mailto:${email}">${email}</a>)`;
  const details: [string, string | null][] = [
    [copy.page, data.pageUrl],
    [copy.version, data.appVersion],
    [copy.window, data.viewport],
    [copy.browser, data.userAgent],
  ];
  const knownDetails = details.filter((detail): detail is [string, string] => detail[1] !== null);

  return {
    subject: `${copy.kinds[data.kind]}: ${excerpt(data.message)} — ${APP_NAME}`,
    text: [
      copy.from(reporter),
      '',
      data.message,
      '',
      ...knownDetails.map(([label, value]) => `${label}: ${value}`),
      '',
      `${copy.inboxLink}: ${data.inboxUrl}`,
    ].join('\n'),
    html: `
      <p>${copy.from(reporterHtml)}</p>
      <blockquote style="white-space: pre-wrap">${escapeHtml(data.message)}</blockquote>
      <p>${knownDetails
        .map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value)}`)
        .join('<br>')}</p>
      <p><a href="${escapeHtml(data.inboxUrl)}">${escapeHtml(copy.inboxLink)}</a></p>
    `,
  };
};
