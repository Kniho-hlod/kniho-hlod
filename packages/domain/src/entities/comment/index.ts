import { defineEntity } from '@eleansphere/entity-core';
import { commentFields } from './fields';

/**
 * Comments under books. There is no CRUD for them: the comments routes check who may see the
 * book — its owner and the owner's friends — and who may change a comment.
 */
export const commentEntity = defineEntity({
  name: 'comment',
  prefix: 'cm_',
  basePath: '/api/comment-rows',
  access: { read: 'admin', write: 'admin' },
  fields: commentFields,
  indexes: [{ fields: ['bookId'] }],
});
