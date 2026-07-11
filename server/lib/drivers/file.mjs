// File driver — dev / small-scale, single process, zero external services.
//
// Fixes the original store's scaling foot-guns:
//   • O(1) lookups via Maps (id / email / hash) instead of O(n) array scans.
//   • Debounced, async, atomic persistence (coalesced tmp+rename) — never a
//     synchronous whole-file write on the request path.
//   • Image blobs live as separate files on disk, NOT in the in-memory DB or the
//     JSON snapshot, so RAM and write size stay flat as the catalog grows.
//
// It is still a single-box store. For many concurrent instances use the postgres
// driver (Supabase). The interface is identical, so switching is a config change.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, BLOB_DIR, ensureDataDir, ensureBlobDir } from "../paths.mjs";

const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_LIST = 1000; // hard cap so an unbounded list can never blow up a response

const blobPath = (id) => path.join(BLOB_DIR, encodeURIComponent(id) + ".b64");

export async function createRepo() {
  ensureDataDir();
  ensureBlobDir();

  const db = { users: [], works: [], boards: [], orders: [], newsletter: [] };
  const idx = {
    userById: new Map(), userByEmail: new Map(),
    workById: new Map(), workByHash: new Map(),
    boardById: new Map(),
    orderById: new Map(),
    newsletter: new Set(),
  };

  // ---- load + one-time migration of any inline base64 images to blob files ----
  try {
    const raw = JSON.parse(await fsp.readFile(DB_FILE, "utf8"));
    for (const k of Object.keys(db)) if (Array.isArray(raw[k])) db[k] = raw[k];
    // legacy: registry was an object map hash->{workId}; folded into works.cert.hash now.
    for (const w of db.works) {
      if (typeof w.img === "string") {
        try { await fsp.writeFile(blobPath(w.id), w.img); } catch {}
        delete w.img; // strip the blob out of memory + future snapshots
      }
    }
  } catch { /* fresh start */ }

  for (const u of db.users) { idx.userById.set(u.id, u); idx.userByEmail.set(u.email, u); }
  for (const w of db.works) { idx.workById.set(w.id, w); if (w.cert?.hash) idx.workByHash.set(w.cert.hash, w); }
  for (const b of db.boards) idx.boardById.set(b.id, b);
  for (const o of db.orders) idx.orderById.set(o.id, o);
  for (const s of db.newsletter) idx.newsletter.add(s.email);

  // ---- debounced atomic persistence (coalesces bursts; never blocks the loop) ----
  let dirty = false, flushing = false, timer = null;
  function schedule() {
    dirty = true;
    if (timer || flushing) return;
    timer = setTimeout(() => { timer = null; flush(); }, 200);
    timer.unref?.();
  }
  async function flush() {
    if (flushing || !dirty) return;
    flushing = true; dirty = false;
    const snapshot = JSON.stringify(db);
    try {
      ensureDataDir();
      const tmp = DB_FILE + "." + process.pid + ".tmp";
      await fsp.writeFile(tmp, snapshot);
      await fsp.rename(tmp, DB_FILE); // atomic on the same volume
    } catch { dirty = true; /* retry on next schedule */ }
    finally {
      flushing = false;
      if (dirty) schedule();
    }
  }

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  return {
    async close() { if (timer) clearTimeout(timer); dirty = true; await flush(); },

    users: {
      async findByEmail(email) { return clone(idx.userByEmail.get(email) || null); },
      async findById(id) { return clone(idx.userById.get(id) || null); },
      async create(user) {
        db.users.push(user);
        idx.userById.set(user.id, user); idx.userByEmail.set(user.email, user);
        schedule(); return clone(user);
      },
      // Patch a user in place (v1: profile). idx and db.users share the object
      // reference, so mutating here updates both and the next snapshot persists it.
      async update(id, patch) {
        const u = idx.userById.get(id);
        if (!u) return null;
        Object.assign(u, patch);
        schedule(); return clone(u);
      },
    },

    works: {
      async list({ cat, q, limit, offset } = {}) {
        let out = db.works;
        if (cat && cat !== "all") out = out.filter((w) => w.cat === cat);
        if (q) { const s = q.toLowerCase(); out = out.filter((w) => (w.title + " " + w.artist + " " + w.medium).toLowerCase().includes(s)); }
        const start = Math.max(0, offset | 0);
        const end = start + Math.min(limit || MAX_LIST, MAX_LIST);
        return out.slice(start, end).map((w) => ({ ...clone(w), hasImage: !!w.imgUrl || fs.existsSync(blobPath(w.id)) }));
      },
      async findById(id) { return clone(idx.workById.get(id) || null); },
      async findByHash(hash) { return clone(idx.workByHash.get(hash) || null); },
      async create(meta, image) {
        if (typeof image === "string") { ensureBlobDir(); await fsp.writeFile(blobPath(meta.id), image); }
        db.works.unshift(meta);
        idx.workById.set(meta.id, meta);
        if (meta.cert?.hash) idx.workByHash.set(meta.cert.hash, meta);
        schedule(); return clone(meta);
      },
      async getImage(id) { try { return await fsp.readFile(blobPath(id), "utf8"); } catch { return null; } },
    },

    boards: {
      async listByUser(uid) { return db.boards.filter((b) => b.userId === uid).map(clone); },
      async findByUserAndId(uid, id) { const b = idx.boardById.get(id); return b && b.userId === uid ? clone(b) : null; },
      async create(board) { db.boards.push(board); idx.boardById.set(board.id, board); schedule(); return clone(board); },
      async remove(uid, id) {
        const b = idx.boardById.get(id);
        if (!b || b.userId !== uid) return false;
        db.boards.splice(db.boards.indexOf(b), 1); idx.boardById.delete(id); schedule(); return true;
      },
      async togglePin(uid, id, workId) {
        const b = idx.boardById.get(id);
        if (!b || b.userId !== uid) return null;
        const i = b.pins.indexOf(workId);
        if (i > -1) b.pins.splice(i, 1); else b.pins.push(workId);
        schedule(); return { pins: b.pins.slice(), saved: i === -1 };
      },
    },

    orders: {
      async create(order) { db.orders.push(order); idx.orderById.set(order.id, order); schedule(); return clone(order); },
      async findById(id) { return clone(idx.orderById.get(id) || null); },
    },

    newsletter: {
      async add(email, ip) {
        if (idx.newsletter.has(email)) return false;
        idx.newsletter.add(email);
        db.newsletter.push({ email, ts: new Date().toISOString(), ip });
        schedule(); return true;
      },
    },
  };
}
