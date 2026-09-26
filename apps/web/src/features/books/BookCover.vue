<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import GeneratedCover from './GeneratedCover.vue';

defineProps<{
  /** The image to show; without one, a cover is drawn from the title. */
  url: string | undefined;
  title: string;
  author?: string | null;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="aspect-[2/3] w-full overflow-hidden rounded-lg bg-elevated ring-2 ring-line">
    <img
      v-if="url"
      :src="url"
      :alt="t('books.coverOf', { title })"
      class="size-full object-cover"
      loading="lazy"
      decoding="async"
    />
    <GeneratedCover v-else :title="title" :author="author" size="cover" />
  </div>
</template>
