import { describe, expect, it } from 'vitest';
import { readerToday } from './reader-today';

const LATE_EVENING_UTC = new Date('2026-09-25T23:30:00Z');

describe('readerToday', () => {
  it('reads the date in the reader’s time zone', () => {
    expect(readerToday('Europe/Prague', LATE_EVENING_UTC)).toBe('2026-09-26');
    expect(readerToday('America/New_York', LATE_EVENING_UTC)).toBe('2026-09-25');
  });

  it('falls back to Prague for a missing or unknown zone', () => {
    expect(readerToday(null, LATE_EVENING_UTC)).toBe('2026-09-26');
    expect(readerToday('Mars/Olympus_Mons', LATE_EVENING_UTC)).toBe('2026-09-26');
  });
});
