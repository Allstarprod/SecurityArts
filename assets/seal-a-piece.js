// seal-a-piece.js — choose a finished file, see its fingerprint, seal it, and watch
// the wax land on it in a colour picked from the art under it.
// The server does the real sealing (it re-hashes the bytes and signs them); the
// fingerprint shown here is worked out in the browser so the artist can see exactly
// what will be sealed, and so we can confirm the server sealed that same file.
import { initSite, currentUser } from "./site.js";
import { sealColour, tintedWaxUrl } from "./seal/seal-ink.js";
import { shouldUseFallback } from "./stamp3d/capability.js";

const MAX_BYTES = 6_000_000;                                    // the server's decoded-image cap
const TYPES = { "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WebP" };
const CATS = [
  ["painting", "Painting"], ["illustration", "Illustration"], ["photography", "Photography"], ["3d", "3D"],
  ["lettering", "Lettering"], ["concept", "Concept art"], ["mixed", "Mixed media"],
];

const $ = (id) => document.getElementById(id);
const api = window.SA_API;
const state = { user: null, file: null, dataUrl: "", hash: "", img: null, duplicate: null, busy: false, work: null };

// ---------- small helpers ----------
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
const sizeLabel = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const when = (ts) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const titleFromName = (name) => name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

function say(text, kind) {
  const note = $("note");
  note.hidden = !text;
  note.textContent = text || "";
  note.className = `notice${kind ? ` notice--${kind}` : ""}`;
  const live = $("live");
  live.textContent = "";
  if (text) requestAnimationFrame(() => { live.textContent = text; });
}

// File problems show beside the drop zone, where the visitor is looking, not by the
// Seal button further down. The notice is role=alert, so it's announced too.
function fileProblem(text) {
  const n = $("dropNote");
  n.hidden = !text;
  n.textContent = text || "";
  $("drop").classList.toggle("is-invalid", !!text);
  if (text) say("");
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const readAs = (file, how) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error || new Error("read failed"));
  r[how](file);
});

// ---------- mediums (real radio buttons, styled as chips) ----------
function buildMediums() {
  $("mediums").replaceChildren(...CATS.map(([key, label]) =>
    el("label", { class: "medium" }, el("input", { type: "radio", name: "cat", value: key }), el("span", { text: label }))));
}
const chosenCat = () => document.querySelector('input[name="cat"]:checked')?.value || "";

// ---------- choosing a file ----------
async function pickFile(file) {
  if (!file) return;
  if (!TYPES[file.type]) { fileProblem("That file type can't be sealed. Use a PNG, JPG or WebP image."); return; }
  if (file.size > MAX_BYTES) { fileProblem(`That file is ${sizeLabel(file.size)}. The limit is 6 MB, so export a smaller copy and seal that one.`); return; }
  fileProblem("");
  say("Reading your file…", "working");
  try {
    const [buffer, dataUrl] = await Promise.all([readAs(file, "readAsArrayBuffer"), readAs(file, "readAsDataURL")]);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    Object.assign(state, { file, dataUrl, img, hash: await sha256Hex(buffer), duplicate: null });
  } catch {
    fileProblem("We couldn't read that image. Try exporting it again.");
    return;
  }
  $("previewImg").src = state.dataUrl;
  $("previewImg").alt = `Preview of ${file.name}`;
  $("fileName").textContent = file.name;
  $("fileInfo").textContent = `${TYPES[file.type]} · ${state.img.naturalWidth}×${state.img.naturalHeight} · ${sizeLabel(file.size)}`;
  $("drop").hidden = true;
  $("preview").hidden = false;
  const hash = $("hash");
  hash.textContent = state.hash;
  hash.classList.remove("is-empty");
  if (!$("title").value.trim()) $("title").value = titleFromName(file.name);
  say("");
  checkDuplicate(state.hash);
}

