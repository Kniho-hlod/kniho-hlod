import { createOptionalUser, createVerifyToken, generateId, HttpError } from '@eleansphere/be-core';
import type { ProjectPlugin } from '@eleansphere/be-core';
import {
  ACCEPTED_FRIENDSHIP,
  friendshipEntity,
  INVITES_PATH,
  MY_INVITE_PATH,
} from '@kniho-hlod/domain';
import type { InviteInfo, InviteRelation, MyInvite } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';
import { acceptFriendship } from './accept-friendship';
import type { DescribeFriends } from './describe-friends';
import type { FriendLink, Friendships } from './friendships';
import type { InviteCodes } from './invite-codes';
import type { People } from './people';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

export interface InvitesPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  describeFriends: DescribeFriends;
  inviteCodes: InviteCodes;
  notify: Notify;
}

/**
 * Invite links. `GET /api/me/invite` gives the reader their code (made on first ask), `POST`
 * replaces it. `GET /api/invites/:code` says who invites — to anyone, so a visitor sees whose
 * invitation it is before signing up — and, to a signed-in reader, how they stand with them.
 * `POST /api/invites/:code/accept` makes the two friends: the inviter shared the link on purpose.
 */
export function createInvitesPlugin(options: InvitesPluginOptions): ProjectPlugin {
  const { jwtSecret, registry, people, friendships, describeFriends, inviteCodes, notify } =
    options;

  async function inviterOf(code: string): Promise<string> {
    const inviterId = await inviteCodes.ownerOf(code);
    if (!inviterId) throw new HttpError(NOT_FOUND, 'invite not found');
    return inviterId;
  }

  async function relationTo(inviterId: string, readerId: string | undefined) {
    if (!readerId) return 'none' satisfies InviteRelation;
    if (readerId === inviterId) return 'self' satisfies InviteRelation;
    const friendship = await friendships.between(inviterId, readerId);
    if (!friendship) return 'none' satisfies InviteRelation;
    return friendship.get('status') === ACCEPTED_FRIENDSHIP ? 'friends' : 'requested';
  }

  /** Friends with the inviter from now on, whatever stood between them before. */
  async function befriend(inviterId: string, readerId: string): Promise<FriendLink> {
    const existing = await friendships.between(inviterId, readerId);
    if (existing?.get('status') === ACCEPTED_FRIENDSHIP) {
      return {
        friendId: inviterId,
        since: (existing.get('acceptedAt') ?? existing.get('createdAt')) as Date,
      };
    }
    if (existing) return acceptFriendship(existing, readerId, notify);
    const friendship = await registry.get(friendshipEntity.config.name).create({
      id: generateId(friendshipEntity.config.prefix),
      requesterId: inviterId,
      addresseeId: readerId,
      status: ACCEPTED_FRIENDSHIP,
      acceptedAt: new Date(),
    });
    await notify({ recipientId: inviterId, actorId: readerId, kind: 'friendAccepted' });
    return { friendId: inviterId, since: friendship.get('acceptedAt') as Date };
  }

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);

      app.get(
        MY_INVITE_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const invite: MyInvite = { code: await inviteCodes.codeOf(String(req.user?.id)) };
          res.json(invite);
        })
      );

      app.post(
        MY_INVITE_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const invite: MyInvite = { code: await inviteCodes.replace(String(req.user?.id)) };
          res.json(invite);
        })
      );

      app.get(
        `${INVITES_PATH}/:code`,
        createOptionalUser(jwtSecret),
        asyncHandler(async (req, res) => {
          const inviterId = await inviterOf(String(req.params.code));
          const inviter = await people.summary(inviterId);
          if (!inviter) throw new HttpError(NOT_FOUND, 'invite not found');
          const info: InviteInfo = {
            inviter,
            relation: await relationTo(inviterId, req.user?.id),
          };
          res.json(info);
        })
      );

      app.post(
        `${INVITES_PATH}/:code/accept`,
        requireUser,
        asyncHandler(async (req, res) => {
          const inviterId = await inviterOf(String(req.params.code));
          const readerId = String(req.user?.id);
          if (inviterId === readerId) throw new HttpError(BAD_REQUEST, 'this is your own invite');
          const [friend] = await describeFriends([await befriend(inviterId, readerId)]);
          res.json(friend);
        })
      );
    },
  };
}
