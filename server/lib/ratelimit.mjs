// Rate limiting — maps to: OWASP A07 / MITRE ATT&CK T1110 (brute force),
// T1499 (endpoint DoS) / NIST PR.AC / CIS 8.
// Pluggable rate limiter. Async interface so it works for both backends:
//   • memory   (default) — per-process sliding window. Correct for ONE instance
//     (or one clustered box). Fast, zero deps.
//   • postgres (RATELIMIT_DRIVER=postgres) — shared fixed-window counters in the
//     rate_limits table, so limits hold ACROSS many instances behind a load balancer.
//
// Usage: await rateLimit(bucket, limit, windowMs) -> true if allowed.
let backend = null;

function memoryBackend() {
  const buckets = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of buckets) {
      const keep = arr.filter((t) => now - t < 600_000);
      if (keep.length) buckets.set(k, keep); else buckets.delete(k);
    }
  }, 300_000);
  timer.unref?.();
  return {
    async allow(key, limit, windowMs) {
      const now = Date.now();
      const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
      arr.push(now);
      buckets.set(key, arr);
      return arr.length <= limit;
    },
  };
}

async function postgresBackend() {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_RATELIMIT_POOL_MAX) || 5,
    ssl: process.env.PG_SSL === "0" ? false : { rejectUnauthorized: false },
  });
  pool.on("error", (e) => console.error("ratelimit pg error:", e.message));
  return {
    async allow(key, limit, windowMs) {
      const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
      try {
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
        return r.rows[0].count <= limit;
      } catch (e) {
        // Fail OPEN on limiter outage — never take the whole API down because the
        // counter store hiccuped. (Abuse is still bounded by the DB's own limits.)
        console.error("ratelimit degraded, allowing:", e.message);
        return true;
      }
    },
  };
}

async function getBackend() {
  if (backend) return backend;
  const driver = (process.env.RATELIMIT_DRIVER || "memory").toLowerCase();
  backend = driver === "postgres" ? await postgresBackend() : memoryBackend();
  return backend;
}

export async function rateLimit(bucket, limit, windowMs) {
  return (await getBackend()).allow(bucket, limit, windowMs);
}
