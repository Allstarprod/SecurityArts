// Postgres driver — production / scale. Works with any Postgres, and with Supabase
// out of the box (use the project's connection string / pooler URL as DATABASE_URL).
//
// Why this scales where the file driver can't:
//   • Shared state: every app instance talks to the same DB, so you can run N
//     stateless servers behind a load balancer (sessions are already stateless JWT-style cookies).
//   • Indexed lookups + server-side filtering/pagination — no full-table scans in Node.
//   • Connection pooling; image blobs in a side table so hot queries never touch them.
//
// Requires the `pg` package (npm i pg) and DATABASE_URL. Run schema.sql once
// (or set DB_AUTO_MIGRATE=1 to apply it on boot).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rowToUser = (r) => (r ? { id: r.id, email: r.email, name: r.name, pass: r.pass, createdAt: r.created_at, profile: r.profile || {}, handle: r.handle || null } : null);
const rowToWork = (r) => (r ? {
  id: r.id, own: r.own, title: r.title, artist: r.artist, cat: r.cat, medium: r.medium,
  price: r.price, cert: r.cert, ownerId: r.owner_id, createdAt: r.created_at,
  imgUrl: r.img_url || undefined,
} : null);
const rowToBoard = (r) => (r ? { id: r.id, userId: r.user_id, name: r.name, pins: r.pins || [] } : null);
const rowToOrder = (r) => (r ? {
  id: r.id, lines: r.lines, total: r.total, email: r.email, name: r.name,
  userId: r.user_id, status: r.status, createdAt: r.created_at,
} : null);
const rowToComment = (r) => (r ? {
  id: r.id, workId: r.work_id, userId: r.user_id, authorName: r.author_name, text: r.text,
  parentId: r.parent_id || null, likes: r.likes || 0, likedBy: r.liked_by || [], createdAt: r.created_at,
} : null);

