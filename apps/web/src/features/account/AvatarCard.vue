<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { FILE_ROLES } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

const { t } = useI18n();
const session = useSessionStore();
const queryClient = useQueryClient();

const errorMessage = ref('');
const avatarSlot = services.users.files(FILE_ROLES.avatar);
const userId = computed(() => session.user?.id ?? '');
const avatarQueryKey = computed(() => ['avatar', userId.value]);

const { data: avatars } = useQuery({
  queryKey: avatarQueryKey,
  queryFn: () => avatarSlot.list(userId.value),
  enabled: computed(() => userId.value !== ''),
});

const avatarUrl = computed(() => avatars.value?.[0]?.url);

const { mutateAsync: uploadAvatar, isPending } = useMutation({
  mutationFn: (file: File) => avatarSlot.upload(userId.value, file),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: avatarQueryKey.value }),
});

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
      <h2 class="font-semibold text-highlighted">{{ t('account.avatar') }}</h2>
    </template>

    <div class="flex items-center gap-4">
      <UAvatar :src="avatarUrl" :alt="session.user?.displayName" size="3xl" />
      <div class="flex flex-col gap-2">
        <label>
          <input
            type="file"
            class="sr-only"
            :accept="ACCEPTED_TYPES"
            :disabled="isPending"
            @change="selectAvatar"
          />
          <UButton as="span" icon="i-lucide-upload" color="neutral" variant="subtle" :loading="isPending">
            {{ t('account.avatar') }}
          </UButton>
        </label>
        <p class="text-xs text-muted">{{ t('account.avatarHint') }}</p>
      </div>
    </div>

    <UAlert v-if="errorMessage" class="mt-4" color="error" variant="subtle" :description="errorMessage" />
  </UCard>
</template>
