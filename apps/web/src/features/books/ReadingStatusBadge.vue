<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ReadingStatus } from '@kniho-hlod/domain';

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success';

const STATUS_COLORS: Record<ReadingStatus, BadgeColor> = {
  none: 'neutral',
  want: 'info',
  reading: 'warning',
  read: 'success',
};

defineProps<{ status: ReadingStatus }>();

const { t } = useI18n();
</script>

<template>
  <UBadge :color="STATUS_COLORS[status]" variant="subtle">
    {{ t(`books.readingStatus.${status}`) }}
  </UBadge>
</template>
