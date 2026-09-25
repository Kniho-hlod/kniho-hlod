import { userEntity } from './user';
import { systemNotificationEntity } from './system-notification';
import { bookEntity } from './book';
import { contactEntity } from './contact';
import { loanEntity } from './loan';
import { shelfEntity } from './shelf';
import { bookShelfEntity } from './book-shelf';

export { userEntity, type User } from './user';
export { userFields } from './user/fields';
export {
  systemNotificationEntity,
  findActiveRangeIssues,
  type SystemNotification,
} from './system-notification';
export {
  bookEntity,
  BOOKS_PATH,
  findReadingDatesIssues,
  readingDatesForStatus,
  type Book,
  type BookWithDetails,
  type ReadingDates,
  type SetBookShelvesRequest,
} from './book';
export { bookFields } from './book/fields';
export { contactEntity, type Contact, type ContactWithLoans } from './contact';
export { contactFields } from './contact/fields';
export {
  loanEntity,
  LOANS_PATH,
  findLoanDatesIssues,
  loanStatus,
  type ActiveLoan,
  type Loan,
  type LoanBook,
  type LoanContact,
  type LoanWithDetails,
  type ReturnLoanRequest,
} from './loan';
export { loanFields } from './loan/fields';
export {
  shelfEntity,
  SHELF_ORDER,
  type Shelf,
  type ShelfSummary,
  type ShelfWithBooks,
} from './shelf';
export { shelfFields } from './shelf/fields';
export { bookShelfEntity } from './book-shelf';

/** Every entity, for the API's `toModelConfigs(allEntities)`. */
export const allEntities = {
  user: userEntity,
  systemNotification: systemNotificationEntity,
  book: bookEntity,
  contact: contactEntity,
  loan: loanEntity,
  shelf: shelfEntity,
  bookShelf: bookShelfEntity,
};

/** Entities whose `/api` CRUD routes are not mounted (yet). */
export const ENTITIES_WITHOUT_CRUD_ROUTES = [userEntity.config.name, bookShelfEntity.config.name];
