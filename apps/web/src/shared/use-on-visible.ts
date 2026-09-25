import { onBeforeUnmount, watch } from 'vue';
import type { Ref } from 'vue';

/** How far below the viewport the target may still be: start loading before it scrolls in. */
const DEFAULT_ROOT_MARGIN = '400px';

/** Calls `onVisible` whenever `target` comes into view — e.g. to load a list's next page. */
export function useOnVisible(
  target: Ref<HTMLElement | null>,
  onVisible: () => void,
  rootMargin = DEFAULT_ROOT_MARGIN
): void {
  let observer: IntersectionObserver | undefined;

  const stopWatching = watch(
    target,
    (element) => {
      observer?.disconnect();
      if (!element) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onVisible();
        },
        { rootMargin }
      );
      observer.observe(element);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    stopWatching();
    observer?.disconnect();
  });
}
