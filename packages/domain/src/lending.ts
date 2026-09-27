import { ApiClient } from '@eleansphere/entity-core';
import { FRIENDS_PATH } from './friends';
import type { FriendBookSummary, PersonSummary } from './friends';

/** Requests to borrow: the reader's incoming and outgoing, and the answers. */
export const LOAN_REQUESTS_PATH = '/api/loan-requests';
/** The books the reader has borrowed from friends and not returned yet. */
export const BORROWED_PATH = '/api/borrowed';
/** Where the web app lists loans; its `?tab=borrowed` shows the books borrowed from friends. */
export const LOANS_PAGE_PATH = '/loans';

/** `POST /api/friends/:userId/books/:bookId/requests`. */
export interface LoanRequestBody {
  message?: string | null;
  /** When the friend would bring the book back. */
  dueAt?: string | null;
}

/** `POST /api/loan-requests/:id/accept`: the due date, when the owner changes the one asked for. */
export interface AcceptLoanRequestBody {
  dueAt?: string | null;
}

/** A request waiting for an answer, as either side sees it. */
export interface LoanRequestItem {
  id: string;
  book: FriendBookSummary;
  /** The other reader: the friend asking, or the owner asked. */
  person: PersonSummary;
  message: string | null;
  dueAt: string | null;
  sentAt: string;
}

export interface LoanRequests {
  incoming: LoanRequestItem[];
  outgoing: LoanRequestItem[];
}

/** A book the reader has borrowed from a friend: from whom, since when, due back when. */
export interface BorrowedLoan {
  id: string;
  book: FriendBookSummary;
  lender: PersonSummary;
  lentAt: string;
  dueAt: string | null;
}

/** Asking friends for books, answering them, and what the reader has borrowed. */
export class LendingService extends ApiClient {
  request(friendId: string, bookId: string, body: LoanRequestBody): Promise<LoanRequestItem> {
    return this.post<LoanRequestItem>(
      `${FRIENDS_PATH}/${encodeURIComponent(friendId)}/books/${encodeURIComponent(bookId)}/requests`,
      body
    );
  }

  requests(): Promise<LoanRequests> {
    return this.get<LoanRequests>(LOAN_REQUESTS_PATH);
  }

  /** Lends the book: the loan starts today, to the friend as a linked contact. */
  accept(requestId: string, body: AcceptLoanRequestBody = {}): Promise<void> {
    return this.post<void>(`${LOAN_REQUESTS_PATH}/${encodeURIComponent(requestId)}/accept`, body);
  }

  decline(requestId: string): Promise<void> {
    return this.post<void>(`${LOAN_REQUESTS_PATH}/${encodeURIComponent(requestId)}/decline`, {});
  }

  /** The friend takes back a request of theirs. */
  cancel(requestId: string): Promise<void> {
    return this.post<void>(`${LOAN_REQUESTS_PATH}/${encodeURIComponent(requestId)}/cancel`, {});
  }

  borrowed(): Promise<BorrowedLoan[]> {
    return this.get<BorrowedLoan[]>(BORROWED_PATH);
  }
}
