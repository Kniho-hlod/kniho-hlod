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

/** What an uploaded file is attached to (be-core file service `refType`). */
export const FILE_REF_TYPES = {
  user: 'user',
} as const;

/** The file's slot on that row (be-core file service `role`). */
export const FILE_ROLES = {
  avatar: 'avatar',
} as const;

/** Roles holding a single file: uploading a new one replaces the previous. */
export const SINGLE_FILE_ROLES = [FILE_ROLES.avatar];
