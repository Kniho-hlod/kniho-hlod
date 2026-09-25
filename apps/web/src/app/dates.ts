import { i18n } from './i18n';

/**
 * `2026-09-25` → "25. 9. 2026" (cs) or "Sep 25, 2026" (en). A calendar date has no time zone, so
 * it is formatted as UTC midnight and can't slip to the neighbouring day.
 */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(i18n.global.locale.value, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
