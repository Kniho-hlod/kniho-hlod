<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { READING_STATUSES } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import { NO_BOOK_FILTERS, useBookList } from '@/features/books/api';
import type { BookListFilters } from '@/features/books/api';
import BookCard from '@/features/books/BookCard.vue';
import BookFilters from '@/features/books/BookFilters.vue';
import BookCheckDialog from '@/features/books/BookCheckDialog.vue';
import LibraryQuickStart from '@/features/library-import/LibraryQuickStart.vue';
import { canUseCamera } from '@/features/scanner/camera-support';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';
import ShelfTabs from '@/features/shelves/ShelfTabs.vue';
import { useOnVisible } from '@/shared/use-on-visible';

const SKELETON_COUNT = 8;
/** The quick start (import, shelf scan) shows while the library is smaller than this. */
const QUICK_START_UNTIL = 30;
const QUICK_START_DISMISSED_KEY = 'kniho-hlod:quick-start-dismissed';

const { t } = useI18n();
const route = useRoute();
const canScan = canUseCamera();
const isCheckingBook = ref(false);

/** Several books at once: from a file, or the shelf scan where there is a camera. */
const bulkItems = computed(() => [
  {
    label: t('libraryQuickStart.import.title'),
    icon: 'i-lucide-file-spreadsheet',
    to: { name: 'book-import' },
  },
  ...(canScan
    ? [
        {
          label: t('libraryQuickStart.scan.title'),
          icon: 'i-lucide-scan-line',
          to: { name: 'shelf-scan' },
        },
      ]
    : []),
]);

function readQuickStartDismissed(): boolean {
  try {
    return localStorage.getItem(QUICK_START_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
const isQuickStartDismissed = ref(readQuickStartDismissed());

function dismissQuickStart(): void {
  isQuickStartDismissed.value = true;
  try {
    localStorage.setItem(QUICK_START_DISMISSED_KEY, '1');
  } catch {
    // Without storage the card stays hidden until the next visit.
  }
}

/** `?status=reading` opens the list filtered, as the dashboard's "reading" tile links it. */
function statusFromQuery(value: unknown): ReadingStatus | null {
  return READING_STATUSES.find((status) => status === value) ?? null;
}

const filters = ref<BookListFilters>({
  ...NO_BOOK_FILTERS,
  readingStatus: statusFromQuery(route.query.status),
});
watch(
  () => route.query.status,
  (status) => {
    filters.value = { ...filters.value, readingStatus: statusFromQuery(status) };
  }
);
/** The shelf lives in the address (`?shelf=`), so a shelf can be linked to and gone back to. */
const shelfId = computed(() => (typeof route.query.shelf === 'string' ? route.query.shelf : null));
const listFilters = computed<BookListFilters>(() => ({ ...filters.value, shelfId: shelfId.value }));
const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useBookList(listFilters);

const books = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);
const total = computed(() => data.value?.pages[0]?.total ?? 0);
/** Whether the search or a filter below the shelves narrows the list. */
const isSearched = computed(
  () =>
    filters.value.q.trim() !== '' ||
    filters.value.readingStatus !== null ||
    filters.value.minRating !== null ||
    filters.value.availability !== null
);
const isFiltered = computed(() => isSearched.value || shelfId.value !== null);
const showsQuickStart = computed(
  () => !isQuickStartDismissed.value && !isFiltered.value && total.value < QUICK_START_UNTIL
);
const emptyText = computed(() => {
  if (shelfId.value !== null && !isSearched.value) return t('shelves.emptyShelf');
  return isFiltered.value ? t('books.emptyFiltered') : t('books.empty');
});

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('books.title') }}</h1>
      <!-- On a phone the actions line up in a grid of two columns, the scans first. -->
      <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <UButton
          v-if="canScan"
          icon="i-lucide-scan-search"
          color="neutral"
          variant="outline"
          class="justify-center"
          @click="isCheckingBook = true"
        >
          {{ t('bookCheck.button') }}
        </UButton>
        <UButton
          v-if="canScan"
          :to="{ name: 'book-new', query: { scan: '1' } }"
          icon="i-lucide-scan-barcode"
          color="neutral"
          variant="outline"
          class="justify-center"
        >
          {{ t('scanner.scan') }}
        </UButton>
        <UDropdownMenu :items="bulkItems">
          <UButton
            icon="i-lucide-layers"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="outline"
            class="w-full justify-center sm:w-auto"
          >
            {{ t('books.addInBulk') }}
          </UButton>
        </UDropdownMenu>
        <UButton
          :to="{ name: 'book-new' }"
          icon="i-lucide-plus"
          class="justify-center"
          :data-tour="TOUR_TARGETS.addBook"
        >
          {{ t('books.add') }}
        </UButton>
      </div>
    </header>

    <ShelfTabs :active-shelf-id="shelfId" />

    <BookFilters v-model="filters" />

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul
      v-else-if="isPending"
      class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5"
    >
      <li v-for="index in SKELETON_COUNT" :key="index" class="flex flex-col gap-2">
        <USkeleton class="aspect-[2/3] w-full rounded-lg" />
        <USkeleton class="h-4 w-3/4" />
      </li>
    </ul>

    <EmptyState
      v-else-if="books.length === 0"
      :icon="isFiltered ? 'i-lucide-search-x' : 'i-lucide-library'"
      :title="emptyText"
    >
      <template v-if="!isFiltered">
        <UButton :to="{ name: 'book-new' }" icon="i-lucide-plus">
          {{ t('books.add') }}
        </UButton>
        <UButton
          :to="{ name: 'book-import' }"
          icon="i-lucide-file-up"
          color="neutral"
          variant="outline"
        >
          {{ t('libraryImport.button') }}
        </UButton>
        <UButton
          v-if="canScan"
          :to="{ name: 'shelf-scan' }"
          icon="i-lucide-scan-line"
          color="neutral"
          variant="outline"
        >
          {{ t('shelfScan.button') }}
        </UButton>
      </template>
    </EmptyState>

    <template v-else>
      <LibraryQuickStart v-if="showsQuickStart" :can-scan="canScan" @dismiss="dismissQuickStart" />
      <p class="text-sm text-muted">{{ t('books.total', { count: total }) }}</p>
      <ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
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

    <BookCheckDialog v-if="canScan" v-model:open="isCheckingBook" />
  </section>
</template>
