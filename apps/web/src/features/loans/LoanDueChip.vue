<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LoanDue } from './loan-due';

interface ChipStyle {
  icon: string;
  /** Literal Tailwind classes for the chip's colours in both modes. */
  classes: string;
}

const CHIP_STYLES: Record<LoanDue['status'], ChipStyle> = {
  overdue: { icon: 'i-lucide-alarm-clock', classes: 'bg-rose-500 text-white ring-2 ring-line' },
  dueSoon: { icon: 'i-lucide-clock', classes: 'bg-yellow-300 text-ink-900 ring-2 ring-line' },
  active: { icon: 'i-lucide-calendar', classes: 'bg-elevated text-toned' },
  returned: {
    icon: 'i-lucide-check',
    classes: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-200',
  },
};

const props = defineProps<{ due: LoanDue }>();

const { t } = useI18n();

const label = computed(() => {
  const { due } = props;
  switch (due.status) {
    case 'returned':
      return t('loans.status.returned');
    case 'overdue':
      return t('loans.due.overdue', due.daysOverdue);
    default:
      return due.daysLeft === null ? t('loans.due.none') : t('loans.due.in', due.daysLeft);
  }
});
</script>

<template>
  <UBadge
    color="neutral"
    variant="soft"
    :icon="CHIP_STYLES[due.status].icon"
    :class="CHIP_STYLES[due.status].classes"
  >
    {{ label }}
  </UBadge>
</template>
