import type { Ref } from 'vue';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import type { UserOverview, UserRole } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { nextPageNumber } from '@/app/pagination';

/** The first element of every administration query key. */
const ADMIN_QUERY_KEY = 'admin';
export const USERS_PAGE_SIZE = 30;

export function useAdminStats() {
  return useQuery({
    queryKey: [ADMIN_QUERY_KEY, 'stats'],
    queryFn: () => services.stats.admin(),
  });
}

/** Accounts, the newest first, a page at a time; `search` matches the name or e-mail. */
export function useUserList(search: Ref<string>) {
  return useInfiniteQuery({
    queryKey: [ADMIN_QUERY_KEY, 'users', search],
    queryFn: ({ pageParam }) =>
      services.users.getAll({
        page: pageParam,
        limit: USERS_PAGE_SIZE,
        q: search.value.trim() || undefined,
      }) as Promise<PaginatedResponse<UserOverview>>,
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

export interface RoleChange {
  user: UserOverview;
  role: UserRole;
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ user, role }: RoleChange) => services.users.setRole(user.id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  });
}

/** Deletes an account with its whole library. */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: UserOverview) => services.users.delete(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  });
}
