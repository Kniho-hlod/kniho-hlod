import { describe, expect, it } from 'vitest';
import { positionsAfterMove } from './shelf-order';

describe('positionsAfterMove', () => {
  it('numbers the shelves by their new places, sending only the changed ones', () => {
    const shelves = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ];

    expect(positionsAfterMove(shelves, 2, 1)).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('gives shelves that never had a place of their own one, all at once', () => {
    // New shelves all start at 0 and are listed by name until the reader first moves one.
    const shelves = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 0 },
      { id: 'c', sortOrder: 0 },
    ];

    expect(positionsAfterMove(shelves, 0, 1)).toEqual([
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });

  it('does nothing for a move past either end or onto the same place', () => {
    const shelves = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ];

    expect(positionsAfterMove(shelves, 0, -1)).toEqual([]);
    expect(positionsAfterMove(shelves, 1, 2)).toEqual([]);
    expect(positionsAfterMove(shelves, 1, 1)).toEqual([]);
  });
});
