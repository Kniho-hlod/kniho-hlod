<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import {
  bookFields,
  findIsbnIssues,
  findReadingDatesIssues,
  READING_STATUSES,
  readingDatesForStatus,
  toIsbn13,
} from '@kniho-hlod/domain';
import type { Book, ReadingStatus } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import FormActions from '@/components/FormActions.vue';
import {
  describeIsbnLookupError,
  fetchCatalogueCover,
  findBookByIsbn,
  useBook,
  useIsbnLookup,
  useSaveBook,
} from '@/features/books/api';
import {
  BOOK_FORM_FIELDS,
  bookFormFrom,
  emptyBookForm,
  KEEP_COVER,
  shelvesChange,
  withCatalogueDetails,
} from '@/features/books/book-form';
import type { BookFormState, CoverChange } from '@/features/books/book-form';
import CoverPicker from '@/features/books/CoverPicker.vue';
import RatingInput from '@/features/books/RatingInput.vue';
import { useToday } from '@/features/loans/use-today';
import { canUseCamera } from '@/features/scanner/camera-support';
import IsbnScanner from '@/features/scanner/IsbnScanner.vue';
import ShelfPicker from '@/features/shelves/ShelfPicker.vue';

type AlertColor = 'success' | 'warning' | 'error';

interface Notice {
  color: AlertColor;
  text: string;
}

/** `?scan=1` on the new-book page opens the barcode scanner right away. */
const SCAN_QUERY_VALUE = '1';

/** Without `id` the form adds a book; with it, it edits that book. */
const props = defineProps<{ id?: string }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const today = useToday();

const bookId = toRef(props, 'id');
const isEditing = computed(() => bookId.value !== undefined);
const { data: book, error: loadError, isPending: isLoading } = useBook(bookId);

const schema = formSchema(pickFields(bookFields, BOOK_FORM_FIELDS), 'create', {
  refine: (form) => [...findIsbnIssues(form), ...findReadingDatesIssues(form)],
});
const state = reactive(emptyBookForm());
const cover = ref<CoverChange>(KEEP_COVER);
const storedShelfIds = ref<string[]>([]);
const shelfIds = ref<string[]>([]);
const errorMessage = ref('');
const lookupNotice = ref<Notice>();
/** The reader's other book with the ISBN just looked up: adding it again is likely a mistake. */
const duplicate = ref<Book>();

const readingStatusItems = computed(() =>
  READING_STATUSES.map((status) => ({ label: t(`books.readingStatus.${status}`), value: status }))
);

// The book to edit fills the form once — a background refetch must not overwrite what's typed.
const hasFilledForm = ref(false);
watch(
  book,
  (loaded) => {
    if (!loaded || hasFilledForm.value) return;
    Object.assign(state, bookFormFrom(loaded));
    storedShelfIds.value = loaded.shelves.map((shelf) => shelf.id);
    shelfIds.value = [...storedShelfIds.value];
    hasFilledForm.value = true;
  },
  { immediate: true }
);

/**
 * Starting or finishing a book dates it today, unless it's dated already. Only the reader's own
 * choice does this — filling the form with a stored book must not change its dates.
 */
function chooseReadingStatus(status: ReadingStatus): void {
  state.readingStatus = status;
  Object.assign(state, readingDatesForStatus(status, state, today.value));
}

// A chosen but not yet uploaded image is previewed from a temporary object URL.
const pendingCoverUrl = ref<string>();
watch(cover, (change, _previous, onCleanup) => {
  if (change.kind !== 'replace') {
    pendingCoverUrl.value = undefined;
    return;
  }
  const url = URL.createObjectURL(change.image);
  pendingCoverUrl.value = url;
  onCleanup(() => URL.revokeObjectURL(url));
});

const coverPreviewUrl = computed(() => {
  switch (cover.value.kind) {
    case 'replace':
      return pendingCoverUrl.value;
    case 'remove':
      return undefined;
    case 'keep':
      return fileUrl(book.value?.cover);
  }
  return undefined;
});

const coverNote = computed(() =>
  cover.value.kind === 'replace' && cover.value.source === 'catalogue'
    ? t('books.coverFromCatalogue')
    : undefined
);

