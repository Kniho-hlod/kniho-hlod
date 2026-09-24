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
} as const satisfies Fields;
