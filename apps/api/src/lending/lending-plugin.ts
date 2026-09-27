import {
  createVerifyToken,
  generateId,
  HttpError,
  Op,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { EmailMessage, EmailService, ProjectPlugin } from '@eleansphere/be-core';
import {
  bookEntity,
  BORROWED_PATH,
  contactEntity,
  DEFAULT_LOAN_REQUEST_STATUS,
  DEFAULT_LOCALE,
  findLoanDatesIssues,
  FRIENDS_PAGE_PATH,
  FRIENDS_PATH,
  LOAN_REQUESTS_PATH,
  loanEntity,
  loanRequestBodyFields,
  loanRequestEntity,
  LOANS_PAGE_PATH,
  LOCALES,
  userEntity,
} from '@kniho-hlod/domain';
import type {
  BorrowedLoan,
  Locale,
  LoanRequestItem,
  LoanRequests,
  LoanRequestStatus,
} from '@kniho-hlod/domain';
import type { Request } from 'express';
import { loanRequestEmail } from '../emails/loan-request';
import { loanRequestAnswerEmail } from '../emails/loan-request-answer';
import type { LoanRequestAnswer } from '../emails/loan-request-answer';
import type { FriendLibrary } from '../friends/friend-library';
import type { Friendships } from '../friends/friendships';
import type { People } from '../friends/people';
import { asyncHandler } from '../http/async-handler';
import type { ReaderToday } from '../loans/reader-today';
import type { ModelClass, ModelRegistry } from '../models-registry';
import type { Notify } from '../notifications/notifications-plugin';
import type { BookSummaries } from './book-summaries';
import { createLendToFriend } from './lend-to-friend';

type Row = InstanceType<ModelClass>;

const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const CONFLICT = 409;
const DECLINED: LoanRequestStatus = 'declined';
const CANCELLED: LoanRequestStatus = 'cancelled';
const DUE_AT_FIELD = 'dueAt';
const BORROWED_TAB_QUERY = '?tab=borrowed';
/** Sorts a borrowed book without a due date after every dated one. */
const NO_DUE_DATE = '9999-12-31';

export interface LendingPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  people: People;
  friendships: Friendships;
  friendLibrary: FriendLibrary;
  bookSummaries: BookSummaries;
  readerToday: ReaderToday;
  notify: Notify;
  appBaseUrl: string;
}

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