function hasCover(): boolean {
  return cover.value.kind === 'replace' || (cover.value.kind === 'keep' && !!book.value?.cover);
}

function selectCover(image: File): void {
  cover.value = { kind: 'replace', image, source: 'upload' };
}

function removeCover(): void {
  const stored = book.value?.cover;
  cover.value = stored ? { kind: 'remove', fileId: stored.id } : KEEP_COVER;
}

function rejectLargeCover(): void {
  toast.add({ title: t('books.coverTooLarge'), color: 'warning' });
}

const lookupIsbn = computed(() => (state.isbn ? toIsbn13(state.isbn) : null));
const hasIsbnText = computed(() => Boolean(state.isbn?.trim()));
const { mutateAsync: lookUp, isPending: isLookingUp } = useIsbnLookup();

async function importCatalogueCover(isbn: string): Promise<void> {
  try {
    cover.value = { kind: 'replace', image: await fetchCatalogueCover(isbn), source: 'catalogue' };
  } catch {
    // The details are filled in already; a cover that won't download is not worth an error.
  }
}

async function checkForDuplicate(isbn: string): Promise<void> {
  try {
    const existing = await findBookByIsbn(isbn);
    duplicate.value = existing && existing.id !== bookId.value ? existing : undefined;
  } catch {
    // Only a hint: without it the reader can still save.
    duplicate.value = undefined;
  }
}

async function fillFromCatalogue(): Promise<void> {
  const isbn = lookupIsbn.value;
  duplicate.value = undefined;
  // Say why nothing is looked up, instead of a button that silently stays grey.
  if (!isbn) {
    lookupNotice.value = { color: 'warning', text: t('books.isbnInvalid') };
    return;
  }
  lookupNotice.value = undefined;
  void checkForDuplicate(isbn);
  try {
    const found = await lookUp(isbn);
    Object.assign(state, withCatalogueDetails(state, found));
    lookupNotice.value = { color: 'success', text: t('books.isbnFilled') };
    if (found.hasCover && !hasCover()) await importCatalogueCover(found.isbn);
  } catch (err) {
    lookupNotice.value = { color: 'warning', text: describeIsbnLookupError(err) };
  }
}

const canScan = canUseCamera();
const isScanning = ref(!isEditing.value && canScan && route.query.scan === SCAN_QUERY_VALUE);

async function fillFromScannedIsbn(isbn: string): Promise<void> {
  state.isbn = isbn;
  await fillFromCatalogue();
}

const { mutateAsync: saveBook, isPending: isSaving } = useSaveBook();

function savedToastTitle(coverSaved: boolean, shelvesSaved: boolean): string {
  if (!coverSaved) return t('books.savedWithoutCover');
  if (!shelvesSaved) return t('books.savedWithoutShelves');
  return t('books.saved');
}

