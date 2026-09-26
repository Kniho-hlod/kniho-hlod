<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ReadingStatus } from '@kniho-hlod/domain';

interface StatusStyle {
  icon: string;
  /** Literal Tailwind classes for the pill's colours in both modes. */
  classes: string;
}

const STATUS_STYLES: Record<ReadingStatus, StatusStyle> = {
  none: { icon: 'i-lucide-book', classes: 'bg-elevated text-toned' },
  want: {
    icon: 'i-lucide-bookmark',
    classes: 'bg-sky-200 text-sky-950 dark:bg-sky-400/20 dark:text-sky-200',
  },
  reading: {
    icon: 'i-lucide-book-open',
    classes: 'bg-orange-200 text-orange-950 dark:bg-orange-400/20 dark:text-orange-200',
  },
  read: {
    icon: 'i-lucide-check',
    classes: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-200',
  },
};

defineProps<{ status: ReadingStatus }>();

const { t } = useI18n();
</script>

<template>
  <UBadge
    color="neutral"
    variant="soft"
    :icon="STATUS_STYLES[status].icon"
    :class="STATUS_STYLES[status].classes"
  >
    {{ t(`books.readingStatus.${status}`) }}
  </UBadge>
</template>
