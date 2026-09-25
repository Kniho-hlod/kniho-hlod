import { userEntity } from './user';
import { systemNotificationEntity } from './system-notification';
import { bookEntity } from './book';

export { userEntity, type User } from './user';
export { userFields } from './user/fields';
export {
  systemNotificationEntity,
  findActiveRangeIssues,
  type SystemNotification,
} from './system-notification';
export { bookEntity, findReadingDatesIssues, type Book, type BookWithCover } from './book';
export { bookFields } from './book/fields';

/** Every entity, for the API's `toModelConfigs(allEntities)`. */
export const allEntities = {
  user: userEntity,
  systemNotification: systemNotificationEntity,
  book: bookEntity,
};

/** Entities whose `/api` CRUD routes are not mounted (yet). */
export const ENTITIES_WITHOUT_CRUD_ROUTES = [userEntity.config.name];
