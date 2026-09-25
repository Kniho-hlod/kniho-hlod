import { ApiClient } from '@eleansphere/entity-core';

export const STATS_PATH = '/api/stats';

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

export class StatsService extends ApiClient {
  library(): Promise<LibraryStats> {
    return this.get<LibraryStats>(STATS_PATH);
  }
}
