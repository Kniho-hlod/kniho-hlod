import { generateId, HttpError, Op } from '@eleansphere/be-core';
import type { Sequelize } from '@eleansphere/be-core';
import { contactEntity, userEntity } from '@kniho-hlod/domain';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { Transaction } from './friendships';

type Row = InstanceType<ModelClass>;

const NOT_FOUND = 404;

/**
 * A reader's contact for a friend: the one linked to the friend already, else one with the
 * friend's e-mail (linked now), else a new one under the friend's name. Lending to a friend —
 * from a request or straight from the loan form — always goes to this contact.
 */
export function createFriendContact(registry: ModelRegistry, sequelize: Sequelize) {
  const model = (name: string) => registry.get(name);

  return async function friendContact(
    ownerId: string,
    friendId: string,
    transaction?: Transaction
  ): Promise<Row> {
    const contacts = model(contactEntity.config.name);
    const linked = await contacts.findOne({
      where: { ownerId, linkedUserId: friendId },
      transaction,
    });
    if (linked) return linked;
    const friend = await model(userEntity.config.name).findByPk(friendId, {
      attributes: ['displayName', 'email'],
      transaction,
    });
    if (!friend) throw new HttpError(NOT_FOUND, 'friend not found');
    const sameEmail = await contacts.findOne({
      where: {
        ownerId,
        linkedUserId: null,
        [Op.and]: [
          sequelize.where(
            sequelize.fn('lower', sequelize.col('email')),
            String(friend.get('email')).toLowerCase()
          ),
        ],
      },
      transaction,
    });
    if (sameEmail) return sameEmail.update({ linkedUserId: friendId }, { transaction });
    return contacts.create(
      {
        id: generateId(contactEntity.config.prefix),
        ownerId,
        name: String(friend.get('displayName')),
        linkedUserId: friendId,
      },
      { transaction }
    );
  };
}

export type FriendContact = ReturnType<typeof createFriendContact>;
