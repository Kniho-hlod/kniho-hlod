<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { userFields } from '@kniho-hlod/domain';
import { pickFields } from '@/app/fields';
import { VALIDATE_ON, formSchema } from '@/app/validation';
import { describeError } from '@/app/errors';
import PasswordInput from '@/components/PasswordInput.vue';
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
    errorMessage.value = describeError(err, { conflict: t('auth.emailTaken') });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard class="ring-0 shadow-pop">
    <template #header>
      <h1 class="text-2xl font-extrabold text-highlighted">{{ t('auth.signUpTitle') }}</h1>
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
        <PasswordInput v-model="state.password" autocomplete="new-password" />
      </UFormField>

      <UButton type="submit" :loading="isSubmitting" block>{{ t('auth.signUp') }}</UButton>
    </UForm>

    <template #footer>
      <div class="flex flex-col gap-2">
        <p class="text-center text-sm text-muted">{{ t('auth.haveAccount') }}</p>
        <UButton :to="{ name: 'sign-in' }" color="neutral" variant="outline" block>
          {{ t('auth.signIn') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
