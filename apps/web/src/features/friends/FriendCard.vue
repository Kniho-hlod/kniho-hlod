<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Friend } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookCover from '@/features/books/BookCover.vue';

/** A friend in the list: who, since when, and what they are reading — a link to their library. */
defineProps<{ friend: Friend }>();

const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="{ name: 'friend', params: { userId: friend.id } }"
    class="flex h-full flex-col gap-3 rounded-xl bg-default p-4 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <div class="flex items-center gap-3">
      <PersonAvatar :name="friend.displayName" :src="fileUrl(friend.avatar)" size="lg" />
      <div class="flex min-w-0 flex-col">
        <p class="truncate font-display text-lg font-bold text-highlighted">
          {{ friend.displayName }}
        </p>
        <p class="text-xs text-muted">
          {{ t('friends.since', { date: formatDate(friend.friendsSince.slice(0, 10)) }) }}
        </p>
      </div>
    </div>

    <p v-if="!friend.sharesLibrary" class="text-sm text-muted">{{ t('friends.notSharing') }}</p>
    <div v-else-if="friend.readingNow.length > 0" class="flex flex-col gap-2">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        {{ t('friends.readingNow') }}
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="book in friend.readingNow" :key="book.id" class="flex items-center gap-2">
          <div class="w-8 shrink-0">
            <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
          </div>
          <span class="min-w-0 truncate text-sm font-medium text-default">{{ book.title }}</span>
        </li>
      </ul>
    </div>
    <p v-else class="text-sm text-muted">{{ t('friends.readingNothing') }}</p>
  </RouterLink>
</template>
