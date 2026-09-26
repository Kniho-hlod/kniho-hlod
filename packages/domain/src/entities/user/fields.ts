import type { Fields } from '@eleansphere/entity-core';
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_USER_ROLE,
  LOCALES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USER_ROLES,
} from '../../constants';

const EMAIL_MAX_LENGTH = 254;
const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 60;
const TIMEZONE_MAX_LENGTH = 64;
const DEFAULT_REMINDER_DAYS_BEFORE = 2;
const MAX_REMINDER_DAYS_BEFORE = 30;
const RELEASE_VERSION_MAX_LENGTH = 20;
const INVITE_CODE_MAX_LENGTH = 32;

export const userFields = {
  email: {
    type: 'STRING',
    required: true,
    unique: true,
    format: 'email',
    maxLength: EMAIL_MAX_LENGTH,
  },
  password: {
    type: 'STRING',
    required: true,
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
    hash: 'bcrypt',
  },
  displayName: {
    type: 'STRING',
    required: true,
    minLength: DISPLAY_NAME_MIN_LENGTH,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
  },
  role: { type: 'ENUM', values: USER_ROLES, default: DEFAULT_USER_ROLE, readOnly: true },
  locale: { type: 'ENUM', values: LOCALES, default: DEFAULT_LOCALE },
  timezone: { type: 'STRING', default: DEFAULT_TIMEZONE, maxLength: TIMEZONE_MAX_LENGTH },
  emailReminders: { type: 'BOOLEAN', default: true },
  reminderDaysBefore: {
    type: 'INTEGER',
    default: DEFAULT_REMINDER_DAYS_BEFORE,
    min: 0,
    max: MAX_REMINDER_DAYS_BEFORE,
  },
  /**
   * When the reader finished or skipped the onboarding tour; empty until then, so the tour greets
   * them on the home page. Set by the app through `PATCH /api/auth/me`.
   */
  onboardedAt: { type: 'DATE' },
  /**
   * The newest release whose notes the reader has seen (`1.4`); the app shows "what's new" for
   * anything newer. Empty for a reader the app hasn't recorded yet. Set through `PATCH /api/auth/me`.
   */
  lastSeenRelease: { type: 'STRING', maxLength: RELEASE_VERSION_MAX_LENGTH },
  /** Friends see the reader's library (the books not hidden from them) and what they read. */
  shareLibrary: { type: 'BOOLEAN', default: false },
  /** E-mails about friend requests; the bell shows everything either way. */
  emailNotifications: { type: 'BOOLEAN', default: true },
  /**
   * The reader's invite link (`/invite/<code>`): whoever opens it can become their friend. Made
   * by the server when first asked for, replaced on request; never in a response of its own.
   */
  inviteCode: {
    type: 'STRING',
    unique: true,
    readOnly: true,
    writeOnly: true,
    maxLength: INVITE_CODE_MAX_LENGTH,
  },
} as const satisfies Fields;
