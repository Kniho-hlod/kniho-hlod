<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { ApiError } from '@eleansphere/entity-core';
import { userFields } from '@kniho-hlod/domain';
import { pickFields } from '@/app/fields';
import { VALIDATE_ON, formSchema } from '@/app/validation';
import { describeError } from '@/app/errors';
import { services } from '@/app/api';

const BAD_REQUEST = 400;

const { t } = useI18n();
const route = useRoute();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const schema = formSchema(pickFields(userFields, ['password']), 'create');
const state = reactive({ password: '' });
const errorMessage = ref('');
const isDone = ref(false);
const isSubmitting = ref(false);

async function resetPassword(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await services.auth.resetPassword(token.value, state.password);
    isDone.value = true;
  } catch (err) {
    const isExpiredLink = err instanceof ApiError && err.status === BAD_REQUEST;
    errorMessage.value = isExpiredLink ? t('auth.resetPasswordInvalid') : describeError(err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-xl font-semibold text-highlighted">{{ t('auth.resetPasswordTitle') }}</h1>
    </template>

    <UAlert
      v-if="!token"
      color="error"
      variant="subtle"
      :description="t('auth.resetPasswordInvalid')"
    />

    <UAlert
      v-else-if="isDone"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      :description="t('auth.resetPasswordDone')"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="resetPassword"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UFormField :label="t('auth.newPassword')" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          autofocus
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" :loading="isSubmitting" block>{{ t('common.save') }}</UButton>
    </UForm>

    <template #footer>
      <ULink :to="{ name: 'sign-in' }" class="text-sm">{{ t('auth.signIn') }}</ULink>
    </template>
  </UCard>
</template>
