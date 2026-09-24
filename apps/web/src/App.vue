<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { cs, en } from '@nuxt/ui/locale';

const { locale } = useI18n();

// Nuxt UI's own strings (date pickers, pagination, …) follow the app's language.
const uiLocale = computed(() => (locale.value === 'en' ? en : cs));
</script>

<template>
  <UApp :locale="uiLocale">
    <RouterView />
  </UApp>
</template>
