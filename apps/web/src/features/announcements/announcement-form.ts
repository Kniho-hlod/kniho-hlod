import type { NotificationSeverity, SystemNotification } from '@kniho-hlod/domain';

/** The announcement fields the form validates with the API's own rules. */
export const ANNOUNCEMENT_FORM_FIELDS = [
  'title',
  'message',
  'severity',
  'activeFrom',
  'activeTo',
] as const;

export interface AnnouncementFormState {
  title: string;
  message: string;
  severity: NotificationSeverity;
  /** `YYYY-MM-DDTHH:mm` in the administrator's own time, as `<input type="datetime-local">` holds it. */
  activeFrom: string;
  activeTo: string;
}

/** Where an announcement stands at a moment: not shown yet, shown, or over. */
export type AnnouncementStatus = 'scheduled' | 'active' | 'ended';

/** A new announcement runs for a day unless the administrator says otherwise. */
const DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000;
const DATE_PART_WIDTH = 2;

function twoDigits(value: number): string {
  return String(value).padStart(DATE_PART_WIDTH, '0');
}

/** A moment as `YYYY-MM-DDTHH:mm` in the device's time zone. */
export function toLocalDateTime(moment: Date): string {
  const date = `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}`;
  return `${date}T${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` in the device's time zone — how JavaScript reads it — as an ISO timestamp. */
export function fromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

/** A new announcement: plain information, shown from now for a day. */
export function newAnnouncementForm(now: Date): AnnouncementFormState {
  return {
    title: '',
    message: '',
    severity: 'info',
    activeFrom: toLocalDateTime(now),
    activeTo: toLocalDateTime(new Date(now.getTime() + DEFAULT_DURATION_MS)),
  };
}

export function announcementFormFrom(announcement: SystemNotification): AnnouncementFormState {
  return {
    title: announcement.title,
    message: announcement.message,
    severity: announcement.severity,
    activeFrom: toLocalDateTime(new Date(announcement.activeFrom)),
    activeTo: toLocalDateTime(new Date(announcement.activeTo)),
  };
}

/** The form as the API wants it: text trimmed, times as ISO timestamps. */
export function toAnnouncementPayload(form: AnnouncementFormState): AnnouncementFormState {
  return {
    title: form.title.trim(),
    message: form.message.trim(),
    severity: form.severity,
    activeFrom: fromLocalDateTime(form.activeFrom),
    activeTo: fromLocalDateTime(form.activeTo),
  };
}

export function announcementStatus(
  { activeFrom, activeTo }: Pick<SystemNotification, 'activeFrom' | 'activeTo'>,
  now: Date
): AnnouncementStatus {
  if (now.getTime() < Date.parse(activeFrom)) return 'scheduled';
  return now.getTime() <= Date.parse(activeTo) ? 'active' : 'ended';
}
