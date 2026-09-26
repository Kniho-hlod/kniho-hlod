<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { cs, en } from '@nuxt/ui/locale';
import SplashScreen from '@/components/SplashScreen.vue';
import UpdatePrompt from '@/components/UpdatePrompt.vue';
import { useStartup } from '@/composables/use-startup';

/**
 * Toasts drop in at the top, clear of the phone's tab bar and the form's save bar, and go by
 * themselves. One that needs an answer sets `duration: 0` (`UpdatePrompt`).
 */
const TOASTER = { position: 'top-center', duration: 2000 } as const;

const { locale } = useI18n();
const isStarting = useStartup();

// Nuxt UI's own strings (date pickers, pagination, …) follow the app's language.
const uiLocale = computed(() => (locale.value === 'en' ? en : cs));
</script>

<template>
  <UApp :locale="uiLocale" :toaster="TOASTER">
    <RouterView />
    <!-- Over the first page, so that page is already there when the splash screen fades. -->
    <Transition
      leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <SplashScreen v-if="isStarting" />
    </Transition>
    <UpdatePrompt />
  </UApp>
</template>
