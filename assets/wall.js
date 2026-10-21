// wall.js — the wall: real sealed work from the API, filtered by medium and search,
// images lazy-loaded, each badge coloured from the art under it, and a certificate
// viewer that checks the record, names the sealing account and lets anyone check a
// file. No invented works: if the API has nothing, the wall says so.
import { initSite } from "./site.js";
import { sealColour } from "./seal/seal-ink.js";

const PAGE = 24;
const IMAGE_CONCURRENCY = 4;
const SEARCH_DELAY = 280;
const ANNOUNCE_DELAY = 700;
const RETRY_DELAYS = [2500, 8000];      // transient image failures (network, 429, 5xx)
const CATS = [
  ["", "Everything"], ["painting", "Painting"], ["illustration", "Illustration"], ["photography", "Photography"],
  ["3d", "3D"], ["lettering", "Lettering"], ["concept", "Concept art"], ["mixed", "Mixed media"],
];
const CAT_LABEL = Object.fromEntries(CATS.filter(([k]) => k));

const $ = (id) => document.getElementById(id);
const els = {
  chips: $("chips"), q: $("q"), form: $("searchForm"), count: $("count"), announce: $("announce"),
  grid: $("grid"), state: $("state"), more: $("more"), viewer: $("viewer"), heading: $("wall-h"),
};
const api = window.SA_API;

const state = { cat: "", q: "", offset: 0, done: false, loading: false, shown: 0, run: 0 };
const works = new Map();            // id → list row
const details = new Map();          // id → Promise of the full work (with img), dropped once drawn
const accounts = new Map();         // ownerId → Promise of the public profile

// ---------- small DOM helpers (text only — nothing from the API is parsed as HTML) ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter(Boolean));
  return node;
}
function useMark(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.setAttribute("aria-hidden", "true");
  svg.append(use);
  return svg;
}
const when = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

// ---------- announcements (one always-present live region, written once things settle) ----------
let announceTimer = 0;
function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    els.announce.textContent = "";
    requestAnimationFrame(() => { els.announce.textContent = text; });
  }, ANNOUNCE_DELAY);
}
function resultSummary() {
  const where = [state.cat && CAT_LABEL[state.cat], state.q && `“${state.q}”`].filter(Boolean).join(", ");
  if (!state.shown) return where ? `No sealed pieces match ${where}.` : "Nothing on the wall yet.";
  return `${state.shown}${state.done ? "" : " or more"} sealed ${state.shown === 1 ? "piece" : "pieces"}${where ? ` for ${where}` : ""}.`;
}

// ---------- filters (built once, updated in place so keyboard focus stays put) ----------
function buildChips() {
  els.chips.replaceChildren(...CATS.map(([key, label]) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(state.cat === key), "data-cat": key, text: label });
    b.addEventListener("click", () => { if (state.cat !== key) { state.cat = key; syncChips(); reload(); } });
    return b;
  }));
}
function syncChips() {
  for (const chip of els.chips.children) chip.setAttribute("aria-pressed", String(chip.dataset.cat === state.cat));
}

let searchTimer = 0;
els.q.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { const q = els.q.value.trim(); if (q !== state.q) { state.q = q; reload(); } }, SEARCH_DELAY);
});
els.form.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(searchTimer); state.q = els.q.value.trim(); reload(); });

// ---------- images: lazy, a few at a time, retried when the failure is temporary ----------
let active = 0;
const waiting = [];
function pump() {
  while (active < IMAGE_CONCURRENCY && waiting.length) {
    const job = waiting.shift();
    active++;
    job().finally(() => { active--; pump(); });
  }
}
function detail(id) {
  if (!details.has(id)) {
    const p = api.getWork(id);
    p.catch(() => details.delete(id));    // a failed fetch can be retried next time
    details.set(id, p);
  }
  return details.get(id);
}

const seen = new IntersectionObserver((entries) => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue;
    seen.unobserve(target);
    queueImage(target, 0);
  }
}, { rootMargin: "400px 0px" });

function queueImage(tile, attempt) {
  const run = state.run;
  waiting.push(() => loadImage(tile, run, attempt));
  pump();
}

class PermanentImageError extends Error {}

async function imageSource(id) {
  const row = works.get(id);
  if (row?.imgUrl) return row.imgUrl;            // CDN-hosted: no detail request needed
  let work;
  try { work = await detail(id); }
  catch (err) {
    if (/not found/i.test(err?.message || "")) throw new PermanentImageError("gone");
    throw err;                                   // network / 429 / 5xx: worth another try
  }
  if (!work?.img) throw new PermanentImageError("no image");
  return work.img;
}

