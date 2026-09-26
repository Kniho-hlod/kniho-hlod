<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { TourTarget } from './tour-steps';

/**
 * A ring around the element the tour talks about, with the rest of the page dimmed. It follows
 * the element as the page scrolls, resizes or loads, scrolls it into view, and lets every click
 * through.
 */
const props = defineProps<{ target: TourTarget }>();

/** Room between the element and the ring, in pixels. */
const RING_GAP = 6;
/** The element must stay put this long before the page scrolls to it: the page is still loading. */
const SETTLED_MS = 200;
/** A scroll gets this long to finish before another one may start. */
const SCROLL_MS = 700;
/**
 * For this long after a step starts, content loading above the element (a card, a list) brings
 * it back into view. Later the reader scrolls freely.
 */
const FOLLOW_LAYOUT_MS = 3000;
/** The share of the window above the tour's card, where the element should be seen. */
const VISIBLE_SHARE = 0.65;

interface Frame {
  top: number;
  left: number;
  width: number;
  height: number;
}

const frame = ref<Frame | null>(null);
let animationFrame = 0;
let stepStartedAt = performance.now();
/** Where the element sits in the page — it changes when the layout does, not when it scrolls. */
let lastPageTop: number | null = null;
let unmovedSince = 0;
let lastScrollAt: number | null = null;

/** The mark's visible element: navigation is marked once in the header and once in the tab bar. */
function findTarget(): HTMLElement | null {
  const marked = document.querySelectorAll<HTMLElement>(`[data-tour="${props.target}"]`);
  return [...marked].find((element) => element.getClientRects().length > 0) ?? null;
}

function scrollBehavior(): 'auto' | 'smooth' {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function isSameFrame(left: Frame | null, right: Frame | null): boolean {
  return (
    left?.top === right?.top &&
    left?.left === right?.left &&
    left?.width === right?.width &&
    left?.height === right?.height
  );
}

function isWellInView(bounds: DOMRect): boolean {
  return bounds.top >= 0 && bounds.bottom <= window.innerHeight * VISIBLE_SHARE;
}

/** Scrolls to the element once it has stopped moving, and again if loading moves it early on. */
function keepInView(element: HTMLElement, bounds: DOMRect, now: number): void {
  const pageTop = bounds.top + window.scrollY;
  if (pageTop !== lastPageTop) {
    lastPageTop = pageTop;
    unmovedSince = now;
    return;
  }
  const hasSettled = now - unmovedSince >= SETTLED_MS;
  const isScrolling = lastScrollAt !== null && now - lastScrollAt < SCROLL_MS;
  const mayScroll = lastScrollAt === null || now - stepStartedAt < FOLLOW_LAYOUT_MS;
  if (hasSettled && !isScrolling && mayScroll && !isWellInView(bounds)) {
    lastScrollAt = now;
    element.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }
}

function follow(now: number): void {
  const element = findTarget();
  const bounds = element?.getBoundingClientRect();
  if (element && bounds) keepInView(element, bounds, now);
  const next = bounds
    ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height }
    : null;
  if (!isSameFrame(frame.value, next)) frame.value = next;
  animationFrame = requestAnimationFrame(follow);
}

watch(
  () => props.target,
  () => {
    stepStartedAt = performance.now();
    lastPageTop = null;
    lastScrollAt = null;
  }
);

onMounted(() => {
  animationFrame = requestAnimationFrame(follow);
});
onBeforeUnmount(() => cancelAnimationFrame(animationFrame));

const ringStyle = computed(() =>
  frame.value
    ? {
        top: `${frame.value.top - RING_GAP}px`,
        left: `${frame.value.left - RING_GAP}px`,
        width: `${frame.value.width + 2 * RING_GAP}px`,
        height: `${frame.value.height + 2 * RING_GAP}px`,
      }
    : undefined
);
</script>

<template>
  <div
    v-if="ringStyle"
    aria-hidden="true"
    class="pointer-events-none fixed z-30 rounded-xl ring-4 ring-secondary shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]"
    :style="ringStyle"
  />
</template>
