import { describe, expect, it } from 'vitest';
import { validateFields } from '@eleansphere/schema';
import {
  bookFields,
  contactFields,
  findLoanDatesIssues,
  findReadingDatesIssues,
  LOCALES,
  loanFields,
  shelfFields,
} from '@kniho-hlod/domain';
import { buildSampleLibrary } from './build-sample-library';
import { SAMPLE_LIBRARIES } from './sample-library-content';

const TODAY = '2026-09-25';
const NOW = new Date('2026-09-25T10:00:00Z');

function build(locale: (typeof LOCALES)[number]) {
  let counter = 0;
  return buildSampleLibrary(SAMPLE_LIBRARIES[locale], {
    ownerId: 'u_reader',
    today: TODAY,
    now: NOW,
    newId: (prefix) => `${prefix}${++counter}`,
  });
}

describe.each(LOCALES)('The sample library in %s', (locale) => {
  const rows = build(locale);
  const ids = (list: Record<string, unknown>[]) => new Set(list.map(({ id }) => id));

  it('passes the rules the readers’ own rows pass', () => {
    const validate = (fields: Parameters<typeof validateFields>[0], list: object[]) =>
      list.flatMap((row) => validateFields(fields, { ...row }, { mode: 'create' }));

    expect(validate(shelfFields, rows.shelves)).toEqual([]);
    expect(validate(bookFields, rows.books)).toEqual([]);
    expect(validate(contactFields, rows.contacts)).toEqual([]);
    expect(validate(loanFields, rows.loans)).toEqual([]);
    expect(rows.books.flatMap((book) => findReadingDatesIssues(book))).toEqual([]);
    expect(rows.loans.flatMap((loan) => findLoanDatesIssues(loan))).toEqual([]);
  });

  it('is all the reader’s and all marked as a sample', () => {
    const everyRow = Object.values(rows).flat();

    expect(everyRow.every((row) => row.ownerId === 'u_reader' && row.isSample === true)).toBe(true);
  });

  it('only refers to its own rows', () => {
    const bookIds = ids(rows.books);
    const shelfIds = ids(rows.shelves);
    const contactIds = ids(rows.contacts);

    expect(rows.bookShelves.every(({ bookId }) => bookIds.has(bookId))).toBe(true);
    expect(rows.bookShelves.every(({ shelfId }) => shelfIds.has(shelfId))).toBe(true);
    expect(
      rows.loans.every(({ bookId, contactId }) => bookIds.has(bookId) && contactIds.has(contactId))
    ).toBe(true);
  });

  it('keeps the books in their listed order, newest first', () => {
    const times = rows.books.map(({ createdAt }) => (createdAt as Date).getTime());

    expect(times).toEqual([...times].sort((left, right) => right - left));
    expect(new Set(times).size).toBe(times.length);
  });

  it('lends one book past its due date, one due soon and has one back', () => {
    expect(rows.loans).toMatchObject([
      { lentAt: '2026-08-21', dueAt: '2026-09-20', returnedAt: null },
      { lentAt: '2026-08-30', dueAt: '2026-09-27', returnedAt: null },
      { lentAt: '2026-06-27', dueAt: '2026-07-27', returnedAt: '2026-07-25' },
    ]);
  });
});