async function loadImage(tile, run, attempt) {
  if (run !== state.run || !tile.isConnected) return;       // a newer filter replaced this tile
  const frame = tile.querySelector(".piece__frame");
  const img = frame.querySelector("img");
  try {
    const src = await imageSource(tile.dataset.id);
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous"; // lets the badge read the pixels (CDN must send CORS)
    img.src = src;
    try { await img.decode(); } catch { throw new PermanentImageError("undecodable"); }
    if (run !== state.run || !tile.isConnected) return;
    details.delete(tile.dataset.id);                        // the viewer re-fetches; keep memory flat
    frame.classList.add("is-loaded");
    colourBadge(frame.querySelector(".piece__badge"), img);
  } catch (err) {
    if (run !== state.run || !tile.isConnected) return;
    if (!(err instanceof PermanentImageError) && attempt < RETRY_DELAYS.length) {
      setTimeout(() => queueImage(tile, attempt + 1), RETRY_DELAYS[attempt]);
      return;
    }
    if (err instanceof PermanentImageError) {
      // A wall is for looking at: a piece whose image can't be shown comes off the
      // wall (its certificate still exists and still verifies).
      tile.remove();
      state.shown = Math.max(0, state.shown - 1);
      updateCount();
      if (!state.shown && state.done) setState("empty");
      announce(resultSummary());
    } else {
      frame.classList.add("is-loaded", "is-failed");        // keep the piece; say what happened
      frame.prepend(el("span", { class: "piece__failed", text: "Image didn't load" }));
    }
  }
}

// The badge takes whichever palette ink holds against the art right under it.
// Offsets, not getBoundingClientRect: the badge is mid stamp-animation (scaled, spun),
// and offset metrics give its resting footprint. The image fills the frame from 0,0.
function colourBadge(badge, img) {
  const kx = img.naturalWidth / img.clientWidth;
  const ky = img.naturalHeight / img.clientHeight;
  if (!Number.isFinite(kx) || !Number.isFinite(ky)) return;
  const rect = { x: badge.offsetLeft * kx, y: badge.offsetTop * ky, w: badge.offsetWidth * kx, h: badge.offsetHeight * ky };
  const pick = sealColour(img, rect, { kind: "flat" });
  if (pick) badge.style.color = pick.hex;       // null (unreadable pixels) keeps the default red
}

// ---------- tiles ----------
function tile(w) {
  const credit = w.artist || "Uncredited";
  const medium = CAT_LABEL[w.cat] || "";
  const open = el("button", { class: "piece__open", type: "button", "aria-label": `Open the certificate for “${w.title}”, credited to ${credit}` },
    el("span", { class: "piece__frame" },
      el("img", { alt: `${w.title}, credited to ${credit}`, decoding: "async" }),
      el("span", { class: "piece__badge" }, useMark("saModern"))));
  open.addEventListener("click", () => openViewer(w.id, open));
  const li = el("li", { class: "piece", "data-id": w.id }, open,
    el("p", { class: "piece__cap" },
      el("span", { class: "piece__title", text: w.title }),
      el("span", { class: "piece__meta", text: medium ? `${credit} · ${medium}` : credit })));
  seen.observe(li);
  return li;
}

// ---------- loading ----------
function stateButton(text, cls, onClick) {
  const b = el("button", { class: cls, type: "button", text });
  b.addEventListener("click", onClick);
  return b;
}
function setState(kind) {
  if (!kind) { els.state.hidden = true; els.state.replaceChildren(); return; }
  els.state.hidden = false;
  if (kind === "empty") {
    const filtered = state.cat || state.q;
    els.state.replaceChildren(
      el("div", { class: "state__mark" }, useMark("saModern")),
      el("h2", { class: "h2", text: filtered ? "Nothing sealed matches that — yet." : "The wall is waiting for its first piece." }),
      el("p", { class: "lede", text: filtered ? "Try another medium or clear the search." : "Seal something you finished and it goes up here, with its certificate." }),
      filtered
        ? stateButton("Show everything", "btn btn--ghost", () => { state.cat = ""; state.q = ""; els.q.value = ""; syncChips(); els.chips.firstElementChild.focus(); reload(); })
        : el("a", { class: "btn btn--red", href: "/seal-a-piece", text: "Seal your own" }));   // signed out, that page asks you to join
  } else {
    els.state.replaceChildren(
      el("p", { class: "notice notice--problem", text: "We couldn't reach the wall just now. Your connection or our server had a hiccup." }),
      stateButton("Try again", "btn btn--ink", () => { els.heading.focus(); reload(); }));
  }
}

