import { onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Typing pauses this long before a search runs, so each keystroke doesn't fire a request. */
export const SEARCH_DELAY_MS = 300;

/** `source`, but only once it has stopped changing for `delayMs`. */
export function useDebounced<T>(source: Ref<T>, delayMs: number = SEARCH_DELAY_MS): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(source, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = value;
    }, delayMs);
  });
  onBeforeUnmount(() => clearTimeout(timer));
  return debounced;
}
