import { daysBetween } from '@eleansphere/schema';
import { Op } from '@eleansphere/be-core';
import type { CoreInstance, EmailService } from '@eleansphere/be-core';
import {
  ACCEPTED_FRIENDSHIP,
  bookEntity,
  DEFAULT_BOOK_VISIBILITY,
  DEFAULT_FRIENDSHIP_STATUS,
  DEFAULT_LOAN_REQUEST_STATUS,
  DEFAULT_LOCALE,
  DEFAULT_RECOMMENDATION_STATUS,
  DEFAULT_TIMEZONE,
  FRIENDS_PAGE_PATH,
  friendshipEntity,
  LOCALES,
  loanRequestEntity,
  readerToday,
  recommendationEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { FeedItemKind, Locale, ReadingStatus } from '@kniho-hlod/domain';
import { weeklyDigestEmail } from '../emails/weekly-digest';
import type { DigestActivity, DigestWaiting } from '../emails/weekly-digest';

type Models = CoreInstance['models'];
type Row = InstanceType<Models[string]>;

/** The day of the week the e-mail goes out on, in the reader's time zone: Sunday. */
export const DIGEST_WEEKDAY = 0;
/** A week, less a day: a run a day late still sends next week's e-mail on time. */
const DAYS_BETWEEN_DIGESTS = 6;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** How many of the friends' books one e-mail lists; the rest are counted. */
export const DIGEST_ACTIVITY_LIMIT = 8;

const ACCOUNT_PATH = '/account';
const FEED_TAB_QUERY = '?tab=feed';

/** The reading statuses a friend's book shows in the e-mail with, as in the app's feed. */
const DIGEST_KINDS: Partial<Record<ReadingStatus, FeedItemKind>> = {
  reading: 'started',
  read: 'finished',
  want: 'wantsToRead',
};

export interface WeeklyDigestOptions {
  models: Models;
  emailService: EmailService;
  appBaseUrl: string;
  now?: () => Date;
}

export interface WeeklyDigestResult {
  /** Readers e-mailed. */
  readers: number;
  /** Readers whose e-mail could not be sent; they get it on the next run. */
  failed: number;
}

interface Activity extends DigestActivity {
  friendId: string;
  /** The day it happened, `YYYY-MM-DD`, for the order. */
  on: string;
  changedAt: Date;
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** A DATEONLY column comes back as `YYYY-MM-DD`, or as a `Date` from some drivers. */
function toDay(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/** Sunday is 0, as in `Date.getUTCDay`. */
function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** Whether the reader's e-mail is due today: the right weekday, and none in the last week. */
function isDue(reader: Row, now: Date): boolean {
  const timezone = String(reader.get('timezone') ?? DEFAULT_TIMEZONE);
  const today = readerToday(timezone, now);
  if (weekdayOf(today) !== DIGEST_WEEKDAY) return false;
  const lastSent = reader.get('lastDigestSentAt') as Date | null;
  return !lastSent || daysBetween(readerToday(timezone, lastSent), today) >= DAYS_BETWEEN_DIGESTS;
}

/** What a friend's book shows as, and the day it happened — the feed's rule, in the app's zone. */
function toActivity(book: Row, friendName: string): Activity | null {
  const status = book.get('readingStatus') as ReadingStatus;
  const kind = DIGEST_KINDS[status];
  if (!kind) return null;
  const changedAt = book.get('updatedAt') as Date;
  const changedOn = readerToday(DEFAULT_TIMEZONE, changedAt);
  const datedOn =
    status === 'read'
      ? book.get('finishedAt')
      : status === 'reading'
        ? book.get('startedAt')
        : readerToday(DEFAULT_TIMEZONE, book.get('createdAt') as Date);
  const rating = book.get('rating');
  return {
    kind,
    friendId: String(book.get('ownerId')),
    friendName,
    title: String(book.get('title')),
    author: stringOrNull(book.get('author')),
    rating: kind === 'finished' && rating !== null ? Number(rating) : null,
    on: datedOn ? toDay(datedOn) : changedOn,
    changedAt,
  };
}

function newestFirst(left: Activity, right: Activity): number {
  return right.on.localeCompare(left.on) || right.changedAt.getTime() - left.changedAt.getTime();
}

/** How many rows of a model wait for each reader in a column. */
async function countWaiting(
  models: Models,
  modelName: string,
  readerColumn: string,
  status: string,
  readerIds: string[]
): Promise<Map<string, number>> {
  const rows = await models[modelName].findAll({
    where: { [readerColumn]: readerIds, status },
    attributes: [readerColumn],
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const readerId = String(row.get(readerColumn));
    counts.set(readerId, (counts.get(readerId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The weekly e-mail, run with the daily reminders: on Sunday in their own time zone, every reader
 * who keeps it on hears what their sharing friends started, finished or want to read since the
 * last one (the feed's rules: shared, unhidden books, never samples), and what waits for their
 * answer — friend requests, requests to borrow their books, recommendations. Nothing to say, no
 * e-mail. A failed e-mail is tried again on the next run.
 */
export async function sendWeeklyDigests({
  models,
  emailService,
  appBaseUrl,
  now = () => new Date(),
}: WeeklyDigestOptions): Promise<WeeklyDigestResult> {
  const runAt = now();
  const result: WeeklyDigestResult = { readers: 0, failed: 0 };
  const users = models[userEntity.config.name];
  const readers = (await users.findAll({ where: { weeklyDigest: true } })).filter((reader) =>
    isDue(reader, runAt)
  );
  if (readers.length === 0) return result;
  const readerIds = readers.map((reader) => String(reader.get('id')));

  const friendships = await models[friendshipEntity.config.name].findAll({
    where: {
      status: ACCEPTED_FRIENDSHIP,
      [Op.or]: [{ requesterId: readerIds }, { addresseeId: readerIds }],
    },
    attributes: ['requesterId', 'addresseeId'],
  });
  const friendsOf = new Map<string, Set<string>>();
  const link = (readerId: string, friendId: string) => {
    friendsOf.set(readerId, (friendsOf.get(readerId) ?? new Set()).add(friendId));
  };
  for (const friendship of friendships) {
    const requesterId = String(friendship.get('requesterId'));
    const addresseeId = String(friendship.get('addresseeId'));
    link(requesterId, addresseeId);
    link(addresseeId, requesterId);
  }
  const friendIds = [...new Set([...friendsOf.values()].flatMap((ids) => [...ids]))];
  const sharing =
    friendIds.length === 0
      ? []
      : await users.findAll({
          where: { id: friendIds, shareLibrary: true },
          attributes: ['id', 'displayName'],
        });
  const sharingNames = new Map(
    sharing.map((friend) => [String(friend.get('id')), String(friend.get('displayName'))])
  );
  // A week back at most: a reader who turned the e-mail back on doesn't get a year of news.
  const weekAgo = new Date(runAt.getTime() - WEEK_MS);
  const recentBooks =
    sharingNames.size === 0
      ? []
      : await models[bookEntity.config.name].findAll({
          where: {
            ownerId: [...sharingNames.keys()],
            visibility: DEFAULT_BOOK_VISIBILITY,
            isSample: false,
            readingStatus: Object.keys(DIGEST_KINDS),
            updatedAt: { [Op.gte]: weekAgo },
          },
          attributes: [
            'ownerId',
            'title',
            'author',
            'readingStatus',
            'rating',
            'startedAt',
            'finishedAt',
            'createdAt',
            'updatedAt',
          ],
        });
  const activities = recentBooks.flatMap((book) => {
    const activity = toActivity(book, sharingNames.get(String(book.get('ownerId'))) ?? '');
    return activity ? [activity] : [];
  });

  const [friendRequests, loanRequests, recommendations] = await Promise.all([
    countWaiting(
      models,
      friendshipEntity.config.name,
      'addresseeId',
      DEFAULT_FRIENDSHIP_STATUS,
      readerIds
    ),
    countWaiting(
      models,
      loanRequestEntity.config.name,
      'lenderId',
      DEFAULT_LOAN_REQUEST_STATUS,
      readerIds
    ),
    countWaiting(
      models,
      recommendationEntity.config.name,
      'recipientId',
      DEFAULT_RECOMMENDATION_STATUS,
      readerIds
    ),
  ]);

  for (const reader of readers) {
    const readerId = String(reader.get('id'));
    const lastSent = reader.get('lastDigestSentAt') as Date | null;
    const since = lastSent && lastSent > weekAgo ? lastSent : weekAgo;
    // The day it happened has to be in the window too, so a book finished long ago and only
    // edited now isn't news.
    const sinceDay = readerToday(DEFAULT_TIMEZONE, since);
    const friends = friendsOf.get(readerId) ?? new Set<string>();
    const news = activities
      .filter(
        (activity) =>
          friends.has(activity.friendId) && activity.changedAt >= since && activity.on >= sinceDay
      )
      .sort(newestFirst);
    const waiting: DigestWaiting = {
      friendRequests: friendRequests.get(readerId) ?? 0,
      loanRequests: loanRequests.get(readerId) ?? 0,
      recommendations: recommendations.get(readerId) ?? 0,
    };
    if (news.length === 0 && Object.values(waiting).every((count) => count === 0)) continue;

    const email = weeklyDigestEmail({
      locale: toLocale(reader.get('locale')),
      displayName: String(reader.get('displayName')),
      activities: news
        .slice(0, DIGEST_ACTIVITY_LIMIT)
        .map(({ kind, friendName, title, author, rating }) => ({
          kind,
          friendName,
          title,
          author,
          rating,
        })),
      moreActivities: Math.max(0, news.length - DIGEST_ACTIVITY_LIMIT),
      waiting,
      appUrl: appBaseUrl,
      feedUrl: `${appBaseUrl}${FRIENDS_PAGE_PATH}${FEED_TAB_QUERY}`,
      accountUrl: `${appBaseUrl}${ACCOUNT_PATH}`,
    });
    try {
      await emailService.send({ to: String(reader.get('email')), ...email });
    } catch {
      // be-core has logged the failure; the reader stays unmarked for the next run.
      result.failed += 1;
      continue;
    }
    await users.update({ lastDigestSentAt: runAt }, { where: { id: readerId } });
    result.readers += 1;
  }
  return result;
}