function bodyOf(req: Request): Record<string, unknown> {
  return (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
    string,
    unknown
  >;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Lending between friends. `POST /api/friends/:userId/books/:bookId/requests` asks for a shared
 * book at home; `GET /api/loan-requests` lists the reader's waiting requests, both ways;
 * `POST /api/loan-requests/:id/accept` lends the book (see `createLendToFriend`), `…/decline`
 * and `…/cancel` answer or take one back. `GET /api/borrowed` is what the reader has borrowed.
 * The other side hears through the bell and, if they want, by e-mail.
 */
export function createLendingPlugin(options: LendingPluginOptions): ProjectPlugin {
  const { jwtSecret, registry, people, friendships, friendLibrary, bookSummaries, notify } =
    options;
  const requests = () => registry.get(loanRequestEntity.config.name);
  const users = () => registry.get(userEntity.config.name);
  const loansUrl = new URL(LOANS_PAGE_PATH, options.appBaseUrl).toString();

  const friendBookUrl = (ownerId: string, bookId: string) =>
    new URL(`${FRIENDS_PAGE_PATH}/${ownerId}/books/${bookId}`, options.appBaseUrl).toString();

  async function describe(rows: Row[], readerId: string): Promise<LoanRequestItem[]> {
    const otherOf = (request: Row) =>
      String(
        request.get('requesterId') === readerId
          ? request.get('lenderId')
          : request.get('requesterId')
      );
    const [persons, books] = await Promise.all([
      people.summaries(rows.map(otherOf)),
      bookSummaries(rows.map((request) => String(request.get('bookId')))),
    ]);
    return rows.flatMap((request) => {
      const person = persons.get(otherOf(request));
      const book = books.get(String(request.get('bookId')));
      if (!person || !book) return [];
      return [
        {
          id: String(request.get('id')),
          book,
          person,
          message: (request.get('message') as string | null) ?? null,
          dueAt: (request.get('dueAt') as string | null) ?? null,
          sentAt: (request.get('createdAt') as Date).toISOString(),
        },
      ];
    });
  }

  /** E-mails a reader who wants e-mails about requests; a failed e-mail is only logged. */
  async function emailIfWanted(
    emailService: EmailService | undefined,
    userId: string,
    compose: (locale: Locale) => Omit<EmailMessage, 'to'>
  ): Promise<void> {
    if (!emailService) return;
    const user = await users().findByPk(userId, {
      attributes: ['email', 'locale', 'emailNotifications'],
    });
    if (!user || user.get('emailNotifications') !== true) return;
    try {
      await emailService.send({
        to: String(user.get('email')),
        ...compose(toLocale(user.get('locale'))),
      });
    } catch (err) {
      console.warn(`A lending e-mail failed: ${String(err)}`);
    }
  }

  async function nameOf(userId: string): Promise<string> {
    return (await people.summary(userId))?.displayName ?? '';
  }

  async function tellAnswer(
    emailService: EmailService | undefined,
    request: Row,
    answer: LoanRequestAnswer
  ): Promise<void> {
    const requesterId = String(request.get('requesterId'));
    const lenderId = String(request.get('lenderId'));
    const bookId = String(request.get('bookId'));
    const kind = answer.kind === 'accepted' ? 'loanRequestAccepted' : 'loanRequestDeclined';
    await notify({ recipientId: requesterId, actorId: lenderId, kind, bookId });
    const [ownerName, books] = await Promise.all([nameOf(lenderId), bookSummaries([bookId])]);
    const title = books.get(bookId)?.title ?? '';
    await emailIfWanted(emailService, requesterId, (locale) =>
      loanRequestAnswerEmail({
        locale,
        ownerName,
        title,
        answer,
        linkUrl:
          answer.kind === 'accepted'
            ? `${loansUrl}${BORROWED_TAB_QUERY}`
            : friendBookUrl(lenderId, bookId),
      })
    );
  }

  /** A waiting request the reader may answer (as the owner) or take back (as the friend). */
  async function waitingRequest(
    requestId: string,
    readerId: string,
    side: 'lenderId' | 'requesterId'
  ): Promise<Row> {
    const request = await requests().findByPk(requestId);
    if (
      !request ||
      request.get(side) !== readerId ||
      request.get('status') !== DEFAULT_LOAN_REQUEST_STATUS
    ) {
      throw new HttpError(NOT_FOUND, 'loan request not found');
    }
    return request;
  }

  return {
    registerRoutes(app, sequelize, _models, emailService) {
      const requireUser = createVerifyToken(jwtSecret);
      const lendToFriend = createLendToFriend(registry, sequelize, options.readerToday);

      app.post(
        `${FRIENDS_PATH}/:userId/books/:bookId/requests`,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const lenderId = String(req.params.userId);
          if (!(await friendships.sharesLibraryWith(lenderId, readerId))) {
            throw new HttpError(NOT_FOUND, 'library not found');
          }
          const book = await registry.get(bookEntity.config.name).findOne({
            where: { ...friendLibrary.sharedBooks(lenderId), id: String(req.params.bookId) },
            attributes: ['id', 'title'],
          });
          if (!book) throw new HttpError(NOT_FOUND, 'book not found');
          const bookId = String(book.get('id'));

          const body = bodyOf(req);
          const issues = validateFields(loanRequestBodyFields, body, { mode: 'patch' });
          const dueAt = (body.dueAt as string | null | undefined) ?? null;
          const today = await options.readerToday(readerId);
          const dateIssues = dueAt ? findLoanDatesIssues({ lentAt: today, dueAt }) : [];
          if (issues.length + dateIssues.length > 0) {
            throw new ValidationError([...issues, ...dateIssues]);
          }
          const isOut = await registry
            .get(loanEntity.config.name)
            .count({ where: { bookId, returnedAt: null } });
          if (isOut > 0) throw new HttpError(CONFLICT, 'the book is lent out');

          const message = nullableText(body.message);
          const request = await requests().create({
            id: generateId(loanRequestEntity.config.prefix),
            bookId,
            requesterId: readerId,
            lenderId,
            message,
            dueAt,
          });
          await notify({ recipientId: lenderId, actorId: readerId, kind: 'loanRequest', bookId });
          const requesterName = await nameOf(readerId);
          await emailIfWanted(emailService, lenderId, (locale) =>
            loanRequestEmail({
              locale,
              requesterName,
              title: String(book.get('title')),
              message,
              dueAt,
              loansUrl,
            })
          );
          const [item] = await describe([request], readerId);
          res.status(CREATED).json(item);
        })
      );

      app.get(
        LOAN_REQUESTS_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const waiting = await requests().findAll({
            where: {
              status: DEFAULT_LOAN_REQUEST_STATUS,
              [Op.or]: [{ lenderId: readerId }, { requesterId: readerId }],
            },
            order: [['createdAt', 'DESC']],
          });
          const incoming = waiting.filter((request) => request.get('lenderId') === readerId);
          const outgoing = waiting.filter((request) => request.get('requesterId') === readerId);
          const answer: LoanRequests = {
            incoming: await describe(incoming, readerId),
            outgoing: await describe(outgoing, readerId),
          };
          res.json(answer);
        })
      );

      app.post(
        `${LOAN_REQUESTS_PATH}/:id/accept`,
        requireUser,
        asyncHandler(async (req, res) => {
          const body = bodyOf(req);
          const issues = validateFields({ dueAt: loanRequestBodyFields.dueAt }, body, {
            mode: 'patch',
          });
          if (issues.length > 0) throw new ValidationError(issues);
          const dueAt = DUE_AT_FIELD in body ? ((body.dueAt as string | null) ?? null) : undefined;

          const lent = await lendToFriend(String(req.params.id), String(req.user?.id), dueAt);
          await tellAnswer(emailService, lent.request, { kind: 'accepted', dueAt: lent.loanDueAt });
          for (const declined of lent.declined) {
            await tellAnswer(emailService, declined, { kind: 'declined' });
          }
          res.status(NO_CONTENT).send();
        })
      );

      app.post(
        `${LOAN_REQUESTS_PATH}/:id/decline`,
        requireUser,
        asyncHandler(async (req, res) => {
          const request = await waitingRequest(
            String(req.params.id),
            String(req.user?.id),
            'lenderId'
          );
          await request.update({ status: DECLINED, answeredAt: new Date() });
          await tellAnswer(emailService, request, { kind: 'declined' });
          res.status(NO_CONTENT).send();
        })
      );

      app.post(
        `${LOAN_REQUESTS_PATH}/:id/cancel`,
        requireUser,
        asyncHandler(async (req, res) => {
          const request = await waitingRequest(
            String(req.params.id),
            String(req.user?.id),
            'requesterId'
          );
          await request.update({ status: CANCELLED, answeredAt: new Date() });
          res.status(NO_CONTENT).send();
        })
      );

      app.get(
        BORROWED_PATH,
        requireUser,
        asyncHandler(async (req, res) => {
          const readerId = String(req.user?.id);
          const linked = await registry
            .get(contactEntity.config.name)
            .findAll({ where: { linkedUserId: readerId }, attributes: ['id'] });
          const out =
            linked.length === 0
              ? []
              : await registry.get(loanEntity.config.name).findAll({
                  where: {
                    contactId: linked.map((contact) => String(contact.get('id'))),
                    returnedAt: null,
                  },
                });
          const [books, lenders] = await Promise.all([
            bookSummaries(out.map((loan) => String(loan.get('bookId')))),
            people.summaries(out.map((loan) => String(loan.get('ownerId')))),
          ]);
          const borrowed: BorrowedLoan[] = out.flatMap((loan) => {
            const book = books.get(String(loan.get('bookId')));
            const lender = lenders.get(String(loan.get('ownerId')));
            if (!book || !lender) return [];
            return [
              {
                id: String(loan.get('id')),
                book,
                lender,
                lentAt: String(loan.get('lentAt')),
                dueAt: (loan.get('dueAt') as string | null) ?? null,
              },
            ];
          });
          borrowed.sort((left, right) =>
            (left.dueAt ?? NO_DUE_DATE).localeCompare(right.dueAt ?? NO_DUE_DATE)
          );
          res.json(borrowed);
        })
      );
    },
  };
}
