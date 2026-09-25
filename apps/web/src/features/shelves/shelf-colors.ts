import type { ShelfColor } from '@kniho-hlod/domain';

/**
 * The dot a shelf is marked with. Spelled out in full so Tailwind finds every class in the
 * sources; bright enough to read on both the light and the dark background.
 */
export const SHELF_DOT_CLASSES: Record<ShelfColor, string> = {
  neutral: 'bg-neutral-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-400',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-600',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
};
