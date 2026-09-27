import { addDays } from '@eleansphere/schema';
import { generateId, HttpError, Op, ValidationError } from '@eleansphere/be-core';
import type { Sequelize } from '@eleansphere/be-core';
import {
  contactEntity,
  DEFAULT_LOAN_DAYS,
  DEFAULT_LOAN_REQUEST_STATUS,
  findLoanDatesIssues,
  loanEntity,
  loanRequestEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { LoanRequestStatus } from '@kniho-hlod/domain';
import type { Transaction } from '../friends/friendships';
import type { ReaderToday } from '../loans/reader-today';
import type { ModelClass, ModelRegistry } from '../models-registry';

type Row = InstanceType<ModelClass>;

const NOT_FOUND = 404;
const CONFLICT = 409;
const ACCEPTED: LoanRequestStatus = 'accepted';
const DECLINED: LoanRequestStatus = 'declined';

/** What lending a book to a friend did: the loan, and the other requests it answered. */
export interface Lent {
  request: Row;
  loanDueAt: string | null;
  /** Other friends' requests for the same book, declined now that it is out. */
  declined: Row[];
}

/**
 * Accepting a request lends the book, in one transaction: the owner's contact for the friend
 * (made or linked if need be), a loan from today, the request answered, and the other waiting
 * requests for the book declined. A book out already is a 409 — the loans' unique index settles
 * a race.
 */
export function createLendToFriend(
  registry: ModelRegistry,
  sequelize: Sequelize,
  readerToday: ReaderToday
) {
  const model = (name: string) => registry.get(name);

  /** The owner's contact for the friend: linked already, found by e-mail, or new. */
  async function contactFor(ownerId: string, friendId: string, transaction: Transaction) {
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
  }

  return async function lendToFriend(
    requestId: string,
    ownerId: string,
    dueAtChosen: string | null | undefined
  ): Promise<Lent> {
    const today = await readerToday(ownerId);
    return sequelize.transaction(async (transaction) => {
      const requests = model(loanRequestEntity.config.name);
      const request = await requests.findByPk(requestId, { transaction, lock: true });
      if (
        !request ||
        request.get('lenderId') !== ownerId ||
        request.get('status') !== DEFAULT_LOAN_REQUEST_STATUS
      ) {
        throw new HttpError(NOT_FOUND, 'loan request not found');
      }
      const bookId = String(request.get('bookId'));
      const loans = model(loanEntity.config.name);
      const isOut = await loans.count({ where: { bookId, returnedAt: null }, transaction });
      if (isOut > 0) throw new HttpError(CONFLICT, 'the book is lent out');

      const dueAt =
        dueAtChosen === undefined
          ? ((request.get('dueAt') as string | null) ?? addDays(today, DEFAULT_LOAN_DAYS))
          : dueAtChosen;
      const issues = findLoanDatesIssues({ lentAt: today, dueAt });
      if (issues.length > 0) throw new ValidationError(issues);

      const contact = await contactFor(ownerId, String(request.get('requesterId')), transaction);
      const loan = await loans.create(
        {
          id: generateId(loanEntity.config.prefix),
          ownerId,
          bookId,
          contactId: contact.get('id'),
          lentAt: today,
          dueAt,
        },
        { transaction }
      );
      const answeredAt = new Date();
      await request.update(
        { status: ACCEPTED, answeredAt, loanId: loan.get('id') },
        { transaction }
      );
      const others = await requests.findAll({
        where: { bookId, status: DEFAULT_LOAN_REQUEST_STATUS, id: { [Op.ne]: requestId } },
        transaction,
      });
      for (const other of others) {
        await other.update({ status: DECLINED, answeredAt }, { transaction });
      }
      return { request, loanDueAt: dueAt, declined: others };
    });
  };
}

export type LendToFriend = ReturnType<typeof createLendToFriend>;
