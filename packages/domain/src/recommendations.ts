import { ApiClient } from '@eleansphere/entity-core';
import type { BookWithDetails } from './entities';
import type { FriendBookSummary, PersonSummary } from './friends';

/** `POST` recommend a book, `GET` the recommendations waiting for the reader. */
export const RECOMMENDATIONS_PATH = '/api/recommendations';

/** `POST /api/recommendations`: one of the reader's books, to these friends. */
export interface RecommendBookRequest {
  bookId: string;
  recipientIds: string[];
  message?: string | null;
}

/** A recommendation waiting for the reader: who, which book, and what they wrote. */
export interface RecommendationItem {
  id: string;
  sender: PersonSummary;
  book: FriendBookSummary;
  message: string | null;
  sentAt: string;
}

function recommendationPath(id: string): string {
  return `${RECOMMENDATIONS_PATH}/${encodeURIComponent(id)}`;
}

export class RecommendationsService extends ApiClient {
  recommend(request: RecommendBookRequest): Promise<void> {
    return this.post<void>(RECOMMENDATIONS_PATH, request);
  }

  list(): Promise<RecommendationItem[]> {
    return this.get<RecommendationItem[]>(RECOMMENDATIONS_PATH);
  }

  /** Puts the recommended book in the reader's library (or finds the copy already there). */
  accept(id: string): Promise<BookWithDetails> {
    return this.post<BookWithDetails>(`${recommendationPath(id)}/accept`, {});
  }

  dismiss(id: string): Promise<void> {
    return this.post<void>(`${recommendationPath(id)}/dismiss`, {});
  }
}
