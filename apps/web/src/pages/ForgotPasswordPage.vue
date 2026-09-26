<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toStandardSchema } from '@eleansphere/entity-core';
import type { Fields } from '@eleansphere/entity-core';
import { VALIDATE_ON, translateIssue } from '@/app/validation';
import { describeError } from '@/app/errors';
import { services } from '@/app/api';

const emailField = {
  email: { type: 'STRING', required: true, format: 'email' },
} as const satisfies Fields;

const { t } = useI18n();

const schema = toStandardSchema(emailField, 'create', { formatMessage: translateIssue });
const state = reactive({ email: '' });
const errorMessage = ref('');
const isSent = ref(false);
const isSubmitting = ref(false);

async function requestReset(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await services.auth.forgotPassword(state.email);
    isSent.value = true;
  } catch (err) {
    errorMessage.value = describeError(err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard class="ring-0 shadow-pop">
    <template #header>
      <h1 class="text-2xl font-extrabold text-highlighted">{{ t('auth.forgotPasswordTitle') }}</h1>
      <p class="text-sm text-muted">{{ t('auth.forgotPasswordHint') }}</p>
    </template>

    <UAlert
      v-if="isSent"
      color="success"
      variant="subtle"
      icon="i-lucide-mail-check"
      :description="t('auth.forgotPasswordSent')"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="requestReset"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UFormField :label="t('auth.email')" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" autofocus class="w-full" />
      </UFormField>

      <UButton type="submit" :loading="isSubmitting" block>{{ t('auth.send') }}</UButton>
    </UForm>

    <template #footer>
      <ULink :to="{ name: 'sign-in' }" class="text-sm">{{ t('common.back') }}</ULink>
    </template>
  </UCard>
</template>
