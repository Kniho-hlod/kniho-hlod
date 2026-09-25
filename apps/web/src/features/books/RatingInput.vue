<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RATING_MAX } from '@kniho-hlod/domain';

const rating = defineModel<number | null>({ required: true });

const { t } = useI18n();
const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

function isLit(star: number): boolean {
  return rating.value !== null && star <= rating.value;
}

/** Choosing the current rating again clears it. */
function choose(star: number): void {
  rating.value = rating.value === star ? null : star;
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1"
    role="group"
    :aria-label="t('books.fields.rating')"
  >
    <UButton
      v-for="star in STARS"
      :key="star"
      icon="i-lucide-star"
      color="neutral"
      variant="ghost"
      square
      :aria-label="t('books.rateAs', { rating: star, max: RATING_MAX })"
      :aria-pressed="isLit(star)"
      :class="isLit(star) ? 'text-amber-500 [&_path]:fill-current' : 'text-dimmed'"
      @click="choose(star)"
    />
    <span class="ms-2 text-sm text-muted">
      {{
        rating === null ? t('books.noRating') : t('books.ratingOutOf', { rating, max: RATING_MAX })
      }}
    </span>
  </div>
</template>
