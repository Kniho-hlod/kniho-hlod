import { defineEntity } from '@eleansphere/entity-core';
import { DEFAULT_LOAN_REQUEST_STATUS } from '../../constants';
import { loanRequestFields } from './fields';

/**
 * Friends' requests to borrow a book. There is no CRUD for them: the lending routes know both
 * sides. The partial unique index lets a friend have one request waiting per book.
 */
export const loanRequestEntity = defineEntity({
  name: 'loanRequest',
  prefix: 'lr_',
  basePath: '/api/loan-request-rows',
  access: { read: 'admin', write: 'admin' },
  fields: loanRequestFields,
  indexes: [
    {
      fields: ['bookId', 'requesterId'],
      unique: true,
      where: { status: DEFAULT_LOAN_REQUEST_STATUS },
    },
    { fields: ['lenderId'] },
  ],
});