async function submit(): Promise<void> {
  errorMessage.value = '';
  try {
    const form: BookFormState = { ...state };
    const saved = await saveBook({
      id: bookId.value,
      form,
      cover: cover.value,
      shelves: shelvesChange(storedShelfIds.value, shelfIds.value),
    });
    const isComplete = saved.coverSaved && saved.shelvesSaved;
    toast.add({
      title: savedToastTitle(saved.coverSaved, saved.shelvesSaved),
      color: isComplete ? 'success' : 'warning',
    });
    await router.push({ name: 'book', params: { id: saved.book.id } });
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}

function cancel(): void {
  void router.push(
    bookId.value ? { name: 'book', params: { id: bookId.value } } : { name: 'books' }
  );
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-3xl font-extrabold text-highlighted">
      {{ isEditing ? t('books.edit') : t('books.add') }}
    </h1>

    <USkeleton v-if="isEditing && isLoading && !loadError" class="h-96 w-full" />

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      :description="describeError(loadError)"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="submit"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UCard>
        <template #header>
          <h2 class="text-lg font-bold text-highlighted">{{ t('books.isbnLookup') }}</h2>
          <p class="text-sm text-muted">{{ t('books.isbnLookupHint') }}</p>
        </template>

        <div class="flex flex-col gap-3">
          <UFormField :label="t('books.fields.isbn')" name="isbn">
            <div class="flex gap-2">
              <UInput
                v-model.nullable="state.isbn"
                inputmode="numeric"
                autocomplete="off"
                class="min-w-0 flex-1"
                @keydown.enter.prevent="fillFromCatalogue"
              />
              <UButton
                v-if="canScan"
                icon="i-lucide-scan-barcode"
                color="neutral"
                variant="outline"
                :aria-label="t('scanner.scan')"
                :title="t('scanner.scan')"
                @click="isScanning = true"
              />
              <UButton
                icon="i-lucide-search"
                :loading="isLookingUp"
                :disabled="!hasIsbnText"
                @click="fillFromCatalogue"
              >
                {{ t('books.isbnSearch') }}
              </UButton>
            </div>
          </UFormField>

          <UAlert
            v-if="lookupNotice"
            :color="lookupNotice.color"
            variant="subtle"
            :description="lookupNotice.text"
          />

          <UAlert
            v-if="duplicate"
            color="info"
            variant="subtle"
            icon="i-lucide-copy"
            :description="t('books.duplicate', { title: duplicate.title })"
            :actions="[
              {
                label: t('books.openDuplicate'),
                to: { name: 'book', params: { id: duplicate.id } },
                color: 'info',
                variant: 'outline',
              },
            ]"
          />
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-lg font-bold text-highlighted">{{ t('books.details') }}</h2>
        </template>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('books.fields.title')" name="title" required class="sm:col-span-2">
            <UInput v-model="state.title" class="w-full" />
          </UFormField>

          <UFormField :label="t('books.fields.author')" name="author" class="sm:col-span-2">
            <UInput v-model.nullable="state.author" class="w-full" />
          </UFormField>

          <UFormField :label="t('books.fields.publisher')" name="publisher">
            <UInput v-model.nullable="state.publisher" class="w-full" />
          </UFormField>

          <UFormField :label="t('books.fields.publishedYear')" name="publishedYear">
            <UInput
              v-model.number.nullable="state.publishedYear"
              type="number"
              inputmode="numeric"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('books.fields.pageCount')" name="pageCount">
            <UInput
              v-model.number.nullable="state.pageCount"
              type="number"
              inputmode="numeric"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('books.fields.language')" name="language">
            <UInput v-model.nullable="state.language" placeholder="cs" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('books.fields.description')"
            name="description"
            class="sm:col-span-2"
          >
            <UTextarea
              v-model="state.description"
              :model-modifiers="{ nullable: true }"
              :rows="5"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-lg font-bold text-highlighted">{{ t('books.reading') }}</h2>
        </template>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('books.fields.readingStatus')" name="readingStatus">
            <USelect
              :model-value="state.readingStatus"
              :items="readingStatusItems"
              class="w-full"
              @update:model-value="chooseReadingStatus"
            />
          </UFormField>

          <UFormField :label="t('books.fields.rating')" name="rating">
            <RatingInput v-model="state.rating" />
          </UFormField>

          <UFormField :label="t('books.fields.startedAt')" name="startedAt">
            <UInput v-model.nullable="state.startedAt" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('books.fields.finishedAt')" name="finishedAt">
            <UInput v-model.nullable="state.finishedAt" type="date" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('shelves.title')"
            name="shelves"
            :help="t('shelves.pickHint')"
            class="sm:col-span-2"
          >
            <ShelfPicker v-model="shelfIds" />
          </UFormField>

          <UFormField :label="t('books.fields.notes')" name="notes" class="sm:col-span-2">
            <UTextarea
              v-model="state.notes"
              :model-modifiers="{ nullable: true }"
              :rows="3"
              :placeholder="t('books.notesPlaceholder')"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-lg font-bold text-highlighted">{{ t('books.cover') }}</h2>
        </template>
        <CoverPicker
          :preview-url="coverPreviewUrl"
          :title="state.title"
          :note="coverNote"
          @select="selectCover"
          @remove="removeCover"
          @too-large="rejectLargeCover"
        />
      </UCard>

      <FormActions>
        <UButton color="neutral" variant="ghost" @click="cancel">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" icon="i-lucide-check" :loading="isSaving">
          {{ t('common.save') }}
        </UButton>
      </FormActions>
    </UForm>

    <IsbnScanner v-if="canScan" v-model:open="isScanning" @detected="fillFromScannedIsbn" />
  </section>
</template>
