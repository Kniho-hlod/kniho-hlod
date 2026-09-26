<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import type { FriendBook } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import BookCover from '@/features/books/BookCover.vue';
import RatingStars from '@/features/books/RatingStars.vue';
import ReadingStatusBadge from '@/features/books/ReadingStatusBadge.vue';

/** A book in a friend's library: cover, title, how they read it, and whether it is lent. */
const props = defineProps<{ book: FriendBook; friendId: string }>();

const { t } = useI18n();
/** A book not started shows no status. */
const readingStatus = computed(() =>
  props.book.readingStatus === DEFAULT_READING_STATUS ? null : props.book.readingStatus
);
</script>

<template>
  <RouterLink
    :to="{ name: 'friend-book', params: { userId: friendId, bookId: book.id } }"
    class="group flex flex-col gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
  >
    <div
      class="relative rounded-lg transition-[translate,box-shadow] duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-1 group-hover:shadow-pop"
    >
      <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
      <span
        v-if="book.lent"
        class="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 text-xs font-bold text-yellow-300 ring-2 ring-yellow-300"
      >
        <UIcon name="i-lucide-hand-helping" class="size-3.5 shrink-0" />
        {{ t('books.lent') }}
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
        <ReadingStatusBadge v-if="readingStatus" :status="readingStatus" reader="friend" />
        <RatingStars v-if="book.rating" :rating="book.rating" display="score" />
      </div>
    </div>
  </RouterLink>
</template>
