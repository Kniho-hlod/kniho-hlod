import { defineEntity } from '@eleansphere/entity-core';
import { systemNotificationFields } from './fields';

export { findActiveRangeIssues } from './active-range';

/**
 * Announcements (maintenance windows, news) shown on the sign-in page and in the app while
 * `activeFrom <= now <= activeTo`. Administrators manage them; `GET …/active` is public.
 */
export const systemNotificationEntity = defineEntity({
  name: 'systemNotification',
  prefix: 'sn_',
  basePath: '/api/system-notifications',
  access: { read: 'admin', write: 'admin' },
  activeRange: { from: 'activeFrom', to: 'activeTo' },
  fields: systemNotificationFields,
  query: { sort: ['activeFrom', 'createdAt'], defaultSort: '-activeFrom' },
  extend: (Base) =>
    class extends Base {
      /** Announcements active right now. Public: works without signing in. */
      getActive() {
        return this.get<SystemNotification[]>(`${this.basePath}/active`);
      }
    },
});

export type SystemNotification = InstanceType<typeof systemNotificationEntity.Dto>;
