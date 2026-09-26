import { attachFiles, FILE_MODEL_NAME } from '@eleansphere/be-core';
import type { StorageAdapter } from '@eleansphere/be-core';
import { FILE_REF_TYPES, FILE_ROLES, userEntity } from '@kniho-hlod/domain';
import type { PersonSummary } from '@kniho-hlod/domain';
import type { FileDto } from '@eleansphere/entity-core';
import type { ModelRegistry } from '../models-registry';

/** Where `attachFiles` puts each reader's avatar list before it is reduced to one `avatar`. */
const AVATARS_KEY = 'avatars';

export interface People {
  /** Readers as others see them — name and picture, never an e-mail — by id. */
  summaries(userIds: string[]): Promise<Map<string, PersonSummary>>;
  /** One reader as others see them, or `null` when there is no such account. */
  summary(userId: string): Promise<PersonSummary | null>;
}

export function createPeople(registry: ModelRegistry, storage: StorageAdapter): People {
  async function summaries(userIds: string[]): Promise<Map<string, PersonSummary>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const users = await registry
      .get(userEntity.config.name)
      .findAll({ where: { id: ids }, attributes: ['id', 'displayName'] });
    const rows = users.map((user) => {
      const person = { id: String(user.get('id')), displayName: String(user.get('displayName')) };
      return { ...person, toJSON: () => person };
    });
    const withAvatars = await attachFiles(
      registry.get(FILE_MODEL_NAME),
      storage,
      FILE_REF_TYPES.user,
      rows,
      { role: FILE_ROLES.avatar, as: AVATARS_KEY }
    );
    return new Map(
      withAvatars.map(({ [AVATARS_KEY]: avatars, id, displayName }) => [
        String(id),
        {
          id: String(id),
          displayName: String(displayName),
          avatar: Array.isArray(avatars) ? ((avatars[0] as FileDto | undefined) ?? null) : null,
        },
      ])
    );
  }

  return {
    summaries,
    async summary(userId) {
      return (await summaries([userId])).get(userId) ?? null;
    },
  };
}
