import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { Shelf, ShelfColor, ShelfWithBooks } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';
import { positionsAfterMove } from './shelf-order';

/** The API's page limit; readers keep a handful of shelves, so one page holds them all. */
const SHELVES_LIMIT = 200;

/** Every shelf of the reader, in their order, each with its book count. */
export function useShelves() {
  return useQuery({
    queryKey: [QUERY_KEYS.shelves, 'all'],
    queryFn: async () => {
      const page = (await services.shelves.getAll({
        limit: SHELVES_LIMIT,
      })) as PaginatedResponse<ShelfWithBooks>;
      return page.data;
    },
  });
}

export interface ShelfFormState {
  name: string;
  color: ShelfColor;
}

export interface SaveShelfRequest {
  /** The shelf to update; without one a new shelf is created. */
  id: string | undefined;
  form: ShelfFormState;
}

export function useSaveShelf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: SaveShelfRequest): Promise<Shelf> => {
      const payload = { ...form, name: form.name.trim() };
      return id ? services.shelves.update(id, payload) : services.shelves.create(payload);
    },
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export function useDeleteShelf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.shelves.delete(id),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export interface MoveShelfRequest {
  /** All shelves, in the order they are shown. */
  shelves: ShelfWithBooks[];
  from: number;
  to: number;
}

/** Moves a shelf up or down the list, renumbering the shelves whose place changes. */
export function useMoveShelf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shelves, from, to }: MoveShelfRequest): Promise<void> => {
      const positions = shelves.map((shelf) => ({ id: shelf.id, sortOrder: shelf.sortOrder ?? 0 }));
      await Promise.all(
        positionsAfterMove(positions, from, to).map(({ id, sortOrder }) =>
          services.shelves.update(id, { sortOrder })
        )
      );
    },
    onSettled: () => invalidateLibrary(queryClient),
  });
}

/** Finds the reader's shelf of that name, letter case aside — the API allows each name once. */
export function findShelfByName<T extends Pick<Shelf, 'name'>>(
  shelves: readonly T[],
  name: string
): T | undefined {
  const wanted = name.trim().toLocaleLowerCase();
  return shelves.find((shelf) => shelf.name.trim().toLocaleLowerCase() === wanted);
}
