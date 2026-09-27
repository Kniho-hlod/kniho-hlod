export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const DEFAULT_USER_ROLE: UserRole = 'user';
export const ADMIN_ROLE: UserRole = 'admin';

export const LOCALES = ['cs', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'cs';

/** Reminders and "today" are computed in the user's time zone. */
export const DEFAULT_TIMEZONE = 'Europe/Prague';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

/** Where a book stands for its owner as a reader. */
export const READING_STATUSES = ['none', 'want', 'reading', 'read'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];
export const DEFAULT_READING_STATUS: ReadingStatus = 'none';

/**
 * Who sees a book besides its owner: the owner's friends, once the owner shares the library
 * (`user.shareLibrary`), or nobody.
 */
export const BOOK_VISIBILITIES = ['friends', 'private'] as const;
export type BookVisibility = (typeof BOOK_VISIBILITIES)[number];
export const DEFAULT_BOOK_VISIBILITY: BookVisibility = 'friends';
/** The visibility of a book hidden from friends. */
export const HIDDEN_BOOK_VISIBILITY: BookVisibility = 'private';

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** The colours a shelf can be marked with, named after the Tailwind palette the web draws them in. */
export const SHELF_COLORS = [
  'neutral',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'sky',
  'blue',
  'violet',
  'pink',
] as const;
export type ShelfColor = (typeof SHELF_COLORS)[number];
export const DEFAULT_SHELF_COLOR: ShelfColor = 'neutral';
/** How many shelves one book can be put on at once. */
export const MAX_SHELVES_PER_BOOK = 50;

/** Where a loan stands on a given day; see `loanStatus`. */
export const LOAN_STATUSES = ['active', 'dueSoon', 'overdue', 'returned'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
/** A loan counts as due soon from this many days before its due date. */
export const DUE_SOON_DAYS = 7;
/** The due date a new loan suggests: this many days after lending. */
export const DEFAULT_LOAN_DAYS = 30;

/** What a reader's report to the administrators is about. */
export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const DEFAULT_FEEDBACK_KIND: FeedbackKind = 'bug';
/** Whether an administrator has dealt with a report yet. */
export const FEEDBACK_STATUSES = ['new', 'resolved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const DEFAULT_FEEDBACK_STATUS: FeedbackStatus = 'new';

/** A friendship starts as one reader's request and holds once the other accepts it. */
export const FRIENDSHIP_STATUSES = ['pending', 'accepted'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];
export const DEFAULT_FRIENDSHIP_STATUS: FriendshipStatus = 'pending';
export const ACCEPTED_FRIENDSHIP: FriendshipStatus = 'accepted';

/**
 * A friend's request to borrow a book: waiting for the owner, lent (`accepted`), `declined` by
 * the owner or `cancelled` by the friend.
 */
export const LOAN_REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type LoanRequestStatus = (typeof LOAN_REQUEST_STATUSES)[number];
export const DEFAULT_LOAN_REQUEST_STATUS: LoanRequestStatus = 'pending';

/** What a notification in the bell tells the reader. */
export const NOTIFICATION_KINDS = [
  'friendRequest',
  'friendAccepted',
  'loanRequest',
  'loanRequestAccepted',
  'loanRequestDeclined',
  'comment',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** What an uploaded file is attached to (be-core file service `refType`). */
export const FILE_REF_TYPES = {
  user: 'user',
  book: 'book',
  feedback: 'feedback',
} as const;

/** The file's slot on that row (be-core file service `role`). */
export const FILE_ROLES = {
  avatar: 'avatar',
  cover: 'cover',
  screenshot: 'screenshot',
} as const;

/** Roles holding a single file: uploading a new one replaces the previous. */
export const SINGLE_FILE_ROLES = [FILE_ROLES.avatar, FILE_ROLES.cover, FILE_ROLES.screenshot];
