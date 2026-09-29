import { defineEntity } from '@eleansphere/entity-core';
import { DEFAULT_RECOMMENDATION_STATUS } from '../../constants';
import { recommendationFields } from './fields';

/**
 * Books readers recommend to their friends. There is no CRUD for them: the recommendations routes
 * know both sides. The partial unique index keeps one waiting recommendation per book and friend.
 */
export const recommendationEntity = defineEntity({
  name: 'recommendation',
  prefix: 'rc_',
  basePath: '/api/recommendation-rows',
  access: { read: 'admin', write: 'admin' },
  fields: recommendationFields,
  indexes: [
    {
      fields: ['bookId', 'recipientId'],
      unique: true,
      where: { status: DEFAULT_RECOMMENDATION_STATUS },
    },
    { fields: ['recipientId'] },
  ],
});
