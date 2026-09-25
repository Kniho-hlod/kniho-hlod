import { Op } from '@eleansphere/be-core';
import type { CustomFilterResolver, ModelRouteOverrides } from '@eleansphere/be-core';
import { contactEntity, loanEntity } from '@kniho-hlod/domain';
import type { ActiveLoan } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type Row = Record<string, unknown>;

export interface ActiveLoans {
  /** Adds `activeLoan` to each book (already plain objects: another enrich step ran first). */
  attachToBooks: (books: Row[]) => Promise<Row[]>;
  /** `routes.contact.enrich`: each contact carries `activeLoans`, the books they have now. */
  countForContacts: Enrich;
  /** `routes.book.customFilters.lent`: `true` for books out on a loan, `false` for the rest. */
  lentFilter: CustomFilterResolver;
}

export function createActiveLoans(registry: ModelRegistry): ActiveLoans {
  const loans = () => registry.get(loanEntity.config.name);

  function findActive(where: Row, attributes: string[]) {
    return loans().findAll({ where: { ...where, returnedAt: null }, attributes });
  }

  return {
    async attachToBooks(books) {
      if (books.length === 0) return books;
      const active = await findActive({ bookId: books.map((book) => String(book.id)) }, [
        'id',
        'bookId',
        'contactId',
        'lentAt',
        'dueAt',
      ]);
      const contactIds = [...new Set(active.map((loan) => String(loan.get('contactId'))))];
      const contacts =
        contactIds.length === 0
          ? []
          : await registry
              .get(contactEntity.config.name)
              .findAll({ where: { id: contactIds }, attributes: ['id', 'name'] });
      const contactNames = new Map(
        contacts.map((contact) => [String(contact.get('id')), String(contact.get('name'))])
      );

      const loansByBook = new Map<string, ActiveLoan>();
      for (const loan of active) {
        const contactId = String(loan.get('contactId'));
        loansByBook.set(String(loan.get('bookId')), {
          id: String(loan.get('id')),
          lentAt: String(loan.get('lentAt')),
          dueAt: (loan.get('dueAt') as string | null) ?? null,
          contact: { id: contactId, name: contactNames.get(contactId) ?? '' },
        });
      }
      return books.map((book) => ({
        ...book,
        activeLoan: loansByBook.get(String(book.id)) ?? null,
      }));
    },

    async countForContacts(contacts) {
      const rows = contacts.map((contact) => contact.toJSON() as Row);
      if (rows.length === 0) return [];
      const active = await findActive({ contactId: rows.map((row) => String(row.id)) }, [
        'contactId',
      ]);
      const counts = new Map<string, number>();
      for (const loan of active) {
        const contactId = String(loan.get('contactId'));
        counts.set(contactId, (counts.get(contactId) ?? 0) + 1);
      }
      return rows.map((row) => ({ ...row, activeLoans: counts.get(String(row.id)) ?? 0 }));
    },

    async lentFilter(lent, req) {
      const active = await findActive({ ownerId: req.user?.id }, ['bookId']);
      const lentBookIds = active.map((loan) => String(loan.get('bookId')));
      // `NOT IN ()` would match nothing in SQL; with nothing lent every book is at home.
      if (!lent && lentBookIds.length === 0) return {};
      return { id: { [lent ? Op.in : Op.notIn]: lentBookIds } };
    },
  };
}
