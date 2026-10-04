<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import { describeError } from '@/app/errors';
import { invalidateLibrary } from '@/app/library-queries';
import FormActions from '@/components/FormActions.vue';
import {
  addScannedBook,
  describeIsbnLookupError,
  findBookByIsbn,
  lookUpIsbn,
} from '@/features/books/api';
import { canUseCamera } from '@/features/scanner/camera-support';
import ScannerViewfinder from '@/features/scanner/ScannerViewfinder.vue';
import { createShelfScan } from '@/features/shelf-scan/shelf-scan';
import type { ScannedBook, ScannedBookState } from '@/features/shelf-scan/shelf-scan';
import ShelfPicker from '@/features/shelves/ShelfPicker.vue';

/** A short buzz on phones that can: the book was read, the next one can come. */
const SCAN_VIBRATION_MS = 60;

const STATE_ICONS: Record<ScannedBookState, string> = {
  looking: 'i-lucide-loader-circle',
  found: 'i-lucide-book-check',
  unknown: 'i-lucide-book-dashed',
  owned: 'i-lucide-library',
  added: 'i-lucide-circle-check',
};
const STATE_STYLES: Record<ScannedBookState, string> = {
  looking: 'animate-spin text-muted',
  found: 'text-primary',
  unknown: 'text-warning',
  owned: 'text-muted',
  added: 'text-success',
};

const { t } = useI18n();
const queryClient = useQueryClient();

const shelf = createShelfScan({
  lookUp: lookUpIsbn,
  findOwned: findBookByIsbn,
  describeLookupError: describeIsbnLookupError,
});
const { books, toAdd, isLooking } = shelf;

const canScan = canUseCamera();
const shelfIds = ref<string[]>([]);
const lastScan = ref<string | null>(null);
const progress = ref<{ done: number; total: number } | null>(null);
const added = ref<number | null>(null);
const failed = ref(0);

const isAdding = computed(() => progress.value !== null && added.value === null);
const isScanning = computed(() => canScan && progress.value === null);

function onDetected(isbn: string): void {
  const outcome = shelf.scan(isbn);
  lastScan.value = outcome === 'new' ? t('shelfScan.scanned') : t('shelfScan.scannedAgain');
  if (outcome === 'new') navigator.vibrate?.(SCAN_VIBRATION_MS);
}

function stateText(book: ScannedBook): string | null {
  if (book.state === 'looking') return t('shelfScan.looking');
  if (book.state === 'owned') return t('shelfScan.owned');
  if (book.state === 'added') return t('shelfScan.added');
  if (book.state === 'unknown') return book.problem;
  return book.author;
}

async function addAll(): Promise<void> {
  const batch = [...toAdd.value];
  let count = 0;
  failed.value = 0;
  progress.value = { done: 0, total: batch.length };
  for (const book of batch) {
    try {
      await addScannedBook({
        isbn: book.isbn,
        title: book.title,
        details: book.details,
        shelfIds: shelfIds.value,
      });
      book.state = 'added';
      book.problem = null;
      count += 1;
    } catch (err) {
      book.problem = describeError(err);
      failed.value += 1;
    }
    progress.value = { done: progress.value.done + 1, total: batch.length };
  }
  added.value = count;
  await invalidateLibrary(queryClient);
}

function scanMore(): void {
  books.value = books.value.filter((book) => book.state !== 'added');
  progress.value = null;
  added.value = null;
  lastScan.value = null;
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('shelfScan.title') }}</h1>
      <p class="text-toned">{{ t('shelfScan.intro') }}</p>
    </div>

    <UAlert
      v-if="!canScan"
      color="warning"
      variant="subtle"
      :description="t('shelfScan.noCamera')"
    />

    <template v-if="isScanning">
      <!-- Mounted only while scanning: the camera is off once the books are being added. -->
      <ScannerViewfinder continuous @detected="onDetected" />
      <p
        v-if="lastScan"
        class="-mt-2 text-sm font-semibold text-highlighted"
        aria-live="polite"
        role="status"
      >
        {{ lastScan }}
      </p>
    </template>

    <UCard v-if="added !== null">
      <div class="flex flex-col items-start gap-3">
        <h2 class="font-display text-xl font-bold text-highlighted">
          {{ t('shelfScan.done', added) }}
        </h2>
        <p v-if="failed > 0" class="text-toned">{{ t('shelfScan.failed', failed) }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton :to="{ name: 'books' }" icon="i-lucide-library">
            {{ t('shelfScan.toLibrary') }}
          </UButton>
          <UButton color="neutral" variant="outline" icon="i-lucide-scan-barcode" @click="scanMore">
            {{ t('shelfScan.more') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard v-else-if="isAdding && progress">
      <div class="flex flex-col gap-3">
        <p class="font-semibold text-highlighted">
          {{ t('shelfScan.adding', { done: progress.done, total: progress.total }) }}
        </p>
        <UProgress :model-value="progress.done" :max="progress.total" />
      </div>
    </UCard>

    <UFormField
      v-if="books.length > 0 && !isAdding && added === null"
      :label="t('shelfScan.shelf')"
    >
      <ShelfPicker v-model="shelfIds" />
    </UFormField>

    <p v-if="canScan && books.length === 0" class="text-sm text-muted">
      {{ t('shelfScan.empty') }}
    </p>

    <ul v-if="books.length > 0" class="flex flex-col divide-y-2 divide-line/10">
      <li v-for="book in books" :key="book.isbn" class="flex items-start gap-3 py-2">
        <UIcon
          :name="STATE_ICONS[book.state]"
          class="mt-0.5 size-5 shrink-0"
          :class="STATE_STYLES[book.state]"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <UInput
            v-if="book.state === 'unknown'"
            v-model="book.title"
            :placeholder="t('shelfScan.typeTitle')"
            :aria-label="t('shelfScan.typeTitleFor', { isbn: book.isbn })"
            :disabled="isAdding"
            class="w-full"
          />
          <span v-else-if="book.title" class="font-semibold text-highlighted">
            {{ book.title }}
          </span>
          <span v-else class="font-semibold text-muted">{{ book.isbn }}</span>
          <span v-if="stateText(book)" class="text-sm text-muted">{{ stateText(book) }}</span>
          <ULink
            v-if="book.state === 'owned' && book.ownedBookId"
            :to="{ name: 'book', params: { id: book.ownedBookId } }"
            class="text-sm"
          >
            {{ t('shelfScan.open') }}
          </ULink>
        </div>
        <UButton
          v-if="book.state !== 'added' && !isAdding"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('shelfScan.remove', { title: book.title || book.isbn })"
          @click="shelf.remove(book.isbn)"
        />
      </li>
    </ul>

    <FormActions v-if="added === null && !isAdding && books.length > 0">
      <span v-if="isLooking" class="mr-auto text-sm text-muted">{{ t('shelfScan.waiting') }}</span>
      <UButton icon="i-lucide-plus" :disabled="toAdd.length === 0 || isLooking" @click="addAll">
        {{ t('shelfScan.addAll', toAdd.length) }}
      </UButton>
    </FormActions>
  </section>
</template>
