<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import type { AdminStats } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { useAdminStats } from '@/features/admin/api';

interface StatTile {
  key: keyof AdminStats;
  icon: string;
}

interface Section {
  key: 'users' | 'announcements';
  icon: string;
  to: RouteLocationRaw;
}

const STAT_TILES: StatTile[] = [
  { key: 'users', icon: 'i-lucide-users' },
  { key: 'newUsers', icon: 'i-lucide-user-plus' },
  { key: 'books', icon: 'i-lucide-library' },
  { key: 'lent', icon: 'i-lucide-hand-helping' },
  { key: 'overdue', icon: 'i-lucide-alarm-clock' },
  { key: 'remindersOn', icon: 'i-lucide-mail' },
];

const SECTIONS: Section[] = [
  { key: 'users', icon: 'i-lucide-users', to: { name: 'admin-users' } },
  { key: 'announcements', icon: 'i-lucide-megaphone', to: { name: 'announcements' } },
];

const { t } = useI18n();
const { data: stats, error, isPending } = useAdminStats();
</script>

<template>
  <section class="flex flex-col gap-6">
    <h1 class="text-3xl font-extrabold text-highlighted">{{ t('admin.title') }}</h1>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <li
        v-for="tile in STAT_TILES"
        :key="tile.key"
        class="flex flex-col justify-between gap-3 rounded-xl bg-default p-4 ring-2 ring-line"
      >
        <span class="flex items-start justify-between gap-2 text-sm font-semibold text-toned">
          {{ t(`admin.stats.${tile.key}`) }}
          <UIcon :name="tile.icon" class="size-5 shrink-0" />
        </span>
        <USkeleton v-if="isPending" class="h-9 w-12" />
        <span v-else class="font-display text-4xl leading-none font-extrabold text-highlighted">
          {{ stats?.[tile.key] ?? 0 }}
        </span>
      </li>
    </ul>

    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <li v-for="section in SECTIONS" :key="section.key">
        <RouterLink
          :to="section.to"
          class="group flex items-center gap-3 rounded-xl bg-default p-4 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          <UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
