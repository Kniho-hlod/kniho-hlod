<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { toStandardSchema } from '@eleansphere/entity-core';
import type { Fields } from '@eleansphere/entity-core';
import { VALIDATE_ON, translateIssue } from '@/app/validation';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

/** Sign-in only checks that something plausible was typed; the server decides the rest. */
const credentialFields = {
  email: { type: 'STRING', required: true, format: 'email' },
  password: { type: 'STRING', required: true },
} as const satisfies Fields;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const schema = toStandardSchema(credentialFields, 'create', { formatMessage: translateIssue });
const state = reactive({ email: '', password: '' });
const errorMessage = ref('');
const isSubmitting = ref(false);

async function signIn(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await session.signIn(state.email, state.password);
    const redirect = route.query.redirect;
    await router.push(typeof redirect === 'string' ? redirect : { name: 'home' });
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
      <h1 class="text-2xl font-extrabold text-highlighted">{{ t('auth.signInTitle') }}</h1>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="signIn"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UFormField :label="t('auth.email')" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" autofocus class="w-full" />
      </UFormField>

      <UFormField :label="t('auth.password')" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" :loading="isSubmitting" block>{{ t('auth.signIn') }}</UButton>
    </UForm>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <ULink :to="{ name: 'forgot-password' }">{{ t('auth.forgotPassword') }}</ULink>
        <span class="text-muted">
          {{ t('auth.noAccount') }}
          <ULink :to="{ name: 'sign-up' }">{{ t('auth.signUp') }}</ULink>
        </span>
      </div>
    </template>
  </UCard>
</template>
