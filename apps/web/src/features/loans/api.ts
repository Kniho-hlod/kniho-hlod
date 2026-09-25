import { computed } from 'vue';
import type { Ref } from 'vue';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { LoanWithDetails } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';
import { nextPageNumber } from '@/app/pagination';
import { toLoanPayload } from './loan-form';
import type { ContactChoice, LoanFormState } from './loan-form';

export const LOANS_PAGE_SIZE = 20;

/** Loans still out, or those already back. */
export type LoanListState = 'active' | 'returned';

export interface LoanListFilters {
  state: LoanListState;
  /** Only this book's loans. */
  bookId?: string;
  /** Only this contact's loans. */
  contactId?: string;
  /** Only loans due on or before this date (`YYYY-MM-DD`): overdue and due soon. */
  dueBy?: string;
}

/** Books still out come soonest-due first (no due date last); returned ones latest first. */
function toListRequest(filters: LoanListFilters, page: number) {
  const isActive = filters.state === 'active';
  return {
    page,
    limit: LOANS_PAGE_SIZE,
    filter: {
      returnedAt: { isNull: isActive },
      bookId: filters.bookId,
      contactId: filters.contactId,
      dueAt: filters.dueBy ? { lte: filters.dueBy } : undefined,
    },
    sort: isActive ? (['dueAt', '-lentAt'] as const) : (['-returnedAt'] as const),
  };
}

export function useLoanList(filters: Ref<LoanListFilters>) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.loans, 'list', filters],
    queryFn: ({ pageParam }) =>
      services.loans.getAll(toListRequest(filters.value, pageParam)) as Promise<
        PaginatedResponse<LoanWithDetails>
      >,
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

export function useLoan(id: Ref<string | undefined>) {
  return useQuery({
    queryKey: [QUERY_KEYS.loans, 'detail', id],
    queryFn: () => {
      if (!id.value) throw new Error('No loan to load');
      return services.loans.getById(id.value) as Promise<LoanWithDetails>;
    },
    enabled: computed(() => id.value !== undefined),
  });
}

/** The chosen contact's id — a new name becomes a contact first. */
async function resolveContactId(choice: ContactChoice): Promise<string> {
  if (choice.kind === 'existing') return choice.id;
  const contact = await services.contacts.create({ name: choice.name.trim() });
  return contact.id;
}

export interface SaveLoanRequest {
  /** The loan to update; without one the book is lent. */
  id: string | undefined;
  form: LoanFormState;
}

/**
 * Lends a book, or updates a loan. A new contact is created first; if the loan then fails (the
 * book was lent meanwhile), the contact stays — it is a person the reader named, not a leftover.
 */
export function useSaveLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, form }: SaveLoanRequest): Promise<LoanWithDetails> => {
      if (!form.contact) throw new Error('A loan needs a contact');
      const payload = toLoanPayload(form, await resolveContactId(form.contact));
      const saved = id
        ? await services.loans.update(id, payload)
        : await services.loans.create(payload);
      return saved as LoanWithDetails;
    },
    onSettled: () => invalidateLibrary(queryClient),
  });
}

export function useReturnLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.loans.markReturned(id),
    onSettled: () => invalidateLibrary(queryClient),
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.loans.delete(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [QUERY_KEYS.loans, 'detail', id] });
      return invalidateLibrary(queryClient);
    },
  });
}

export function useLibraryStats() {
  return useQuery({
    queryKey: [QUERY_KEYS.stats],
    queryFn: () => services.stats.library(),
  });
}
