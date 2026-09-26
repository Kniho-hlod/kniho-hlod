import { userEntity } from './user';
import { systemNotificationEntity } from './system-notification';
import { bookEntity } from './book';
import { contactEntity } from './contact';
import { loanEntity } from './loan';
import { shelfEntity } from './shelf';
import { bookShelfEntity } from './book-shelf';
import { feedbackEntity } from './feedback';

export {
  userEntity,
  USERS_PATH,
  type SetUserRoleRequest,
  type User,
  type UserOverview,
} from './user';
export { userFields } from './user/fields';
export {
  systemNotificationEntity,
  findActiveRangeIssues,
  type SystemNotification,
} from './system-notification';
export { systemNotificationFields } from './system-notification/fields';
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
  loanReminderDue,
  loanStatus,
  OVERDUE_REMINDER_INTERVAL_DAYS,
  type ActiveLoan,
  type Loan,
  type LoanBook,
  type LoanContact,
  type LoanReminderKind,
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
export {
  feedbackEntity,
  ADMIN_FEEDBACK_PATH,
  FEEDBACK_PATH,
  type Feedback,
  type FeedbackReporter,
  type FeedbackReportRequest,
  type FeedbackWithDetails,
} from './feedback';
export {
  FEEDBACK_CONTEXT_MAX_LENGTH,
  feedbackFields,
  feedbackReportFields,
} from './feedback/fields';

/** Every entity, for the API's `toModelConfigs(allEntities)`. */
export const allEntities = {
  user: userEntity,
  systemNotification: systemNotificationEntity,
  book: bookEntity,
  contact: contactEntity,
  loan: loanEntity,
  shelf: shelfEntity,
  bookShelf: bookShelfEntity,
  feedback: feedbackEntity,
};

/** Entities whose `/api` CRUD routes are not mounted: book–shelf pairs change through the book. */
export const ENTITIES_WITHOUT_CRUD_ROUTES = [bookShelfEntity.config.name];
