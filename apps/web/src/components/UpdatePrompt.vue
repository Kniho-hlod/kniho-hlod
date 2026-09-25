<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { useRegisterSW } from 'virtual:pwa-register/vue';

/**
 * Registers the service worker and says when a new version of the app is ready. The new version
 * waits until the reader reloads — never mid-form.
 */
const { t } = useI18n();
const toast = useToast();
const { needRefresh, updateServiceWorker } = useRegisterSW();

watch(needRefresh, (isNewVersionReady) => {
  if (!isNewVersionReady) return;
  toast.add({
    title: t('app.updateReady'),
    description: t('app.updateHint'),
    icon: 'i-lucide-refresh-cw',
    duration: 0,
    actions: [{ label: t('app.reload'), onClick: () => void updateServiceWorker(true) }],
  });
});
</script>

<template>
  <span hidden />
</template>
