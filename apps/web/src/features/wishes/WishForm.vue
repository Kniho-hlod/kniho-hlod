<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { wishFields } from '@kniho-hlod/domain';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { describeIsbnLookupError, lookUpIsbn } from '@/features/books/api';
import type { WishFormState } from './api';

/**
 * A wish's fields: title and author, or an ISBN to fill them from the catalogues, and a note for
 * friends. The parent owns the buttons that submit it (`form` is the id they point at).
 */
defineProps<{ id: string }>();
const emit = defineEmits<{ submit: [] }>();
const state = defineModel<WishFormState>({ required: true });

const { t } = useI18n();
const toast = useToast();
// Adding and editing both send every field, so both check them as a new wish.
const schema = formSchema(wishFields, 'create');

const isLookingUp = ref(false);

async function lookUp(): Promise<void> {
  if (state.value.isbn.trim() === '') return;
  isLookingUp.value = true;
  try {
    const found = await lookUpIsbn(state.value.isbn.trim());
    state.value = {
      ...state.value,
      title: found.title,
      author: found.author ?? state.value.author,
      isbn: found.isbn,
    };
  } catch (err) {
    toast.add({ title: describeIsbnLookupError(err), color: 'warning' });
  } finally {
    isLookingUp.value = false;
  }
}
</script>

<template>
  <UForm
    :id="id"
    :schema="schema"
    :state="state"
    :validate-on="VALIDATE_ON"
    class="grid grid-cols-1 gap-4 sm:grid-cols-2"
    @submit="emit('submit')"
  >
    <UFormField :label="t('wishes.fields.isbn')" name="isbn" class="sm:col-span-2">
      <div class="flex gap-2">
        <UInput
          v-model="state.isbn"
          inputmode="numeric"
          :placeholder="t('wishes.isbnPlaceholder')"
          class="min-w-0 flex-1"
          @keydown.enter.prevent="lookUp"
        />
        <UButton
          icon="i-lucide-search"
          color="neutral"
          variant="outline"
          :loading="isLookingUp"
          :disabled="state.isbn.trim() === ''"
          @click="lookUp"
        >
          {{ t('wishes.lookUp') }}
        </UButton>
      </div>
    </UFormField>
    <UFormField :label="t('wishes.fields.title')" name="title" required>
      <UInput v-model="state.title" class="w-full" />
    </UFormField>
    <UFormField :label="t('wishes.fields.author')" name="author">
      <UInput v-model="state.author" class="w-full" />
    </UFormField>
    <UFormField
      :label="t('wishes.fields.note')"
      :description="t('wishes.noteHint')"
      name="note"
      class="sm:col-span-2"
    >
      <UTextarea v-model="state.note" :rows="2" autoresize class="w-full" />
    </UFormField>
  </UForm>
</template>
