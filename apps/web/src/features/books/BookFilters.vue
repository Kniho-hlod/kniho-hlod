<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RATING_MAX, RATING_MIN, READING_STATUSES } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import type { Availability, BookListFilters } from './api';

/** Searching waits for a pause in typing, so each keystroke doesn't fire a request. */
const SEARCH_DELAY_MS = 300;
/** The select value meaning "no filter". */
const ANY = 'any';
const RATINGS_FROM_BEST = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, index) => RATING_MAX - index
);

const filters = defineModel<BookListFilters>({ required: true });

const { t } = useI18n();

const search = ref(filters.value.q);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(search, (text) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filters.value = { ...filters.value, q: text };
  }, SEARCH_DELAY_MS);
});

onBeforeUnmount(() => clearTimeout(searchTimer));

const statusItems = computed(() => [
  { label: t('books.anyStatus'), value: ANY },
  ...READING_STATUSES.map((status) => ({
    label: t(`books.readingStatus.${status}`),
    value: status,
  })),
]);

const AVAILABILITIES: Availability[] = ['home', 'lent'];

const availabilityItems = computed(() => [
  { label: t('books.availability.any'), value: ANY },
  ...AVAILABILITIES.map((availability) => ({
    label: t(`books.availability.${availability}`),
    value: availability,
  })),
]);

const ratingItems = computed(() => [
  { label: t('books.anyRating'), value: ANY },
  ...RATINGS_FROM_BEST.map((rating) => ({
    label: t('books.ratingAtLeast', { rating }),
    value: String(rating),
  })),
]);

const readingStatus = computed({
  get: () => filters.value.readingStatus ?? ANY,
  set: (value: string) => {
    const status = value === ANY ? null : (value as ReadingStatus);
    filters.value = { ...filters.value, readingStatus: status };
  },
});

const availability = computed({
  get: () => filters.value.availability ?? ANY,
  set: (value: string) => {
    filters.value = {
      ...filters.value,
      availability: value === ANY ? null : (value as Availability),
    };
  },
});

const minRating = computed({
  get: () => (filters.value.minRating === null ? ANY : String(filters.value.minRating)),
  set: (value: string) => {
    filters.value = { ...filters.value, minRating: value === ANY ? null : Number(value) };
  },
});
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
    <UInput
      v-model="search"
      type="search"
      icon="i-lucide-search"
      :placeholder="t('books.search')"
      :aria-label="t('books.search')"
      class="sm:basis-full lg:flex-1 lg:basis-0"
    />
    <USelect
      v-model="readingStatus"
      :items="statusItems"
      :aria-label="t('books.fields.readingStatus')"
      class="sm:flex-1 lg:w-44 lg:flex-none"
    />
    <USelect
      v-model="minRating"
      :items="ratingItems"
      :aria-label="t('books.fields.rating')"
      class="sm:flex-1 lg:w-44 lg:flex-none"
    />
    <USelect
      v-model="availability"
      :items="availabilityItems"
      :aria-label="t('books.availability.label')"
      class="sm:flex-1 lg:w-44 lg:flex-none"
    />
  </div>
</template>
