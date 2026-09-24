import { computed, ref } from 'vue';

export type ColorMode = 'light' | 'dark';

const COLOR_MODE_STORAGE_KEY = 'kniho-hlod.color-mode';
const DARK_CLASS = 'dark';

function readStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const mode = ref<ColorMode>(readStoredMode() ?? (prefersDark() ? 'dark' : 'light'));

function apply(next: ColorMode): void {
  mode.value = next;
  document.documentElement.classList.toggle(DARK_CLASS, next === 'dark');
  localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
}

apply(mode.value);

/** Light or dark, remembered per browser; follows the system preference until it's changed. */
export function useColorMode() {
  return {
    mode: computed(() => mode.value),
    isDark: computed(() => mode.value === 'dark'),
    setMode: apply,
    toggle: () => apply(mode.value === 'dark' ? 'light' : 'dark'),
  };
}