export async function createRepo() {
  const { default: pg } = await import("pg"); // dynamic so the file driver needs no deps
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the postgres driver.");

  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase and most managed PGs require TLS; allow opt-out for local PG.
    ssl: process.env.PG_SSL === "0" ? false : { rejectUnauthorized: false },
  });
  pool.on("error", (e) => { console.error("pg pool error:", e.message); });

  const q = (text, params) => pool.query(text, params);

  await q("SELECT 1"); // fail fast if the DB is unreachable

  if (process.env.DB_AUTO_MIGRATE === "1") {
    const schema = await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "schema.sql"), "utf8");
    await q(schema);
  }

  async function tx(fn) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const r = await fn(client); await client.query("COMMIT"); return r; }
    catch (e) { try { await client.query("ROLLBACK"); } catch {} throw e; }
    finally { client.release(); }
  }

  return {
    async close() { await pool.end(); },

    users: {
      async findByEmail(email) { return rowToUser((await q("SELECT * FROM users WHERE email=$1", [email])).rows[0]); },
      async findById(id) { return rowToUser((await q("SELECT * FROM users WHERE id=$1", [id])).rows[0]); },
      async findByHandle(handle) { return rowToUser((await q("SELECT * FROM users WHERE lower(handle)=lower($1) LIMIT 1", [handle])).rows[0]); },
      async create(u) {
        await q(
          "INSERT INTO users (id,email,name,pass,created_at) VALUES ($1,$2,$3,$4,$5)",
          [u.id, u.email, u.name, u.pass, u.createdAt]
        );
        return u;
      },
      // Patch a user (v1: name / profile). Builds the SET clause from provided keys only.
      async update(id, patch) {
        const sets = [], vals = [];
        if (patch.name !== undefined) { vals.push(patch.name); sets.push(`name=$${vals.length}`); }
        if (patch.handle !== undefined) { vals.push(patch.handle); sets.push(`handle=$${vals.length}`); }
        if (patch.pass !== undefined) { vals.push(patch.pass); sets.push(`pass=$${vals.length}`); }
        if (patch.profile !== undefined) { vals.push(JSON.stringify(patch.profile)); sets.push(`profile=$${vals.length}::jsonb`); }
        if (!sets.length) return rowToUser((await q("SELECT * FROM users WHERE id=$1", [id])).rows[0]);
        vals.push(id);
        const r = await q(`UPDATE users SET ${sets.join(",")} WHERE id=$${vals.length} RETURNING *`, vals);
        return rowToUser(r.rows[0]);
      },
    },

    works: {
      async list({ cat, q: query, limit, offset } = {}) {
        const rows = (await q(
          `SELECT w.id,w.own,w.title,w.artist,w.cat,w.medium,w.price,w.cert,w.owner_id,w.created_at,w.img_url,
                  (w.img_url IS NOT NULL OR EXISTS(SELECT 1 FROM work_blobs b WHERE b.work_id=w.id)) AS has_image
             FROM works w
            WHERE ($1::text IS NULL OR w.cat=$1)
              AND ($2::text IS NULL OR (w.title||' '||w.artist||' '||w.medium) ILIKE '%'||$2||'%')
            ORDER BY w.created_at DESC
            LIMIT $3 OFFSET $4`,
          [cat && cat !== "all" ? cat : null, query || null, Math.min(limit || 1000, 1000), Math.max(0, offset | 0)]
        )).rows;
        return rows.map((r) => ({ ...rowToWork(r), hasImage: r.has_image }));
      },
      async findById(id) { return rowToWork((await q("SELECT * FROM works WHERE id=$1", [id])).rows[0]); },
      async findByHash(hash) { return rowToWork((await q("SELECT * FROM works WHERE hash=$1", [hash])).rows[0]); },
      async listByOwner(ownerId) {
        const rows = (await q(
          `SELECT w.id,w.own,w.title,w.artist,w.cat,w.medium,w.price,w.cert,w.owner_id,w.created_at,w.img_url,
                  (w.img_url IS NOT NULL OR EXISTS(SELECT 1 FROM work_blobs b WHERE b.work_id=w.id)) AS has_image
             FROM works w WHERE w.owner_id=$1 ORDER BY w.created_at DESC`, [ownerId]
        )).rows;
        return rows.map((r) => ({ ...rowToWork(r), hasImage: r.has_image }));
      },
      async create(meta, image) {
        return tx(async (c) => {
          await c.query(
            `INSERT INTO works (id,own,title,artist,cat,medium,price,cert,hash,owner_id,created_at,img_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [meta.id, meta.own ?? true, meta.title, meta.artist, meta.cat, meta.medium,
             JSON.stringify(meta.price), JSON.stringify(meta.cert), meta.cert?.hash || null, meta.ownerId, meta.createdAt, meta.imgUrl || null]
          );
          if (typeof image === "string") {
            await c.query("INSERT INTO work_blobs (work_id,data) VALUES ($1,$2) ON CONFLICT (work_id) DO UPDATE SET data=EXCLUDED.data", [meta.id, image]);
          }
          return meta;
        });
      },
      async getImage(id) { return (await q("SELECT data FROM work_blobs WHERE work_id=$1", [id])).rows[0]?.data ?? null; },
    },

    boards: {
      async listByUser(uid) { return (await q("SELECT * FROM boards WHERE user_id=$1 ORDER BY created_at", [uid])).rows.map(rowToBoard); },
      async findByUserAndId(uid, id) { return rowToBoard((await q("SELECT * FROM boards WHERE id=$1 AND user_id=$2", [id, uid])).rows[0]); },
      async create(b) {
        await q("INSERT INTO boards (id,user_id,name,pins) VALUES ($1,$2,$3,$4::jsonb)", [b.id, b.userId, b.name, JSON.stringify(b.pins || [])]);
        return b;
      },
      async remove(uid, id) { return (await q("DELETE FROM boards WHERE id=$1 AND user_id=$2", [id, uid])).rowCount > 0; },
      async togglePin(uid, id, workId) {
        return tx(async (c) => {
          const b = rowToBoard((await c.query("SELECT * FROM boards WHERE id=$1 AND user_id=$2 FOR UPDATE", [id, uid])).rows[0]);
          if (!b) return null;
          const i = b.pins.indexOf(workId);
          if (i > -1) b.pins.splice(i, 1); else b.pins.push(workId);
          await c.query("UPDATE boards SET pins=$1::jsonb WHERE id=$2", [JSON.stringify(b.pins), id]);
          return { pins: b.pins, saved: i === -1 };
        });
      },
    },

    comments: {
      async listByWork(workId) { return (await q("SELECT * FROM comments WHERE work_id=$1 ORDER BY created_at", [workId])).rows.map(rowToComment); },
      async countByWorks(workIds) {
        if (!workIds.length) return {};
        const rows = (await q("SELECT work_id, count(*)::int AS c FROM comments WHERE work_id = ANY($1) GROUP BY work_id", [workIds])).rows;
        const out = {}; for (const r of rows) out[r.work_id] = r.c; return out;
      },
      async findById(id) { return rowToComment((await q("SELECT * FROM comments WHERE id=$1", [id])).rows[0]); },
      async create(c) {
        await q(
          "INSERT INTO comments (id,work_id,user_id,author_name,text,parent_id,likes,liked_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
          [c.id, c.workId, c.userId, c.authorName, c.text, c.parentId, c.likes || 0, JSON.stringify(c.likedBy || []), c.createdAt]
        );
        return c;
      },
      async toggleLike(id, userId) {
        return tx(async (cl) => {
          const c = rowToComment((await cl.query("SELECT * FROM comments WHERE id=$1 FOR UPDATE", [id])).rows[0]);
          if (!c) return null;
          const i = c.likedBy.indexOf(userId);
          if (i > -1) c.likedBy.splice(i, 1); else c.likedBy.push(userId);
          const likes = c.likedBy.length;
          await cl.query("UPDATE comments SET liked_by=$1::jsonb, likes=$2 WHERE id=$3", [JSON.stringify(c.likedBy), likes, id]);
          return { likes, liked: i === -1 };
        });
      },
      // Author-only; cascades to replies inside one transaction. Returns rows removed.
      async remove(id, userId) {
        return tx(async (cl) => {
          const owner = (await cl.query("SELECT user_id FROM comments WHERE id=$1", [id])).rows[0];
          if (!owner || owner.user_id !== userId) return 0;
          return (await cl.query("DELETE FROM comments WHERE id=$1 OR parent_id=$1", [id])).rowCount;
        });
      },
    },

    orders: {
      async create(o) {
        await q(
          "INSERT INTO orders (id,lines,total,email,name,user_id,status,created_at) VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8)",
          [o.id, JSON.stringify(o.lines), o.total, o.email, o.name, o.userId, o.status, o.createdAt]
        );
        return o;
      },
      async findById(id) { return rowToOrder((await q("SELECT * FROM orders WHERE id=$1", [id])).rows[0]); },
    },

    stats: {
      async incrementView(workId) {
        return Number((await q(
          "INSERT INTO work_stats (work_id,views) VALUES ($1,1) ON CONFLICT (work_id) DO UPDATE SET views=work_stats.views+1 RETURNING views",
          [workId]
        )).rows[0].views); // BIGINT arrives as a string from pg — coerce so both drivers return a number
      },
      async viewsFor(workIds) {
        if (!workIds.length) return {};
        const rows = (await q("SELECT work_id, views FROM work_stats WHERE work_id = ANY($1)", [workIds])).rows;
        const out = {}; for (const r of rows) out[r.work_id] = Number(r.views); return out;
      },
    },

    likes: {
      async toggle(workId, userId) {
        return tx(async (c) => {
          const existed = (await c.query("DELETE FROM work_likes WHERE work_id=$1 AND user_id=$2", [workId, userId])).rowCount > 0;
          if (!existed) await c.query("INSERT INTO work_likes (work_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [workId, userId]);
          const likes = (await c.query("SELECT count(*)::int AS n FROM work_likes WHERE work_id=$1", [workId])).rows[0].n;
          return { likes, liked: !existed };
        });
      },
      async likedBy(workId, userId) { return (await q("SELECT 1 FROM work_likes WHERE work_id=$1 AND user_id=$2", [workId, userId])).rowCount > 0; },
      async countByWorks(workIds) {
        if (!workIds.length) return {};
        const rows = (await q("SELECT work_id, count(*)::int AS n FROM work_likes WHERE work_id = ANY($1) GROUP BY work_id", [workIds])).rows;
        const out = {}; for (const r of rows) out[r.work_id] = r.n; return out;
      },
    },

    passwordResets: {
      async create(r) {
        await q("INSERT INTO password_resets (token_hash,user_id,expires_at,created_at) VALUES ($1,$2,$3,$4)", [r.tokenHash, r.userId, r.expiresAt, r.createdAt]);
        return r;
      },
      async findByHash(hash) {
        const row = (await q("SELECT * FROM password_resets WHERE token_hash=$1", [hash])).rows[0];
        return row ? { tokenHash: row.token_hash, userId: row.user_id, expiresAt: Number(row.expires_at), createdAt: row.created_at } : null;
      },
      async consume(hash) { return (await q("DELETE FROM password_resets WHERE token_hash=$1", [hash])).rowCount > 0; },
      async removeByUser(userId) { return (await q("DELETE FROM password_resets WHERE user_id=$1", [userId])).rowCount; },
    },

    newsletter: {
      async add(email, ip) {
        const r = await q(
          "INSERT INTO newsletter (email,ip,ts) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING email",
          [email, ip, new Date().toISOString()]
        );
        return r.rowCount > 0;
      },
    },
  };
}
