import type { Fields } from '@eleansphere/entity-core';
import {
  DEFAULT_FEEDBACK_KIND,
  DEFAULT_FEEDBACK_STATUS,
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
} from '../../constants';

const MESSAGE_MAX_LENGTH = 4000;
/** A `STRING` column holds this many characters. */
export const FEEDBACK_CONTEXT_MAX_LENGTH = 255;
const APP_VERSION_MAX_LENGTH = 40;
const VIEWPORT_MAX_LENGTH = 20;

const KIND = { type: 'ENUM', values: FEEDBACK_KINDS, default: DEFAULT_FEEDBACK_KIND } as const;
const MESSAGE = { type: 'TEXT', required: true, maxLength: MESSAGE_MAX_LENGTH } as const;
/** The page the reader was on, as the app's own path (`/books/bk_1`). */
const PAGE_URL = { type: 'STRING', maxLength: FEEDBACK_CONTEXT_MAX_LENGTH } as const;
/** The app's build, so a report can be matched to the code it came from. */
const APP_VERSION = { type: 'STRING', maxLength: APP_VERSION_MAX_LENGTH } as const;
/** The window's size in CSS pixels, `390×844`. */
const VIEWPORT = { type: 'STRING', maxLength: VIEWPORT_MAX_LENGTH } as const;

/** What a reader sends with a report (`POST /api/feedback`). */
export const feedbackReportFields = {
  kind: { ...KIND, required: true },
  message: MESSAGE,
  pageUrl: PAGE_URL,
  appVersion: APP_VERSION,
  viewport: VIEWPORT,
} as const satisfies Fields;

/**
 * A stored report: what the reader sent stays as it was, and so does who sent it and with which
 * browser (set by the server). Administrators only move its `status`.
 */
export const feedbackFields = {
  kind: { ...KIND, readOnly: true },
  message: { ...MESSAGE, readOnly: true },
  pageUrl: { ...PAGE_URL, readOnly: true },
  appVersion: { ...APP_VERSION, readOnly: true },
  viewport: { ...VIEWPORT, readOnly: true },
  userAgent: { type: 'STRING', readOnly: true, maxLength: FEEDBACK_CONTEXT_MAX_LENGTH },
  reporterId: {
    type: 'STRING',
    required: true,
    readOnly: true,
    references: { model: 'user', onDelete: 'CASCADE' },
  },
  status: { type: 'ENUM', values: FEEDBACK_STATUSES, default: DEFAULT_FEEDBACK_STATUS },
} as const satisfies Fields;
