<script setup lang="ts">
/** A review for friends, as a quote; `by` names who wrote it when it isn't the page's own book. */
defineProps<{ text: string; by?: string }>();
</script>

<template>
  <figure class="flex flex-col gap-1 border-l-4 border-secondary pl-3">
    <blockquote class="whitespace-pre-line text-default italic">{{ text }}</blockquote>
    <figcaption v-if="by" class="text-xs font-semibold text-muted">{{ by }}</figcaption>
  </figure>
</template>
