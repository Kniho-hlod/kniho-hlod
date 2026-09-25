<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { LoanStatus } from '@kniho-hlod/domain';

type BadgeColor = 'neutral' | 'warning' | 'error' | 'success';

const STATUS_COLORS: Record<LoanStatus, BadgeColor> = {
  active: 'neutral',
  dueSoon: 'warning',
  overdue: 'error',
  returned: 'success',
};

defineProps<{ status: LoanStatus }>();

const { t } = useI18n();
</script>

<template>
  <UBadge :color="STATUS_COLORS[status]" variant="subtle">
    {{ t(`loans.status.${status}`) }}
  </UBadge>
</template>
