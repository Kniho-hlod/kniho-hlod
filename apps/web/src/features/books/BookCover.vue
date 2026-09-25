<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  /** The image to show; without one, a placeholder with the title stands in. */
  url: string | undefined;
  title: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="aspect-[2/3] w-full overflow-hidden rounded-md bg-elevated ring ring-default">
    <img
      v-if="url"
      :src="url"
      :alt="t('books.coverOf', { title })"
      class="size-full object-cover"
      loading="lazy"
      decoding="async"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted"
    >
      <UIcon name="i-lucide-book" class="size-8" />
      <span class="line-clamp-3 text-xs">{{ title }}</span>
    </div>
  </div>
</template>
