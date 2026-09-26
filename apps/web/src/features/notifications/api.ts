import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { services } from '@/app/api';
import { useSessionStore } from '@/features/auth/session-store';

/** How often the bell asks for news while the app is open; it also asks on coming back to it. */
const NOTIFICATIONS_REFRESH_MS = 60_000;
const NOTIFICATIONS_KEY = ['notifications'] as const;

export function useNotifications() {
  const session = useSessionStore();
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => services.notifications.feed(),
    refetchInterval: NOTIFICATIONS_REFRESH_MS,
    refetchOnWindowFocus: true,
    enabled: computed(() => session.isSignedIn),
  });
}

/** Marks these notifications read, or all of them without ids. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => services.notifications.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
