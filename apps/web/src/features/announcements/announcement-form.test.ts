import { describe, expect, it } from 'vitest';
import {
  announcementFormFrom,
  announcementStatus,
  fromLocalDateTime,
  newAnnouncementForm,
  toAnnouncementPayload,
  toLocalDateTime,
} from './announcement-form';

// Local times, so the tests hold in any time zone the machine runs in.
const NOW = new Date(2026, 8, 26, 9, 5, 42);

describe('announcement form', () => {
  it('writes a moment as the datetime field holds it, and reads it back', () => {
    expect(toLocalDateTime(NOW)).toBe('2026-09-26T09:05');
    expect(fromLocalDateTime('2026-09-26T09:05')).toBe(new Date(2026, 8, 26, 9, 5).toISOString());
  });

  it('starts a new announcement now and ends it a day later', () => {
    expect(newAnnouncementForm(NOW)).toEqual({
      title: '',
      message: '',
      severity: 'info',
      activeFrom: '2026-09-26T09:05',
      activeTo: '2026-09-27T09:05',
    });
  });

  it('round-trips a stored announcement through the form', () => {
    const stored = {
      id: 'sn_1',
      title: 'Údržba',
      message: 'Dnes v noci.',
      severity: 'warning' as const,
      activeFrom: new Date(2026, 8, 26, 22, 0).toISOString(),
      activeTo: new Date(2026, 8, 27, 2, 0).toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };

    const form = announcementFormFrom(stored);
    expect(form.activeFrom).toBe('2026-09-26T22:00');
    expect(toAnnouncementPayload({ ...form, title: '  Údržba  ' })).toEqual({
      title: 'Údržba',
      message: 'Dnes v noci.',
      severity: 'warning',
      activeFrom: stored.activeFrom,
      activeTo: stored.activeTo,
    });
  });

  it('tells a scheduled announcement from a running and a finished one', () => {
    const range = (from: Date, to: Date) => ({
      activeFrom: from.toISOString(),
      activeTo: to.toISOString(),
    });
    const hour = 60 * 60 * 1000;
    const at = (offset: number) => new Date(NOW.getTime() + offset);

    expect(announcementStatus(range(at(hour), at(2 * hour)), NOW)).toBe('scheduled');
    expect(announcementStatus(range(at(-hour), at(hour)), NOW)).toBe('active');
    expect(announcementStatus(range(at(-2 * hour), at(-hour)), NOW)).toBe('ended');
  });
});
