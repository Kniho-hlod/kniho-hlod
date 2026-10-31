import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { BookWithDetails, FriendWish, Wish } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';

/** The API's page limit; a wish list fits on one page. */
const WISHES_LIMIT = 200;

export interface WishFormState {
  title: string;
  author: string;
  isbn: string;
  note: string;
}

export function emptyWishForm(): WishFormState {
  return { title: '', author: '', isbn: '', note: '' };
}

export function wishToForm(wish: Wish): WishFormState {
  return {
    title: wish.title,
    author: wish.author ?? '',
    isbn: wish.isbn ?? '',
    note: wish.note ?? '',
  };
}

/** Empty fields go as `null`, so clearing one in an edit clears it on the server. */
function toPayload(form: WishFormState) {
  const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    title: form.title.trim(),
    author: orNull(form.author),
    isbn: orNull(form.isbn),
    note: orNull(form.note),
  };
}

/** The reader's wish list, newest first. */
export function useWishes() {
  return useQuery({
    queryKey: [QUERY_KEYS.wishes, 'all'],
    queryFn: async () => {
      const page = (await services.wishes.getAll({
        limit: WISHES_LIMIT,
      })) as PaginatedResponse<Wish>;
      return page.data;
    },
  });
}

export interface SaveWishRequest {
  /** The wish to update; without one a new wish is created. */
  id: string | undefined;
  form: WishFormState;
}

export function useSaveWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: SaveWishRequest): Promise<Wish> =>
      id ? services.wishes.update(id, toPayload(form)) : services.wishes.create(toPayload(form)),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export function useDeleteWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<void> => services.wishes.delete(id),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

/** The reader got the book: it moves from the list into the library. */
export function useFulfilWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<BookWithDetails> => services.wishes.fulfil(id),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

/** A friend's wish list; only for a friend who shares their library (404 otherwise). */
export function useFriendWishes(userId: Ref<string>) {
  return useQuery({
    queryKey: [QUERY_KEYS.friendWishes, userId],
    queryFn: () => services.friendWishes.list(userId.value),
  });
}

export interface FriendGiftRequest {
  userId: string;
  wishId: string;
}

/** The reader promises to give a friend's wished-for book. */
export function useGiveWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, wishId }: FriendGiftRequest): Promise<FriendWish> =>
      services.friendWishes.give(userId, wishId),
    onSettled: (_result, _error, { userId }) =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.friendWishes, userId] }),
  });
}

/** Takes the reader's promise back. */
export function useCancelGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, wishId }: FriendGiftRequest): Promise<void> =>
      services.friendWishes.cancelGift(userId, wishId),
    onSettled: (_result, _error, { userId }) =>
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.friendWishes, userId] }),
  });
}
