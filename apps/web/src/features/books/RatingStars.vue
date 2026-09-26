<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RATING_MAX } from '@kniho-hlod/domain';

/** `stars` draws all five; `score` is one star and the number, for tight spots like a card. */
export type RatingDisplay = 'stars' | 'score';

withDefaults(defineProps<{ rating: number; display?: RatingDisplay }>(), { display: 'stars' });

const { t } = useI18n();
const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);
const FILLED_STAR = 'text-amber-400 [&_path]:fill-current [&_path]:stroke-line';
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5"
    role="img"
    :aria-label="t('books.ratingOutOf', { rating, max: RATING_MAX })"
  >
    <template v-if="display === 'score'">
      <UIcon name="i-lucide-star" class="size-4" :class="FILLED_STAR" />
      <span class="text-sm font-bold text-highlighted">{{ rating }}</span>
    </template>
    <template v-else>
      <UIcon
        v-for="star in STARS"
        :key="star"
        name="i-lucide-star"
        class="size-4"
        :class="star <= rating ? FILLED_STAR : 'text-dimmed'"
      />
    </template>
  </span>
</template>
