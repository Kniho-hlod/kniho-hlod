import type { ModelRouteOverrides } from '@eleansphere/be-core';
import { bookEntity, contactEntity } from '@kniho-hlod/domain';
import type { BookCovers } from '../books/book-covers';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;

const BOOK_ATTRIBUTES = ['id', 'title', 'author'];
const CONTACT_ATTRIBUTES = ['id', 'name'];

function byId<Row extends Record<string, unknown>>(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function distinct(values: unknown[]): string[] {
  return [...new Set(values.map(String))];
}

/**
 * `routes.loan.enrich`: every loan the API returns carries its `book` (title, author, cover) and
 * its `contact` (name), loaded in one query each for the whole page.
 */
export function createLoanDetails(registry: ModelRegistry, bookCovers: BookCovers): Enrich {
  return async (loans) => {
    const rows = loans.map((loan) => loan.toJSON() as Record<string, unknown>);
    if (rows.length === 0) return [];

    const [books, contacts] = await Promise.all([
      registry.get(bookEntity.config.name).findAll({
        where: { id: distinct(rows.map((row) => row.bookId)) },
        attributes: BOOK_ATTRIBUTES,
      }),
      registry.get(contactEntity.config.name).findAll({
        where: { id: distinct(rows.map((row) => row.contactId)) },
        attributes: CONTACT_ATTRIBUTES,
      }),
    ]);
    const booksById = byId(await bookCovers.attach(books));
    const contactsById = byId(contacts.map((contact) => contact.toJSON()));

    return rows.map((row) => ({
      ...row,
      book: booksById.get(String(row.bookId)) ?? null,
      contact: contactsById.get(String(row.contactId)) ?? null,
    }));
  };
}
