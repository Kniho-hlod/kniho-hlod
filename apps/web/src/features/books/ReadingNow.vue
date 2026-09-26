<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { useBooksBeingRead } from './api';
import BookCover from './BookCover.vue';

/** The books the reader has open right now, for the dashboard; nothing when there are none. */
const { t } = useI18n();
const { data } = useBooksBeingRead();
const books = computed(() => data.value?.data ?? []);
</script>

<template>
  <section v-if="books.length > 0" class="flex flex-col gap-3">
    <h2 class="text-xl font-bold text-highlighted">{{ t('home.readingNow') }}</h2>
    <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4">
      <li v-for="book in books" :key="book.id">
        <RouterLink
          :to="{ name: 'book', params: { id: book.id } }"
          class="group flex flex-col gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <div
            class="rounded-lg transition-[translate,box-shadow] duration-150 group-hover:-translate-y-1 group-hover:shadow-pop"
          >
            <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
          </div>
          <div class="flex min-w-0 flex-col">
            <p
              class="line-clamp-2 font-display text-sm leading-tight font-bold text-highlighted group-hover:text-primary"
            >
              {{ book.title }}
            </p>
            <p v-if="book.startedAt" class="text-xs text-muted">
              {{ t('books.readingSince', { date: formatDate(book.startedAt) }) }}
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