function updateCount() {
  els.count.textContent = state.shown ? `${state.shown}${state.done ? "" : "+"} sealed ${state.shown === 1 ? "piece" : "pieces"}` : "";
}

async function loadPage() {
  if (state.loading || state.done) return;
  state.loading = true;
  const run = state.run;
  els.more.disabled = true;
  els.grid.setAttribute("aria-busy", "true");
  const qs = new URLSearchParams({ limit: String(PAGE), offset: String(state.offset) });
  if (state.cat) qs.set("cat", state.cat);
  if (state.q) qs.set("q", state.q);
  try {
    const rows = (await api.listWorks(qs.toString())) || [];
    if (run !== state.run) return;              // a newer filter replaced this request
    for (const w of rows) works.set(w.id, w);
    els.grid.append(...rows.map(tile));
    state.offset += rows.length;
    state.shown += rows.length;
    state.done = rows.length < PAGE;
    setState(state.shown ? null : "empty");
    announce(resultSummary());
  } catch {
    if (run !== state.run) return;
    if (!state.shown) setState("error");
    announce("The wall didn't load. There's a Try again button.");
  } finally {
    if (run === state.run) {
      state.loading = false;
      els.more.disabled = false;
      els.more.hidden = state.done || !state.shown;
      els.grid.removeAttribute("aria-busy");
      updateCount();
    }
  }
}

function reload() {
  state.run++;
  Object.assign(state, { offset: 0, done: false, loading: false, shown: 0 });
  seen.disconnect();
  waiting.length = 0;
  els.grid.replaceChildren();
  setState(null);
  loadPage();
}
els.more.addEventListener("click", loadPage);

// ---------- viewer ----------
const viewer = { work: null, opener: null, pushed: false };

function account(ownerId) {
  if (!ownerId) return Promise.resolve(null);
  if (!accounts.has(ownerId)) accounts.set(ownerId, api.users.get(ownerId).catch(() => null));
  return accounts.get(ownerId);
}

function row(k, v, id) {
  const dd = el("dd", { text: v });
  if (id) dd.id = id;
  return el("div", {}, el("dt", { text: k }), dd);
}

function certRows(w) {
  const c = w.cert || {};
  const signedTime = c.v === 1;
  const sig = String(c.sig || "");
  return [
    row("Sealed by", "Looking up the account…", "viewerAccount"),
    row("Fingerprint", c.hash ? `SHA-256 ${c.hash}` : "—"),
    row(signedTime ? "Sealed" : "Recorded", c.ts ? `${when(c.ts)}${signedTime ? "" : " (time not signed — older seal)"}` : "—"),
    row("Signature", sig.length > 40 ? `${sig.slice(0, 24)}…${sig.slice(-12)}` : sig || "—"),
    row("Signed with", c.kid || c.signer || "—"),
  ];
}

function setRecord(kind, text) {
  const node = $("viewerRecord");
  node.className = `cert__record cert__record--${kind}`;
  node.textContent = text;
}

// Checks the stored certificate against the public record, rather than trusting it.
async function checkRecord(w) {
  setRecord("pending", "Checking the public record…");
  const hash = w.cert?.hash;
  if (!hash) { setRecord("bad", "This piece has no fingerprint on record."); return; }
  try {
    const r = await api.verify(hash);
    if (viewer.work !== w) return;
    if (r?.verified && r.work?.id === w.id) setRecord("ok", "Signature checks out against the public record.");
    else if (r?.verified) setRecord("bad", "This file's public record belongs to a different piece. Treat this listing with care.");
    else setRecord("bad", "The signature on this certificate doesn't check out.");
  } catch {
    if (viewer.work === w) setRecord("bad", "We couldn't check the public record just now.");
  }
}

async function showAccount(w) {
  const who = await account(w.ownerId);
  if (viewer.work !== w) return;
  const dd = $("viewerAccount");
  if (!dd) return;
  if (!who) { dd.textContent = "A SecurityArts account"; return; }
  const name = who.name || "A SecurityArts account";
  // Same rule as the certificate page: only a claimed handle has a profile to link to.
  dd.replaceChildren(who.handleClaimed
    ? el("a", { href: `/@${encodeURIComponent(who.handle)}`, text: `${name} (@${who.handle})` })
    : name);
}

