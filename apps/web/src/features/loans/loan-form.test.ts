import { describe, expect, it } from 'vitest';
import { newLoanForm, toLoanPayload } from './loan-form';

const TODAY = '2026-09-25';

describe('newLoanForm', () => {
  it('lends today, due back thirty days later', () => {
    expect(newLoanForm(TODAY, 'bk_1')).toEqual({
      bookId: 'bk_1',
      contact: null,
      lentAt: TODAY,
      dueAt: '2026-10-25',
      returnedAt: null,
      note: null,
    });
  });
});

describe('toLoanPayload', () => {
  it('sends the resolved contact and clears empty text', () => {
    const form = {
      ...newLoanForm(TODAY, 'bk_1'),
      contact: { kind: 'new' as const, name: 'Jana' },
      dueAt: '',
      note: '  ',
    };

    expect(toLoanPayload(form, 'ct_1')).toEqual({
      bookId: 'bk_1',
      contactId: 'ct_1',
      lentAt: TODAY,
      dueAt: null,
      returnedAt: null,
      note: null,
    });
  });

  it('refuses a loan without a book', () => {
    expect(() => toLoanPayload(newLoanForm(TODAY, null), 'ct_1')).toThrow(/needs a book/);
  });
});
