<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookReview from '@/features/books/BookReview.vue';
import RatingStars from '@/features/books/RatingStars.vue';
import ReadingStatusBadge from '@/features/books/ReadingStatusBadge.vue';
import { useFriendCopies } from './api';

/**
 * Under a book: which friends have it too (the same ISBN), how they rated it and what they
 * wrote, each linking to their copy and its talk. Nothing shows without an ISBN or such friends.
 */
const props = defineProps<{
  isbn: string | null;
  /** The copy this page shows already, left out of the list. */
  exceptBookId?: string;
}>();

const { t } = useI18n();
const { data } = useFriendCopies(toRef(props, 'isbn'));
const copies = computed(() =>
  (data.value ?? []).filter((copy) => copy.bookId !== props.exceptBookId)
);
</script>

<template>
  <section v-if="copies.length > 0" class="flex flex-col gap-3">
    <h2 class="text-xl font-bold text-highlighted">{{ t('feed.friendsOnBook') }}</h2>
    <ul class="grid gap-3 lg:grid-cols-2">
      <li v-for="copy in copies" :key="copy.bookId">
        <RouterLink
          :to="{ name: 'friend-book', params: { userId: copy.friend.id, bookId: copy.bookId } }"
          class="flex h-full flex-col gap-2 rounded-xl bg-default p-3 ring-2 ring-line/15 transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop-sm hover:ring-line focus-visible:outline-2 focus-visible:outline-primary"
        >
          <p class="flex items-center gap-2 font-semibold text-highlighted">
            <PersonAvatar
              :name="copy.friend.displayName"
              :src="fileUrl(copy.friend.avatar)"
              size="2xs"
            />
            <span class="min-w-0 truncate">{{ copy.friend.displayName }}</span>
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <ReadingStatusBadge
              v-if="copy.readingStatus !== DEFAULT_READING_STATUS"
              :status="copy.readingStatus"
              reader="friend"
            />
            <RatingStars v-if="copy.rating" :rating="copy.rating" />
          </div>
          <BookReview v-if="copy.review" :text="copy.review" />
          <p v-if="copy.commentCount > 0" class="flex items-center gap-1 text-xs text-muted">
            <UIcon name="i-lucide-message-circle" class="size-3.5" />
            {{ t('feed.comments', copy.commentCount) }}
          </p>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
