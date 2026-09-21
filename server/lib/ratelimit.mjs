// Rate limiting — maps to: OWASP A07 / MITRE ATT&CK T1110 (brute force),
// T1499 (endpoint DoS) / NIST PR.AC / CIS 8.
// Pluggable rate limiter. Async interface so it works for both backends:
//   • memory   (default) — per-process sliding window. Correct for ONE instance
//     (or one clustered box). Fast, zero deps.
//   • postgres (RATELIMIT_DRIVER=postgres) — shared fixed-window counters in the
//     rate_limits table, so limits hold ACROSS many instances behind a load balancer.
//
// Usage:
//   await rateLimit(bucket, limit, windowMs, { critical })  -> true if allowed (counts the hit)
//   await rateLimitPeek(bucket, limit, windowMs, { critical }) -> true if under the limit (no hit)
//   await rateLimitHit(bucket, windowMs, { critical })      -> record a hit without deciding
// The peek/hit pair exists for the per-account login lockout, which must count only
// FAILED attempts (decide before the password check, record after it).
//
// Failure policy (audit MEDIUM #9): when the shared postgres counter store errors,
// `critical` buckets (auth + sealing) fail CLOSED onto the in-process memory limiter —
// still a real limit, just per-instance — while everything else fails open so a DB
// hiccup can't take the whole API down.
let backend = null;
let memoryFallback = null;

function memoryBackend() {
  // key -> { windowMs, hits: number[] }. Each bucket remembers its own window so the
  // sweeper can prune correctly for a 1-minute limiter and a 24-hour quota alike
  // (the old flat 10-minute prune silently reset any window longer than that).
  const buckets = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      const keep = b.hits.filter((t) => now - t < b.windowMs);
      if (keep.length) b.hits = keep; else buckets.delete(k);
    }
  }, 300_000);
  timer.unref?.();
  const live = (key, windowMs) => {
    const now = Date.now();
    const b = buckets.get(key) || { windowMs, hits: [] };
    b.windowMs = windowMs;
    b.hits = b.hits.filter((t) => now - t < windowMs);
    buckets.set(key, b);
    return b;
  };
  return {
    async hit(key, windowMs) { live(key, windowMs).hits.push(Date.now()); },
    async peek(key, limit, windowMs) { return live(key, windowMs).hits.length < limit; },
    async allow(key, limit, windowMs) {
      const b = live(key, windowMs);
      b.hits.push(Date.now());
      return b.hits.length <= limit;
    },
  };
}

// `pool` is injectable so the fail-closed path can be unit-tested without a database.
export async function createPostgresBackend(pool) {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_RATELIMIT_POOL_MAX) || 5,
      ssl: process.env.PG_SSL === "0" ? false : { rejectUnauthorized: false },
    });
    pool.on("error", (e) => console.error("ratelimit pg error:", e.message));
  }
  const fallback = () => (memoryFallback ||= memoryBackend());
  const windowStartOf = (windowMs) => Math.floor(Date.now() / windowMs) * windowMs;

  // Increment the current window's counter and return the new count.
  async function bump(key, windowMs) {
    const windowStart = windowStartOf(windowMs);
    const r = await pool.query(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES ($1,$2,1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStart]
    );
    // opportunistic prune of stale windows (cheap, keeps the table small)
    if (r.rows[0].count === 1) {
      pool.query("DELETE FROM rate_limits WHERE window_start < $1", [windowStart - windowMs * 4]).catch(() => {});
    }
    return r.rows[0].count;
  }

  // On a store outage: critical buckets keep a per-instance limit; others fail open.
  function degraded(e, critical, viaMemory) {
    console.error(`ratelimit degraded (${critical ? "fail-closed → memory" : "fail-open"}):`, e.message);
    return critical ? viaMemory(fallback()) : true;
  }

  return {
    async hit(key, windowMs, { critical = false } = {}) {
      try { await bump(key, windowMs); }
      catch (e) { if (critical) await fallback().hit(key, windowMs); else console.error("ratelimit degraded (hit dropped):", e.message); }
    },
    async peek(key, limit, windowMs, { critical = false } = {}) {
      try {
        const r = await pool.query("SELECT count FROM rate_limits WHERE bucket=$1 AND window_start=$2", [key, windowStartOf(windowMs)]);
        return (r.rows[0]?.count || 0) < limit;
      } catch (e) {
        return degraded(e, critical, (m) => m.peek(key, limit, windowMs));
      }
    },
    async allow(key, limit, windowMs, { critical = false } = {}) {
      try { return (await bump(key, windowMs)) <= limit; }
      catch (e) { return degraded(e, critical, (m) => m.allow(key, limit, windowMs)); }
    },
  };
}

async function getBackend() {
  if (backend) return backend;
  const driver = (process.env.RATELIMIT_DRIVER || "memory").toLowerCase();
  backend = driver === "postgres" ? await createPostgresBackend() : memoryBackend();
  return backend;
}

export async function rateLimit(bucket, limit, windowMs, opts) {
  return (await getBackend()).allow(bucket, limit, windowMs, opts);
}
export async function rateLimitPeek(bucket, limit, windowMs, opts) {
  return (await getBackend()).peek(bucket, limit, windowMs, opts);
}
export async function rateLimitHit(bucket, windowMs, opts) {
  return (await getBackend()).hit(bucket, windowMs, opts);
}

// Test hook: a fresh in-process limiter (no env, no DB).
export const _memoryBackendForTests = memoryBackend;
