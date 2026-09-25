import { computed } from 'vue';
import type { Ref } from 'vue';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { Contact, ContactWithLoans } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';
import { nextPageNumber } from '@/app/pagination';

export const CONTACTS_PAGE_SIZE = 30;
/** How many matches the contact picker offers at once. */
const PICKER_LIMIT = 20;

/** The reader's contacts by name, a page at a time; `search` matches name, e-mail or phone. */
export function useContactList(search: Ref<string>) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.contacts, 'list', search],
    queryFn: ({ pageParam }) =>
      services.contacts.getAll({
        page: pageParam,
        limit: CONTACTS_PAGE_SIZE,
        q: search.value.trim() || undefined,
      }) as Promise<PaginatedResponse<ContactWithLoans>>,
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

/** Contacts matching what is typed into a picker; the previous matches stay while typing. */
export function useContactMatches(search: Ref<string>) {
  return useQuery({
    queryKey: [QUERY_KEYS.contacts, 'matches', search],
    queryFn: () =>
      services.contacts.getAll({ limit: PICKER_LIMIT, q: search.value.trim() || undefined }),
    placeholderData: keepPreviousData,
  });
}

export function useContact(id: Ref<string | undefined>) {
  return useQuery({
    queryKey: [QUERY_KEYS.contacts, 'detail', id],
    queryFn: () => {
      if (!id.value) throw new Error('No contact to load');
      return services.contacts.getById(id.value) as Promise<ContactWithLoans>;
    },
    enabled: computed(() => id.value !== undefined),
  });
}

export interface ContactFormState {
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
}

export function contactFormFrom(contact?: Contact): ContactFormState {
  return {
    name: contact?.name ?? '',
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    note: contact?.note ?? null,
  };
}

function emptyAsNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toContactPayload(form: ContactFormState): ContactFormState {
  return {
    name: form.name.trim(),
    email: emptyAsNull(form.email),
    phone: emptyAsNull(form.phone),
    note: emptyAsNull(form.note),
  };
}

export interface SaveContactRequest {
  /** The contact to update; without one a new contact is created. */
  id: string | undefined;
  form: ContactFormState;
}

export function useSaveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: SaveContactRequest) => {
      const payload = toContactPayload(form);
      return id ? services.contacts.update(id, payload) : services.contacts.create(payload);
    },
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.contacts.delete(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [QUERY_KEYS.contacts, 'detail', id] });
      return invalidateLibrary(queryClient);
    },
  });
}