// Identical bytes can only be sealed once; say so before they fill in the form.
async function checkDuplicate(hash) {
  try {
    const record = await api.verify(hash);
    if (state.hash !== hash || !record?.work) return;
    state.duplicate = record.work;
    const note = $("note");
    say(`This exact file is already sealed, as “${record.work.title}”.`, "problem");
    note.append(" ", el("a", { class: "linkish", href: `/seal/${encodeURIComponent(record.work.id)}`, text: "See its certificate" }));
  } catch { /* 404 = not sealed yet, which is what we want */ }
}

function resetFile() {
  Object.assign(state, { file: null, dataUrl: "", hash: "", img: null, duplicate: null });
  $("preview").hidden = true;
  $("drop").hidden = false;
  $("hash").textContent = "Choose a file and it appears here. It's worked out in your browser.";
  $("hash").classList.add("is-empty");
  $("file").value = "";
  say("");
  fileProblem("");
  $("drop").focus();
}

// ---------- sealing ----------
function validate() {
  if (!state.file) return ["drop", "Choose the file you want to seal first."];
  if (state.duplicate) return ["drop", "This exact file is already sealed. Choose a different file."];
  if (!$("title").value.trim()) return ["title", "Give the piece a title."];
  if (!chosenCat()) return ["mediums", "Pick the medium that fits best."];
  if (!$("credit").value.trim()) return ["credit", "Add the name the piece should be credited to."];
  if (!$("rights").checked) return ["rights", "Confirm you made this or have the right to share it."];
  return null;
}

async function submit(e) {
  e.preventDefault();
  if (state.busy) return;
  const problem = validate();
  if (problem) {
    if (problem[0] === "drop" && !state.file) {
      fileProblem(problem[1]);
      $("drop").scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      $("drop").focus({ preventScroll: true });
      return;
    }
    say(problem[1], "problem");
    const target = problem[0] === "mediums" ? document.querySelector('input[name="cat"]') : $(problem[0]);
    target?.focus();
    return;
  }
  state.busy = true;
  const btn = $("submit");
  btn.disabled = true;
  btn.textContent = "Sealing…";
  say("Fingerprinting and signing your file…", "working");
  try {
    const work = await api.publishWork({ title: $("title").value.trim(), artist: $("credit").value.trim(), cat: chosenCat(), image: state.dataUrl });
    state.work = work;
    await showSealed(work);
  } catch (err) {
    const msg = err?.message || "";
    if (/sign in/i.test(msg)) say("Your sign-in ran out. Sign in again and your file will still be here.", "problem");
    else if (/^HTTP 5|Failed to fetch|NetworkError|Load failed/i.test(msg)) say("We couldn't reach the server. Check your connection and try again.", "problem");
    else say(msg || "Something went wrong. Try again.", "problem");
  }
  state.busy = false;
  btn.disabled = false;
  btn.textContent = "Seal it";
}

// ---------- the moment ----------
function cornerRect(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const s = Math.min(w, h) * 0.3;
  return { x: w - s * 1.1, y: h - s * 1.1, w: s, h: s };
}

// The caption under the stamp. seal-ink's own `why` is a design note (contrast
// ratios, "red would melt into this art"), so the page says it in plain words.
function inkCaption(pick) {
  if (!pick) return "";
  if (pick.name === "red") return "Sealed in chop red wax.";
  if (pick.name === "match") return "Sealed in wax matched to your art, so the seal stands out from it.";
  return `Sealed in ${pick.label.toLowerCase()} wax, so the seal stands out from your art.`;
}

async function stampFlat(stage, pick) {
  const src = await tintedWaxUrl(pick?.hex || "#D42228").catch(() => "/assets/seal/wax.svg");
  stage.replaceChildren(el("div", { class: "stage__flat" },
    el("img", { class: "art", src: state.dataUrl, alt: `${$("title").value.trim()}, sealed` }),
    el("img", { class: "wax", src, alt: "" })));
}

