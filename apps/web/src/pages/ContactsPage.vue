<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import { useContactList } from '@/features/contacts/api';
import ContactCard from '@/features/contacts/ContactCard.vue';
import { useDebounced } from '@/shared/use-debounced';
import { useOnVisible } from '@/shared/use-on-visible';

const SKELETON_COUNT = 5;

const { t } = useI18n();

const search = ref('');
const debouncedSearch = useDebounced(search);
const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useContactList(debouncedSearch);

const contacts = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);
const isSearching = computed(() => debouncedSearch.value.trim() !== '');

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'loans' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('loans.title') }}
    </UButton>

    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('contacts.title') }}</h1>
      <UButton :to="{ name: 'contact-new' }" icon="i-lucide-user-plus">
        {{ t('contacts.add') }}
      </UButton>
    </header>

    <UInput
      v-model="search"
      type="search"
      icon="i-lucide-search"
      :placeholder="t('contacts.search')"
      :aria-label="t('contacts.search')"
    />

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-2">
      <li v-for="index in SKELETON_COUNT" :key="index"><USkeleton class="h-16 w-full" /></li>
    </ul>

    <p v-else-if="contacts.length === 0" class="text-muted">
      {{ isSearching ? t('contacts.emptyFiltered') : t('contacts.empty') }}
    </p>

    <template v-else>
      <ul class="flex flex-col gap-2">
        <li v-for="contact in contacts" :key="contact.id">
          <ContactCard :contact="contact" />
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
        {{ t('common.loadMore') }}
      </UButton>
    </template>
  </section>
</template>
