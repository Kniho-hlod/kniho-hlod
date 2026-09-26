<script setup lang="ts">
import { computed } from 'vue';

/**
 * The bookworm peeking over the sign-in card: it watches the form, shuts its eyes while a password
 * is typed and sulks after a failed sign-in. The card hides everything below its head.
 */
export type BookwormMood = 'watching' | 'shy' | 'sad';

const props = defineProps<{ mood: BookwormMood }>();

/** The outline and green of `src/assets/bookworm.svg`, here with a face that can change. */
const BODY_OUTLINE =
  'M34.2 15.2C39 15.2 42.9 19 42.9 23.5C42.9 27 41 29.5 38.2 31.8C36.6 33.4 35.3 35.3 35.2 37.5C35 38.5 34.5 39.5 34.3 40.5C33.8 42.8 30.2 45.8 27.3 45.8C24.3 45.8 21 43.5 21 40L21 37.5C21 36.2 21.5 35.2 22.3 34.6L24.3 33.5C24.8 32.2 26.3 30.5 26.3 28.5L26.3 22C26.3 18 29.8 15.2 34.2 15.2Z';
const BODY_COLOR = '#9ac06e';
const EYE_CENTERS = [
  { x: 32.1, y: 22.8 },
  { x: 38.7, y: 22.8 },
] as const;
const EYE_RADIUS = 2;
const PUPIL_RADIUS = 1;
const CLOSED_EYE_HALF_WIDTH = 1.7;
const CLOSED_EYE_DEPTH = 1.6;
const SMILE = 'M33.4 26.9Q35.4 29 37.4 26.9';
const FROWN = 'M33.6 27.9Q35.4 26.1 37.2 27.9';

interface Face {
  /** Tailwind classes that move the whole worm: ducking behind the card, drooping. */
  pose: string;
  /** Where the pupils sit in the eyes, or `null` for shut eyes. */
  pupils: { dx: number; dy: number } | null;
  mouth: string;
}

const FACES: Record<BookwormMood, Face> = {
  watching: { pose: 'translate-y-0', pupils: { dx: -0.6, dy: 0.6 }, mouth: SMILE },
  shy: { pose: 'translate-y-3.5', pupils: null, mouth: SMILE },
  sad: { pose: '-rotate-6', pupils: { dx: 0, dy: 0.9 }, mouth: FROWN },
};

const face = computed(() => FACES[props.mood]);

function closedEyePath({ x, y }: { x: number; y: number }): string {
  return `M${x - CLOSED_EYE_HALF_WIDTH} ${y}Q${x} ${y + CLOSED_EYE_DEPTH} ${x + CLOSED_EYE_HALF_WIDTH} ${y}`;
}
</script>

<template>
  <svg
    viewBox="16 14 33 33"
    aria-hidden="true"
    class="origin-bottom text-ink-900 transition-transform duration-300 ease-out motion-reduce:transition-none"
    :class="face.pose"
  >
    <path :d="BODY_OUTLINE" :fill="BODY_COLOR" />
    <g v-if="face.pupils" class="bookworm-eyes">
      <template v-for="eye in EYE_CENTERS" :key="eye.x">
        <circle :cx="eye.x" :cy="eye.y" :r="EYE_RADIUS" fill="#fff" />
        <circle
          :cx="eye.x + face.pupils.dx"
          :cy="eye.y + face.pupils.dy"
          :r="PUPIL_RADIUS"
          fill="currentColor"
        />
      </template>
    </g>
    <g fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round">
      <template v-if="!face.pupils">
        <path v-for="eye in EYE_CENTERS" :key="eye.x" :d="closedEyePath(eye)" />
      </template>
      <path :d="face.mouth" />
    </g>
  </svg>
</template>

<style scoped>
/* An occasional blink while the eyes are open. */
.bookworm-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: bookworm-blink 5s infinite;
}

@keyframes bookworm-blink {
  0%,
  94%,
  100% {
    transform: scaleY(1);
  }
  97% {
    transform: scaleY(0.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bookworm-eyes {
    animation: none;
  }
}
</style>
