<script setup lang="ts">
import { DEFAULT_SHELF_COLOR } from '@kniho-hlod/domain';
import type { ShelfColor } from '@kniho-hlod/domain';
import { SHELF_DOT_CLASSES } from './shelf-colors';

defineProps<{ color: ShelfColor | null | undefined }>();
</script>

<template>
  <span
    class="inline-block size-2.5 shrink-0 rounded-full"
    :class="SHELF_DOT_CLASSES[color ?? DEFAULT_SHELF_COLOR]"
    aria-hidden="true"
  />
</template>
