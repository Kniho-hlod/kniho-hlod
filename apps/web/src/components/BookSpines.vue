<script setup lang="ts">
/** A shelf of book spines drawn in the app's colours — decoration, hidden from screen readers. */
interface Spine {
  /** Literal Tailwind classes: colour, height and width (Tailwind only sees whole class names). */
  classes: string;
  /** Leaning against its neighbour. */
  leaning?: boolean;
}

const SPINES: Spine[] = [
  { classes: 'bg-rose-500 h-[70%] w-[9%]' },
  { classes: 'bg-indigo-500 h-[92%] w-[12%]' },
  { classes: 'bg-yellow-300 h-[80%] w-[8%]' },
  { classes: 'bg-emerald-500 h-[64%] w-[10%]' },
  { classes: 'bg-orange-500 h-[86%] w-[11%]' },
  { classes: 'bg-sky-400 h-[74%] w-[8%]' },
  { classes: 'bg-violet-500 h-[96%] w-[12%]' },
  { classes: 'bg-pink-400 h-[68%] w-[9%]', leaning: true },
];
</script>

<template>
  <div class="flex flex-col" aria-hidden="true">
    <div class="flex h-full items-end gap-[2%] px-[4%]">
      <div
        v-for="(spine, index) in SPINES"
        :key="index"
        class="flex shrink-0 flex-col justify-between rounded-md py-[6%] ring-2 ring-line"
        :class="[
          spine.classes,
          spine.leaning && 'origin-bottom-left rotate-[14deg] translate-x-[6%]',
        ]"
      >
        <span class="h-[5%] min-h-1 bg-line/25" />
        <span class="mx-auto h-[28%] w-[35%] rounded-full bg-white/60" />
        <span class="h-[5%] min-h-1 bg-line/25" />
      </div>
    </div>
    <div class="h-2 rounded-full bg-line" />
  </div>
</template>
