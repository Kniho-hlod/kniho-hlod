import { todayIn } from '@eleansphere/schema';
import { DEFAULT_TIMEZONE } from './constants';

/**
 * Today's date (`YYYY-MM-DD`) where a reader lives — the "today" loans are measured against, the
 * same in the API and the app. The profile's time zone is free text: a missing or unknown one
 * falls back to the default zone.
 */
export function readerToday(timezone: unknown, now: Date = new Date()): string {
  if (typeof timezone === 'string') {
    try {
      return todayIn(timezone, now);
    } catch {
      // Not an IANA zone the runtime knows; use the default below.
    }
  }
  return todayIn(DEFAULT_TIMEZONE, now);
}
