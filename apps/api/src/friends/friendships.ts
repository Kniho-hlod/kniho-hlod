import { Op } from '@eleansphere/be-core';
import type { Sequelize } from '@eleansphere/be-core';
import { ACCEPTED_FRIENDSHIP, friendshipEntity, userEntity } from '@kniho-hlod/domain';
import type { ModelClass, ModelRegistry } from '../models-registry';

/** Sequelize's transaction, which be-core doesn't re-export: what `sequelize.transaction()` opens. */
export type Transaction = Awaited<ReturnType<Sequelize['transaction']>>;
type Row = InstanceType<ModelClass>;

/** A friend of the reader's, and since when. */
export interface FriendLink {
  friendId: string;
  since: Date;
}

export interface Friendships {
  /** The friendship or request between two readers, whichever of them asked. */
  between(firstId: string, secondId: string, transaction?: Transaction): Promise<Row | null>;
  /** The reader's friends (accepted friendships only). */
  friendsOf(userId: string): Promise<FriendLink[]>;
  areFriends(firstId: string, secondId: string): Promise<boolean>;
  /** Whether the reader may see the friend's library: they are friends and it is shared. */
  sharesLibraryWith(friendId: string, readerId: string): Promise<boolean>;
  /** The ones among these readers who share their library. */
  sharingAmong(userIds: string[]): Promise<Set<string>>;
}

/** The other reader of a friendship row. */
export function otherReader(friendship: Row, readerId: string): string {
  const requesterId = String(friendship.get('requesterId'));
  return requesterId === readerId ? String(friendship.get('addresseeId')) : requesterId;
}

export function createFriendships(registry: ModelRegistry): Friendships {
  const friendships = () => registry.get(friendshipEntity.config.name);

  function involving(firstId: string, secondId: string) {
    return {
      [Op.or]: [
        { requesterId: firstId, addresseeId: secondId },
        { requesterId: secondId, addresseeId: firstId },
      ],
    };
  }

  async function sharingAmong(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const sharing = await registry
      .get(userEntity.config.name)
      .findAll({ where: { id: userIds, shareLibrary: true }, attributes: ['id'] });
    return new Set(sharing.map((user) => String(user.get('id'))));
  }

  async function areFriends(firstId: string, secondId: string): Promise<boolean> {
    const friendship = await friendships().findOne({
      where: { ...involving(firstId, secondId), status: ACCEPTED_FRIENDSHIP },
      attributes: ['id'],
    });
    return friendship !== null;
  }

  return {
    between(firstId, secondId, transaction) {
      return friendships().findOne({ where: involving(firstId, secondId), transaction });
    },

    async friendsOf(userId) {
      const accepted = await friendships().findAll({
        where: {
          [Op.or]: [{ requesterId: userId }, { addresseeId: userId }],
          status: ACCEPTED_FRIENDSHIP,
        },
      });
      return accepted.map((friendship) => ({
        friendId: otherReader(friendship, userId),
        since: (friendship.get('acceptedAt') ?? friendship.get('createdAt')) as Date,
      }));
    },

    areFriends,

    async sharesLibraryWith(friendId, readerId) {
      if (friendId === readerId || !(await areFriends(friendId, readerId))) return false;
      return (await sharingAmong([friendId])).has(friendId);
    },

    sharingAmong,
  };
}
