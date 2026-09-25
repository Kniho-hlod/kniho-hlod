<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import { NO_BOOK_FILTERS, useBookList } from '@/features/books/api';
import type { BookListFilters } from '@/features/books/api';
import BookCard from '@/features/books/BookCard.vue';
import BookFilters from '@/features/books/BookFilters.vue';
import { useOnVisible } from '@/shared/use-on-visible';

const SKELETON_COUNT = 8;

const { t } = useI18n();

const filters = ref<BookListFilters>({ ...NO_BOOK_FILTERS });
const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useBookList(filters);

const books = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);
const total = computed(() => data.value?.pages[0]?.total ?? 0);
const isFiltered = computed(
  () =>
    filters.value.q.trim() !== '' ||
    filters.value.readingStatus !== null ||
    filters.value.minRating !== null ||
    filters.value.availability !== null
);

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold text-highlighted">{{ t('books.title') }}</h1>
      <UButton :to="{ name: 'book-new' }" icon="i-lucide-plus">{{ t('books.add') }}</UButton>
    </header>

    <BookFilters v-model="filters" />

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="index in SKELETON_COUNT" :key="index" class="flex flex-col gap-2">
        <USkeleton class="aspect-[2/3] w-full" />
        <USkeleton class="h-4 w-3/4" />
      </li>
    </ul>

    <UCard v-else-if="books.length === 0">
      <div class="flex flex-col items-start gap-3">
        <UIcon name="i-lucide-library" class="size-8 text-primary" />
        <p class="text-muted">{{ isFiltered ? t('books.emptyFiltered') : t('books.empty') }}</p>
        <UButton v-if="!isFiltered" :to="{ name: 'book-new' }" icon="i-lucide-plus">
          {{ t('books.add') }}
        </UButton>
      </div>
    </UCard>

    <template v-else>
      <p class="text-sm text-muted">{{ t('books.total', { count: total }) }}</p>
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li v-for="book in books" :key="book.id">
          <BookCard :book="book" />
        </li>
      </ul>
      <div ref="listEnd" />
      <UButton
        v-if="hasNextPage"
        color="neutral"
        variant="subtle"
        block
        :loading="isFetchingNextPage"
        @click="loadMore"
      >
        {{ t('books.loadMore') }}
      </UButton>
    </template>
  </section>
</template>
