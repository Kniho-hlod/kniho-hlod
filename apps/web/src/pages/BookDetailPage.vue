<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { DropdownMenuItem } from '@nuxt/ui';
import { ApiError } from '@eleansphere/entity-core';
import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import { useBook, useChangeReadingStatus, useDeleteBook } from '@/features/books/api';
import BookCover from '@/features/books/BookCover.vue';
import BookLoanCard from '@/features/books/BookLoanCard.vue';
import RatingStars from '@/features/books/RatingStars.vue';
import ReadingStatusBadge from '@/features/books/ReadingStatusBadge.vue';
import LoanList from '@/features/loans/LoanList.vue';
import { useToday } from '@/features/loans/use-today';
import ShelfChips from '@/features/shelves/ShelfChips.vue';

const NOT_FOUND = 404;

/** The reading status a book moves on to with one tap: begin it, then finish it. */
const NEXT_READING_STATUS: Record<ReadingStatus, ReadingStatus | null> = {
  none: 'reading',
  want: 'reading',
  reading: 'read',
  read: null,
};

const props = defineProps<{ id: string }>();

const { t, locale } = useI18n();
const router = useRouter();
const toast = useToast();

/** `cs` → "čeština" in the app's language; a code the browser doesn't know stays as it is. */
function languageName(code: string | null | undefined): string | null | undefined {
  if (!code) return code;
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const { data: book, error, isPending } = useBook(toRef(props, 'id'));
const isMissing = computed(
  () => error.value instanceof ApiError && error.value.status === NOT_FOUND
);

/** The catalogue details the book has, as label/value rows. */
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
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');
});

/** When the reader read the book, from the dates they have: both, only the start, or only the end. */
const readingPeriod = computed(() => {
  const startedAt = book.value?.startedAt;
  const finishedAt = book.value?.finishedAt;
  if (startedAt && finishedAt) {
    return t('books.readFromTo', { from: formatDate(startedAt), to: formatDate(finishedAt) });
  }
  if (startedAt) return t('books.readingSince', { date: formatDate(startedAt) });
  if (finishedAt) return t('books.finishedOn', { date: formatDate(finishedAt) });
  return null;
});

const today = useToday();
const nextReadingStatus = computed(() =>
  book.value ? NEXT_READING_STATUS[book.value.readingStatus ?? DEFAULT_READING_STATUS] : null
);
const { mutateAsync: changeReadingStatus, isPending: isChangingStatus } = useChangeReadingStatus();

async function moveToNextReadingStatus(): Promise<void> {
  const status = nextReadingStatus.value;
  if (!book.value || !status) return;
  try {
    await changeReadingStatus({ book: book.value, status, today: today.value });
    toast.add({ title: t(`books.readingStatusChanged.${status}`), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const isConfirmingDelete = ref(false);

/** The rarely wanted actions wait behind the “…” button, away from a stray tap. */
const moreActions = computed<DropdownMenuItem[]>(() => [
  {
    label: t('books.delete'),
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => {
      isConfirmingDelete.value = true;
    },
  },
]);
const { mutateAsync: deleteBook, isPending: isDeleting } = useDeleteBook();

async function confirmDelete(): Promise<void> {
  try {
    await deleteBook(props.id);
    toast.add({ title: t('books.deleted'), color: 'success' });
    await router.push({ name: 'books' });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('books.deleteBlockedByLoan') }),
      color: 'error',
    });
  } finally {
    isConfirmingDelete.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'books' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('books.title') }}
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
      <!-- The cover on a little dotted stage. -->
      <div
        class="bg-dots grid place-items-center rounded-2xl bg-indigo-200 px-6 py-8 ring-2 ring-line dark:bg-indigo-400/15"
      >
        <div class="w-40 -rotate-2 rounded-lg shadow-pop sm:w-44">
          <BookCover :url="fileUrl(book.cover)" :title="book.title" :author="book.author" />
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-5">
        <header class="flex flex-col gap-1">
          <h1
            class="text-3xl leading-tight font-extrabold break-words text-highlighted lg:text-4xl"
          >
            {{ book.title }}
          </h1>
          <p v-if="book.author" class="text-lg text-toned">{{ book.author }}</p>
        </header>

        <div class="flex flex-wrap items-center gap-3">
          <ReadingStatusBadge :status="book.readingStatus ?? DEFAULT_READING_STATUS" />
          <RatingStars v-if="book.rating" :rating="book.rating" />
          <span v-if="readingPeriod" class="text-sm text-muted">{{ readingPeriod }}</span>
        </div>

        <ShelfChips v-if="book.shelves.length > 0" :shelves="book.shelves" />

        <div class="flex flex-wrap gap-2">
          <UButton :to="{ name: 'book-edit', params: { id: book.id } }" icon="i-lucide-pencil">
            {{ t('books.edit') }}
          </UButton>
          <UButton
            v-if="nextReadingStatus"
            :icon="nextReadingStatus === 'reading' ? 'i-lucide-book-open' : 'i-lucide-book-check'"
            color="neutral"
            variant="outline"
            :loading="isChangingStatus"
            @click="moveToNextReadingStatus"
          >
            {{ t(`books.nextReadingStatus.${nextReadingStatus}`) }}
          </UButton>
          <UDropdownMenu :items="moreActions" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="outline"
              :aria-label="t('common.moreActions')"
            />
          </UDropdownMenu>
        </div>

        <BookLoanCard :book="book" />

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

        <!-- The reader's own notes, pinned on like a sticky note. -->
        <section
          v-if="book.notes"
          class="flex flex-col gap-1 rounded-lg bg-yellow-100 p-4 ring-2 ring-line rotate-[-0.6deg] dark:bg-yellow-300/10"
        >
          <h2 class="flex items-center gap-1.5 text-sm font-bold text-highlighted">
            <UIcon name="i-lucide-sticky-note" class="size-4" />
            {{ t('books.fields.notes') }}
          </h2>
          <p class="whitespace-pre-line text-default">{{ book.notes }}</p>
        </section>
      </div>
    </article>

    <section v-if="book" class="flex flex-col gap-3">
      <h2 class="text-xl font-bold text-highlighted">{{ t('books.loanHistory') }}</h2>
      <LoanList
        :filters="{ state: 'returned', bookId: book.id }"
        :empty-text="t('loans.noHistory')"
        seen-from="book"
      />
    </section>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('books.delete')"
      :description="t('books.deleteConfirm', { title: book?.title ?? '' })"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingDelete = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
