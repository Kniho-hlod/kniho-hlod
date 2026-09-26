<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SHELF_COLORS } from '@kniho-hlod/domain';
import type { ShelfColor } from '@kniho-hlod/domain';
import { SHELF_DOT_CLASSES } from './shelf-colors';

const color = defineModel<ShelfColor>({ required: true });

const { t } = useI18n();
</script>

<template>
  <div role="radiogroup" :aria-label="t('shelves.fields.color')" class="flex flex-wrap gap-2">
    <button
      v-for="option in SHELF_COLORS"
      :key="option"
      type="button"
      role="radio"
      :aria-checked="color === option"
      :aria-label="t(`shelves.colors.${option}`)"
      :title="t(`shelves.colors.${option}`)"
      class="flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 motion-reduce:transition-none ring-offset-2 ring-offset-(--ui-bg) focus-visible:outline-2 focus-visible:outline-primary"
      :class="[
        SHELF_DOT_CLASSES[option],
        color === option ? 'ring-2 ring-(--ui-text-highlighted)' : '',
      ]"
      @click="color = option"
    >
      <UIcon v-if="color === option" name="i-lucide-check" class="size-4 text-white" />
    </button>
  </div>
</template>
