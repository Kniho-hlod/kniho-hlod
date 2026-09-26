<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import bookwormUrl from '@/assets/bookworm.svg';

const { t } = useI18n();
</script>

<template>
  <span class="flex items-center gap-2.5 font-display text-lg font-extrabold text-highlighted">
    <span
      class="grid size-8 place-items-center rounded-lg bg-white ring-2 ring-line shadow-pop-sm -rotate-6"
    >
      <img :src="bookwormUrl" alt="" class="size-7" />
    </span>
    {{ t('app.name') }}
  </span>
</template>
