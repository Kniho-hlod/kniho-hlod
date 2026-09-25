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

/** Public books will be visible to other readers once community lending arrives. */
export const BOOK_VISIBILITIES = ['private', 'public'] as const;
export type BookVisibility = (typeof BOOK_VISIBILITIES)[number];
export const DEFAULT_BOOK_VISIBILITY: BookVisibility = 'private';

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Where a loan stands on a given day; see `loanStatus`. */
export const LOAN_STATUSES = ['active', 'dueSoon', 'overdue', 'returned'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
/** A loan counts as due soon from this many days before its due date. */
export const DUE_SOON_DAYS = 7;
/** The due date a new loan suggests: this many days after lending. */
export const DEFAULT_LOAN_DAYS = 30;

/** What an uploaded file is attached to (be-core file service `refType`). */
export const FILE_REF_TYPES = {
  user: 'user',
  book: 'book',
} as const;

/** The file's slot on that row (be-core file service `role`). */
export const FILE_ROLES = {
  avatar: 'avatar',
  cover: 'cover',
} as const;

/** Roles holding a single file: uploading a new one replaces the previous. */
export const SINGLE_FILE_ROLES = [FILE_ROLES.avatar, FILE_ROLES.cover];
