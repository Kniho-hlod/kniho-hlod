<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBooksAtHome } from '@/features/books/api';
import { useDebounced } from '@/shared/use-debounced';

interface BookItem {
  label: string;
  value: string;
  description?: string;
}

/** The chosen book's id; only books at home are offered. */
const bookId = defineModel<string | null>({ required: true });

const { t } = useI18n();

const searchTerm = ref('');
const { data: books, isFetching } = useBooksAtHome(useDebounced(searchTerm));

const matchingItems = computed<BookItem[]>(() =>
  (books.value?.data ?? []).map((book) => ({
    label: book.title,
    value: book.id,
    description: book.author ?? undefined,
  }))
);

/** The chosen book stays offered (and labelled) after the search moves on. */
const chosenItem = ref<BookItem>();

const items = computed<BookItem[]>(() => {
  const chosen = chosenItem.value;
  if (!chosen || matchingItems.value.some((item) => item.value === chosen.value)) {
    return matchingItems.value;
  }
  return [chosen, ...matchingItems.value];
});

const selectedValue = computed({
  get: () => bookId.value ?? undefined,
  set: (value: string | undefined) => {
    chosenItem.value = items.value.find((item) => item.value === value);
    bookId.value = chosenItem.value?.value ?? null;
  },
});
</script>

<template>
  <USelectMenu
    v-model="selectedValue"
    v-model:search-term="searchTerm"
    :items="items"
    value-key="value"
    ignore-filter
    :search-input="{ placeholder: t('books.search'), icon: 'i-lucide-search', loading: isFetching }"
    :placeholder="t('loans.pickBook')"
    :aria-label="t('loans.fields.book')"
    icon="i-lucide-book"
    class="w-full"
  >
    <template #empty>
      {{ t('loans.noBooksAtHome') }}
    </template>
  </USelectMenu>
</template>
