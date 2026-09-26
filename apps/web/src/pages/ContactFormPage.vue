<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { contactFields } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { goBackOr } from '@/app/navigation';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import FormActions from '@/components/FormActions.vue';
import { contactFormFrom, useContact, useSaveContact } from '@/features/contacts/api';

const CONTACT_FORM_FIELDS = ['name', 'email', 'phone', 'note'] as const;

/** Without `id` the form adds a contact; with it, it edits that contact. */
const props = defineProps<{ id?: string }>();

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const contactId = toRef(props, 'id');
const isEditing = computed(() => contactId.value !== undefined);
const { data: contact, error: loadError, isPending: isLoading } = useContact(contactId);

const schema = formSchema(pickFields(contactFields, CONTACT_FORM_FIELDS), 'create');
const state = reactive(contactFormFrom());
const errorMessage = ref('');

// The contact to edit fills the form once — a background refetch must not overwrite what's typed.
const hasFilledForm = ref(false);
watch(
  contact,
  (loaded) => {
    if (!loaded || hasFilledForm.value) return;
    Object.assign(state, contactFormFrom(loaded));
    hasFilledForm.value = true;
  },
  { immediate: true }
);

const { mutateAsync: saveContact, isPending: isSaving } = useSaveContact();

async function submit(): Promise<void> {
  errorMessage.value = '';
  try {
    const saved = await saveContact({ id: contactId.value, form: { ...state } });
    toast.add({ title: t('contacts.saved'), color: 'success' });
    const savedContact = { name: 'contact', params: { id: saved.id } };
    // An edit returns to where it started; a new contact's form gives way to its page.
    if (isEditing.value) await goBackOr(router, savedContact);
    else await router.replace(savedContact);
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}

function cancel(): void {
  void goBackOr(router, { name: 'contacts' });
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-3xl font-extrabold text-highlighted">
      {{ isEditing ? t('contacts.edit') : t('contacts.add') }}
    </h1>

    <USkeleton v-if="isEditing && isLoading && !loadError" class="h-64 w-full" />

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
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('contacts.fields.name')" name="name" required class="sm:col-span-2">
            <UInput v-model="state.name" autocomplete="off" class="w-full" />
          </UFormField>
          <UFormField :label="t('contacts.fields.email')" name="email">
            <UInput v-model.nullable="state.email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('contacts.fields.phone')" name="phone">
            <UInput v-model.nullable="state.phone" type="tel" class="w-full" />
          </UFormField>
          <UFormField :label="t('contacts.fields.note')" name="note" class="sm:col-span-2">
            <UTextarea
              v-model="state.note"
              :model-modifiers="{ nullable: true }"
              :rows="3"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <FormActions>
        <UButton color="neutral" variant="ghost" @click="cancel">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" icon="i-lucide-check" :loading="isSaving">
          {{ t('common.save') }}
        </UButton>
      </FormActions>
    </UForm>
  </section>
</template>
