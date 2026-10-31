import type { QueryClient } from '@tanstack/vue-query';

/** The first element of every query key, per kind of server data. */
export const QUERY_KEYS = {
  books: 'books',
  contacts: 'contacts',
  loans: 'loans',
  shelves: 'shelves',
  stats: 'stats',
  sampleLibrary: 'sample-library',
  wishes: 'wishes',
  friendWishes: 'friend-wishes',
} as const;

/**
 * Books, contacts, loans, shelves and the stats all show parts of each other — a book its active
 * loan and its shelves, a contact how many books they have, a shelf its book count, the dashboard
 * every count, the sample library whether the library is still empty, a friend's wish list which
 * wishes the reader owns already, a wish that came true a new book — so a change to any of them
 * refreshes them all. Only queries on screen refetch right away.
 */
export function invalidateLibrary(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => (Object.values(QUERY_KEYS) as unknown[]).includes(query.queryKey[0]),
  });
}
