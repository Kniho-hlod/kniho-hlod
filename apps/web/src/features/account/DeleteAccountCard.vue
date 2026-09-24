<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();

const password = ref('');
const errorMessage = ref('');
const isConfirming = ref(false);
const isSubmitting = ref(false);

async function deleteAccount(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await session.deleteAccount(password.value);
    await router.push({ name: 'sign-in' });
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
      <h2 class="font-semibold text-error">{{ t('account.dangerZone') }}</h2>
    </template>

    <p class="text-sm text-muted">{{ t('account.deleteAccountHint') }}</p>

    <div v-if="!isConfirming" class="mt-4">
      <UButton color="error" variant="subtle" @click="isConfirming = true">
        {{ t('account.deleteAccount') }}
      </UButton>
    </div>

    <form v-else class="mt-4 flex flex-col gap-3" @submit.prevent="deleteAccount">
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UFormField :label="t('account.deleteAccountConfirm')" name="password" required>
        <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>

      <div class="flex gap-2">
        <UButton type="submit" color="error" :loading="isSubmitting" :disabled="!password">
          {{ t('account.deleteAccount') }}
        </UButton>
        <UButton color="neutral" variant="ghost" @click="isConfirming = false">
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </form>
  </UCard>
</template>
