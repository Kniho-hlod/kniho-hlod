<script setup lang="ts">
import type { ShelfSummary } from '@kniho-hlod/domain';
import ShelfDot from './ShelfDot.vue';

/** A book's shelves, each a link to the books on it. */
defineProps<{ shelves: ShelfSummary[] }>();
</script>

<template>
  <ul class="flex flex-wrap gap-1.5">
    <li v-for="shelf in shelves" :key="shelf.id">
      <RouterLink
        :to="{ name: 'books', query: { shelf: shelf.id } }"
        class="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-0.5 text-xs font-medium text-default ring ring-default hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ShelfDot :color="shelf.color" />
        {{ shelf.name }}
      </RouterLink>
    </li>
  </ul>
</template>
