<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import type { AdminStats } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { useAdminStats } from '@/features/admin/api';

/** A headline number: big, with what it is out of underneath. */
interface Highlight {
  key: keyof AdminStats;
  icon: string;
  /** The total the number is a share of, shown as "x % of …". */
  outOf?: keyof AdminStats;
}

/** A card of related numbers, one per row. */
interface StatGroup {
  key: 'readers' | 'library' | 'friends';
  icon: string;
  rows: (keyof AdminStats)[];
  /** A row whose number wants attention when it isn't zero. */
  alert?: keyof AdminStats;
}

interface Section {
  key: 'users' | 'announcements' | 'feedback';
  icon: string;
  to: RouteLocationRaw;
  /** The stat counting what waits for an administrator there, shown as a badge. */
  waiting?: keyof AdminStats;
}

const HIGHLIGHTS: Highlight[] = [
  { key: 'activeUsers', icon: 'i-lucide-activity', outOf: 'users' },
  { key: 'returningUsers', icon: 'i-lucide-repeat', outOf: 'activeUsers' },
  { key: 'activatedUsers', icon: 'i-lucide-book-check', outOf: 'users' },
  { key: 'newUsers', icon: 'i-lucide-user-plus' },
];

const STAT_GROUPS: StatGroup[] = [
  { key: 'readers', icon: 'i-lucide-users', rows: ['users', 'admins', 'remindersOn'] },
  {
    key: 'library',
    icon: 'i-lucide-library',
    rows: ['books', 'contacts', 'newLoans', 'lent', 'overdue'],
    alert: 'overdue',
  },
  { key: 'friends', icon: 'i-lucide-handshake', rows: ['inviters', 'friendships', 'loanRequests'] },
];

const SECTIONS: Section[] = [
  { key: 'users', icon: 'i-lucide-users', to: { name: 'admin-users' } },
  { key: 'announcements', icon: 'i-lucide-megaphone', to: { name: 'announcements' } },
  {
    key: 'feedback',
    icon: 'i-lucide-message-square-warning',
    to: { name: 'admin-feedback' },
    waiting: 'newFeedback',
  },
];

const { t } = useI18n();
const { data: stats, error, isPending } = useAdminStats();

function count(key: keyof AdminStats): number {
  return stats.value?.[key] ?? 0;
}

/** "x % of …" under a headline number; nothing while the total is zero. */
function share(highlight: Highlight): string | undefined {
  if (!highlight.outOf) return undefined;
  const total = count(highlight.outOf);
  if (total === 0) return undefined;
  return t(`admin.shareOf.${highlight.outOf}`, {
    percent: Math.round((count(highlight.key) / total) * 100),
  });
}

function waitingCount(section: Section): number {
  return section.waiting ? (stats.value?.[section.waiting] ?? 0) : 0;
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <h1 class="text-3xl font-extrabold text-highlighted">{{ t('admin.title') }}</h1>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <section class="flex flex-col gap-3" aria-labelledby="admin-usage">
      <div class="flex flex-col gap-1">
        <h2 id="admin-usage" class="font-display text-xl font-bold text-highlighted">
          {{ t('admin.usage.title') }}
        </h2>
        <p class="text-sm text-muted">{{ t('admin.usage.hint') }}</p>
      </div>
      <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li
          v-for="highlight in HIGHLIGHTS"
          :key="highlight.key"
          class="flex flex-col gap-2 rounded-xl bg-default p-4 ring-2 ring-line"
        >
          <span class="flex items-start justify-between gap-2 text-sm font-semibold text-toned">
            {{ t(`admin.stats.${highlight.key}`) }}
            <UIcon :name="highlight.icon" class="size-5 shrink-0" />
          </span>
          <USkeleton v-if="isPending" class="h-9 w-12" />
          <span v-else class="font-display text-4xl leading-none font-extrabold text-highlighted">
            {{ count(highlight.key) }}
          </span>
          <span v-if="!isPending && share(highlight)" class="text-xs text-muted">
            {{ share(highlight) }}
          </span>
        </li>
      </ul>
    </section>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <section
        v-for="group in STAT_GROUPS"
        :key="group.key"
        class="flex flex-col gap-2 rounded-xl bg-default p-4 ring-2 ring-line"
        :aria-labelledby="`admin-stats-${group.key}`"
      >
        <h2
          :id="`admin-stats-${group.key}`"
          class="flex items-center gap-2 font-display font-bold text-highlighted"
        >
          <UIcon :name="group.icon" class="size-5 text-toned" />
          {{ t(`admin.groups.${group.key}`) }}
        </h2>
        <dl class="flex flex-col divide-y-2 divide-line/10">
          <div
            v-for="row in group.rows"
            :key="row"
            class="flex items-baseline justify-between gap-3 py-1.5"
          >
            <dt class="text-sm text-toned">{{ t(`admin.stats.${row}`) }}</dt>
            <dd>
              <USkeleton v-if="isPending" class="h-5 w-8" />
              <span
                v-else
                class="font-display text-lg font-bold"
                :class="row === group.alert && count(row) > 0 ? 'text-error' : 'text-highlighted'"
              >
                {{ count(row) }}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="section in SECTIONS" :key="section.key">
        <RouterLink
          :to="section.to"
          class="group flex h-full items-center gap-3 rounded-xl bg-default p-4 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-yellow-300 text-ink-900"
          >
            <UIcon :name="section.icon" class="size-5" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="font-display font-bold text-highlighted group-hover:text-primary">
              {{ t(`admin.sections.${section.key}.title`) }}
            </span>
            <span class="text-sm text-muted">
              {{ t(`admin.sections.${section.key}.hint`) }}
            </span>
          </span>
          <span
            v-if="waitingCount(section) > 0"
            class="grid min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-xs leading-6 font-bold text-white ring-2 ring-line"
            :aria-label="t('admin.feedback.newCount', waitingCount(section))"
          >
            {{ waitingCount(section) }}
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
