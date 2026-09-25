import { HttpError, Op } from '@eleansphere/be-core';
import type { ModelRouteOverrides } from '@eleansphere/be-core';
import { loanEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type BeforeDelete = NonNullable<ModelRouteOverrides['beforeDelete']>;
type LoanColumn = 'bookId' | 'contactId';

const CONFLICT = 409;

export interface LoanHistory {
  /** `routes.book.beforeDelete`: a lent book can't go; a returned one takes its loans along. */
  clearForBook: BeforeDelete;
  /** `routes.contact.beforeDelete`: the same for a contact who has, or had, borrowed books. */
  clearForContact: BeforeDelete;
}

/**
 * Loans reference their book and contact with `RESTRICT`, so both would be undeletable after a
 * single loan. Deleting one first removes its returned loans — history about something that is
 * going away — and refuses (409) while a loan is still out.
 */
export function createLoanHistory(registry: ModelRegistry): LoanHistory {
  function clearFor(column: LoanColumn, stillLentMessage: string): BeforeDelete {
    return async (row) => {
      const loans = registry.get(loanEntity.config.name);
      const where = { [column]: row.get('id') };
      if ((await loans.count({ where: { ...where, returnedAt: null } })) > 0) {
        throw new HttpError(CONFLICT, stillLentMessage);
      }
      await loans.destroy({ where: { ...where, returnedAt: { [Op.not]: null } } });
    };
  }

  return {
    clearForBook: clearFor('bookId', 'The book is lent out: mark it returned first'),
    clearForContact: clearFor('contactId', 'The contact still has borrowed books'),
  };
}
