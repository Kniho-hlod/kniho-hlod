<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { ApiError } from '@eleansphere/entity-core';
import { DEFAULT_READING_STATUS } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { describeError } from '@/app/errors';
import { useBook, useDeleteBook } from '@/features/books/api';
import BookCover from '@/features/books/BookCover.vue';
import RatingStars from '@/features/books/RatingStars.vue';
import ReadingStatusBadge from '@/features/books/ReadingStatusBadge.vue';

const NOT_FOUND = 404;

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

const isConfirmingDelete = ref(false);
const { mutateAsync: deleteBook, isPending: isDeleting } = useDeleteBook();

async function confirmDelete(): Promise<void> {
  try {
    await deleteBook(props.id);
    toast.add({ title: t('books.deleted'), color: 'success' });
    await router.push({ name: 'books' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
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

    <div v-if="isPending && !error" class="grid gap-6 sm:grid-cols-[12rem_1fr]">
      <USkeleton class="aspect-[2/3] w-40 sm:w-48" />
      <div class="flex flex-col gap-3">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-4 w-1/3" />
      </div>
    </div>

    <UCard v-else-if="isMissing">
      <p class="text-muted">{{ t('books.notFound') }}</p>
    </UCard>

    <UAlert v-else-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <article v-else-if="book" class="grid gap-6 sm:grid-cols-[12rem_1fr]">
      <div class="w-40 sm:w-48">
        <BookCover :url="fileUrl(book.cover)" :title="book.title" />
      </div>

      <div class="flex min-w-0 flex-col gap-4">
        <header class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold text-highlighted">{{ book.title }}</h1>
          <p v-if="book.author" class="text-muted">{{ book.author }}</p>
        </header>

        <div class="flex flex-wrap items-center gap-3">
          <ReadingStatusBadge :status="book.readingStatus ?? DEFAULT_READING_STATUS" />
          <RatingStars v-if="book.rating" :rating="book.rating" />
        </div>

        <dl v-if="details.length > 0" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <template v-for="detail in details" :key="detail.label">
            <dt class="text-muted">{{ detail.label }}</dt>
            <dd class="text-default">{{ detail.value }}</dd>
          </template>
        </dl>

        <p v-if="book.description" class="whitespace-pre-line text-default">
          {{ book.description }}
        </p>

        <div class="flex flex-wrap gap-2">
          <UButton :to="{ name: 'book-edit', params: { id: book.id } }" icon="i-lucide-pencil">
            {{ t('books.edit') }}
          </UButton>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            @click="isConfirmingDelete = true"
          >
            {{ t('books.delete') }}
          </UButton>
        </div>
      </div>
    </article>

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
