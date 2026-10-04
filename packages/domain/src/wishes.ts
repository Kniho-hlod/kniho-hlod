import { ApiClient } from '@eleansphere/entity-core';
import { FRIENDS_PATH } from './friends';

/**
 * Who has promised to give a friend's wished-for book: the reader, another friend, or nobody
 * yet. The friend whose wish it is never learns any of it.
 */
export type WishGift = 'mine' | 'someoneElse' | null;

/** A wish on a friend's list, as the reader sees it. */
export interface FriendWish {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  note: string | null;
  /** When the friend put it on the list. */
  addedAt: string;
  gift: WishGift;
  /** The reader's own copy — a book of theirs with the same ISBN — to lend; `null` for none. */
  myCopy: { id: string } | null;
}

function wishesPath(userId: string): string {
  return `${FRIENDS_PATH}/${encodeURIComponent(userId)}/wishes`;
}

function giftPath(userId: string, wishId: string): string {
  return `${wishesPath(userId)}/${encodeURIComponent(wishId)}/gift`;
}

/** Friends' wish lists: `GET /api/friends/:userId/wishes`, and promising to give one. */
export class FriendWishesService extends ApiClient {
  list(userId: string): Promise<FriendWish[]> {
    return this.get<FriendWish[]>(wishesPath(userId));
  }

  /** The reader promises to give the book (409 when another friend has). */
  give(userId: string, wishId: string): Promise<FriendWish> {
    return this.put<FriendWish>(giftPath(userId, wishId), {});
  }

  /** Takes the reader's promise back. */
  cancelGift(userId: string, wishId: string): Promise<void> {
    return this.httpDelete(giftPath(userId, wishId));
  }
}
