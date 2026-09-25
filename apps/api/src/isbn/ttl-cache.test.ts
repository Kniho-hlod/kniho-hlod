import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

const TTL_MS = 1_000;

function createClock() {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe('TtlCache', () => {
  it('returns what was stored, including null, until it expires', () => {
    const clock = createClock();
    const cache = new TtlCache<string, string | null>({
      maxEntries: 10,
      ttlMs: TTL_MS,
      now: clock.now,
    });

    cache.set('known', 'Hobit');
    cache.set('unknown', null);

    expect(cache.get('known')).toBe('Hobit');
    expect(cache.get('unknown')).toBeNull();
    expect(cache.get('never-stored')).toBeUndefined();

    clock.advance(TTL_MS);
    expect(cache.get('known')).toBeUndefined();
  });

  it('drops the least recently used entry when full', () => {
    const cache = new TtlCache<string, number>({ maxEntries: 2, ttlMs: TTL_MS });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });
});
