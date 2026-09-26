<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BookWithDetails } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import BookCover from './BookCover.vue';
import RatingStars from './RatingStars.vue';
import ReadingStatusBadge from './ReadingStatusBadge.vue';

const props = defineProps<{ book: BookWithDetails }>();

const { t } = useI18n();

const readingStatus = computed(() =>
  props.book.readingStatus && props.book.readingStatus !== 'none' ? props.book.readingStatus : null
);
</script>

<template>
  <RouterLink
    :to="{ name: 'book', params: { id: book.id } }"
    class="group flex flex-col gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
  >
    <div
      class="relative rounded-lg transition-[translate,box-shadow] duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-1 group-hover:shadow-pop"
    >
      <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
      <span
        v-if="book.activeLoan"
        class="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 text-xs font-bold text-yellow-300 ring-2 ring-yellow-300"
        :title="t('loans.lentTo', { name: book.activeLoan.contact.name })"
      >
        <UIcon name="i-lucide-hand-helping" class="size-3.5 shrink-0" />
        <span class="truncate">{{ t('books.lent') }}</span>
      </span>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <p
        class="line-clamp-2 font-display leading-tight font-bold text-highlighted group-hover:text-primary"
      >
        {{ book.title }}
      </p>
      <p v-if="book.author" class="truncate text-sm text-muted">{{ book.author }}</p>
      <div v-if="readingStatus || book.rating" class="flex flex-wrap items-center gap-2 pt-0.5">
        <ReadingStatusBadge v-if="readingStatus" :status="readingStatus" />
        <RatingStars v-if="book.rating" :rating="book.rating" display="score" />
      </div>
    </div>
  </RouterLink>
</template>
