import type { Fields } from '@eleansphere/entity-core';
import { NOTIFICATION_SEVERITIES } from '../../constants';

const TITLE_MAX_LENGTH = 120;
const MESSAGE_MAX_LENGTH = 2000;

export const systemNotificationFields = {
  title: { type: 'STRING', required: true, maxLength: TITLE_MAX_LENGTH },
  message: { type: 'TEXT', required: true, maxLength: MESSAGE_MAX_LENGTH },
  severity: { type: 'ENUM', values: NOTIFICATION_SEVERITIES, default: 'info' },
  activeFrom: { type: 'DATE', required: true },
  activeTo: { type: 'DATE', required: true },
} as const satisfies Fields;