async function openViewer(id, from, { fromUrl = false } = {}) {
  const w = works.get(id);
  if (!w) return;
  viewer.work = w;
  viewer.opener = from || null;
  $("viewerTitle").textContent = w.title;
  $("viewerBy").textContent = [`Credited to ${w.artist || "no one"}`, CAT_LABEL[w.cat]].filter(Boolean).join(" · ");
  $("viewerCert").replaceChildren(...certRows(w));
  $("certLink").href = `/seal/${encodeURIComponent(w.id)}`;
  $("copied").textContent = "";
  $("checkResult").textContent = "";
  $("checkResult").className = "cert__check-result";
  $("checkFile").value = "";
  const img = $("viewerImg");
  img.removeAttribute("src");
  img.alt = `${w.title}, credited to ${w.artist || "no one"}`;
  if (!els.viewer.open) els.viewer.showModal();
  const url = `${location.pathname}?piece=${encodeURIComponent(id)}`;
  if (fromUrl) history.replaceState({ piece: id }, "", url);
  else { history.pushState({ piece: id }, "", url); viewer.pushed = true; }
  checkRecord(w);
  showAccount(w);
  try { const full = await detail(id); if (viewer.work === w && full?.img) img.src = full.img; } catch { /* the certificate still shows */ }
}

function closeViewer() {
  if (!els.viewer.open) return;
  if (viewer.pushed) { viewer.pushed = false; history.back(); return; }   // popstate closes it
  els.viewer.close();
}
els.viewer.addEventListener("close", () => {
  const id = viewer.work?.id;
  viewer.work = null;
  if (viewer.pushed) { viewer.pushed = false; history.back(); }
  else if (location.search) history.replaceState(null, "", location.pathname);
  const back = viewer.opener?.isConnected ? viewer.opener : els.grid.querySelector(`[data-id="${CSS.escape(id || "")}"] .piece__open`);
  (back || els.heading).focus();
});
window.addEventListener("popstate", () => {
  if (!els.viewer.open) return;
  viewer.pushed = false;
  els.viewer.close();
});
$("viewerClose").addEventListener("click", closeViewer);
els.viewer.addEventListener("click", (e) => { if (e.target === els.viewer) closeViewer(); });   // backdrop
// <dialog> closes on Escape natively; this also covers synthetic keyboards that send the key without a key code.
els.viewer.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeViewer(); } });

// ---------- anyone can check: hash a file in the browser and compare ----------
async function sha256Hex(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
$("checkBtn").addEventListener("click", () => $("checkFile").click());
$("checkFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  const out = $("checkResult");
  const w = viewer.work;
  if (!file || !w?.cert?.hash) return;
  out.className = "cert__check-result";
  out.textContent = "Fingerprinting your file…";
  try {
    const hash = await sha256Hex(file);
    if (viewer.work !== w) return;
    const match = hash === w.cert.hash;
    out.className = `cert__check-result notice ${match ? "notice--ok" : "notice--problem"}`;
    out.textContent = match
      ? `Match. “${file.name}” is the exact file this certificate is for.`
      : `No match. “${file.name}” isn't the sealed file — even a resize, re-save or screenshot changes the fingerprint.`;
  } catch {
    out.className = "cert__check-result notice notice--problem";
    out.textContent = "Couldn't read that file. Try another.";
  }
});

async function copy(text, done) {
  const note = $("copied");
  note.textContent = "";
  try { await navigator.clipboard.writeText(text); requestAnimationFrame(() => { note.textContent = done; }); }
  catch { requestAnimationFrame(() => { note.textContent = "Couldn't copy — select it and copy by hand."; }); }
}
$("copyHash").addEventListener("click", () => viewer.work?.cert?.hash && copy(viewer.work.cert.hash, "Fingerprint copied."));
$("copyLink").addEventListener("click", () => viewer.work && copy(`${location.origin}/seal/${encodeURIComponent(viewer.work.id)}`, "Link copied."));

// ---------- start ----------
async function openFromUrl() {
  const id = new URLSearchParams(location.search).get("piece");
  if (!id) return;
  if (!works.has(id)) {
    try { const w = await api.getWork(id); if (w) { works.set(id, w); details.set(id, Promise.resolve(w)); } } catch { return; }
  }
  openViewer(id, null, { fromUrl: true });
}

buildChips();
initSite();
await loadPage();
openFromUrl();
