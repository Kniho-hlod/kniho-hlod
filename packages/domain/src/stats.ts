import { ApiClient } from '@eleansphere/entity-core';

export const STATS_PATH = '/api/stats';
export const ADMIN_STATS_PATH = '/api/admin/stats';
/** Accounts count as new in the administrators' stats for this many days. */
export const NEW_USER_DAYS = 30;

/** The signed-in reader's library in numbers, for the dashboard (`GET /api/stats`). */
export interface LibraryStats {
  books: number;
  /** Books with the reading status `reading`. */
  reading: number;
  contacts: number;
  /** Loans not returned yet. */
  lent: number;
  /** Of those, past their due date … */
  overdue: number;
  /** … and due within `DUE_SOON_DAYS`. */
  dueSoon: number;
}

/** The whole app in numbers, for administrators (`GET /api/admin/stats`). */
export interface AdminStats {
  users: number;
  /** Accounts created in the last `NEW_USER_DAYS` days. */
  newUsers: number;
  admins: number;
  /** Accounts that get e-mail reminders. */
  remindersOn: number;
  /** Books, contacts and loans the readers added themselves, the sample library's left out. */
  books: number;
  contacts: number;
  /** Loans not returned yet … */
  lent: number;
  /** … of which past their due date, counted in the default time zone. */
  overdue: number;
  /** Reports from readers no administrator has resolved yet. */
  newFeedback: number;
}

export class StatsService extends ApiClient {
  library(): Promise<LibraryStats> {
    return this.get<LibraryStats>(STATS_PATH);
  }

  /** Administrators only. */
  admin(): Promise<AdminStats> {
    return this.get<AdminStats>(ADMIN_STATS_PATH);
  }
}
