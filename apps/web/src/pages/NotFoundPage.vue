<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BookSpines from '@/components/BookSpines.vue';

const { t } = useI18n();
</script>

<template>
  <main class="min-h-dvh bg-paper flex flex-col items-center justify-center gap-5 p-6 text-center">
    <BookSpines class="h-28 w-60" />
    <h1 class="font-display text-6xl font-extrabold text-highlighted">404</h1>
    <p class="max-w-sm text-lg text-toned">{{ t('common.pageNotFound') }}</p>
    <UButton :to="{ name: 'home' }" icon="i-lucide-arrow-left">
      {{ t('common.back') }}
    </UButton>
  </main>
</template>
