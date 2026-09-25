import type { PaginatedResponse } from '@eleansphere/entity-core';

/** `getNextPageParam` for infinite lists: the next page number, or `undefined` once all loaded. */
export function nextPageNumber<T>(
  lastPage: PaginatedResponse<T>,
  pages: PaginatedResponse<T>[]
): number | undefined {
  const loaded = pages.reduce((count, page) => count + page.data.length, 0);
  return loaded < lastPage.total ? pages.length + 1 : undefined;
}
