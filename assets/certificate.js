// certificate.js — the public certificate for one sealed work, at /seal/<id>.
// The address bar keeps /seal/<id> (a rewrite), so the id comes from the path; ?work= is
// the fallback for direct /certificate.html links. Everything shown comes from the API.
import { initSite } from "./site.js";
import { el, when, sha256Hex, CAT_LABEL } from "./tiles.js";

const ID_RE = /^[A-Za-z0-9_-]+$/;
const api = window.SA_API;
const $ = (id) => document.getElementById(id);

function workId() {
  const fromPath = /^\/seal\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  const id = fromPath ? decodeURIComponent(fromPath) : new URLSearchParams(location.search).get("work");
  return id && ID_RE.test(id) ? id : null;
}

function show(view) {
  for (const v of ["loading", "missing", "failed", "found"]) $(`view-${v}`).hidden = v !== view;
}

function row(k, v, id) {
  const dd = el("dd", { id }, ...[].concat(v));
  return el("div", {}, el("dt", { text: k }), dd);
}

function setRecord(kind, text) {
  const node = $("record");
  node.className = `cert__record cert__record--${kind}`;
  node.textContent = text;
}

// The stored certificate is checked against the public record rather than trusted.
async function checkRecord(w) {
  setRecord("pending", "Checking the public record…");
  const hash = w.cert?.hash;
  if (!hash) { setRecord("bad", "This piece has no fingerprint on record."); return; }
  try {
    const r = await api.verify(hash);
    if (r?.verified && r.work?.id === w.id) setRecord("ok", "Signature checks out against the public record.");
    else if (r?.verified) setRecord("bad", "This file's public record belongs to a different piece. Treat this listing with care.");
    else setRecord("bad", "The signature on this certificate doesn't check out.");
  } catch {
    setRecord("bad", "We couldn't check the public record just now. Reload to try again.");
  }
}

async function showAccount(w) {
  const dd = $("sealedBy");
  let who = null;
  try { who = w.ownerId ? await api.users.get(w.ownerId) : null; } catch { /* shown as unknown below */ }
  if (!who) { dd.textContent = "A SecurityArts account"; return; }
  const name = who.name || "A SecurityArts account";
  dd.replaceChildren(who.handleClaimed ? el("a", { href: `/@${encodeURIComponent(who.handle)}`, text: `${name} (@${who.handle})` }) : name);
}

async function likes(w, user) {
  const btn = $("likeBtn");
  const count = $("likeCount");
  const paint = (r) => {
    count.textContent = `${r.likes} ${r.likes === 1 ? "like" : "likes"}`;
    btn.setAttribute("aria-pressed", String(!!r.likedByMe));
    btn.textContent = r.likedByMe ? "Liked" : "Like";
  };
  try { paint(await api.workLikes(w.id)); } catch { count.textContent = ""; }
  btn.addEventListener("click", async () => {
    if (!user) { location.href = `/join?next=${encodeURIComponent(`/seal/${w.id}`)}`; return; }
    btn.disabled = true;
    try { paint(await api.likeWork(w.id)); }
    catch (err) { $("copied").textContent = err?.message || "Couldn't save that like. Try again."; }
    btn.disabled = false;
  });
}

async function copy(text, done) {
  const note = $("copied");
  note.textContent = "";
  try { await navigator.clipboard.writeText(text); requestAnimationFrame(() => { note.textContent = done; }); }
  catch { requestAnimationFrame(() => { note.textContent = "Couldn't copy. Select it and copy by hand."; }); }
}

function render(w, user) {
  const credit = w.artist || "no one";
  const medium = CAT_LABEL[w.cat] || w.medium || "";
  const c = w.cert || {};
  const signedTime = c.v === 1;
  const sig = String(c.sig || "");
  document.title = `${w.title} — certificate — SecurityArts`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `The public certificate for “${w.title}”: which account sealed this exact file, and when.`);
  $("title").textContent = w.title;
  $("credit").textContent = [`Credited to ${credit}`, medium].filter(Boolean).join(" · ");
  $("sealedDate").textContent = c.ts ? `Sealed ${when(c.ts)}` : "";
  const img = $("art");
  img.alt = `${w.title}, credited to ${credit}`;
  const noImage = (text) => $("artPanel").replaceChildren(el("p", { class: "piece__failed", text }));
  img.addEventListener("error", () => noImage("Image didn't load"), { once: true });
  if (w.img) img.src = w.img;
  else noImage("No image on file");
  $("certRows").replaceChildren(
    row("Sealed by", "Looking up the account…", "sealedBy"),
    row("Credited to", credit),
    row("Fingerprint", c.hash ? `SHA-256 ${c.hash}` : "—"),
    row(signedTime ? "Sealed" : "Recorded", c.ts ? `${when(c.ts)}${signedTime ? "" : " (time not signed: older seal)"}` : "—"),
    row("Signature", sig.length > 40 ? `${sig.slice(0, 24)}…${sig.slice(-12)}` : sig || "—"),
    row("Signed with", c.kid || c.signer || "—"),
  );
  $("onWall").href = `/wall?piece=${encodeURIComponent(w.id)}`;
  $("copyLink").addEventListener("click", () => copy(`${location.origin}/seal/${encodeURIComponent(w.id)}`, "Link copied."));
  $("copyHash").addEventListener("click", () => c.hash && copy(c.hash, "Fingerprint copied."));
  $("checkBtn").addEventListener("click", () => $("checkFile").click());
  $("checkFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    const out = $("checkResult");
    if (!file || !c.hash) return;
    out.className = "cert__check-result";
    out.textContent = "Fingerprinting your file…";
    try {
      const match = (await sha256Hex(file)) === c.hash;
      out.className = `cert__check-result notice ${match ? "notice--ok" : "notice--problem"}`;
      out.textContent = match
        ? `Match. “${file.name}” is the exact file this certificate is for.`
        : `No match. “${file.name}” isn't the sealed file. Even a resize, re-save or screenshot changes the fingerprint.`;
    } catch {
      out.className = "cert__check-result notice notice--problem";
      out.textContent = "Couldn't read that file. Try another.";
    }
  });
  show("found");
  $("title").focus({ preventScroll: true });
  checkRecord(w);
  showAccount(w);
  likes(w, user);
  api.viewWork(w.id).catch(() => {});
}

const userP = initSite().catch(() => null);

async function start() {
  const id = workId();
  if (!id) { show("missing"); return; }
  try {
    const w = await api.getWork(id);
    if (!w) { show("missing"); return; }
    render(w, await userP);
  } catch (err) {
    show(/not found/i.test(err?.message || "") ? "missing" : "failed");
  }
}

$("retry").addEventListener("click", () => { show("loading"); start(); });
start();
