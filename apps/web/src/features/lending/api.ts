import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { QueryClient } from '@tanstack/vue-query';
import type { AcceptLoanRequestBody, LoanRequestBody } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary } from '@/app/library-queries';

/** The first element of every lending query key. */
const LENDING_KEY = 'lending';
/** Friends' libraries show whether a book is lent and the reader's own waiting request. */
const FRIENDS_KEY = 'friends';

/** A request changes both the requests and how the friend's book looks. */
async function invalidateLending(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [LENDING_KEY] }),
    queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] }),
  ]);
}

/** The reader's waiting requests: friends asking for their books, and theirs to friends. */
export function useLoanRequests() {
  return useQuery({
    queryKey: [LENDING_KEY, 'requests'],
    queryFn: () => services.lending.requests(),
  });
}

/** The books the reader has borrowed from friends. */
export function useBorrowed() {
  return useQuery({
    queryKey: [LENDING_KEY, 'borrowed'],
    queryFn: () => services.lending.borrowed(),
  });
}

export interface BookRequest {
  friendId: string;
  bookId: string;
  body: LoanRequestBody;
}

export function useRequestBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ friendId, bookId, body }: BookRequest) =>
      services.lending.request(friendId, bookId, body),
    onSuccess: () => invalidateLending(queryClient),
  });
}

export interface AcceptRequest {
  requestId: string;
  body: AcceptLoanRequestBody;
}

/** Lends the book: a loan appears in the reader's own library too. */
export function useAcceptLoanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, body }: AcceptRequest) => services.lending.accept(requestId, body),
    onSuccess: () => Promise.all([invalidateLending(queryClient), invalidateLibrary(queryClient)]),
  });
}

export function useDeclineLoanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => services.lending.decline(requestId),
    onSuccess: () => invalidateLending(queryClient),
  });
}

export function useCancelLoanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => services.lending.cancel(requestId),
    onSuccess: () => invalidateLending(queryClient),
  });
}
