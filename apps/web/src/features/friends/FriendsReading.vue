<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { fileUrl } from '@/app/api';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookCover from '@/features/books/BookCover.vue';
import { useFriends } from './api';

/** On the home page: what friends are reading now; nothing when none of them is. */
const { t } = useI18n();
const { data: friends } = useFriends();

const reading = computed(() =>
  (friends.value ?? []).flatMap((friend) => friend.readingNow.map((book) => ({ friend, book })))
);
</script>

<template>
  <section v-if="reading.length > 0" class="flex flex-col gap-3">
    <h2 class="text-xl font-bold text-highlighted">{{ t('friends.homeTitle') }}</h2>
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="{ friend, book } in reading" :key="book.id">
        <RouterLink
          :to="{ name: 'friend-book', params: { userId: friend.id, bookId: book.id } }"
          class="flex h-full items-center gap-3 rounded-xl bg-default p-3 ring-2 ring-line/15 transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop-sm hover:ring-line focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div class="w-12 shrink-0">
            <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
          </div>
          <div class="flex min-w-0 flex-col gap-1">
            <p class="line-clamp-2 font-display leading-tight font-bold text-highlighted">
              {{ book.title }}
            </p>
            <p class="flex items-center gap-1.5 text-sm text-muted">
              <PersonAvatar :name="friend.displayName" :src="fileUrl(friend.avatar)" size="3xs" />
              <span class="truncate">{{
                t('friends.isReading', { name: friend.displayName })
              }}</span>
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
