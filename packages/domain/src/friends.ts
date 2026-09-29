import { ApiClient, toListQueryParams } from '@eleansphere/entity-core';
import type { Fields, FileDto, PaginatedResponse } from '@eleansphere/entity-core';
import type { QueryConfig } from '@eleansphere/schema';
import type { ReadingStatus, ShelfColor } from './constants';
import type { BookWithDetails } from './entities';

export const FRIENDS_PATH = '/api/friends';
export const FRIEND_REQUESTS_PATH = `${FRIENDS_PATH}/requests`;
export const FRIEND_INVITATIONS_PATH = `${FRIENDS_PATH}/invitations`;
/**
 * `GET /api/friend-copies?isbn=`: friends' shared copies of one book. Not under `/api/friends`,
 * where the segment would read as a friend's id.
 */
export const FRIEND_COPIES_PATH = '/api/friend-copies';
/** `GET` the reader's invite code (made on first ask), `POST` replace it. */
export const MY_INVITE_PATH = '/api/me/invite';
/** `GET /api/invites/:code` who invites, `POST /api/invites/:code/accept` become friends. */
export const INVITES_PATH = '/api/invites';
/** Where the web app opens an invite link. */
export const INVITE_PAGE_PATH = '/invite';
/** Where the web app lists friends and friend requests. */
export const FRIENDS_PAGE_PATH = '/friends';

const EMAIL_MAX_LENGTH = 254;

/** `POST /api/friends/invitations`: whom to invite, by e-mail. */
export const friendInvitationFields = {
  email: { type: 'STRING', required: true, format: 'email', maxLength: EMAIL_MAX_LENGTH },
} as const satisfies Fields;

export interface FriendInvitationRequest {
  email: string;
}

/**
 * A friend's book list: what the friend's readers may filter, search and sort by — a narrower
 * choice than a reader has in their own library.
 */
export const FRIEND_BOOK_QUERY = {
  filter: { readingStatus: 'in' },
  customFilters: {
    /** A shelf id of the friend's: the books on it. */
    shelf: 'STRING',
  },
  sort: ['title', 'author', 'createdAt'],
  defaultSort: '-createdAt',
  search: ['title', 'author'],
} as const satisfies QueryConfig;

/** Another reader as their friends see them: a name and a picture, never an e-mail. */
export interface PersonSummary {
  id: string;
  displayName: string;
  avatar: FileDto | null;
}

/** A friend's book in a list: enough for a cover and a title. */
export interface FriendBookSummary {
  id: string;
  title: string;
  author: string | null;
  cover: FileDto | null;
}

export interface Friend extends PersonSummary {
  /** When the friendship began. */
  friendsSince: string;
  /** Whether the friend shares their library; without it only their name and picture show. */
  sharesLibrary: boolean;
  /** The shared books they are reading now. */
  readingNow: FriendBookSummary[];
}

/** A friendship one reader asked for and the other hasn't answered yet. */
export interface FriendRequest {
  id: string;
  /** The other reader: who asked, or whom the reader asked. */
  person: PersonSummary;
  sentAt: string;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface FriendShelf {
  id: string;
  name: string;
  color: ShelfColor;
  /** The shared books on it. */
  bookCount: number;
}

/**
 * A book in a friend's shared library: its details, cover, shelves and whether it is at home —
 * never the owner's notes or who has it.
 */
export interface FriendBook extends FriendBookSummary {
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  description: string | null;
  readingStatus: ReadingStatus;
  rating: number | null;
  /** What the friend wrote about the book for their friends. */
  review: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  shelves: Pick<FriendShelf, 'id' | 'name' | 'color'>[];
  /** The book is out on a loan, due back then (`null`: no date agreed); `null` when at home. */
  lent: { dueAt: string | null } | null;
  /** The reader's own request to borrow it, while it waits for an answer. */
  myRequest: { id: string } | null;
  /** The reader's own copy — a book of theirs with the same ISBN — or `null`. */
  myCopy: { id: string } | null;
}

/** A friend's shared copy of a book the reader looks at (the same ISBN). */
export interface FriendCopy {
  friend: PersonSummary;
  bookId: string;
  readingStatus: ReadingStatus;
  rating: number | null;
  review: string | null;
  commentCount: number;
}

/** The friend's list of books, a page at a time. */
export interface FriendBookListRequest {
  page?: number;
  limit?: number;
  q?: string;
  filter?: { readingStatus?: ReadingStatus[]; shelf?: string };
  sort?: string;
}

/** The reader's own invite code; the link is `<app>/invite/<code>`. */
export interface MyInvite {
  code: string;
}

/**
 * How the reader opening an invite stands with whoever sent it: it is their own link, they are
 * friends already, a request is waiting between them, or nothing yet (also for a signed-out
 * visitor).
 */
export type InviteRelation = 'self' | 'friends' | 'requested' | 'none';

export interface InviteInfo {
  inviter: PersonSummary;
  relation: InviteRelation;
}

function friendPath(userId: string): string {
  return `${FRIENDS_PATH}/${encodeURIComponent(userId)}`;
}

/** Friends, friend requests, invites and friends' shared libraries. */
export class FriendsService extends ApiClient {
  list(): Promise<Friend[]> {
    return this.get<Friend[]>(FRIENDS_PATH);
  }

