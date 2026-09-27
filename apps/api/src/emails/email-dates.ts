import type { Locale } from '@kniho-hlod/domain';

const CZECH_FEW_MAX = 4;

/** `2026-10-10` → "10. 10. 2026" or "Oct 10, 2026", as the app shows dates. */
export function formatEmailDate(date: string, locale: Locale): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

/** "1 den", "2 dny", "5 dní" — or "1 day", "5 days". */
export function dayCount(count: number, locale: Locale): string {
  if (locale === 'en') return count === 1 ? '1 day' : `${count} days`;
  if (count === 1) return '1 den';
  if (count > 1 && count <= CZECH_FEW_MAX) return `${count} dny`;
  return `${count} dní`;
}
