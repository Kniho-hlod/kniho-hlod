<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <main class="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
    <UIcon name="i-lucide-compass" class="size-10 text-primary" />
    <h1 class="text-2xl font-semibold text-highlighted">404</h1>
    <UButton :to="{ name: 'home' }" color="neutral" variant="subtle">
      {{ t('common.back') }}
    </UButton>
  </main>
</template>
