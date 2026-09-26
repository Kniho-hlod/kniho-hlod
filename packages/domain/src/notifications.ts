import { ApiClient } from '@eleansphere/entity-core';
import type { NotificationKind } from './constants';
import type { PersonSummary } from './friends';

/** `GET` the reader's latest notifications, `POST …/read` mark them read. */
export const NOTIFICATIONS_PATH = '/api/notifications';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** Who did it. */
  actor: PersonSummary;
  createdAt: string;
  /** `null` until the reader has seen it. */
  readAt: string | null;
}

export interface NotificationFeed {
  /** The latest, newest first. */
  data: NotificationItem[];
  /** How many of all the reader's notifications are unread. */
  unread: number;
}

/** `POST /api/notifications/read`: these, or every unread one when no ids are given. */
export interface MarkNotificationsReadRequest {
  ids?: string[];
}

export class NotificationsService extends ApiClient {
  feed(): Promise<NotificationFeed> {
    return this.get<NotificationFeed>(NOTIFICATIONS_PATH);
  }

  markRead(ids?: string[]): Promise<void> {
    const request: MarkNotificationsReadRequest = ids ? { ids } : {};
    return this.post<void>(`${NOTIFICATIONS_PATH}/read`, request);
  }
}
