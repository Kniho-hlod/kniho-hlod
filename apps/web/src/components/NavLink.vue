<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

/**
 * When a link counts as the current page: `exact` only on its own page — every signed-in page
 * sits under home's `/`, so a looser match would light it up everywhere; `section` on its page and
 * the pages below it (a book's detail belongs to Books).
 */
export type NavigationMatch = 'exact' | 'section';

const props = defineProps<{ to: RouteLocationRaw; match: NavigationMatch }>();

function isCurrent(isActive: boolean, isExactActive: boolean): boolean {
  return props.match === 'exact' ? isExactActive : isActive;
}
</script>

<template>
  <!-- `data-active` lets the caller style the current item with Tailwind's `data-active:`. -->
  <RouterLink v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
    <a
      :href="href"
      :data-active="isCurrent(isActive, isExactActive) || undefined"
      :aria-current="isCurrent(isActive, isExactActive) ? 'page' : undefined"
      @click="navigate"
    >
      <slot />
    </a>
  </RouterLink>
</template>
