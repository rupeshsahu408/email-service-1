type Entry<T> = { value: T; expiresAt: number };

/**
 * Tiny in-process TTL cache for automation lists and similar (Phase 6 scaling).
 * Not shared across serverless instances; safe as a best-effort layer.
 */
export class TtlCache<K, T> {
  private store = new Map<K, Entry<T>>();

  constructor(private ttlMs: number) {}

  get(key: K): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: K, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: K): void {
    this.store.delete(key);
  }
}
