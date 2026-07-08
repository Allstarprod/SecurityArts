// All API routes. Handlers receive a ctx: { req,res,params,body,user,ip,https }.
// Data access goes through the async `repo` (file or postgres) — never touch a
// concrete store here, so the same routes serve 10 users or 100k.
import crypto from "node:crypto";
import { repo } from "./lib/repo.mjs";
import { putImage, blobStoreActive } from "./lib/blobstore.mjs";
import { seal, verifySeal, publicKeyPem, SIGNER_ID } from "./lib/seal.mjs";
import { Router, ok, created, fail, str, isEmail, CATS } from "./lib/http.mjs";
import {
  hashPassword, verifyPassword, createSession, sessionCookie, clearCookie,
} from "./lib/auth.mjs";
import { rateLimit, audit } from "./lib/security.mjs";

const MEDIUM = {
  illustration: "Digital illustration", painting: "Oil on linen", "3d": "3D render",
  photography: "35mm photograph", lettering: "Hand lettering", concept: "Concept art", mixed: "Mixed media",
};

/* Authoritative pricing — never trust a client-sent price (OWASP A04/A08). */
function priceFor(seed) {
  const base = 60 + (Math.abs(seed) % 11) * 40;
  return { personal: Math.round(base / 5) * 5, commercial: Math.round((base * 3) / 10) * 10, exclusive: Math.round((base * 9) / 25) * 25 };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }

// Authoritative prices for the design-system marketplace catalog
// (ui_kits/market/index.html), whose product ids are "m"+i for i = 0..15.
// The client shows base ×1 / ×3 / ×9 with base = 120 + ((i*47)%9)*60 — mirror it
// here so the server records exactly the price the buyer saw. (The root
// marketplace uses "p"+i ids, priced deterministically via the regex below.)
const MARKET = {};
for (let i = 0; i < 16; i++) {
  const base = 120 + ((i * 47) % 9) * 60;
  MARKET["m" + i] = { personal: base, commercial: base * 3, exclusive: base * 9 };
}

async function priceOf(id) {
  const w = await repo.works.findById(id);
  if (w && w.price) return w.price;
  if (MARKET[id]) return MARKET[id];
  const m = /^p(\d+)$/.exec(id);
  return priceFor(m ? Number(m[1]) * 7 + 3 : hashStr(id));
}

function publicUser(u) { return u ? { id: u.id, email: u.email, name: u.name } : null; }

// A throwaway scrypt hash used to spend equivalent CPU on failed logins for
// unknown emails, so timing can't distinguish "no such user" from "wrong password".
const DUMMY_HASH = hashPassword(crypto.randomBytes(32).toString("hex"));

export const router = new Router();

/* ---- health --------------------------------------------------------- */
router.get("/api/health", ({ res }) => ok(res, { status: "ok", signer: SIGNER_ID, driver: repo.driver }));
router.get("/api/seal/pubkey", ({ res }) => ok(res, { signer: SIGNER_ID, publicKey: publicKeyPem }));

