import type { Fields } from '@eleansphere/entity-core';
import { DEFAULT_SHELF_COLOR, SHELF_COLORS } from '../../constants';

const NAME_MAX_LENGTH = 60;
const SORT_ORDER_MIN = 0;

export const shelfFields = {
  name: { type: 'STRING', required: true, maxLength: NAME_MAX_LENGTH },
  color: { type: 'ENUM', values: SHELF_COLORS, default: DEFAULT_SHELF_COLOR },
  /** Where the shelf stands among the reader's shelves: lower first, equal ones by name. */
  sortOrder: { type: 'INTEGER', default: 0, min: SORT_ORDER_MIN },
} as const satisfies Fields;
