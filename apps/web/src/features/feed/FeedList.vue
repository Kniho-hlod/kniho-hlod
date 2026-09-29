<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import { useOnVisible } from '@/shared/use-on-visible';
import { useFeed } from './api';
import FeedItemCard from './FeedItemCard.vue';

const SKELETON_COUNT = 3;

/** What friends read, newest first; more loads as the end of the list comes into view. */
const { t } = useI18n();

const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useFeed();
const items = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);

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
      <USkeleton class="h-28 w-full rounded-xl" />
    </li>
  </ul>

  <EmptyState
    v-else-if="items.length === 0"
    icon="i-lucide-newspaper"
    size="section"
    :title="t('feed.emptyTitle')"
    :description="t('feed.empty')"
  />

  <div v-else class="flex flex-col gap-3">
    <ul class="flex flex-col gap-3">
      <li v-for="item in items" :key="item.id">
        <FeedItemCard :item="item" />
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
