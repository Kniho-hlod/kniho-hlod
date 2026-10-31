<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { describeError } from '@/app/errors';
import { useSessionStore } from '@/features/auth/session-store';

/**
 * Sharing with friends, on the account page: whether friends see the library, what exactly they
 * see and never see, e-mails about friend requests and the weekly e-mail about friends. Each
 * switch saves at once.
 */
const { t } = useI18n();
const toast = useToast();
const session = useSessionStore();

type SharingSetting = 'shareLibrary' | 'emailNotifications' | 'weeklyDigest';
const saving = ref<SharingSetting | null>(null);

const shareLibrary = computed(() => session.user?.shareLibrary ?? false);
const emailNotifications = computed(() => session.user?.emailNotifications ?? true);
const weeklyDigest = computed(() => session.user?.weeklyDigest ?? true);

async function change(setting: SharingSetting, value: boolean): Promise<void> {
  saving.value = setting;
  try {
    await session.updateProfile({ [setting]: value });
    toast.add({ title: t(`friends.sharing.saved.${setting}.${value}`), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-bold text-highlighted">{{ t('friends.sharing.title') }}</h2>
    </template>

    <div class="flex flex-col gap-5">
      <UFormField
        :label="t('friends.sharing.shareLibrary')"
        :description="t('friends.sharing.shareLibraryHint')"
        orientation="horizontal"
      >
        <USwitch
          :model-value="shareLibrary"
          :loading="saving === 'shareLibrary'"
          :aria-label="t('friends.sharing.shareLibrary')"
          @update:model-value="change('shareLibrary', $event)"
        />
      </UFormField>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg bg-emerald-50 p-3 ring-2 ring-line/15 dark:bg-emerald-400/10">
          <p class="flex items-center gap-1.5 text-sm font-bold text-highlighted">
            <UIcon name="i-lucide-eye" class="size-4" />
            {{ t('friends.sharing.seenTitle') }}
          </p>
          <p class="mt-1 text-sm text-toned">{{ t('friends.sharing.seen') }}</p>
        </div>
        <div class="rounded-lg bg-rose-50 p-3 ring-2 ring-line/15 dark:bg-rose-400/10">
          <p class="flex items-center gap-1.5 text-sm font-bold text-highlighted">
            <UIcon name="i-lucide-eye-off" class="size-4" />
            {{ t('friends.sharing.privateTitle') }}
          </p>
          <p class="mt-1 text-sm text-toned">{{ t('friends.sharing.private') }}</p>
        </div>
      </div>

      <UFormField
        :label="t('friends.sharing.emailNotifications')"
        :description="t('friends.sharing.emailNotificationsHint')"
        orientation="horizontal"
      >
        <USwitch
          :model-value="emailNotifications"
          :loading="saving === 'emailNotifications'"
          :aria-label="t('friends.sharing.emailNotifications')"
          @update:model-value="change('emailNotifications', $event)"
        />
      </UFormField>

      <UFormField
        :label="t('friends.sharing.weeklyDigest')"
        :description="t('friends.sharing.weeklyDigestHint')"
        orientation="horizontal"
      >
        <USwitch
          :model-value="weeklyDigest"
          :loading="saving === 'weeklyDigest'"
          :aria-label="t('friends.sharing.weeklyDigest')"
          @update:model-value="change('weeklyDigest', $event)"
        />
      </UFormField>
    </div>
  </UCard>
</template>
