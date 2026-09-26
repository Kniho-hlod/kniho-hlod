<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppLogo from '@/components/AppLogo.vue';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import BookSpines from '@/components/BookSpines.vue';
import SystemNotificationBanner from '@/components/SystemNotificationBanner.vue';

const { t } = useI18n();
</script>

<template>
  <div class="min-h-dvh bg-paper flex flex-col">
    <header class="flex items-center justify-between p-4">
      <RouterLink to="/" class="rounded-lg">
        <AppLogo />
      </RouterLink>
      <AppearanceMenu />
    </header>

    <main class="flex flex-1 items-center justify-center px-4 pb-10">
      <div
        class="grid w-full max-w-md items-center gap-8 lg:max-w-5xl lg:grid-cols-[1fr_28rem] lg:gap-16"
      >
        <section class="flex flex-col gap-4 lg:gap-6">
          <p
            class="font-display text-3xl font-extrabold leading-tight text-highlighted lg:text-6xl lg:leading-[1.02]"
          >
            {{ t('app.heroTitle') }}
          </p>
          <p class="text-toned lg:max-w-md lg:text-lg">{{ t('app.tagline') }}</p>
          <BookSpines class="h-24 w-64 lg:mt-4 lg:h-52 lg:w-md" />
        </section>

        <div class="flex flex-col gap-4">
          <SystemNotificationBanner />
          <RouterView />
        </div>
      </div>
    </main>
  </div>
</template>
