<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { NotificationSeverity, SystemNotification } from '@kniho-hlod/domain';
import { services } from '@/app/api';

const SEVERITY_STYLES: Record<NotificationSeverity, { color: 'info' | 'warning' | 'error'; icon: string }> = {
  info: { color: 'info', icon: 'i-lucide-info' },
  warning: { color: 'warning', icon: 'i-lucide-triangle-alert' },
  critical: { color: 'error', icon: 'i-lucide-octagon-alert' },
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Public endpoint: announcements show on the sign-in page too.
const { data: notifications } = useQuery({
  queryKey: ['system-notifications', 'active'],
  queryFn: (): Promise<SystemNotification[]> => services.systemNotifications.getActive(),
  refetchInterval: REFRESH_INTERVAL_MS,
});
</script>

<template>
  <div v-if="notifications?.length" class="flex flex-col gap-2">
    <UAlert
      v-for="notification in notifications"
      :key="notification.id"
      :title="notification.title"
      :description="notification.message"
      :color="SEVERITY_STYLES[notification.severity].color"
      :icon="SEVERITY_STYLES[notification.severity].icon"
      variant="subtle"
    />
  </div>
</template>
