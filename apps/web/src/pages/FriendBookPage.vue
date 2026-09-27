<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@eleansphere/entity-core';
import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import type { ShelfSummary } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import BookCover from '@/features/books/BookCover.vue';
import RatingStars from '@/features/books/RatingStars.vue';
import ReadingStatusBadge from '@/features/books/ReadingStatusBadge.vue';
import { useFriend, useFriendBook } from '@/features/friends/api';
import RequestBookPanel from '@/features/lending/RequestBookPanel.vue';
import BookComments from '@/features/comments/BookComments.vue';
import ShelfChips from '@/features/shelves/ShelfChips.vue';

const NOT_FOUND = 404;

/** A book in a friend's shared library, to look at: no editing, no loans, no notes. */
const props = defineProps<{ userId: string; bookId: string }>();

const { t, locale } = useI18n();
const userId = toRef(props, 'userId');
const { data: friend } = useFriend(userId);
const { data: book, error, isPending } = useFriendBook(userId, toRef(props, 'bookId'));
const isMissing = computed(
  () => error.value instanceof ApiError && error.value.status === NOT_FOUND
);

function languageName(code: string | null): string | null {
  if (!code) return code;
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const details = computed(() => {
  const current = book.value;
  if (!current) return [];
  const rows = [
    { label: t('books.fields.isbn'), value: current.isbn },
    { label: t('books.fields.publisher'), value: current.publisher },
    { label: t('books.fields.publishedYear'), value: current.publishedYear },
    { label: t('books.fields.pageCount'), value: current.pageCount },
    { label: t('books.fields.language'), value: languageName(current.language) },
  ];
  return rows.filter((row) => row.value !== null && row.value !== '');
});

/** Where the book is: at home, or lent and due back when. */
const whereabouts = computed(() => {
  const lent = book.value?.lent;
  if (!lent) return t('friends.library.atHome');
  return lent.dueAt
    ? t('friends.library.lentUntil', { date: formatDate(lent.dueAt) })
    : t('friends.library.lent');
});

const shelfLink = (shelf: ShelfSummary) => ({
  name: 'friend',
  params: { userId: props.userId },
  query: { shelf: shelf.id },
});
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'friend', params: { userId } }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ friend?.displayName ?? t('friends.title') }}
    </UButton>

    <div v-if="isPending && !error" class="grid gap-6 sm:grid-cols-[16rem_1fr]">
      <USkeleton class="aspect-[4/5] w-full rounded-2xl" />
      <div class="flex flex-col gap-3">
        <USkeleton class="h-9 w-2/3" />
        <USkeleton class="h-5 w-1/3" />
      </div>
    </div>

    <EmptyState v-else-if="isMissing" icon="i-lucide-book-x" :title="t('books.notFound')" />
    <UAlert v-else-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <article v-else-if="book" class="grid items-start gap-6 sm:grid-cols-[16rem_1fr] lg:gap-10">
      <div
        class="bg-dots grid place-items-center rounded-2xl bg-orange-200 px-6 py-8 ring-2 ring-line dark:bg-orange-400/15"
      >
        <div class="w-40 rotate-2 rounded-lg shadow-pop sm:w-44">
          <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-5">
        <header class="flex flex-col gap-1">
          <p v-if="friend" class="text-sm font-semibold text-muted">
            {{ t('friends.library.ownedBy', { name: friend.displayName }) }}
          </p>
          <h1
            class="text-3xl leading-tight font-extrabold break-words text-highlighted lg:text-4xl"
          >
            {{ book.title }}
          </h1>
          <p v-if="book.author" class="text-lg text-toned">{{ book.author }}</p>
        </header>

        <div class="flex flex-wrap items-center gap-3">
          <ReadingStatusBadge
            v-if="book.readingStatus !== DEFAULT_READING_STATUS"
            :status="book.readingStatus"
            reader="friend"
          />
          <RatingStars v-if="book.rating" :rating="book.rating" />
        </div>

        <ShelfChips v-if="book.shelves.length > 0" :shelves="book.shelves" :link-to="shelfLink" />

        <p
          class="flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold ring-2 ring-line"
          :class="
            book.lent
              ? 'bg-ink-900 text-yellow-300'
              : 'bg-emerald-200 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-100'
          "
        >
          <UIcon :name="book.lent ? 'i-lucide-hand-helping' : 'i-lucide-house'" class="size-4" />
          {{ whereabouts }}
        </p>

        <RequestBookPanel
          v-if="friend"
          :book="book"
          :friend-id="userId"
          :friend-name="friend.displayName"
        />

        <dl v-if="details.length > 0" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div
            v-for="detail in details"
            :key="detail.label"
            class="flex min-w-0 flex-col rounded-lg bg-default px-3 py-2 ring-2 ring-line/15"
          >
            <dt class="text-xs text-muted">{{ detail.label }}</dt>
            <dd class="truncate font-semibold text-highlighted">{{ detail.value }}</dd>
          </div>
        </dl>

        <p v-if="book.description" class="whitespace-pre-line text-default">
          {{ book.description }}
        </p>
      </div>
    </article>

    <BookComments v-if="book" :book-id="book.id" when-empty="invite" />
  </section>
</template>
