<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import { useShelves } from './api';
import ShelfDot from './ShelfDot.vue';

/** The shelf the book list shows; `null` for all books. */
defineProps<{ activeShelfId: string | null }>();

const { t } = useI18n();
const { data: shelves } = useShelves();

const TAB_CLASSES =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ring-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const ACTIVE_TAB_CLASSES = 'bg-yellow-300 text-ink-900 ring-line';
const IDLE_TAB_CLASSES = 'bg-default text-default ring-line/15 hover:ring-line';

function shelfLink(shelfId: string | null): RouteLocationRaw {
  return shelfId ? { name: 'books', query: { shelf: shelfId } } : { name: 'books' };
}
</script>

<template>
  <!-- The page's side padding is bled into, so the row scrolls edge to edge on a phone. -->
  <nav :aria-label="t('shelves.title')" class="-mx-4 overflow-x-auto px-4">
    <ul class="flex w-max items-center gap-2 py-1.5">
      <li>
        <!-- `aria-current` set here wins over RouterLink's own, which ignores the query. -->
        <RouterLink
          :to="shelfLink(null)"
          :class="[TAB_CLASSES, activeShelfId === null ? ACTIVE_TAB_CLASSES : IDLE_TAB_CLASSES]"
          :aria-current="activeShelfId === null ? 'page' : 'false'"
        >
          {{ t('shelves.allBooks') }}
        </RouterLink>
      </li>
      <li v-for="shelf in shelves" :key="shelf.id">
        <RouterLink
          :to="shelfLink(shelf.id)"
          :class="[TAB_CLASSES, activeShelfId === shelf.id ? ACTIVE_TAB_CLASSES : IDLE_TAB_CLASSES]"
          :aria-current="activeShelfId === shelf.id ? 'page' : 'false'"
        >
          <ShelfDot :color="shelf.color" />
          {{ shelf.name }}
        </RouterLink>
      </li>
      <li>
        <UButton
          :to="{ name: 'shelves' }"
          icon="i-lucide-settings-2"
          color="neutral"
          variant="ghost"
          size="sm"
        >
          {{ shelves?.length ? t('shelves.manage') : t('shelves.createFirst') }}
        </UButton>
      </li>
    </ul>
  </nav>
</template>
