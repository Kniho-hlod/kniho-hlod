<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import { addDays } from '@eleansphere/schema';
import { DUE_SOON_DAYS } from '@kniho-hlod/domain';
import type { LibraryStats } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import InstallAppCard from '@/components/InstallAppCard.vue';
import { useSessionStore } from '@/features/auth/session-store';
import ReadingNow from '@/features/books/ReadingNow.vue';
import { useLibraryStats } from '@/features/loans/api';
import LoanList from '@/features/loans/LoanList.vue';
import { useToday } from '@/features/loans/use-today';

type StatKey = keyof Pick<LibraryStats, 'books' | 'reading' | 'lent' | 'overdue'>;

interface StatTile {
  key: StatKey;
  icon: string;
  to: RouteLocationRaw;
}

/** Literal Tailwind classes: each count has its own colour, in both modes. */
const TILE_COLORS: Record<StatKey, string> = {
  books: 'bg-indigo-200 text-indigo-950 dark:bg-indigo-400/25 dark:text-indigo-50',
  reading: 'bg-orange-200 text-orange-950 dark:bg-orange-400/25 dark:text-orange-50',
  lent: 'bg-sky-200 text-sky-950 dark:bg-sky-400/25 dark:text-sky-50',
  overdue: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-400/25 dark:text-emerald-50',
};
const ALARM_COLORS = 'bg-rose-500 text-white';

const STAT_TILES: StatTile[] = [
  { key: 'books', icon: 'i-lucide-library', to: { name: 'books' } },
  { key: 'reading', icon: 'i-lucide-book-open', to: { name: 'books' } },
  { key: 'lent', icon: 'i-lucide-hand-helping', to: { name: 'loans' } },
  { key: 'overdue', icon: 'i-lucide-alarm-clock', to: { name: 'loans' } },
];

const { t } = useI18n();
const session = useSessionStore();
const today = useToday();

/** The greeting is friendly: the first name, not the whole of it. */
const firstName = computed(() => session.user?.displayName.trim().split(/\s+/)[0] ?? '');

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

/** "Not now" on the install offer holds on this device; the account page still offers it. */
const INSTALL_OFFER_DISMISSED_KEY = 'kniho-hlod.install-offer-dismissed';

function readInstallOfferDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_OFFER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

const isInstallOfferDismissed = ref(readInstallOfferDismissed());

function dismissInstallOffer(): void {
  isInstallOfferDismissed.value = true;
  try {
    localStorage.setItem(INSTALL_OFFER_DISMISSED_KEY, 'true');
  } catch {
    // Without storage the offer simply comes back next time.
  }
}
</script>

<template>
  <section class="flex flex-col gap-8">
    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold text-highlighted lg:text-4xl">
        {{ t('home.welcome', { name: firstName }) }}
      </h1>
      <p class="text-toned">{{ t('home.welcomeHint') }}</p>
    </header>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <li v-for="tile in STAT_TILES" :key="tile.key">
        <RouterLink
          :to="tile.to"
          class="flex min-h-28 flex-col justify-between gap-3 rounded-xl p-4 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="isAlarming(tile) ? ALARM_COLORS : TILE_COLORS[tile.key]"
        >
          <span class="flex items-start justify-between gap-2 text-sm font-semibold">
            {{ t(`home.stats.${tile.key}`) }}
            <UIcon :name="tile.icon" class="size-5 shrink-0" />
          </span>
          <USkeleton v-if="isPending" class="h-9 w-12 bg-white/50" />
          <span v-else class="font-display text-4xl leading-none font-extrabold">
            {{ stats?.[tile.key] ?? 0 }}
          </span>
        </RouterLink>
      </li>
    </ul>

    <EmptyState
      v-if="stats && !hasBooks"
      icon="i-lucide-book-plus"
      :title="t('home.emptyTitle')"
      :description="t('home.empty')"
    >
      <UButton :to="{ name: 'book-new' }" icon="i-lucide-plus">{{ t('books.add') }}</UButton>
    </EmptyState>

    <section v-else-if="stats" class="flex flex-col gap-3">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-bold text-highlighted">
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
      <p
        v-else
        class="flex items-center gap-3 rounded-xl bg-default p-4 text-toned ring-2 ring-line/15"
      >
        <UIcon name="i-lucide-party-popper" class="size-5 shrink-0 text-secondary" />
        {{ t('home.nothingDue') }}
      </p>
    </section>

    <ReadingNow v-if="hasBooks" />

    <InstallAppCard v-if="!isInstallOfferDismissed">
      <template #actions>
        <UButton color="neutral" variant="ghost" @click="dismissInstallOffer">
          {{ t('install.notNow') }}
        </UButton>
      </template>
    </InstallAppCard>
  </section>
</template>
