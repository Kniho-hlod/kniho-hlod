<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useInstallPrompt } from '@/shared/install-prompt';

/** Offers to install the app, where the browser can; the `actions` slot adds buttons. */
const { t } = useI18n();
const { option, install } = useInstallPrompt();
</script>

<template>
  <UCard v-if="option !== 'none'">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-smartphone" class="mt-0.5 size-6 shrink-0 text-primary" />
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="font-semibold text-highlighted">{{ t('install.title') }}</h2>
          <p class="text-sm text-muted">{{ t('install.description') }}</p>
          <p v-if="option === 'share-menu'" class="text-sm text-default">
            {{ t('install.shareMenuSteps') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="option === 'prompt'" icon="i-lucide-download" @click="install">
            {{ t('install.install') }}
          </UButton>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </UCard>
</template>
