import type { QueryClient } from '@tanstack/vue-query';

/** The first element of every query key, per kind of server data. */
export const QUERY_KEYS = {
  books: 'books',
  contacts: 'contacts',
  loans: 'loans',
  stats: 'stats',
} as const;

/**
 * Books, contacts, loans and the stats all show parts of each other — a book its active loan, a
 * contact how many books they have, the dashboard every count — so a change to any of them
 * refreshes them all. Only queries on screen refetch right away.
 */
export function invalidateLibrary(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => (Object.values(QUERY_KEYS) as unknown[]).includes(query.queryKey[0]),
  });
}
