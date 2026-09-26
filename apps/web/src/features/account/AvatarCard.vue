<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useSessionStore } from '@/features/auth/session-store';
import { useAvatar } from './use-avatar';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

const { t } = useI18n();
const session = useSessionStore();
const { avatarUrl, uploadAvatar, isUploading } = useAvatar();

const errorMessage = ref('');

async function selectAvatar(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  errorMessage.value = '';
  if (file.size > MAX_AVATAR_BYTES) {
    errorMessage.value = t('account.avatarHint');
    return;
  }
  try {
    await uploadAvatar(file);
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-bold text-highlighted">{{ t('account.avatar') }}</h2>
    </template>

    <div class="flex items-center gap-4">
      <PersonAvatar :name="session.user?.displayName ?? ''" :src="avatarUrl" size="3xl" />
      <div class="flex flex-col gap-2">
        <label>
          <input
            type="file"
            class="sr-only"
            :accept="ACCEPTED_TYPES"
            :disabled="isUploading"
            @change="selectAvatar"
          />
          <UButton
            as="span"
            icon="i-lucide-upload"
            color="neutral"
            variant="subtle"
            :loading="isUploading"
          >
            {{ t('account.avatar') }}
          </UButton>
        </label>
        <p class="text-xs text-muted">{{ t('account.avatarHint') }}</p>
      </div>
    </div>

    <UAlert
      v-if="errorMessage"
      class="mt-4"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />
  </UCard>
</template>
