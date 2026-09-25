<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  /** The cover to show; without one, a book icon stands in. */
  url: string | undefined;
  title: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-elevated ring ring-default"
  >
    <img
      v-if="url"
      :src="url"
      :alt="t('books.coverOf', { title })"
      class="size-full object-cover"
      loading="lazy"
      decoding="async"
    />
    <UIcon v-else name="i-lucide-book" class="size-5 text-muted" />
  </div>
</template>
