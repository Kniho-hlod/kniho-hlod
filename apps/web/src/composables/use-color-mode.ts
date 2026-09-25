import { computed, ref } from 'vue';

export type ColorMode = 'light' | 'dark';

const COLOR_MODE_STORAGE_KEY = 'kniho-hlod.color-mode';
const DARK_CLASS = 'dark';
const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function systemMode(): ColorMode {
  return window.matchMedia(PREFERS_DARK_QUERY).matches ? 'dark' : 'light';
}

const mode = ref<ColorMode>(readStoredMode() ?? systemMode());

function show(next: ColorMode): void {
  mode.value = next;
  document.documentElement.classList.toggle(DARK_CLASS, next === 'dark');
}

/** Only a choice the reader made is remembered; until then the system decides. */
function choose(next: ColorMode): void {
  show(next);
  localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
}

show(mode.value);
window.matchMedia(PREFERS_DARK_QUERY).addEventListener('change', () => {
  if (!readStoredMode()) show(systemMode());
});

/** Light or dark, remembered per browser; follows the system preference until it's changed. */
export function useColorMode() {
  return {
    mode: computed(() => mode.value),
    isDark: computed(() => mode.value === 'dark'),
    setMode: choose,
    toggle: () => choose(mode.value === 'dark' ? 'light' : 'dark'),
  };
}
