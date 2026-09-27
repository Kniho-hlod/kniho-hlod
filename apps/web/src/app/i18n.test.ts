import { describe, expect, it } from 'vitest';
import { czechPluralForm, i18n } from './i18n';

describe('Czech plurals', () => {
  it('picks the zero, one, few (2–4) or many form', () => {
    expect([0, 1, 2, 4, 5, 11, 22, 1.5].map(czechPluralForm)).toEqual([0, 1, 2, 2, 3, 3, 3, 3]);
  });

  it('counts books on a shelf the Czech way', () => {
    const countBooks = (count: number) =>
      i18n.global.t('shelves.bookCount', count, { locale: 'cs' });

    expect([0, 1, 3, 5].map(countBooks)).toEqual(['žádná kniha', '1 kniha', '3 knihy', '5 knih']);
  });
});

describe('Messages', () => {
  /** Every string in a locale file, by its dotted key; lists of lines keep their index. */
  function leafKeys(messages: unknown, prefix = ''): string[] {
    if (typeof messages === 'string') return [prefix];
    if (messages === null || typeof messages !== 'object') return [];
    return Object.entries(messages).flatMap(([key, value]) =>
      leafKeys(value, prefix ? `${prefix}.${key}` : key)
    );
  }

  it.each(['cs', 'en'] as const)("all compile in %s — `@` must be written {'@'}", (locale) => {
    const keys = leafKeys(i18n.global.getLocaleMessage(locale));

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(() => i18n.global.t(key, { count: 1 }, { locale }), key).not.toThrow();
    }
  });
});
