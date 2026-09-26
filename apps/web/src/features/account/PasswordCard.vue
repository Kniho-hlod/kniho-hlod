<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toStandardSchema } from '@eleansphere/entity-core';
import type { Fields } from '@eleansphere/entity-core';
import { PASSWORD_MIN_LENGTH } from '@kniho-hlod/domain';
import { VALIDATE_ON, translateIssue } from '@/app/validation';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

const passwordChangeFields = {
  currentPassword: { type: 'STRING', required: true },
  newPassword: { type: 'STRING', required: true, minLength: PASSWORD_MIN_LENGTH },
} as const satisfies Fields;

const { t } = useI18n();
const session = useSessionStore();

const schema = toStandardSchema(passwordChangeFields, 'create', { formatMessage: translateIssue });
const state = reactive({ currentPassword: '', newPassword: '' });
const errorMessage = ref('');
const isChanged = ref(false);
const isSubmitting = ref(false);

async function changePassword(): Promise<void> {
  errorMessage.value = '';
  isChanged.value = false;
  isSubmitting.value = true;
  try {
    await session.changePassword(state.currentPassword, state.newPassword);
    state.currentPassword = '';
    state.newPassword = '';
    isChanged.value = true;
  } catch (err) {
    errorMessage.value = describeError(err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-bold text-highlighted">{{ t('account.changePassword') }}</h2>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="changePassword"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />
      <UAlert
        v-else-if="isChanged"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        :description="t('account.passwordChanged')"
      />

      <UFormField :label="t('auth.currentPassword')" name="currentPassword" required>
        <UInput
          v-model="state.currentPassword"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('auth.newPassword')" name="newPassword" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <div>
        <UButton type="submit" :loading="isSubmitting">{{ t('common.save') }}</UButton>
      </div>
    </UForm>
  </UCard>
</template>
