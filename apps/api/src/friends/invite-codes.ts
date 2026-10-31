import crypto from 'node:crypto';
import { INVITE_LINK_DAYS, userEntity } from '@kniho-hlod/domain';
import type { MyInvite } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

/** 9 random bytes: 12 URL-safe characters, far too many to guess. */
const INVITE_CODE_BYTES = 9;
const INVITE_CODE_FIELD = 'inviteCode';
const ISSUED_AT_FIELD = 'inviteCodeIssuedAt';
const INVITE_LINK_MS = INVITE_LINK_DAYS * 24 * 60 * 60 * 1000;

export interface InviteCodes {
  /** The reader's invite, made on first ask and again once the last one has run out. */
  inviteOf(userId: string): Promise<MyInvite>;
  /** A new invite for the reader; the old link stops working. */
  replace(userId: string): Promise<MyInvite>;
  /** Whose invite this is, or `null` for a code nobody has (any more) or one that ran out. */
  ownerOf(code: string): Promise<string | null>;
}

function newCode(): string {
  return crypto.randomBytes(INVITE_CODE_BYTES).toString('base64url');
}

/**
 * Invite links work for `INVITE_LINK_DAYS` after they were made: a link posted somewhere public
 * or forwarded on doesn't make friends forever.
 */
export function createInviteCodes(
  registry: ModelRegistry,
  now: () => Date = () => new Date()
): InviteCodes {
  const users = () => registry.get(userEntity.config.name);
  const expiryOf = (issuedAt: Date) => new Date(issuedAt.getTime() + INVITE_LINK_MS);
  const isCurrent = (issuedAt: unknown): issuedAt is Date =>
    issuedAt instanceof Date && expiryOf(issuedAt) > now();

  async function replace(userId: string): Promise<MyInvite> {
    const code = newCode();
    const issuedAt = now();
    await users().update(
      { [INVITE_CODE_FIELD]: code, [ISSUED_AT_FIELD]: issuedAt },
      { where: { id: userId } }
    );
    return { code, expiresAt: expiryOf(issuedAt).toISOString() };
  }

  return {
    async inviteOf(userId) {
      const user = await users().findByPk(userId, {
        attributes: [INVITE_CODE_FIELD, ISSUED_AT_FIELD],
      });
      const code = user?.get(INVITE_CODE_FIELD);
      const issuedAt = user?.get(ISSUED_AT_FIELD);
      if (typeof code !== 'string' || !isCurrent(issuedAt)) return replace(userId);
      return { code, expiresAt: expiryOf(issuedAt).toISOString() };
    },

    replace,

    async ownerOf(code) {
      const owner = await users().findOne({
        where: { [INVITE_CODE_FIELD]: code },
        attributes: ['id', ISSUED_AT_FIELD],
      });
      return owner && isCurrent(owner.get(ISSUED_AT_FIELD)) ? String(owner.get('id')) : null;
    },
  };
}
