<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';

interface QuickStartTile {
  key: 'import' | 'scan';
  icon: string;
  to: RouteLocationRaw;
}

/** Whether the device has a camera for the shelf scan; without one only the import is offered. */
const props = defineProps<{ canScan: boolean }>();
const emit = defineEmits<{ dismiss: [] }>();

const TILE_COLORS: Record<QuickStartTile['key'], string> = {
  import: 'bg-indigo-200 text-indigo-950 dark:bg-indigo-400/25 dark:text-indigo-50',
  scan: 'bg-orange-200 text-orange-950 dark:bg-orange-400/25 dark:text-orange-50',
};

const { t } = useI18n();

const tiles: QuickStartTile[] = [
  { key: 'import', icon: 'i-lucide-file-spreadsheet', to: { name: 'book-import' } },
  ...(props.canScan
    ? [{ key: 'scan' as const, icon: 'i-lucide-scan-line', to: { name: 'shelf-scan' } }]
    : []),
];
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-xl bg-default p-4 ring-2 ring-line"
    aria-labelledby="quick-start-title"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex flex-col gap-0.5">
        <h2 id="quick-start-title" class="font-display text-lg font-bold text-highlighted">
          {{ t('libraryQuickStart.title') }}
        </h2>
        <p class="text-sm text-toned">{{ t('libraryQuickStart.intro') }}</p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('libraryQuickStart.dismiss')"
        @click="emit('dismiss')"
      />
    </div>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <li v-for="tile in tiles" :key="tile.key">
        <RouterLink
          :to="tile.to"
          class="flex h-full items-start gap-3 rounded-xl p-4 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="TILE_COLORS[tile.key]"
        >
          <UIcon :name="tile.icon" class="mt-0.5 size-6 shrink-0" />
          <span class="flex flex-col gap-0.5">
            <span class="font-display font-bold">{{
              t(`libraryQuickStart.${tile.key}.title`)
            }}</span>
            <span class="text-sm opacity-80">{{ t(`libraryQuickStart.${tile.key}.text`) }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