  requests(): Promise<FriendRequests> {
    return this.get<FriendRequests>(FRIEND_REQUESTS_PATH);
  }

  /**
   * Invites someone by e-mail: a reader gets a friend request, anyone else an invitation to the
   * app. The answer is the same either way, so it never tells who uses the app.
   */
  inviteByEmail(email: string): Promise<void> {
    const request: FriendInvitationRequest = { email };
    return this.post<void>(FRIEND_INVITATIONS_PATH, request);
  }

  acceptRequest(requestId: string): Promise<Friend> {
    return this.post<Friend>(`${FRIEND_REQUESTS_PATH}/${encodeURIComponent(requestId)}/accept`, {});
  }

  /** Declines a request to the reader, or takes back one they sent. */
  removeRequest(requestId: string): Promise<void> {
    return this.httpDelete(`${FRIEND_REQUESTS_PATH}/${encodeURIComponent(requestId)}`);
  }

  friend(userId: string): Promise<Friend> {
    return this.get<Friend>(friendPath(userId));
  }

  unfriend(userId: string): Promise<void> {
    return this.httpDelete(friendPath(userId));
  }

  books(userId: string, request: FriendBookListRequest): Promise<PaginatedResponse<FriendBook>> {
    return this.get<PaginatedResponse<FriendBook>, Record<string, string>>(
      `${friendPath(userId)}/books`,
      toListQueryParams(request)
    );
  }

  book(userId: string, bookId: string): Promise<FriendBook> {
    return this.get<FriendBook>(`${friendPath(userId)}/books/${encodeURIComponent(bookId)}`);
  }

  /** Friends' shared copies of the book with this ISBN, for "Friends on this book". */
  copies(isbn: string): Promise<FriendCopy[]> {
    return this.get<FriendCopy[], Record<string, string>>(FRIEND_COPIES_PATH, { isbn });
  }

  /** Puts a copy of the friend's book in the reader's library, as one they want to read. */
  copyBook(userId: string, bookId: string): Promise<BookWithDetails> {
    return this.post<BookWithDetails>(
      `${friendPath(userId)}/books/${encodeURIComponent(bookId)}/copy`,
      {}
    );
  }

  shelves(userId: string): Promise<FriendShelf[]> {
    return this.get<FriendShelf[]>(`${friendPath(userId)}/shelves`);
  }

  myInvite(): Promise<MyInvite> {
    return this.get<MyInvite>(MY_INVITE_PATH);
  }

  /** A new invite link; the old one stops working. */
  replaceInvite(): Promise<MyInvite> {
    return this.post<MyInvite>(MY_INVITE_PATH, {});
  }

  invite(code: string): Promise<InviteInfo> {
    return this.get<InviteInfo>(`${INVITES_PATH}/${encodeURIComponent(code)}`);
  }

  acceptInvite(code: string): Promise<Friend> {
    return this.post<Friend>(`${INVITES_PATH}/${encodeURIComponent(code)}/accept`, {});
  }
}
