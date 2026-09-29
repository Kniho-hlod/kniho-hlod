import { computed } from 'vue';
import type { Ref } from 'vue';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { services } from '@/app/api';
import { invalidateLibrary } from '@/app/library-queries';
import { nextPageNumber } from '@/app/pagination';

export const FEED_PAGE_SIZE = 20;

/**
 * Friends' query keys start with `friends` — the feed and friends' copies of a book among them —
 * so whatever changes a friendship refreshes these too.
 */
const FRIENDS_KEY = 'friends';

/** What friends read, newest first, a page at a time. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: [FRIENDS_KEY, 'feed'],
    queryFn: ({ pageParam }) => services.feed.list({ page: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

/** Friends' shared copies of the book with this ISBN; nothing is asked for a book without one. */
export function useFriendCopies(isbn: Ref<string | null | undefined>) {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'copies', isbn],
    queryFn: () => services.friends.copies(isbn.value ?? ''),
    enabled: computed(() => Boolean(isbn.value)),
  });
}

export interface FriendBookRef {
  friendId: string;
  bookId: string;
}

/** Puts a copy of a friend's book in the reader's library, as one they want to read. */
export function useCopyFriendBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ friendId, bookId }: FriendBookRef) =>
      services.friends.copyBook(friendId, bookId),
    onSuccess: () =>
      Promise.all([
        invalidateLibrary(queryClient),
        queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] }),
      ]),
  });
}
