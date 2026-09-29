import {
  createRateLimiter,
  createVerifyToken,
  generateId,
  HttpError,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { ModelRouteOverrides, ProjectPlugin, RateLimitConfig } from '@eleansphere/be-core';
import {
  bookEntity,
  DEFAULT_RECOMMENDATION_STATUS,
  RECOMMENDATIONS_PATH,
  recommendationBodyFields,
  recommendationEntity,
} from '@kniho-hlod/domain';
import type { RecommendationItem, RecommendationStatus } from '@kniho-hlod/domain';
import type { Request, RequestHandler } from 'express';
import type { CopyBook } from '../books/copy-book';
import type { Friendships } from '../friends/friendships';
import type { People } from '../friends/people';
import { asyncHandler } from '../http/async-handler';
import type { BookSummaries } from '../lending/book-summaries';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';

type Row = InstanceType<ModelClass>;

const NO_CONTENT = 204;
const NOT_FOUND = 404;
const ACCEPTED: RecommendationStatus = 'accepted';
const DISMISSED: RecommendationStatus = 'dismissed';
const RECIPIENTS_FIELD = 'recipientIds';
/** More than a reader has friends to tell at once; keeps one request's work bounded. */
const MAX_RECIPIENTS = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/** Per reader: enough to tell every friend about a few books, not to flood them. */
export const RECOMMENDATION_RATE_LIMIT: RateLimitConfig = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 30,
};

export interface RecommendationsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  bookSummaries: BookSummaries;
  copyBook: CopyBook;
  /** `routes.book.enrich`: an accepted book answers like any other of the reader's books. */
  bookDetails: NonNullable<ModelRouteOverrides['enrich']>;
  notify: Notify;
  rateLimit: RateLimitConfig | 'off';
}

function bodyOf(req: Request): Record<string, unknown> {
  return (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
    string,
    unknown
  >;
}

/** The recipients' ids from the body: at least one, all strings, each once. */
function readRecipients(body: Record<string, unknown>): string[] {
  const ids = body[RECIPIENTS_FIELD];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw new ValidationError([{ path: RECIPIENTS_FIELD, code: 'type' }]);
  }
  const unique = [...new Set(ids as string[])];
  if (unique.length === 0)
    throw new ValidationError([{ path: RECIPIENTS_FIELD, code: 'required' }]);
  if (unique.length > MAX_RECIPIENTS) {
    throw new ValidationError([{ path: RECIPIENTS_FIELD, code: 'maxLength' }]);
  }
  return unique;
}

/**
 * Recommending books to friends. `POST /api/recommendations` sends one of the reader's own books
 * to some of their friends, with a message; each hears through the bell. `GET` lists the
 * recommendations waiting for the reader; `POST …/:id/accept` puts the book in their library (or
 * finds the copy they have) and `…/dismiss` sets it aside. Ending a friendship drops the waiting
 * ones between the two.
 */
export function createRecommendationsPlugin({
  jwtSecret,
  registry,
  people,
  friendships,
  bookSummaries,
  copyBook,
  bookDetails,
  notify,
  rateLimit,
}: RecommendationsPluginOptions): ProjectPlugin {
  const recommendations = () => registry.get(recommendationEntity.config.name);
  const books = () => registry.get(bookEntity.config.name);

  async function describe(rows: Row[]): Promise<RecommendationItem[]> {
    const [senders, summaries] = await Promise.all([
      people.summaries(rows.map((row) => String(row.get('senderId')))),
      bookSummaries(rows.map((row) => String(row.get('bookId')))),
    ]);
    return rows.flatMap((row) => {
      const sender = senders.get(String(row.get('senderId')));
      const book = summaries.get(String(row.get('bookId')));
      if (!sender || !book) return [];
      return [
        {
          id: String(row.get('id')),
          sender,
          book,
          message: (row.get('message') as string | null) ?? null,
          sentAt: (row.get('createdAt') as Date).toISOString(),
        },
      ];
    });
  }

  /** A recommendation waiting for the reader, or a 404. */
  async function waitingFor(id: string, readerId: string): Promise<Row> {
    const recommendation = await recommendations().findByPk(id);
    if (
      !recommendation ||
      recommendation.get('recipientId') !== readerId ||
      recommendation.get('status') !== DEFAULT_RECOMMENDATION_STATUS
    ) {
      throw new HttpError(NOT_FOUND, 'recommendation not found');
    }
    return recommendation;
  }

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);
      const sendGuards: RequestHandler[] = [requireUser];
      if (rateLimit !== 'off') {
        sendGuards.push(
          createRateLimiter({ ...rateLimit, keyOf: (req) => `recommendations:${req.user?.id}` })
        );
      }

      app.post(
        RECOMMENDATIONS_PATH,
        ...sendGuards,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const body = bodyOf(req);
          const issues = validateFields(recommendationBodyFields, body, { mode: 'patch' });
          if (issues.length > 0) throw new ValidationError(issues);
          const recipientIds = readRecipients(body);
          const book = await books().findOne({
            where: { id: String(body.bookId ?? ''), ownerId: readerId, isSample: false },
            attributes: ['id'],
          });
          if (!book) throw new HttpError(NOT_FOUND, 'book not found');
          const bookId = String(book.get('id'));
          const areFriends = await Promise.all(
            recipientIds.map((recipientId) => friendships.areFriends(readerId, recipientId))
          );
          if (areFriends.some((isFriend) => !isFriend)) {
            throw new ValidationError([{ path: RECIPIENTS_FIELD, code: 'reference' }]);
          }
          // A friend with this book waiting from the reader already isn't told twice.
          const waiting = await recommendations().findAll({
            where: { bookId, recipientId: recipientIds, status: DEFAULT_RECOMMENDATION_STATUS },
            attributes: ['recipientId'],
          });
          const told = new Set(waiting.map((row) => String(row.get('recipientId'))));
          const message =
            typeof body.message === 'string' && body.message.trim() !== ''
              ? body.message.trim()
              : null;
          for (const recipientId of recipientIds.filter((id) => !told.has(id))) {
            await recommendations().create({
              id: generateId(recommendationEntity.config.prefix),
              bookId,
              senderId: readerId,
              recipientId,
              message,
            });
            await notify({ recipientId, actorId: readerId, kind: 'recommendation', bookId });
          }
          res.status(NO_CONTENT).send();
        })
      );

      app.get(
        RECOMMENDATIONS_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const waiting = await recommendations().findAll({
            where: { recipientId: String(req.user?.id), status: DEFAULT_RECOMMENDATION_STATUS },
            order: [['createdAt', 'DESC']],
          });
          res.json(await describe(waiting));
        })
      );

      app.post(
        `${RECOMMENDATIONS_PATH}/:id/accept`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const recommendation = await waitingFor(String(req.params.id), readerId);
          const source = await books().findByPk(String(recommendation.get('bookId')));
          if (!source) throw new HttpError(NOT_FOUND, 'book not found');
          const { book } = await copyBook(source, readerId);
          await recommendation.update({
            status: ACCEPTED,
            bookCopyId: book.get('id'),
            answeredAt: new Date(),
          });
          const [copy] = await bookDetails([book]);
          res.json(copy);
        })
      );

      app.post(
        `${RECOMMENDATIONS_PATH}/:id/dismiss`,
        requireUser,
        asyncHandler(async (req, res) => {
          const recommendation = await waitingFor(String(req.params.id), String(req.user?.id));
          await recommendation.update({ status: DISMISSED, answeredAt: new Date() });
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
