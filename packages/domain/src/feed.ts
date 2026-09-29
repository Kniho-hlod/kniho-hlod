import { ApiClient } from '@eleansphere/entity-core';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { QueryConfig } from '@eleansphere/schema';
import type { FriendBookSummary, PersonSummary } from './friends';

/** `GET /api/feed`: what the reader's friends read, newest first. */
export const FEED_PATH = '/api/feed';

/** The feed pages like a list; its order is fixed (newest first), so it sorts by nothing else. */
export const FEED_QUERY = {
  sort: ['createdAt'],
  defaultSort: '-createdAt',
} as const satisfies QueryConfig;

/**
 * What a friend is doing with a book: started it, finished it or wants to read it. One item per
 * book, from its reading status, so a book that is finished no longer shows as started.
 */
export const FEED_ITEM_KINDS = ['started', 'finished', 'wantsToRead'] as const;
export type FeedItemKind = (typeof FEED_ITEM_KINDS)[number];

export interface FeedItem {
  /** The book's id: a book is in the feed once. */
  id: string;
  kind: FeedItemKind;
  /** The day it happened (`YYYY-MM-DD`): started, finished, or put on the wish list. */
  on: string;
  friend: PersonSummary;
  book: FriendBookSummary & { rating: number | null; review: string | null };
  commentCount: number;
}

export interface FeedRequest {
  page?: number;
  limit?: number;
}

export class FeedService extends ApiClient {
  list(request: FeedRequest = {}): Promise<PaginatedResponse<FeedItem>> {
    const params: Record<string, string> = {};
    if (request.page !== undefined) params.page = String(request.page);
    if (request.limit !== undefined) params.limit = String(request.limit);
    return this.get<PaginatedResponse<FeedItem>, Record<string, string>>(FEED_PATH, params);
  }
}
