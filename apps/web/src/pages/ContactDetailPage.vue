<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { ApiError } from '@eleansphere/entity-core';
import { describeError } from '@/app/errors';
import { useContact, useDeleteContact } from '@/features/contacts/api';
import LoanList from '@/features/loans/LoanList.vue';

const NOT_FOUND = 404;

const props = defineProps<{ id: string }>();

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const { data: contact, error, isPending } = useContact(toRef(props, 'id'));
const isMissing = computed(
  () => error.value instanceof ApiError && error.value.status === NOT_FOUND
);

const isConfirmingDelete = ref(false);
const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteContact();

async function confirmDelete(): Promise<void> {
  try {
    await deleteContact(props.id);
    toast.add({ title: t('contacts.deleted'), color: 'success' });
    await router.push({ name: 'contacts' });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('contacts.deleteBlocked') }),
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
      :to="{ name: 'contacts' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('contacts.title') }}
    </UButton>

    <USkeleton v-if="isPending && !error" class="h-32 w-full" />

    <UCard v-else-if="isMissing">
      <p class="text-muted">{{ t('contacts.notFound') }}</p>
    </UCard>

    <UAlert v-else-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <template v-else-if="contact">
      <header class="flex items-center gap-3">
        <UAvatar :alt="contact.name" size="xl" />
        <h1 class="min-w-0 text-2xl font-semibold break-words text-highlighted">
          {{ contact.name }}
        </h1>
      </header>

      <dl
        v-if="contact.email || contact.phone || contact.note"
        class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
      >
        <template v-if="contact.email">
          <dt class="text-muted">{{ t('contacts.fields.email') }}</dt>
          <dd>
            <a :href="`mailto:${contact.email}`" class="text-primary hover:underline">
              {{ contact.email }}
            </a>
          </dd>
        </template>
        <template v-if="contact.phone">
          <dt class="text-muted">{{ t('contacts.fields.phone') }}</dt>
          <dd>
            <a :href="`tel:${contact.phone}`" class="text-primary hover:underline">
              {{ contact.phone }}
            </a>
          </dd>
        </template>
        <template v-if="contact.note">
          <dt class="text-muted">{{ t('contacts.fields.note') }}</dt>
          <dd class="whitespace-pre-line">{{ contact.note }}</dd>
        </template>
      </dl>

      <div class="flex flex-wrap gap-2">
        <UButton :to="{ name: 'contact-edit', params: { id: contact.id } }" icon="i-lucide-pencil">
          {{ t('contacts.edit') }}
        </UButton>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          @click="isConfirmingDelete = true"
        >
          {{ t('contacts.delete') }}
        </UButton>
      </div>

      <section class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('contacts.borrowed') }}</h2>
        <LoanList
          :filters="{ state: 'active', contactId: contact.id }"
          :empty-text="t('contacts.nothingBorrowed')"
          seen-from="contact"
        />
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('contacts.history') }}</h2>
        <LoanList
          :filters="{ state: 'returned', contactId: contact.id }"
          :empty-text="t('loans.noHistory')"
          seen-from="contact"
        />
      </section>
    </template>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('contacts.delete')"
      :description="t('contacts.deleteConfirm', { name: contact?.name ?? '' })"
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
