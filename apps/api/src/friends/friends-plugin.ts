import {
  createRateLimiter,
  createVerifyToken,
  generateId,
  HttpError,
  Op,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { EmailService, ProjectPlugin, RateLimitConfig } from '@eleansphere/be-core';
import {
  DEFAULT_FRIENDSHIP_STATUS,
  DEFAULT_LOAN_REQUEST_STATUS,
  DEFAULT_LOCALE,
  DEFAULT_RECOMMENDATION_STATUS,
  FRIEND_INVITATIONS_PATH,
  FRIEND_REQUESTS_PATH,
  friendInvitationFields,
  FRIENDS_PAGE_PATH,
  FRIENDS_PATH,
  friendshipEntity,
  INVITE_PAGE_PATH,
  loanRequestEntity,
  LOCALES,
  recommendationEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { FriendContact, FriendRequest, FriendRequests, Locale } from '@kniho-hlod/domain';
import type { Request, RequestHandler } from 'express';
import { friendInvitationEmail } from '../emails/friend-invitation';
import { friendRequestEmail } from '../emails/friend-request';
import { asyncHandler } from '../http/async-handler';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';
import { acceptFriendship } from './accept-friendship';
import { createFriendContact } from './friend-contact';
import type { DescribeFriends } from './describe-friends';
import type { Friendships } from './friendships';
import type { InviteCodes } from './invite-codes';
import type { People } from './people';

type Row = InstanceType<ModelClass>;

const ACCEPTED = 202;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/** Per reader: enough to invite a book club, too few to spam. */
export const FRIEND_INVITATION_RATE_LIMIT: RateLimitConfig = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 20,
};

export interface FriendsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  describeFriends: DescribeFriends;
  inviteCodes: InviteCodes;
  notify: Notify;
  appBaseUrl: string;
  rateLimit: RateLimitConfig | 'off';
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

/** The invited address from the body, or a 400 with the issues the form shows too. */
function readInvitedEmail(body: unknown): string {
  const sent = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const issues = validateFields(friendInvitationFields, sent, { mode: 'create' });
  if (issues.length > 0) throw new ValidationError(issues);
  return String(sent.email).trim();
}

function readerOf(req: Request): string {
  return String(req.user?.id);
}

/**
 * Friends and friend requests: `GET /api/friends` (with what each is reading),
 * `GET /api/friends/requests`, `POST /api/friends/invitations` (by e-mail, rate-limited),
 * `POST /api/friends/requests/:id/accept`, `DELETE /api/friends/requests/:id` (decline or take
 * back), `GET /api/friends/:userId` and `DELETE /api/friends/:userId` (end the friendship),
 * `POST /api/friends/:userId/contact` (the reader's contact for the friend, made or linked if
 * need be, so the loan form can lend to a friend).
 * Anything between other readers answers 404.
 */
export function createFriendsPlugin(options: FriendsPluginOptions): ProjectPlugin {
  const { jwtSecret, registry, people, friendships, describeFriends, notify } = options;
  const rows = () => registry.get(friendshipEntity.config.name);
  const users = () => registry.get(userEntity.config.name);
  const friendsUrl = new URL(FRIENDS_PAGE_PATH, options.appBaseUrl).toString();

  async function pendingRequestTo(readerId: string, requestId: string): Promise<Row | null> {
    const request = await rows().findByPk(requestId);
    const isPendingForReader =
      request?.get('status') === DEFAULT_FRIENDSHIP_STATUS &&
      (request.get('addresseeId') === readerId || request.get('requesterId') === readerId);
    return isPendingForReader ? request : null;
  }

  async function listRequests(readerId: string): Promise<FriendRequests> {
    const pending = await rows().findAll({
      where: {
        status: DEFAULT_FRIENDSHIP_STATUS,
        [Op.or]: [{ requesterId: readerId }, { addresseeId: readerId }],
      },
      order: [['createdAt', 'DESC']],
    });
    const isIncoming = (request: Row) => request.get('addresseeId') === readerId;
    const otherOf = (request: Row) =>
      String(isIncoming(request) ? request.get('requesterId') : request.get('addresseeId'));
    const persons = await people.summaries(pending.map(otherOf));
    const toRequest = (request: Row): FriendRequest[] => {
      const person = persons.get(otherOf(request));
      if (!person) return [];
      return [
        {
          id: String(request.get('id')),
          person,
          sentAt: (request.get('createdAt') as Date).toISOString(),
        },
      ];
    };
    return {
      incoming: pending.filter(isIncoming).flatMap(toRequest),
      outgoing: pending.filter((request) => !isIncoming(request)).flatMap(toRequest),
    };
  }

  /** Asks an existing reader; when they had asked the inviter already, that makes them friends. */
  async function askReader(
    inviter: Row,
    invited: Row,
    emailService: EmailService | undefined
  ): Promise<void> {
    const inviterId = String(inviter.get('id'));
    const invitedId = String(invited.get('id'));
    const existing = await friendships.between(inviterId, invitedId);
    if (existing) {
      const invitedAskedFirst =
        existing.get('status') === DEFAULT_FRIENDSHIP_STATUS &&
        existing.get('addresseeId') === inviterId;
      if (invitedAskedFirst) await acceptFriendship(existing, inviterId, notify);
      return;
    }
    await rows().create({
      id: generateId(friendshipEntity.config.prefix),
      requesterId: inviterId,
      addresseeId: invitedId,
      status: DEFAULT_FRIENDSHIP_STATUS,
    });
    await notify({ recipientId: invitedId, actorId: inviterId, kind: 'friendRequest' });
    if (emailService && invited.get('emailNotifications') === true) {
      await emailService.send({
        to: String(invited.get('email')),
        ...friendRequestEmail({
          locale: toLocale(invited.get('locale')),
          requesterName: String(inviter.get('displayName')),
          friendsUrl,
        }),
      });
    }
  }

  /** Invites someone without an account through the inviter's own link. */
  async function inviteNewcomer(
    inviter: Row,
    email: string,
    emailService: EmailService | undefined
  ): Promise<void> {
    if (!emailService) return;
    const code = await options.inviteCodes.codeOf(String(inviter.get('id')));
    await emailService.send({
      to: email,
      ...friendInvitationEmail({
        locale: toLocale(inviter.get('locale')),
        inviterName: String(inviter.get('displayName')),
        inviteUrl: new URL(`${INVITE_PAGE_PATH}/${code}`, options.appBaseUrl).toString(),
      }),
    });
  }

  return {
    registerRoutes(app, sequelize, _models, emailService) {
      const requireUser = createVerifyToken(jwtSecret);
      const invitationGuards: RequestHandler[] = [requireUser];
      if (options.rateLimit !== 'off') {
        invitationGuards.push(
          createRateLimiter({
            ...options.rateLimit,
            keyOf: (req) => `friend-invitations:${req.user?.id}`,
          })
        );
      }

      app.get(
        FRIENDS_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          res.json(await describeFriends(await friendships.friendsOf(readerOf(req))));
        })
      );

      app.get(
        FRIEND_REQUESTS_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          res.json(await listRequests(readerOf(req)));
        })
      );

      app.post(
        FRIEND_INVITATIONS_PATH,
        ...invitationGuards,
        asyncHandler(async (req, res) => {
          const email = readInvitedEmail(req.body);
          const inviter = await users().findByPk(readerOf(req));
          if (!inviter) throw new HttpError(NOT_FOUND, 'reader not found');
          const invited = await users().findOne({
            where: sequelize.where(
              sequelize.fn('lower', sequelize.col('email')),
              email.toLowerCase()
            ),
          });
          try {
            if (!invited) await inviteNewcomer(inviter, email, emailService);
            else if (invited.get('id') !== inviter.get('id')) {
              await askReader(inviter, invited, emailService);
            }
          } catch (err) {
            // The answer never depends on the address: a failed e-mail is only logged.
            console.warn(`A friend invitation failed: ${String(err)}`);
          }
          res.status(ACCEPTED).send();
        })
      );

      app.post(
        `${FRIEND_REQUESTS_PATH}/:id/accept`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = readerOf(req);
          const request = await pendingRequestTo(readerId, String(req.params.id));
          if (!request || request.get('addresseeId') !== readerId) {
            throw new HttpError(NOT_FOUND, 'friend request not found');
          }
          const [friend] = await describeFriends([
            await acceptFriendship(request, readerId, notify),
          ]);
          res.json(friend);
        })
      );

      app.delete(
        `${FRIEND_REQUESTS_PATH}/:id`,
        requireUser,
        asyncHandler(async (req, res) => {
          const request = await pendingRequestTo(readerOf(req), String(req.params.id));
          if (!request) throw new HttpError(NOT_FOUND, 'friend request not found');
          await request.destroy();
          res.status(NO_CONTENT).send();
        })
      );

      app.get(
        `${FRIENDS_PATH}/:userId`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = readerOf(req);
          const friendId = String(req.params.userId);
          const link = (await friendships.friendsOf(readerId)).find(
            (friend) => friend.friendId === friendId
          );
          if (!link) throw new HttpError(NOT_FOUND, 'friend not found');
          const [friend] = await describeFriends([link]);
          res.json(friend);
        })
      );

      const friendContact = createFriendContact(registry, sequelize);

      app.post(
        `${FRIENDS_PATH}/:userId/contact`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = readerOf(req);
          const friendId = String(req.params.userId);
          if (!(await friendships.areFriends(readerId, friendId))) {
            throw new HttpError(NOT_FOUND, 'friend not found');
          }
          const contact = await sequelize.transaction((transaction) =>
            friendContact(readerId, friendId, transaction)
          );
          const result: FriendContact = {
            id: String(contact.get('id')),
            name: String(contact.get('name')),
          };
          res.json(result);
        })
      );

      app.delete(
        `${FRIENDS_PATH}/:userId`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = readerOf(req);
          const friendId = String(req.params.userId);
          if (!(await friendships.areFriends(readerId, friendId))) {
            throw new HttpError(NOT_FOUND, 'friend not found');
          }
          await (await friendships.between(readerId, friendId))?.destroy();
          // Requests to borrow between them lapse with the friendship; loans already made stay.
          await registry.get(loanRequestEntity.config.name).destroy({
            where: {
              status: DEFAULT_LOAN_REQUEST_STATUS,
              [Op.or]: [
                { requesterId: readerId, lenderId: friendId },
                { requesterId: friendId, lenderId: readerId },
              ],
            },
          });
          // So do waiting recommendations; a book already taken into a library stays there.
          await registry.get(recommendationEntity.config.name).destroy({
            where: {
              status: DEFAULT_RECOMMENDATION_STATUS,
              [Op.or]: [
                { senderId: readerId, recipientId: friendId },
                { senderId: friendId, recipientId: readerId },
              ],
            },
          });
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
