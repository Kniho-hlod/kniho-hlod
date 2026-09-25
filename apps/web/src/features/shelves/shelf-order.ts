export interface ShelfPosition {
  id: string;
  sortOrder: number;
}

/**
 * Moves the shelf at `from` to `to` in a list shown in shelf order, and answers the positions
 * that have to change for the new order to stick: every shelf numbered by its place, but only
 * those whose number differs from what is stored.
 */
export function positionsAfterMove(
  shelves: readonly ShelfPosition[],
  from: number,
  to: number
): ShelfPosition[] {
  if (from === to || to < 0 || to >= shelves.length) return [];
  const reordered = [...shelves];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered
    .map((shelf, index) => ({ id: shelf.id, sortOrder: index }))
    .filter((position, index) => reordered[index].sortOrder !== position.sortOrder);
}
