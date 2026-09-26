import { defineEntity } from '@eleansphere/entity-core';
import type { FileDto } from '@eleansphere/entity-core';
import { loanFields } from './fields';

export { findLoanDatesIssues } from './loan-dates';
export { loanStatus } from './loan-status';
export {
  loanReminderDue,
  OVERDUE_REMINDER_INTERVAL_DAYS,
  type LoanReminderKind,
} from './loan-reminder';

/** Where loans live; the API also serves `POST {LOANS_PATH}/:id/return` there. */
export const LOANS_PATH = '/api/loans';

/** `POST /api/loans/:id/return`. Without `returnedAt` the book comes back today. */
export interface ReturnLoanRequest {
  returnedAt?: string;
}

/**
 * Books lent out. Each belongs to the lending reader; the partial unique index lets a book be out
 * on one loan at a time, even when two requests race.
 */
export const loanEntity = defineEntity({
  name: 'loan',
  prefix: 'ln_',
  basePath: LOANS_PATH,
  access: { read: 'owner', write: 'owner' },
  fields: loanFields,
  indexes: [{ fields: ['bookId'], unique: true, where: { returnedAt: null } }],
  query: {
    filter: { bookId: 'eq', contactId: 'eq', returnedAt: 'isNull', dueAt: 'range' },
    sort: ['lentAt', 'dueAt', 'returnedAt', 'createdAt'],
    defaultSort: '-lentAt',
  },
  extend: (Base) =>
    class extends Base {
      /** Marks the book as back — today in the reader's time zone unless the request says when. */
      markReturned(id: string, request: ReturnLoanRequest = {}) {
        return this.post<LoanWithDetails>(
          `${this.basePath}/${encodeURIComponent(id)}/return`,
          request
        );
      }
    },
});

export type Loan = InstanceType<typeof loanEntity.Dto>;

/** The lent book, as the API attaches it to a loan. */
export interface LoanBook {
  id: string;
  title: string;
  author: string | null;
  cover: FileDto | null;
}

/** Who has the book, as the API attaches it to a loan. */
export interface LoanContact {
  id: string;
  name: string;
}

/** A loan as the API returns it: with its book and contact. */
export type LoanWithDetails = Loan & { book: LoanBook; contact: LoanContact };

/** The loan a book is out on, as the API attaches it to the book. */
export interface ActiveLoan {
  id: string;
  lentAt: string;
  dueAt: string | null;
  contact: LoanContact;
}
