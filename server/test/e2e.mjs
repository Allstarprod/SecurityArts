// End-to-end suite — works against EITHER driver. Boots nothing itself: point it
// at a running server.  Usage:
//   node server.mjs                      (terminal 1 — file driver)
//   node test/e2e.mjs                    (terminal 2)
// or against Supabase:
//   node --env-file=.env server.mjs      (terminal 1)
//   node test/e2e.mjs                    (terminal 2)
// Env: PORT (default 8137), EXPECT_DRIVER=file|postgres (optional strict check).
const PORT = process.env.PORT || "8137";
const O = `http://localhost:${PORT}`;
const EXPECT_DRIVER = process.env.EXPECT_DRIVER || process.argv[2] || ""; // arg form works on Windows npm too
let pass = 0, fail = 0, cookie = "";
const check = (n, c, got = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${got ? "  (" + got + ")" : ""}`); c ? pass++ : fail++; };

async function api(path, { method = "GET", body, origin = O, xff } = {}) {
  const h = { "Content-Type": "application/json" };
  if (method !== "GET") h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  if (xff) h["X-Forwarded-For"] = xff;
  const r = await fetch(`${O}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j };
}

const main = async () => {
  const health = await api("/api/health");
  const driver = health.j?.data?.driver;
  check("health", health.status === 200 && !!driver, `driver=${driver}`);
  if (EXPECT_DRIVER) check(`driver is ${EXPECT_DRIVER}`, driver === EXPECT_DRIVER, driver);

  // auth round-trip
  const email = `e2e_${Date.now()}@x.com`;
  const reg = await api("/api/auth/register", { method: "POST", body: { email, password: "supersecret1", name: "E2E" } });
  check("register", reg.status === 201 && reg.j?.data?.email === email, `HTTP ${reg.status}`);
  const me = await api("/api/auth/me");
  check("session → /me", me.status === 200 && me.j?.data?.email === email);
  const badLogin = await api("/api/auth/login", { method: "POST", body: { email, password: "wrong" } });
  check("wrong password → 401", badLogin.status === 401);
  const login = await api("/api/auth/login", { method: "POST", body: { email, password: "supersecret1" } });
  check("correct login → 200", login.status === 200);

  // publish → list → detail → verify
  const image = "data:image/svg+xml," + "z".repeat(50_000);
  const pub = await api("/api/works", { method: "POST", body: { title: "E2E Piece", artist: "E2E", cat: "painting", image } });
  const id = pub.j?.data?.id, hash = pub.j?.data?.cert?.hash, imgOut = pub.j?.data?.img || "";
  check("publish + seal", pub.status === 201 && !!id && !!hash, `id=${id} storage=${imgOut.startsWith("http") ? "supabase-cdn" : "db"}`);
  const list = await api("/api/works?cat=painting&q=e2e");
  const inList = (list.j?.data || []).find((w) => w.id === id);
  check("list (filtered): blob stripped + hasImage", !!inList && inList.img === undefined && inList.hasImage === true);
  const one = await api(`/api/works/${id}`);
  const img = one.j?.data?.img || "";
  check("detail serves image (data: or CDN url)", one.status === 200 && (img.startsWith("data:") || img.startsWith("http")), img.slice(0, 40));
  const ver = await api(`/api/verify/${hash}`);
  check("verify by hash", ver.status === 200 && ver.j?.data?.verified === true);

  // boards
  const board = await api("/api/boards", { method: "POST", body: { name: "E2E Faves" } });
  const bid = board.j?.data?.id;
  check("board create", board.status === 201 && !!bid);
  const pin = await api(`/api/boards/${bid}/pins`, { method: "POST", body: { workId: id } });
  check("togglePin add", pin.status === 200 && pin.j?.data?.saved === true);
  const unpin = await api(`/api/boards/${bid}/pins`, { method: "POST", body: { workId: id } });
  check("togglePin remove", unpin.status === 200 && unpin.j?.data?.saved === false);
  const del = await api(`/api/boards/${bid}`, { method: "DELETE" });
  check("board delete", del.status === 200 && del.j?.data?.deleted === true);

  // checkout: authoritative pricing + order fetch
  const ck = await api("/api/checkout", { method: "POST", body: { email, items: [{ id: "m0", license: "commercial" }] } });
  check("checkout m0 commercial == $360", ck.status === 201 && ck.j?.data?.total === 360, `total=${ck.j?.data?.total}`);
  const oid = ck.j?.data?.orderId;
  const order = await api(`/api/orders/${oid}`);
  check("order fetch (owner)", order.status === 200 && order.j?.data?.total === 360);

  // newsletter idempotency
  const n1 = await api("/api/newsletter", { method: "POST", body: { email } });
  const n2 = await api("/api/newsletter", { method: "POST", body: { email } });
  check("newsletter subscribe + idempotent", n1.status === 200 && n2.status === 200);

  // security posture
  const csrf = await api("/api/checkout", { method: "POST", origin: "http://evil.example", body: { email, items: [{ id: "m0", license: "personal" }] } });
  check("CSRF cross-origin blocked", csrf.status === 403, `HTTP ${csrf.status}`);

  console.log(`\n${fail === 0 ? "ALL GREEN" : fail + " FAILED"} — ${pass} passed, ${fail} failed  [driver=${driver}]`);
  process.exit(fail === 0 ? 0 : 1);
};
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
