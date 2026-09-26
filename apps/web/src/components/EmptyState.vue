<script setup lang="ts">
/**
 * `page` when the emptiness is the page's main news (no books yet); `section` for a part of a page
 * that happens to be empty (a book's loan history), so it doesn't outshout the rest.
 */
export type EmptyStateSize = 'page' | 'section';

/** A place with nothing in it yet: what belongs here, and the way to add the first one. */
withDefaults(
  defineProps<{
    icon: string;
    title: string;
    description?: string;
    size?: EmptyStateSize;
  }>(),
  { description: undefined, size: 'page' }
);
</script>

<template>
  <div
    v-if="size === 'section'"
    class="flex items-center gap-3 rounded-xl border-2 border-dashed border-line/25 p-4"
  >
    <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-yellow-300 text-ink-900">
      <UIcon :name="icon" class="size-5" />
    </span>
    <div class="flex min-w-0 flex-col">
      <p class="font-semibold text-highlighted">{{ title }}</p>
      <p v-if="description" class="text-sm text-toned">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="ms-auto flex shrink-0 gap-2">
      <slot />
    </div>
  </div>

  <div
    v-else
    class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line/25 px-6 py-10 text-center"
  >
    <span
      class="mb-1 grid size-14 place-items-center rounded-xl bg-yellow-300 text-ink-900 shadow-pop-sm -rotate-6"
    >
      <UIcon :name="icon" class="size-7" />
    </span>
    <p class="font-display text-xl font-bold text-highlighted">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-toned">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