async function stamp3d(stage) {
  const { mountWaxSeal, artSheet } = await import("./stamp3d/wax-seal.js");
  const sheet = artSheet(state.img);
  const { x, y, r } = sheet.spot;
  const pick = sealColour(sheet.canvas, { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { kind: "wax" });
  stage.replaceChildren(el("canvas", { "aria-hidden": "true" }));
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", `${$("title").value.trim()}, with the wax seal pressed onto its corner`);
  await mountWaxSeal(stage, { mode: "slam", art: state.img, color: pick?.hex || "#D42228" });
  return pick;
}

async function showSealed(work) {
  $("form").hidden = true;
  $("preview").hidden = true;
  $("stageWrap").hidden = false;
  const stage = $("stage");
  let pick = null;
  try {
    if (shouldUseFallback()) { pick = sealColour(state.img, cornerRect(state.img), { kind: "wax" }); await stampFlat(stage, pick); }
    else pick = await stamp3d(stage);
  } catch {
    await stampFlat(stage, pick);                                  // Three.js didn't load: the flat stamp still lands
  }
  $("stageWhy").textContent = inkCaption(pick);

  const c = work.cert || {};
  $("doneTitle").textContent = `“${work.title}” is sealed.`;
  $("doneWhen").textContent = c.ts ? `Sealed ${when(c.ts)}` : "";
  const who = state.user ? (state.user.handleClaimed && state.user.handle ? `${state.user.name} (@${state.user.handle})` : state.user.name) : "Your account";
  const sig = String(c.sig || "");
  const rows = [
    ["Sealed by", who],
    ["Credited to", work.artist],
    ["Fingerprint", c.hash ? `SHA-256 ${c.hash}` : "—"],
    ["Signature", sig.length > 40 ? `${sig.slice(0, 24)}…${sig.slice(-12)}` : sig || "—"],
    ["Signed with", c.kid || c.signer || "—"],
  ];
  $("doneCert").replaceChildren(...rows.map(([k, v]) => el("div", {}, el("dt", { text: k }), el("dd", { text: v }))));
  const match = $("doneMatch");
  match.hidden = false;
  if (c.hash && c.hash === state.hash) {
    match.className = "notice notice--ok";
    match.textContent = "The server's fingerprint matches the file you chose, byte for byte.";
  } else {
    match.className = "notice notice--problem";
    match.textContent = "The server's fingerprint doesn't match the file in your browser. Please tell us at hello@securityarts.studio.";
  }
  $("seeOnWall").href = `/wall?piece=${encodeURIComponent(work.id)}`;
  $("seeCert").href = `/seal/${encodeURIComponent(work.id)}`;
  $("done").hidden = false;
  say("");
  // Keep the stamp in view so nobody misses it landing (on narrow screens the
  // certificate sits below it); screen readers still move to the certificate.
  $("done").focus({ preventScroll: true });
  $("stageWrap").scrollIntoView({ block: "center", behavior: "instant" });
}

function sealAnother() {
  $("done").hidden = true;
  $("stageWrap").hidden = true;
  $("stage").replaceChildren();
  $("form").hidden = false;
  $("title").value = "";
  $("rights").checked = false;
  $("copied").textContent = "";
  for (const r of document.querySelectorAll('input[name="cat"]')) r.checked = false;
  state.work = null;
  resetFile();
}

// ---------- wiring ----------
const drop = $("drop");
drop.addEventListener("click", () => $("file").click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); pickFile(e.dataTransfer?.files?.[0]); });
$("file").addEventListener("change", (e) => pickFile(e.target.files?.[0]));
$("swap").addEventListener("click", resetFile);
$("form").addEventListener("submit", submit);
$("again").addEventListener("click", sealAnother);
$("copyLink").addEventListener("click", async () => {
  if (!state.work) return;
  const out = $("copied");
  out.textContent = "";
  try { await navigator.clipboard.writeText(`${location.origin}/seal/${encodeURIComponent(state.work.id)}`); requestAnimationFrame(() => { out.textContent = "Link copied."; }); }
  catch { requestAnimationFrame(() => { out.textContent = "Couldn't copy — use the See it on the wall link."; }); }
});

buildMediums();
initSite();
state.user = await currentUser();
if (state.user) {
  $("form").hidden = false;
  $("credit").value = state.user.name || "";
} else {
  $("signedOut").hidden = false;
  drop.replaceWith(el("img", { class: "drop__stamp", src: "/assets/seal/wax.svg", alt: "", style: "width: min(60%, 20rem)" }));
}
