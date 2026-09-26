<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <span class="flex items-center gap-2.5 font-display text-lg font-extrabold text-highlighted">
    <span
      class="grid size-8 place-items-center rounded-lg bg-primary-500 text-white shadow-pop-sm -rotate-6"
    >
      <UIcon name="i-lucide-library-big" class="size-5" />
    </span>
    {{ t('app.name') }}
  </span>
</template>
