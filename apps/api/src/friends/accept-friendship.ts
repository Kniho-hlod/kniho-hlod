import { ACCEPTED_FRIENDSHIP } from '@kniho-hlod/domain';
import type { ModelClass } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';
import { otherReader } from './friendships';
import type { FriendLink } from './friendships';

type Row = InstanceType<ModelClass>;

/** Makes a request a friendship and tells the other reader, who asked (or invited). */
export async function acceptFriendship(
  friendship: Row,
  acceptedBy: string,
  notify: Notify
): Promise<FriendLink> {
  const acceptedAt = new Date();
  await friendship.update({ status: ACCEPTED_FRIENDSHIP, acceptedAt });
  const friendId = otherReader(friendship, acceptedBy);
  await notify({ recipientId: friendId, actorId: acceptedBy, kind: 'friendAccepted' });
  return { friendId, since: acceptedAt };
}
