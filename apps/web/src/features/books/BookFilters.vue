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
/** On phones and tablets the filters wait in a drawer; the search stays in view. */
const isDrawerOpen = ref(false);
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

/** How many of the filters beside the search narrow the list — shown on the drawer's button. */
const activeFilterCount = computed(
  () =>
    [filters.value.readingStatus, filters.value.minRating, filters.value.availability].filter(
      (value) => value !== null
    ).length
);

function clearFilters(): void {
  filters.value = { ...filters.value, readingStatus: null, minRating: null, availability: null };
}

const minRating = computed({
  get: () => (filters.value.minRating === null ? ANY : String(filters.value.minRating)),
  set: (value: string) => {
    filters.value = { ...filters.value, minRating: value === ANY ? null : Number(value) };
  },
});
</script>

<template>
  <div class="flex gap-2">
    <UInput
      v-model="search"
      type="search"
      icon="i-lucide-search"
      :placeholder="t('books.search')"
      :aria-label="t('books.search')"
      class="min-w-0 flex-1"
    />

    <UDrawer v-model:open="isDrawerOpen" :title="t('books.filters.title')">
      <UButton
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="outline"
        class="lg:hidden"
        :aria-label="t('books.filters.title')"
      >
        <span class="hidden sm:inline">{{ t('books.filters.title') }}</span>
        <UBadge v-if="activeFilterCount" color="primary" size="sm" variant="solid">
          {{ activeFilterCount }}
        </UBadge>
      </UButton>

      <template #body>
        <div class="flex flex-col gap-4 pb-2">
          <UFormField :label="t('books.fields.readingStatus')">
            <USelect v-model="readingStatus" :items="statusItems" class="w-full" />
          </UFormField>
          <UFormField :label="t('books.fields.rating')">
            <USelect v-model="minRating" :items="ratingItems" class="w-full" />
          </UFormField>
          <UFormField :label="t('books.availability.label')">
            <USelect v-model="availability" :items="availabilityItems" class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <UButton block @click="isDrawerOpen = false">{{ t('books.filters.done') }}</UButton>
        <UButton
          v-if="activeFilterCount"
          block
          color="neutral"
          variant="ghost"
          @click="clearFilters"
        >
          {{ t('books.filters.clear') }}
        </UButton>
      </template>
    </UDrawer>

    <div class="hidden gap-2 lg:flex">
      <USelect
        v-model="readingStatus"
        :items="statusItems"
        :aria-label="t('books.fields.readingStatus')"
        class="w-44"
      />
      <USelect
        v-model="minRating"
        :items="ratingItems"
        :aria-label="t('books.fields.rating')"
        class="w-44"
      />
      <USelect
        v-model="availability"
        :items="availabilityItems"
        :aria-label="t('books.availability.label')"
        class="w-44"
      />
    </div>
  </div>
</template>
