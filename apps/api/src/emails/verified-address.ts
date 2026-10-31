import { Op } from '@eleansphere/be-core';

/** The user column be-core's e-mail verification sets once the reader opened the link. */
export const EMAIL_VERIFIED_AT_FIELD = 'emailVerifiedAt';

/**
 * Only readers who confirmed their address get e-mails beyond the confirmation and password
 * links: anyone can sign up with someone else's address, whose owner never asked for them.
 * Spread into a `where`.
 */
export const HAS_VERIFIED_EMAIL = { [EMAIL_VERIFIED_AT_FIELD]: { [Op.ne]: null } };

interface UserRow {
  get(key: string): unknown;
}

export function hasVerifiedEmail(user: UserRow): boolean {
  const verifiedAt = user.get(EMAIL_VERIFIED_AT_FIELD);
  return verifiedAt !== null && verifiedAt !== undefined;
}
