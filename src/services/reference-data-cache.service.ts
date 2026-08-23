type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCachedValue<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  const now = Date.now();

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = await loader();

  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });

  return value;
}
