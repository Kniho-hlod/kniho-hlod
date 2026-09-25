interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface TtlCacheOptions {
  maxEntries: number;
  ttlMs: number;
  /** Clock, for tests. */
  now?: () => number;
}

/**
 * A bounded in-memory cache: an entry expires `ttlMs` after it was stored, and past `maxEntries`
 * the least recently used entry is dropped. `undefined` from `get` means "not cached", so `null`
 * can be cached as an answer of its own.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ maxEntries, ttlMs, now = Date.now }: TtlCacheOptions) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Re-inserting moves the key to the end of the Map's order: the most recently used.
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) this.dropLeastRecentlyUsed();
  }

  private dropLeastRecentlyUsed(): void {
    const oldest = this.entries.keys().next();
    if (!oldest.done) this.entries.delete(oldest.value);
  }
}
