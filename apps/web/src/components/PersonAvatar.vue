<script setup lang="ts">
import { computed } from 'vue';
import type { AvatarProps } from '@nuxt/ui';
import { coverDesign } from '@/features/books/generated-cover';

const props = defineProps<{
  name: string;
  /** Their picture; without one, their initials. */
  src?: string;
  size?: AvatarProps['size'];
}>();

/** People get the colours drawn covers get, picked from the name, so each keeps their own. */
const palette = computed(() => coverDesign(props.name).palette);
</script>

<template>
  <UAvatar
    :src="src"
    :alt="name"
    :size="size"
    class="shrink-0 ring-2 ring-line"
    :class="palette.background"
    :ui="{ fallback: `font-bold ${palette.text}` }"
  />
</template>
