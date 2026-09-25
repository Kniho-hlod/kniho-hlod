<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RATING_MAX } from '@kniho-hlod/domain';

defineProps<{ rating: number }>();

const { t } = useI18n();
const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5"
    role="img"
    :aria-label="t('books.ratingOutOf', { rating, max: RATING_MAX })"
  >
    <UIcon
      v-for="star in STARS"
      :key="star"
      name="i-lucide-star"
      class="size-4"
      :class="star <= rating ? 'text-amber-500 [&_path]:fill-current' : 'text-dimmed'"
    />
  </span>
</template>
