<script setup lang="ts">
import { computed } from 'vue';
import type { BookWithCover } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import BookCover from './BookCover.vue';
import RatingStars from './RatingStars.vue';
import ReadingStatusBadge from './ReadingStatusBadge.vue';

const props = defineProps<{ book: BookWithCover }>();

const readingStatus = computed(() =>
  props.book.readingStatus && props.book.readingStatus !== 'none' ? props.book.readingStatus : null
);
</script>

<template>
  <RouterLink
    :to="{ name: 'book', params: { id: book.id } }"
    class="group flex flex-col gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
  >
    <BookCover :url="fileUrl(book.cover)" :title="book.title" />
    <div class="flex min-w-0 flex-col gap-1">
      <p class="line-clamp-2 font-medium text-highlighted group-hover:text-primary">
        {{ book.title }}
      </p>
      <p v-if="book.author" class="truncate text-sm text-muted">{{ book.author }}</p>
      <div v-if="readingStatus || book.rating" class="flex flex-wrap items-center gap-2">
        <ReadingStatusBadge v-if="readingStatus" :status="readingStatus" />
        <RatingStars v-if="book.rating" :rating="book.rating" />
      </div>
    </div>
  </RouterLink>
</template>
