<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SystemNotification } from '@kniho-hlod/domain';
import { formatDateTime } from '@/app/dates';
import { announcementStatus } from './announcement-form';
import type { AnnouncementStatus } from './announcement-form';
import { SEVERITY_STYLES } from './severity-styles';

const props = defineProps<{ announcement: SystemNotification; now: Date }>();

const STATUS_COLORS: Record<AnnouncementStatus, 'success' | 'neutral' | 'info'> = {
  scheduled: 'info',
  active: 'success',
  ended: 'neutral',
};

const { t } = useI18n();

const status = computed(() => announcementStatus(props.announcement, props.now));
const style = computed(() => SEVERITY_STYLES[props.announcement.severity]);
</script>

<template>
  <RouterLink
    :to="{ name: 'announcement-edit', params: { id: announcement.id } }"
    class="group flex items-start gap-3 rounded-md p-3 ring ring-default hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <UIcon :name="style.icon" class="mt-0.5 size-5 shrink-0" :class="style.iconClass" />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="flex flex-wrap items-center gap-2">
        <span class="font-medium text-highlighted group-hover:text-primary">
          {{ announcement.title }}
        </span>
        <UBadge :color="STATUS_COLORS[status]" variant="subtle" size="sm">
          {{ t(`announcements.status.${status}`) }}
        </UBadge>
      </p>
      <p class="line-clamp-2 text-sm text-muted">{{ announcement.message }}</p>
      <p class="text-xs text-dimmed">
        {{
          t('announcements.period', {
            from: formatDateTime(announcement.activeFrom),
            to: formatDateTime(announcement.activeTo),
          })
        }}
      </p>
    </div>
  </RouterLink>
</template>
