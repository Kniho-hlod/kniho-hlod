import { computed } from 'vue';
import type { Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { SystemNotification } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { toAnnouncementPayload } from './announcement-form';
import type { AnnouncementFormState } from './announcement-form';

/** The first element of every announcement query key: the banner's and the administration's. */
const ANNOUNCEMENTS_QUERY_KEY = 'system-notifications';
/** Administrators see at most this many announcements, the latest first; old ones can go. */
const ANNOUNCEMENTS_LIMIT = 100;
const ACTIVE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Announcements shown right now. Public: the sign-in page shows them too. */
export function useActiveAnnouncements() {
  return useQuery({
    queryKey: [ANNOUNCEMENTS_QUERY_KEY, 'active'],
    queryFn: (): Promise<SystemNotification[]> => services.systemNotifications.getActive(),
    refetchInterval: ACTIVE_REFRESH_INTERVAL_MS,
  });
}

/** Every announcement, past and planned ones included. Administrators only. */
export function useAnnouncements() {
  return useQuery({
    queryKey: [ANNOUNCEMENTS_QUERY_KEY, 'all'],
    queryFn: async () =>
      (await services.systemNotifications.getAll({ limit: ANNOUNCEMENTS_LIMIT })).data,
  });
}

export function useAnnouncement(id: Ref<string | undefined>) {
  return useQuery({
    queryKey: [ANNOUNCEMENTS_QUERY_KEY, 'detail', id],
    queryFn: () => {
      if (!id.value) throw new Error('No announcement to load');
      return services.systemNotifications.getById(id.value);
    },
    enabled: computed(() => id.value !== undefined),
  });
}

export interface SaveAnnouncementRequest {
  /** The announcement to update; without one a new announcement is created. */
  id: string | undefined;
  form: AnnouncementFormState;
}

export function useSaveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: SaveAnnouncementRequest) => {
      const payload = toAnnouncementPayload(form);
      return id
        ? services.systemNotifications.update(id, payload)
        : services.systemNotifications.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_QUERY_KEY] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.systemNotifications.delete(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [ANNOUNCEMENTS_QUERY_KEY, 'detail', id] });
      return queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_QUERY_KEY] });
    },
  });
}