/* ---- auth ----------------------------------------------------------- */
router.post("/api/auth/register", async ({ res, body, ip, https }) => {
  if (!(await rateLimit(`reg:${ip}`, 5, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  const password = str(body.password, { min: 8, max: 200 });
  const name = str(body.name, { min: 1, max: 80 }) || "Artist";
  if (!email || !password) return fail(res, 400, "Valid email and an 8+ character password are required.");
  if (await repo.users.findByEmail(email)) return fail(res, 409, "That email is already registered.");
  const user = { id: "usr_" + crypto.randomUUID(), email, name, pass: hashPassword(password), createdAt: new Date().toISOString() };
  await repo.users.create(user);
  audit("auth.register", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user.id), { https }));
  return created(res, publicUser(user));
});

router.post("/api/auth/login", async ({ res, body, ip, https }) => {
  if (!(await rateLimit(`login:${ip}`, 10, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = String(body.email || "").trim().toLowerCase();
  const user = await repo.users.findByEmail(email);
  // Always run the (deliberately slow) scrypt compare — against a dummy hash when
  // the email is unknown — so response time can't reveal whether an account exists
  // (same message alone isn't enough: skipping scrypt for missing users leaks timing).
  const okPass = verifyPassword(String(body.password || ""), user ? user.pass : DUMMY_HASH);
  if (!user || !okPass) {
    audit("auth.login.fail", { email, ip });
    return fail(res, 401, "Incorrect email or password."); // same message = no user enumeration
  }
  audit("auth.login.ok", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user.id), { https }));
  return ok(res, publicUser(user));
});

router.post("/api/auth/logout", ({ res }) => { res.setHeader("Set-Cookie", clearCookie()); return ok(res, { loggedOut: true }); });
router.get("/api/auth/me", ({ res, user }) => ok(res, publicUser(user)));

/* ---- works + verification ------------------------------------------ */
router.get("/api/works", async ({ res, url }) => {
  const cat = url.searchParams.get("cat");
  const q = url.searchParams.get("q") || "";
  const limit = Number(url.searchParams.get("limit")) || undefined;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const list = await repo.works.list({ cat, q, limit, offset }); // driver drops the blob + adds hasImage
  return ok(res, list);
});

router.get("/api/works/:id", async ({ res, params }) => {
  const w = await repo.works.findById(params.id);
  if (!w) return fail(res, 404, "Work not found.");
  // CDN-hosted image: hand back the URL (an <img src> takes it like a data URI)
  // and never touch blob bytes. Otherwise fall back to the repo's blob store.
  if (w.imgUrl) return ok(res, { ...w, img: w.imgUrl, hasImage: true });
  const img = await repo.works.getImage(params.id);
  return ok(res, { ...w, img: img || undefined, hasImage: !!img });
});

// Publish + SERVER-SIDE seal. The server hashes the received bytes and signs
// them with the SecurityArts key — the client never signs the authoritative seal.
router.post("/api/works", async ({ res, body, user, ip }) => {
  if (!(await rateLimit(`pub:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  const title = str(body.title, { min: 1, max: 80 });
  const artist = str(body.artist, { min: 1, max: 60 });
  const cat = CATS.includes(body.cat) ? body.cat : null;
  const image = typeof body.image === "string" && body.image.length < 8_000_000 ? body.image : null;
  if (!title || !artist || !cat || !image) return fail(res, 400, "title, artist, a valid medium, and an image are required.");
  const cert = seal(image);
  const id = "u_" + crypto.randomUUID().slice(0, 12);
  const meta = {
    id, own: true, title, artist, cat, medium: MEDIUM[cat],
    price: priceFor(hashStr(id)), cert, ownerId: user ? user.id : null, createdAt: cert.ts,
  };
  // Prefer object storage + CDN (Supabase Storage) when configured; on any upload
  // failure fall back to the repo driver's blob store so publish never breaks.
  const imgUrl = blobStoreActive ? await putImage(id, image) : null;
  if (imgUrl) meta.imgUrl = imgUrl;
  await repo.works.create(meta, imgUrl ? null : image); // blob out of the hot path
  audit("work.publish", { workId: id, hash: cert.hash, ownerId: meta.ownerId, storage: imgUrl ? "supabase" : "db", ip });
  return created(res, { ...meta, img: imgUrl || image });
});

// Public provenance check — the whole point of the brand.
router.get("/api/verify/:hash", async ({ res, params }) => {
  const work = await repo.works.findByHash(params.hash);
  if (!work) return fail(res, 404, "No sealed work found for that hash.");
  const valid = verifySeal(work.cert.hash, work.cert.sig);
  return ok(res, { verified: valid, signer: work.cert.signer, sealedAt: work.cert.ts,
    work: { id: work.id, title: work.title, artist: work.artist, medium: work.medium } });
});

/* ---- boards (auth required) ---------------------------------------- */
function requireUser(ctx) { if (!ctx.user) { fail(ctx.res, 401, "Sign in to use boards."); return false; } return true; }
router.get("/api/boards", async (ctx) => { if (!requireUser(ctx)) return; ok(ctx.res, await repo.boards.listByUser(ctx.user.id)); });
router.post("/api/boards", async (ctx) => {
  if (!requireUser(ctx)) return;
  const name = str(ctx.body.name, { min: 1, max: 40 });
  if (!name) return fail(ctx.res, 400, "A board name is required.");
  const board = { id: "brd_" + crypto.randomUUID().slice(0, 10), userId: ctx.user.id, name, pins: [] };
  await repo.boards.create(board);
  return created(ctx.res, board);
});
router.del("/api/boards/:id", async (ctx) => {
  if (!requireUser(ctx)) return;
  const removed = await repo.boards.remove(ctx.user.id, ctx.params.id);
  if (!removed) return fail(ctx.res, 404, "Board not found.");
  return ok(ctx.res, { deleted: true });
});
router.post("/api/boards/:id/pins", async (ctx) => {
  if (!requireUser(ctx)) return;
  const workId = str(ctx.body.workId, { min: 1, max: 60 });
  if (!workId) return fail(ctx.res, 400, "workId is required.");
  const result = await repo.boards.togglePin(ctx.user.id, ctx.params.id, workId);
  if (!result) return fail(ctx.res, 404, "Board not found.");
  return ok(ctx.res, result);
});

/* ---- checkout / orders --------------------------------------------- */
router.post("/api/checkout", async ({ res, body, user, ip }) => {
  if (!(await rateLimit(`ck:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : null;
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  if (!items || !items.length || !email) return fail(res, 400, "A non-empty cart and a valid email are required.");
  const lics = ["personal", "commercial", "exclusive"];
  const lines = [];
  for (const it of items) {
    const id = str(it.id, { min: 1, max: 60 });
    const license = lics.includes(it.license) ? it.license : null;
    if (!id || !license) return fail(res, 400, "Malformed cart item.");
    lines.push({ id, license, price: (await priceOf(id))[license] }); // server-authoritative price
  }
  const total = lines.reduce((s, l) => s + l.price, 0);
  const order = {
    id: "SA-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    lines, total, email, name: str(body.name, { max: 80 }) || null,
    userId: user ? user.id : null, status: "paid", createdAt: new Date().toISOString(),
  };
  await repo.orders.create(order);
  audit("order.placed", { orderId: order.id, total, email, ip }); // NOTE: real payment (Stripe) goes here
  return created(res, { orderId: order.id, total, lines });
});
router.get("/api/orders/:id", async ({ res, params, user }) => {
  const o = await repo.orders.findById(params.id);
  if (!o) return fail(res, 404, "Order not found.");
  if (o.userId && (!user || user.id !== o.userId)) return fail(res, 403, "Not your order.");
  return ok(res, o);
});

/* ---- newsletter ----------------------------------------------------- */
router.post("/api/newsletter", async ({ res, body, ip }) => {
  if (!(await rateLimit(`news:${ip}`, 5, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  if (!isEmail(body.email)) return fail(res, 400, "Enter a valid email address.");
  const email = body.email.trim().toLowerCase();
  const added = await repo.newsletter.add(email, ip);
  if (added) audit("newsletter.subscribe", { email, ip }); // NOTE: hand off to ESP (double opt-in) here
  return ok(res, { subscribed: true });
});
