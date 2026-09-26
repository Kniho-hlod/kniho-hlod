import crypto from 'node:crypto';
import { userEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

/** 9 random bytes: 12 URL-safe characters, far too many to guess. */
const INVITE_CODE_BYTES = 9;
const INVITE_CODE_FIELD = 'inviteCode';

export interface InviteCodes {
  /** The reader's invite code, made on first ask. */
  codeOf(userId: string): Promise<string>;
  /** A new code for the reader; the old link stops working. */
  replace(userId: string): Promise<string>;
  /** Whose invite this is, or `null` for a code nobody has (any more). */
  ownerOf(code: string): Promise<string | null>;
}

function newCode(): string {
  return crypto.randomBytes(INVITE_CODE_BYTES).toString('base64url');
}

export function createInviteCodes(registry: ModelRegistry): InviteCodes {
  const users = () => registry.get(userEntity.config.name);

  async function replace(userId: string): Promise<string> {
    const code = newCode();
    await users().update({ [INVITE_CODE_FIELD]: code }, { where: { id: userId } });
    return code;
  }

  return {
    async codeOf(userId) {
      const user = await users().findByPk(userId, { attributes: [INVITE_CODE_FIELD] });
      const code = user?.get(INVITE_CODE_FIELD);
      return typeof code === 'string' ? code : replace(userId);
    },

    replace,

    async ownerOf(code) {
      const owner = await users().findOne({
        where: { [INVITE_CODE_FIELD]: code },
        attributes: ['id'],
      });
      return owner ? String(owner.get('id')) : null;
    },
  };
}
