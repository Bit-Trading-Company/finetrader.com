/**
 * Minimal in-memory TTL cache for upstream responses.
 *
 * Entries expire lazily when read, and the oldest entries are evicted once
 * `maxEntries` is exceeded (no timers, so it is safe in serverless functions).
 * The cache is per process: each Vercel instance keeps its own copy.
 *
 * @param {{ ttlMs: number, maxEntries?: number }} options
 */
function createTtlCache({ ttlMs, maxEntries = 500 }) {
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.storedAt >= ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, storedAt: Date.now() });
      while (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value);
      }
    },
  };
}

module.exports = { createTtlCache };
