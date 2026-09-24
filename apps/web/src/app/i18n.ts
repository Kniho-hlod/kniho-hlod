import { createI18n } from 'vue-i18n';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@kniho-hlod/domain';
import cs from '@/locales/cs.json';
import en from '@/locales/en.json';

const LOCALE_STORAGE_KEY = 'kniho-hlod.locale';

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

/** The stored choice, else the browser's language, else Czech. */
export function readPreferredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const fromBrowser = navigator.language.split('-')[0];
  return isLocale(fromBrowser) ? fromBrowser : DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  locale: readPreferredLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { cs, en },
});

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export function translate(key: string, values?: Record<string, unknown>): string {
  return i18n.global.t(key, values ?? {});
}
