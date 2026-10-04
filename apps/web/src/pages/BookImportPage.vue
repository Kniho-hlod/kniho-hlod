<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { LibraryImportResult, ParsedLibrary } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { describeError } from '@/app/errors';
import { invalidateLibrary } from '@/app/library-queries';
import { canUseCamera } from '@/features/scanner/camera-support';
import { importBatches } from '@/features/library-import/import-batches';
import {
  LIBRARY_FILE_TYPES,
  NoTitleColumnError,
  readLibraryFile,
} from '@/features/library-import/read-library-file';

/** How many titles the preview lists before "and N more". */
const PREVIEW_COUNT = 6;
const SOURCES = ['goodreads', 'databazeKnih'] as const;
const canScan = canUseCamera();

const { t } = useI18n();
const queryClient = useQueryClient();

const file = ref<File | null>(null);
const library = ref<ParsedLibrary | null>(null);
const readError = ref<string | null>(null);
const isReading = ref(false);
const importError = ref<string | null>(null);
const progress = ref<{ done: number; total: number } | null>(null);
const result = ref<LibraryImportResult | null>(null);

watch(file, async (picked) => {
  library.value = null;
  readError.value = null;
  importError.value = null;
  result.value = null;
  if (!picked) return;
  isReading.value = true;
  try {
    library.value = await readLibraryFile(picked);
    if (library.value.books.length === 0) readError.value = t('libraryImport.noBooks');
  } catch (err) {
    readError.value =
      err instanceof NoTitleColumnError
        ? t('libraryImport.noTitleColumn')
        : t('libraryImport.unreadable');
  } finally {
    isReading.value = false;
  }
});

const books = computed(() => library.value?.books ?? []);
const summary = computed(() => {
  const count = (status: string) =>
    books.value.filter((book) => book.readingStatus === status).length;
  const shelves = new Set(
    books.value.flatMap((book) => book.shelves.map((name) => name.toLowerCase()))
  );
  return [
    { key: 'read', count: count('read') },
    { key: 'reading', count: count('reading') },
    { key: 'want', count: count('want') },
    { key: 'withIsbn', count: books.value.filter((book) => book.isbn).length },
    { key: 'shelves', count: shelves.size },
  ].filter((item) => item.count > 0);
});
const isImporting = computed(() => progress.value !== null && result.value === null);

async function startImport(): Promise<void> {
  const batches = importBatches(books.value);
  const total: LibraryImportResult = { created: 0, duplicates: 0, shelvesCreated: 0 };
  importError.value = null;
  progress.value = { done: 0, total: books.value.length };
  try {
    for (const batch of batches) {
      const answer = await services.libraryImport.import(batch);
      total.created += answer.created;
      total.duplicates += answer.duplicates;
      total.shelvesCreated += answer.shelvesCreated;
      progress.value = { done: progress.value.done + batch.length, total: progress.value.total };
    }
    result.value = total;
  } catch (err) {
    // The parts sent before the failure are in; sending again skips them as duplicates.
    importError.value = describeError(err);
    progress.value = null;
  } finally {
    await invalidateLibrary(queryClient);
  }
}

function startOver(): void {
  file.value = null;
  progress.value = null;
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('libraryImport.title') }}</h1>
      <p class="text-toned">{{ t('libraryImport.intro') }}</p>
    </div>

    <div v-if="!library || readError" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <UCard v-for="source in SOURCES" :key="source">
        <h2 class="font-display font-bold text-highlighted">
          {{ t(`libraryImport.sources.${source}.title`) }}
        </h2>
        <p class="mt-1 text-sm text-toned">{{ t(`libraryImport.sources.${source}.steps`) }}</p>
      </UCard>
    </div>

    <UCard v-if="result">
      <div class="flex flex-col items-start gap-3">
        <h2 class="font-display text-xl font-bold text-highlighted">
          {{ t('libraryImport.done', result.created) }}
        </h2>
        <p v-if="result.duplicates > 0" class="text-toned">
          {{ t('libraryImport.duplicates', result.duplicates) }}
        </p>
        <p v-if="result.shelvesCreated > 0" class="text-toned">
          {{ t('libraryImport.shelvesCreated', result.shelvesCreated) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton :to="{ name: 'books' }" icon="i-lucide-library">
            {{ t('libraryImport.toLibrary') }}
          </UButton>
          <UButton color="neutral" variant="outline" icon="i-lucide-file-up" @click="startOver">
            {{ t('libraryImport.another') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard v-else-if="isImporting && progress">
      <div class="flex flex-col gap-3">
        <p class="font-semibold text-highlighted">
          {{ t('libraryImport.importing', { done: progress.done, total: progress.total }) }}
        </p>
        <UProgress :model-value="progress.done" :max="progress.total" />
      </div>
    </UCard>

    <UCard v-else-if="library && !readError">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="font-display text-xl font-bold text-highlighted">
            {{ t('libraryImport.found', books.length) }}
          </h2>
          <p class="text-sm text-muted">
            {{ t(`libraryImport.format.${library.format}`) }}
            <template v-if="library.skippedRows > 0">
              · {{ t('libraryImport.skippedRows', library.skippedRows) }}
            </template>
          </p>
        </div>
        <ul v-if="summary.length > 0" class="flex flex-wrap gap-2">
          <li
            v-for="item in summary"
            :key="item.key"
            class="rounded-full bg-elevated px-3 py-1 text-sm font-semibold text-toned ring-2 ring-line/10"
          >
            {{ t(`libraryImport.summary.${item.key}`, item.count) }}
          </li>
        </ul>
        <ul class="flex flex-col divide-y-2 divide-line/10">
          <li
            v-for="book in books.slice(0, PREVIEW_COUNT)"
            :key="`${book.title}|${book.author}`"
            class="flex flex-col py-1.5"
          >
            <span class="font-semibold text-highlighted">{{ book.title }}</span>
            <span v-if="book.author" class="text-sm text-muted">{{ book.author }}</span>
          </li>
        </ul>
        <p v-if="books.length > PREVIEW_COUNT" class="text-sm text-muted">
          {{ t('libraryImport.more', books.length - PREVIEW_COUNT) }}
        </p>
        <p class="flex items-start gap-2 text-sm text-muted">
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
          {{ t('libraryImport.duplicatesNote') }}
        </p>
        <UAlert v-if="importError" color="error" variant="subtle" :description="importError" />
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-lucide-download" @click="startImport">
            {{ t('libraryImport.start', books.length) }}
          </UButton>
          <UButton color="neutral" variant="outline" @click="startOver">
            {{ t('libraryImport.otherFile') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <template v-if="!result && !isImporting && (!library || readError)">
      <UFileUpload
        v-model="file"
        :accept="LIBRARY_FILE_TYPES"
        icon="i-lucide-file-spreadsheet"
        :label="t('libraryImport.pick')"
        :description="t('libraryImport.pickHint')"
        layout="list"
        class="min-h-32 w-full"
        :disabled="isReading"
      />
      <UAlert v-if="readError" color="error" variant="subtle" :description="readError" />
      <ULink v-if="canScan" :to="{ name: 'shelf-scan' }" class="self-center text-sm">
        {{ t('shelfScan.fromImport') }}
      </ULink>
    </template>
  </section>
</template>
