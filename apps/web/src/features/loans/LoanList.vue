<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import { useOnVisible } from '@/shared/use-on-visible';
import { useLoanList } from './api';
import type { LoanListFilters } from './api';
import LoanCard from './LoanCard.vue';

const SKELETON_COUNT = 3;

const props = defineProps<{
  filters: LoanListFilters;
  /** Shown when no loan matches. */
  emptyText: string;
  seenFrom?: 'book' | 'contact';
}>();

const { t } = useI18n();

const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useLoanList(
  toRef(props, 'filters')
);
const loans = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);
</script>

<template>
  <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

  <ul v-else-if="isPending" class="flex flex-col gap-3">
    <li v-for="index in SKELETON_COUNT" :key="index">
      <USkeleton class="h-24 w-full" />
    </li>
  </ul>

  <EmptyState
    v-else-if="loans.length === 0"
    icon="i-lucide-hand-helping"
    :title="emptyText"
    size="section"
  />

  <div v-else class="flex flex-col gap-3">
    <ul class="flex flex-col gap-3">
      <li v-for="loan in loans" :key="loan.id">
        <LoanCard :loan="loan" :seen-from="seenFrom" />
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
  </div>
</template>
