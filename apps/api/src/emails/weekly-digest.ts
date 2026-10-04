import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { FeedItemKind, Locale } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

/** A friend's book in the week's e-mail: started, finished or wanted. */
export interface DigestActivity {
  kind: FeedItemKind;
  friendName: string;
  title: string;
  author: string | null;
  /** The friend's rating of a finished book, 1–5. */
  rating: number | null;
}

/** What waits for the reader's answer in the app. */
export interface DigestWaiting {
  friendRequests: number;
  loanRequests: number;
  recommendations: number;
}

export interface WeeklyDigestEmailData {
  locale: Locale;
  displayName: string;
  /** Newest first, at most a handful; `moreActivities` counts the rest. */
  activities: readonly DigestActivity[];
  moreActivities: number;
  waiting: DigestWaiting;
  appUrl: string;
  feedUrl: string;
  accountUrl: string;
}

interface DigestCopy {
  subject: string;
  greeting(displayName: string): string;
  activityIntro: string;
  activity: Record<FeedItemKind, (friendName: string, book: string) => string>;
  rating(rating: number): string;
  moreActivities(count: number): string;
  /** Lower case when it follows the greeting directly. */
  waitingIntro(first: boolean): string;
  waiting: Record<keyof DigestWaiting, (count: number) => string>;
  feedLink: string;
  appLink: string;
  accountLink: string;
}

const APP_NAME = 'Kniho-hlod';
const CZECH_FEW_MAX = 4;

/** Czech's three plural forms: 1, 2–4, 5 and more. */
function czechCount(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`;
  if (count > 1 && count <= CZECH_FEW_MAX) return `${count} ${few}`;
  return `${count} ${many}`;
}

const englishCount = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const COPY: Record<Locale, DigestCopy> = {
  cs: {
    subject: `${APP_NAME}: co je nového u přátel`,
    greeting: (displayName) => `Dobrý den, ${displayName},`,
    activityIntro: 'tohle se tento týden dělo u vašich přátel:',
    activity: {
      started: (name, book) => `${name} čte ${book}`,
      finished: (name, book) => `${name} má dočteno ${book}`,
      wantsToRead: (name, book) => `${name} si chce přečíst ${book}`,
    },
    rating: (rating) => `, hodnocení ${rating}/5`,
    moreActivities: (count) =>
      `a ${czechCount(count, 'další kniha', 'další knihy', 'dalších knih')} v aplikaci`,
    waitingIntro: (first) => `${first ? 'v' : 'V'} aplikaci na vás čeká:`,
    waiting: {
      friendRequests: (count) =>
        czechCount(count, 'žádost o přátelství', 'žádosti o přátelství', 'žádostí o přátelství'),
      loanRequests: (count) =>
        czechCount(
          count,
          'žádost o půjčení knihy',
          'žádosti o půjčení knihy',
          'žádostí o půjčení knihy'
        ),
      recommendations: (count) =>
        czechCount(count, 'doporučená kniha', 'doporučené knihy', 'doporučených knih'),
    },
    feedLink: 'Všechny novinky od přátel',
    appLink: 'Otevřít Kniho-hlod',
    accountLink: 'Týdenní e-mail vypnete v účtu',
  },
  en: {
    subject: `${APP_NAME}: what your friends are reading`,
    greeting: (displayName) => `Hello ${displayName},`,
    activityIntro: 'here is what your friends were up to this week:',
    activity: {
      started: (name, book) => `${name} is reading ${book}`,
      finished: (name, book) => `${name} finished ${book}`,
      wantsToRead: (name, book) => `${name} wants to read ${book}`,
    },
    rating: (rating) => `, rated ${rating}/5`,
    moreActivities: (count) => `and ${englishCount(count, 'more book', 'more books')} in the app`,
    waitingIntro: (first) => (first ? 'waiting' : 'Waiting') + ' for you in the app:',
    waiting: {
      friendRequests: (count) => englishCount(count, 'friend request', 'friend requests'),
      loanRequests: (count) =>
        englishCount(count, 'request to borrow a book', 'requests to borrow a book'),
      recommendations: (count) => englishCount(count, 'recommended book', 'recommended books'),
    },
    feedLink: 'All news from friends',
    appLink: 'Open Kniho-hlod',
    accountLink: 'Turn the weekly e-mail off in your account',
  },
};

const WAITING_ORDER: readonly (keyof DigestWaiting)[] = [
  'friendRequests',
  'loanRequests',
  'recommendations',
];

function bookName({ title, author }: DigestActivity, locale: Locale): string {
  const quoted = locale === 'cs' ? `„${title}“` : `“${title}”`;
  return author ? `${quoted} (${author})` : quoted;
}

/** One e-mail a week: what friends read, and what waits for the reader's answer. */
export const weeklyDigestEmail: EmailTemplateFunction<WeeklyDigestEmailData> = ({
  locale,
  displayName,
  activities,
  moreActivities,
  waiting,
  appUrl,
  feedUrl,
  accountUrl,
}) => {
  const copy = COPY[locale];
  const activityLines = activities.map(
    (activity) =>
      copy.activity[activity.kind](activity.friendName, bookName(activity, locale)) +
      (activity.kind === 'finished' && activity.rating !== null ? copy.rating(activity.rating) : '')
  );
  if (moreActivities > 0) activityLines.push(copy.moreActivities(moreActivities));
  const waitingLines = WAITING_ORDER.filter((key) => waiting[key] > 0).map((key) =>
    copy.waiting[key](waiting[key])
  );

  const textSections: string[][] = [];
  const htmlSections: string[] = [];
  if (activityLines.length > 0) {
    textSections.push([
      copy.activityIntro,
      '',
      ...activityLines.map((line) => `– ${line}`),
      '',
      `${copy.feedLink}: ${feedUrl}`,
    ]);
    htmlSections.push(`
      <p>${escapeHtml(copy.activityIntro)}</p>
      <ul>
        ${activityLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('\n        ')}
      </ul>
      <p><a href="${escapeHtml(feedUrl)}">${escapeHtml(copy.feedLink)}</a></p>`);
  }
  if (waitingLines.length > 0) {
    const waitingIntro = copy.waitingIntro(activityLines.length === 0);
    textSections.push([
      waitingIntro,
      '',
      ...waitingLines.map((line) => `– ${line}`),
      '',
      `${copy.appLink}: ${appUrl}`,
    ]);
    htmlSections.push(`
      <p>${escapeHtml(waitingIntro)}</p>
      <ul>
        ${waitingLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('\n        ')}
      </ul>
      <p><a href="${escapeHtml(appUrl)}">${escapeHtml(copy.appLink)}</a></p>`);
  }

  return {
    subject: copy.subject,
    text: [
      copy.greeting(displayName),
      '',
      ...textSections.flatMap((section) => [...section, '']),
      `${copy.accountLink}: ${accountUrl}`,
    ].join('\n'),
    html: `
      <p>${escapeHtml(copy.greeting(displayName))}</p>${htmlSections.join('')}
      <p><a href="${escapeHtml(accountUrl)}">${escapeHtml(copy.accountLink)}</a></p>
    `,
  };
};
