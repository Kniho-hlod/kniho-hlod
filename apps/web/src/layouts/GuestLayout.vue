<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import SystemNotificationBanner from '@/components/SystemNotificationBanner.vue';

const { t } = useI18n();
</script>

<template>
  <div class="min-h-dvh bg-default flex flex-col">
    <header class="flex items-center justify-between p-4">
      <RouterLink to="/" class="flex items-center gap-2 font-semibold text-highlighted">
        <UIcon name="i-lucide-library-big" class="size-6 text-primary" />
        {{ t('app.name') }}
      </RouterLink>
      <AppearanceMenu />
    </header>

    <main class="flex flex-1 items-center justify-center px-4 pb-10">
      <div class="w-full max-w-md flex flex-col gap-4">
        <SystemNotificationBanner />
        <RouterView />
      </div>
    </main>
  </div>
</template>
