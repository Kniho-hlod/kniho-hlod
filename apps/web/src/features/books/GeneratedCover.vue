<script setup lang="ts">
import { computed } from 'vue';
import { coverDesign } from './generated-cover';

/** `cover` sets the title and author; a `thumbnail` is too small for words and shows an initial. */
export type GeneratedCoverSize = 'cover' | 'thumbnail';

const props = defineProps<{
  title: string;
  author?: string | null;
  size: GeneratedCoverSize;
}>();

const design = computed(() => coverDesign(props.title));
const initial = computed(() => props.title.trim().charAt(0).toLocaleUpperCase());
</script>

<template>
  <!-- Sizes are in container units (`cqw`), so the design scales with whatever holds it. -->
  <div
    class="@container relative flex size-full flex-col overflow-hidden"
    :class="[design.palette.background, design.palette.text]"
    aria-hidden="true"
  >
    <span
      v-if="design.motif === 'sun'"
      class="absolute -top-[12%] -right-[22%] size-[78%] rounded-full ring-2 ring-line"
      :class="design.palette.accent"
    />
    <span
      v-else-if="design.motif === 'arch'"
      class="absolute inset-x-[18%] -bottom-[4%] h-[42%] rounded-t-full ring-2 ring-line"
      :class="design.palette.accent"
    />
    <template v-else-if="design.motif === 'stripes'">
      <span
        class="absolute inset-x-0 bottom-[20%] h-[7%] ring-2 ring-line"
        :class="design.palette.accent"
      />
      <span
        class="absolute inset-x-0 bottom-[8%] h-[5%] ring-2 ring-line"
        :class="design.palette.accent"
      />
    </template>
    <span
      v-else
      class="absolute inset-x-[10%] bottom-[8%] h-[34%] bg-[radial-gradient(currentColor_1.5px,transparent_1.5px)] bg-size-[10px_10px] opacity-40"
    />
    <!-- The spine's crease. -->
    <span class="absolute inset-y-0 left-[7%] w-[2.5%] bg-line/15" />

    <span
      v-if="size === 'thumbnail'"
      class="relative m-auto font-display text-[52cqw] leading-none font-extrabold"
    >
      {{ initial }}
    </span>
    <template v-else>
      <span
        class="relative mt-[14%] ml-[16%] mr-[10%] line-clamp-4 font-display text-[13cqw] leading-[1.05] font-extrabold break-words hyphens-auto"
      >
        {{ title }}
      </span>
      <span
        v-if="author"
        class="relative mt-[5%] ml-[16%] mr-[10%] line-clamp-2 text-[7.5cqw] leading-tight font-semibold opacity-85"
      >
        {{ author }}
      </span>
    </template>
  </div>
</template>
