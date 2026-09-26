<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppLogo from '@/components/AppLogo.vue';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import SystemNotificationBanner from '@/components/SystemNotificationBanner.vue';
import splashImageUrl from '@/assets/splash.webp';

const { t } = useI18n();
</script>

<template>
  <div class="min-h-dvh bg-paper flex flex-col">
    <header class="flex items-center justify-between p-4">
      <RouterLink to="/" class="group rounded-lg">
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
          <!-- The splash screen's picture, stuck on like a photo: on a phone, a strip with the
               bookworm's head above the headline; beside the form, the whole picture. -->
          <div
            aria-hidden="true"
            class="order-first h-36 w-full rounded-xl bg-ink-900 bg-[length:170%_auto] bg-[position:56%_34%] shadow-pop lg:order-none lg:mt-4 lg:aspect-[7/4] lg:h-auto lg:max-w-lg lg:-rotate-2 lg:bg-cover lg:bg-center"
            :style="{ backgroundImage: `url(${splashImageUrl})` }"
          />
        </section>

        <div class="flex flex-col gap-4">
          <SystemNotificationBanner />
          <RouterView />
        </div>
      </div>
    </main>
  </div>
</template>
