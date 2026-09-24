import { AuthService } from '@eleansphere/entity-core';
import type { RegisterRequest as CredentialsRequest } from '@eleansphere/entity-core';
import type { Locale } from './constants';
import type { User } from './entities';

/** User columns a registration may set besides email and password. */
export const REGISTRATION_FIELDS = ['displayName', 'locale'] as const satisfies readonly (keyof User)[];

/** User columns `PATCH /api/auth/me` may change. */
export const PROFILE_FIELDS = [
  'displayName',
  'locale',
  'timezone',
  'emailReminders',
  'reminderDaysBefore',
] as const satisfies readonly (keyof User)[];

export interface RegisterRequest extends CredentialsRequest {
  displayName: string;
  locale?: Locale;
}

export type ProfileChanges = Partial<Pick<User, (typeof PROFILE_FIELDS)[number]>>;

export class KnihoHlodAuthService extends AuthService<User, RegisterRequest, ProfileChanges> {}
