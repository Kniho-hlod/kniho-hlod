<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { toStandardSchema } from '@eleansphere/entity-core';
import type { Fields } from '@eleansphere/entity-core';
import { VALIDATE_ON, translateIssue } from '@/app/validation';
import { describeError } from '@/app/errors';
import PasswordInput from '@/components/PasswordInput.vue';
import PeekingBookworm, { type BookwormMood } from '@/components/PeekingBookworm.vue';
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
const isTypingPassword = ref(false);

const bookwormMood = computed<BookwormMood>(() => {
  if (isTypingPassword.value) return 'shy';
  return errorMessage.value ? 'sad' : 'watching';
});

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
  <!-- Room above the card for the bookworm's head; the card hides the rest of it. -->
  <div class="relative mt-12">
    <PeekingBookworm
      :mood="bookwormMood"
      class="pointer-events-none absolute -top-12 right-8 size-24"
    />
    <UCard class="relative ring-0 shadow-pop">
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
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('auth.password')" name="password" required>
          <template #hint>
            <ULink :to="{ name: 'forgot-password' }">{{ t('auth.forgotPassword') }}</ULink>
          </template>
          <PasswordInput
            v-model="state.password"
            autocomplete="current-password"
            @focus="isTypingPassword = true"
            @blur="isTypingPassword = false"
          />
        </UFormField>

        <UButton type="submit" :loading="isSubmitting" block>{{ t('auth.signIn') }}</UButton>
      </UForm>

      <template #footer>
        <div class="flex flex-col gap-2">
          <p class="text-center text-sm text-muted">{{ t('auth.noAccount') }}</p>
          <UButton :to="{ name: 'sign-up' }" color="neutral" variant="outline" block>
            {{ t('auth.signUp') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
