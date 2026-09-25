<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import { addDays } from '@eleansphere/schema';
import { DUE_SOON_DAYS } from '@kniho-hlod/domain';
import type { LibraryStats } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';
import { useLibraryStats } from '@/features/loans/api';
import LoanList from '@/features/loans/LoanList.vue';
import { useToday } from '@/features/loans/use-today';

type StatKey = keyof Pick<LibraryStats, 'books' | 'reading' | 'lent' | 'overdue'>;

interface StatTile {
  key: StatKey;
  icon: string;
  to: RouteLocationRaw;
}

const STAT_TILES: StatTile[] = [
  { key: 'books', icon: 'i-lucide-library', to: { name: 'books' } },
  { key: 'reading', icon: 'i-lucide-book-open', to: { name: 'books' } },
  { key: 'lent', icon: 'i-lucide-hand-helping', to: { name: 'loans' } },
  { key: 'overdue', icon: 'i-lucide-alarm-clock', to: { name: 'loans' } },
];

const { t } = useI18n();
const session = useSessionStore();
const today = useToday();

const { data: stats, error, isPending } = useLibraryStats();
const hasBooks = computed(() => (stats.value?.books ?? 0) > 0);
const hasLoansDue = computed(() => (stats.value?.overdue ?? 0) + (stats.value?.dueSoon ?? 0) > 0);

/** Overdue and due-soon loans: everything due by the end of the due-soon window. */
const dueFilters = computed(() => ({
  state: 'active' as const,
  dueBy: addDays(today.value, DUE_SOON_DAYS),
}));

function isAlarming(tile: StatTile): boolean {
  return tile.key === 'overdue' && (stats.value?.overdue ?? 0) > 0;
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold text-highlighted">
      {{ t('home.welcome', { name: session.user?.displayName ?? '' }) }}
    </h1>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li v-for="tile in STAT_TILES" :key="tile.key">
        <RouterLink
          :to="tile.to"
          class="flex flex-col gap-1 rounded-lg p-4 ring hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
          :class="isAlarming(tile) ? 'bg-error/5 ring-error/50' : 'ring-default'"
        >
          <span class="flex items-center gap-2 text-sm text-muted">
            <UIcon :name="tile.icon" class="size-4" :class="{ 'text-error': isAlarming(tile) }" />
            {{ t(`home.stats.${tile.key}`) }}
          </span>
          <USkeleton v-if="isPending" class="h-8 w-12" />
          <span
            v-else
            class="text-2xl font-semibold"
            :class="isAlarming(tile) ? 'text-error' : 'text-highlighted'"
          >
            {{ stats?.[tile.key] ?? 0 }}
          </span>
        </RouterLink>
      </li>
    </ul>

    <UCard v-if="stats && !hasBooks">
      <div class="flex flex-col items-start gap-3">
        <UIcon name="i-lucide-book-open" class="size-8 text-primary" />
        <p class="text-muted">{{ t('home.empty') }}</p>
        <UButton :to="{ name: 'book-new' }" icon="i-lucide-plus">{{ t('books.add') }}</UButton>
      </div>
    </UCard>

    <section v-else-if="stats" class="flex flex-col gap-3">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ t('home.dueBack') }}
        </h2>
        <div class="flex gap-2">
          <UButton :to="{ name: 'loans' }" color="neutral" variant="ghost" size="sm">
            {{ t('home.allLoans') }}
          </UButton>
          <UButton :to="{ name: 'loan-new' }" icon="i-lucide-hand-helping" size="sm">
            {{ t('loans.lend') }}
          </UButton>
        </div>
      </header>
      <LoanList v-if="hasLoansDue" :filters="dueFilters" :empty-text="t('home.nothingDue')" />
      <p v-else class="text-muted">{{ t('home.nothingDue') }}</p>
    </section>
  </section>
</template>
