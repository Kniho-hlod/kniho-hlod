<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { FormError } from '@nuxt/ui';
import { findLoanDatesIssues, loanFields } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { goBackOr } from '@/app/navigation';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { useBook } from '@/features/books/api';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useDeleteLoan, useLoan, useSaveLoan } from '@/features/loans/api';
import BookPicker from '@/features/loans/BookPicker.vue';
import ContactPicker from '@/features/loans/ContactPicker.vue';
import { LOAN_FORM_FIELDS, loanFormFrom, newLoanForm } from '@/features/loans/loan-form';
import { useToday } from '@/features/loans/use-today';

/** Without `id` the form lends a book (`?bookId=` picks it); with it, it edits that loan. */
const props = defineProps<{ id?: string }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const today = useToday();

const loanId = toRef(props, 'id');
const isEditing = computed(() => loanId.value !== undefined);
const { data: loan, error: loadError, isPending: isLoading } = useLoan(loanId);

const presetBookId = typeof route.query.bookId === 'string' ? route.query.bookId : null;
const state = reactive(newLoanForm(today.value, presetBookId));

// The book is fixed once known: the one being edited, or the one the lending started from.
const fixedBookId = computed(() => loan.value?.bookId ?? presetBookId ?? undefined);
const { data: presetBook } = useBook(
  computed(() => (isEditing.value ? undefined : (presetBookId ?? undefined)))
);
const fixedBook = computed(() => loan.value?.book ?? presetBook.value);

const schema = formSchema(pickFields(loanFields, LOAN_FORM_FIELDS), 'create', {
  refine: findLoanDatesIssues,
});

/** What the field schema can't see: a book and a contact must be chosen. */
function validateChoices(): FormError[] {
  const required = t('validation.required');
  return [
    ...(state.bookId ? [] : [{ name: 'bookId', message: required }]),
    ...(state.contact ? [] : [{ name: 'contact', message: required }]),
  ];
}

// The loan to edit fills the form once — a background refetch must not overwrite what's typed.
const hasFilledForm = ref(false);
watch(
  loan,
  (loaded) => {
    if (!loaded || hasFilledForm.value) return;
    Object.assign(state, loanFormFrom(loaded));
    hasFilledForm.value = true;
  },
  { immediate: true }
);

const errorMessage = ref('');
const { mutateAsync: saveLoan, isPending: isSaving } = useSaveLoan();

async function submit(): Promise<void> {
  errorMessage.value = '';
  try {
    const saved = await saveLoan({ id: loanId.value, form: { ...state } });
    toast.add({
      title: isEditing.value ? t('loans.saved') : t('loans.lentToast', { title: saved.book.title }),
      color: 'success',
    });
    await goBackOr(router, { name: 'book', params: { id: saved.bookId } });
  } catch (err) {
    errorMessage.value = describeError(err, { conflict: t('loans.alreadyLent') });
  }
}

function cancel(): void {
  void goBackOr(router, { name: 'loans' });
}

const isConfirmingDelete = ref(false);
const { mutateAsync: deleteLoan, isPending: isDeleting } = useDeleteLoan();

async function confirmDelete(): Promise<void> {
  if (!loanId.value) return;
  try {
    await deleteLoan(loanId.value);
    toast.add({ title: t('loans.deleted'), color: 'success' });
    await router.push({ name: 'loans' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isConfirmingDelete.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold text-highlighted">
      {{ isEditing ? t('loans.edit') : t('loans.lend') }}
    </h1>

    <USkeleton v-if="isEditing && isLoading && !loadError" class="h-80 w-full" />

    <UCard v-else-if="loadError && isEditing">
      <p class="text-muted">{{ describeError(loadError) }}</p>
    </UCard>

    <UForm
      v-else
      :schema="schema"
      :validate="validateChoices"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="submit"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UCard>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('loans.fields.book')"
            name="bookId"
            :help="fixedBookId ? undefined : t('loans.pickBookHint')"
            required
            class="sm:col-span-2"
          >
            <div v-if="fixedBookId" class="flex items-center gap-3">
              <BookThumbnail :url="fileUrl(fixedBook?.cover)" :title="fixedBook?.title ?? ''" />
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ fixedBook?.title }}</p>
                <p v-if="fixedBook?.author" class="text-sm text-muted">{{ fixedBook.author }}</p>
              </div>
            </div>
            <BookPicker v-else v-model="state.bookId" />
          </UFormField>

          <UFormField
            :label="t('loans.fields.contact')"
            name="contact"
            :help="t('loans.contactHint')"
            required
            class="sm:col-span-2"
          >
            <ContactPicker v-model="state.contact" />
          </UFormField>

          <UFormField :label="t('loans.fields.lentAt')" name="lentAt" required>
            <UInput v-model="state.lentAt" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('loans.fields.dueAt')" name="dueAt">
            <UInput v-model.nullable="state.dueAt" type="date" class="w-full" />
          </UFormField>

          <UFormField
            v-if="isEditing && loan?.returnedAt"
            :label="t('loans.fields.returnedAt')"
            name="returnedAt"
          >
            <UInput v-model.nullable="state.returnedAt" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('loans.fields.note')" name="note" class="sm:col-span-2">
            <UTextarea
              v-model="state.note"
              :model-modifiers="{ nullable: true }"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="flex flex-wrap justify-between gap-2">
        <UButton
          v-if="isEditing"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          @click="isConfirmingDelete = true"
        >
          {{ t('loans.delete') }}
        </UButton>
        <div class="ml-auto flex gap-2">
          <UButton color="neutral" variant="ghost" @click="cancel">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" icon="i-lucide-check" :loading="isSaving">
            {{ isEditing ? t('common.save') : t('books.lend') }}
          </UButton>
        </div>
      </div>
    </UForm>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('loans.delete')"
      :description="t('loans.deleteConfirm', { title: loan?.book.title ?? '' })"
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
