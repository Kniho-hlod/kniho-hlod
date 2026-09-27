import {
  createRateLimiter,
  createVerifyToken,
  generateId,
  HttpError,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { ProjectPlugin, RateLimitConfig } from '@eleansphere/be-core';
import {
  bookEntity,
  BOOKS_PATH,
  commentBodyFields,
  commentEntity,
  COMMENTS_PATH,
  DEFAULT_BOOK_VISIBILITY,
} from '@kniho-hlod/domain';
import type { CommentItem } from '@kniho-hlod/domain';
import type { Request, RequestHandler } from 'express';
import type { Friendships } from '../friends/friendships';
import type { People } from '../friends/people';
import { asyncHandler } from '../http/async-handler';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';

type Row = InstanceType<ModelClass>;

const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/** Per reader: a lively discussion fits, a flood doesn't. */
export const COMMENT_RATE_LIMIT: RateLimitConfig = { windowMs: RATE_LIMIT_WINDOW_MS, max: 60 };

export interface CommentsPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  notify: Notify;
  rateLimit: RateLimitConfig | 'off';
}

/** The comment's text from the body, trimmed, or a 400 with the issues the form shows too. */
function readText(req: Request): string {
  const sent = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
    string,
    unknown
  >;
  const text = typeof sent.text === 'string' ? sent.text.trim() : sent.text;
  const issues = validateFields(commentBodyFields, { text }, { mode: 'create' });
  if (issues.length > 0) throw new ValidationError(issues);
  return String(text);
}

/**
 * Comments under books: `GET` and `POST /api/books/:id/comments`, `PATCH` and
 * `DELETE /api/comments/:id`. A book's comments are for its owner and the owner's friends who see
 * the book (shared library, not hidden, not a sample) — anyone else gets 404. The author edits and
 * deletes a comment; the book's owner may delete any under their book. A comment by someone else
 * rings the owner's bell.
 */
export function createCommentsPlugin({
  jwtSecret,
  registry,
  people,
  friendships,
  notify,
  rateLimit,
}: CommentsPluginOptions): ProjectPlugin {
  const books = () => registry.get(bookEntity.config.name);
  const comments = () => registry.get(commentEntity.config.name);

  /** The book, when the reader may see it and its comments; otherwise a 404. */
  async function readableBook(bookId: string, readerId: string): Promise<Row> {
    const book = await books().findByPk(bookId, {
      attributes: ['id', 'ownerId', 'visibility', 'isSample'],
    });
    if (!book) throw new HttpError(NOT_FOUND, 'book not found');
    const ownerId = String(book.get('ownerId'));
    if (ownerId === readerId) return book;
    const isShown = book.get('visibility') === DEFAULT_BOOK_VISIBILITY && !book.get('isSample');
    if (!isShown || !(await friendships.sharesLibraryWith(ownerId, readerId))) {
      throw new HttpError(NOT_FOUND, 'book not found');
    }
    return book;
  }

  async function toItems(rows: Row[], readerId: string, bookOwnerId: string) {
    const authors = await people.summaries(rows.map((row) => String(row.get('authorId'))));
    return rows.flatMap((row): CommentItem[] => {
      const authorId = String(row.get('authorId'));
      const author = authors.get(authorId);
      if (!author) return [];
      const isAuthor = authorId === readerId;
      return [
        {
          id: String(row.get('id')),
          author,
          text: String(row.get('text')),
          createdAt: (row.get('createdAt') as Date).toISOString(),
          editedAt: (row.get('editedAt') as Date | null)?.toISOString() ?? null,
          canEdit: isAuthor,
          canDelete: isAuthor || bookOwnerId === readerId,
        },
      ];
    });
  }

  /** A comment on a book the reader still sees. */
  async function visibleComment(commentId: string, readerId: string) {
    const comment = await comments().findByPk(commentId);
    if (!comment) throw new HttpError(NOT_FOUND, 'comment not found');
    const book = await readableBook(String(comment.get('bookId')), readerId);
    return { comment, bookOwnerId: String(book.get('ownerId')) };
  }

  return {
    registerRoutes(app) {
      const requireUser = createVerifyToken(jwtSecret);
      const writeGuards: RequestHandler[] = [requireUser];
      if (rateLimit !== 'off') {
        writeGuards.push(
          createRateLimiter({ ...rateLimit, keyOf: (req) => `comments:${req.user?.id}` })
        );
      }

      app.get(
        `${BOOKS_PATH}/:bookId/comments`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const book = await readableBook(String(req.params.bookId), readerId);
          const rows = await comments().findAll({
            where: { bookId: book.get('id') },
            order: [['createdAt', 'ASC']],
          });
          res.json(await toItems(rows, readerId, String(book.get('ownerId'))));
        })
      );

      app.post(
        `${BOOKS_PATH}/:bookId/comments`,
        ...writeGuards,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const book = await readableBook(String(req.params.bookId), readerId);
          const text = readText(req);
          const bookId = String(book.get('id'));
          const ownerId = String(book.get('ownerId'));
          const comment = await comments().create({
            id: generateId(commentEntity.config.prefix),
            bookId,
            authorId: readerId,
            text,
          });
          if (ownerId !== readerId) {
            await notify({ recipientId: ownerId, actorId: readerId, kind: 'comment', bookId });
          }
          const [item] = await toItems([comment], readerId, ownerId);
          res.status(CREATED).json(item);
        })
      );

      app.patch(
        `${COMMENTS_PATH}/:id`,
        ...writeGuards,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const { comment, bookOwnerId } = await visibleComment(String(req.params.id), readerId);
          if (comment.get('authorId') !== readerId) {
            throw new HttpError(NOT_FOUND, 'comment not found');
          }
          await comment.update({ text: readText(req), editedAt: new Date() });
          const [item] = await toItems([comment], readerId, bookOwnerId);
          res.json(item);
        })
      );

      app.delete(
        `${COMMENTS_PATH}/:id`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const { comment, bookOwnerId } = await visibleComment(String(req.params.id), readerId);
          if (comment.get('authorId') !== readerId && bookOwnerId !== readerId) {
            throw new HttpError(NOT_FOUND, 'comment not found');
          }
          await comment.destroy();
          res.status(NO_CONTENT).send();
        })
      );
    },
  };
}
