import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import type { QueryClient } from '@tanstack/vue-query';
import { INVITE_PAGE_PATH } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { nextPageNumber } from '@/app/pagination';

export const FRIEND_BOOKS_PAGE_SIZE = 24;

/** The first element of every friends query key. */
const FRIENDS_KEY = 'friends';

export interface FriendBookFilters {
  /** Searched in the title and author. */
  q: string;
  readingStatus: ReadingStatus | null;
  /** Only the books on this shelf of the friend's. */
  shelfId: string | null;
}

export const NO_FRIEND_BOOK_FILTERS: FriendBookFilters = {
  q: '',
  readingStatus: null,
  shelfId: null,
};

/** Friends, requests and friends' libraries all change together when a friendship does. */
function invalidateFriends(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] });
}

export function useFriends() {
  return useQuery({ queryKey: [FRIENDS_KEY, 'list'], queryFn: () => services.friends.list() });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'requests'],
    queryFn: () => services.friends.requests(),
  });
}

export function useFriend(userId: Ref<string>) {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'friend', userId],
    queryFn: () => services.friends.friend(userId.value),
  });
}

/** A friend's shared books, newest first, a page at a time. */
export function useFriendBooks(
  userId: Ref<string>,
  filters: Readonly<Ref<FriendBookFilters>>,
  enabled: MaybeRefOrGetter<boolean>
) {
  return useInfiniteQuery({
    queryKey: [FRIENDS_KEY, 'books', userId, filters],
    queryFn: ({ pageParam }) =>
      services.friends.books(userId.value, {
        page: pageParam,
        limit: FRIEND_BOOKS_PAGE_SIZE,
        q: filters.value.q.trim() || undefined,
        filter: {
          readingStatus: filters.value.readingStatus ? [filters.value.readingStatus] : undefined,
          shelf: filters.value.shelfId ?? undefined,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  });
}

export function useFriendBook(userId: Ref<string>, bookId: Ref<string>) {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'book', userId, bookId],
    queryFn: () => services.friends.book(userId.value, bookId.value),
  });
}

export function useFriendShelves(userId: Ref<string>, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'shelves', userId],
    queryFn: () => services.friends.shelves(userId.value),
    enabled: computed(() => toValue(enabled)),
  });
}

export function useMyInvite() {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'my-invite'],
    queryFn: () => services.friends.myInvite(),
  });
}

export function useReplaceInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.friends.replaceInvite(),
    onSuccess: (invite) => queryClient.setQueryData([FRIENDS_KEY, 'my-invite'], invite),
  });
}

export function useInviteByEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => services.friends.inviteByEmail(email.trim()),
    onSuccess: () => invalidateFriends(queryClient),
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => services.friends.acceptRequest(requestId),
    onSuccess: () => invalidateFriends(queryClient),
  });
}

/** Declines a request to the reader, or takes back one they sent. */
export function useRemoveFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => services.friends.removeRequest(requestId),
    onSuccess: () => invalidateFriends(queryClient),
  });
}

export function useUnfriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => services.friends.unfriend(userId),
    onSuccess: () => invalidateFriends(queryClient),
  });
}

/** Who invites, and how the reader stands with them — asked again after signing in. */
export function useInvite(code: Ref<string>, signedIn: Ref<boolean>) {
  return useQuery({
    queryKey: [FRIENDS_KEY, 'invite', code, signedIn],
    queryFn: () => services.friends.invite(code.value),
    retry: false,
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => services.friends.acceptInvite(code),
    onSuccess: () => invalidateFriends(queryClient),
  });
}

/** The address an invite code opens in this app. */
export function inviteLink(code: string): string {
  return new URL(
    `${INVITE_PAGE_PATH}/${encodeURIComponent(code)}`,
    window.location.origin
  ).toString();
}
