<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { userFields } from '@kniho-hlod/domain';
import { pickFields } from '@/app/fields';
import { VALIDATE_ON, formSchema } from '@/app/validation';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

const { t, locale } = useI18n();
const router = useRouter();
const session = useSessionStore();

const schema = formSchema(pickFields(userFields, ['displayName', 'email', 'password']), 'create');
const state = reactive({ displayName: '', email: '', password: '' });
const errorMessage = ref('');
const isSubmitting = ref(false);

async function signUp(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await session.register({ ...state, locale: locale.value as 'cs' | 'en' });
    await router.push({ name: 'home' });
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
      <h1 class="text-xl font-semibold text-highlighted">{{ t('auth.signUpTitle') }}</h1>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="signUp"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UFormField :label="t('auth.displayName')" name="displayName" required>
        <UInput v-model="state.displayName" autocomplete="name" autofocus class="w-full" />
      </UFormField>

      <UFormField :label="t('auth.email')" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>

      <UFormField :label="t('auth.password')" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" :loading="isSubmitting" block>{{ t('auth.signUp') }}</UButton>
    </UForm>

    <template #footer>
      <p class="text-sm text-muted">
        {{ t('auth.haveAccount') }}
        <ULink :to="{ name: 'sign-in' }">{{ t('auth.signIn') }}</ULink>
      </p>
    </template>
  </UCard>
</template>
