<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { useBooksBeingRead } from './api';
import BookThumbnail from './BookThumbnail.vue';

/** The books the reader has open right now, for the dashboard; nothing when there are none. */
const { t } = useI18n();
const { data } = useBooksBeingRead();
const books = computed(() => data.value?.data ?? []);
</script>

<template>
  <section v-if="books.length > 0" class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold text-highlighted">{{ t('home.readingNow') }}</h2>
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="book in books" :key="book.id">
        <RouterLink
          :to="{ name: 'book', params: { id: book.id } }"
          class="flex items-center gap-3 rounded-lg p-2 ring ring-default hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <BookThumbnail :url="fileUrl(book.cover)" :title="book.title" />
          <div class="flex min-w-0 flex-col">
            <p class="truncate font-medium text-highlighted">{{ book.title }}</p>
            <p v-if="book.author" class="truncate text-sm text-muted">{{ book.author }}</p>
            <p v-if="book.startedAt" class="text-xs text-muted">
              {{ t('books.readingSince', { date: formatDate(book.startedAt) }) }}
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
