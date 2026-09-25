import { addDays } from '@eleansphere/schema';
import { DEFAULT_LOAN_DAYS } from '@kniho-hlod/domain';
import type { LoanWithDetails } from '@kniho-hlod/domain';

/** The loan fields the form validates with the API's own rules. */
export const LOAN_FORM_FIELDS = ['lentAt', 'dueAt', 'returnedAt', 'note'] as const;

/** Who gets the book: a contact the reader has, or a name for a new one. */
export type ContactChoice =
  { kind: 'existing'; id: string; name: string } | { kind: 'new'; name: string };

export interface LoanFormState {
  bookId: string | null;
  contact: ContactChoice | null;
  lentAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  note: string | null;
}

/** A new loan: lent today, due back {@link DEFAULT_LOAN_DAYS} later. */
export function newLoanForm(today: string, bookId: string | null): LoanFormState {
  return {
    bookId,
    contact: null,
    lentAt: today,
    dueAt: addDays(today, DEFAULT_LOAN_DAYS),
    returnedAt: null,
    note: null,
  };
}

export function loanFormFrom(loan: LoanWithDetails): LoanFormState {
  return {
    bookId: loan.bookId,
    contact: { kind: 'existing', id: loan.contact.id, name: loan.contact.name },
    lentAt: loan.lentAt,
    dueAt: loan.dueAt ?? null,
    returnedAt: loan.returnedAt ?? null,
    note: loan.note ?? null,
  };
}

function emptyAsNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The form as the API wants it, with the contact already resolved to an id. */
export function toLoanPayload(form: LoanFormState, contactId: string) {
  if (!form.bookId) throw new Error('A loan needs a book');
  return {
    bookId: form.bookId,
    contactId,
    lentAt: form.lentAt,
    dueAt: emptyAsNull(form.dueAt),
    returnedAt: emptyAsNull(form.returnedAt),
    note: emptyAsNull(form.note),
  };
}
