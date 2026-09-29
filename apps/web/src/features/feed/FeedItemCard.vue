<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { FeedItem } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookReview from '@/features/books/BookReview.vue';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import RatingStars from '@/features/books/RatingStars.vue';

/** One thing a friend did with a book: who, what, when, with their rating and review. */
defineProps<{ item: FeedItem }>();

const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="{ name: 'friend-book', params: { userId: item.friend.id, bookId: item.book.id } }"
    class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line/15 transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop-sm hover:ring-line focus-visible:outline-2 focus-visible:outline-primary"
  >
    <BookThumbnail :url="fileUrl(item.book.cover)" :title="item.book.title" />
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <p class="flex items-center gap-1.5 text-sm text-muted">
        <PersonAvatar
          :name="item.friend.displayName"
          :src="fileUrl(item.friend.avatar)"
          size="3xs"
        />
        <span class="min-w-0 truncate">
          {{ t(`feed.kinds.${item.kind}`, { name: item.friend.displayName }) }}
        </span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{{ formatDate(item.on) }}</span>
      </p>
      <p class="font-display leading-tight font-bold text-highlighted">{{ item.book.title }}</p>
      <p v-if="item.book.author" class="text-sm text-toned">{{ item.book.author }}</p>
      <RatingStars v-if="item.book.rating" :rating="item.book.rating" />
      <BookReview v-if="item.book.review" :text="item.book.review" />
      <p v-if="item.commentCount > 0" class="flex items-center gap-1 text-xs text-muted">
        <UIcon name="i-lucide-message-circle" class="size-3.5" />
        {{ t('feed.comments', item.commentCount) }}
      </p>
    </div>
  </RouterLink>
</template>
