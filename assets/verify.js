// verify.js — check a file or a fingerprint against SecurityArts seals. A file is
// fingerprinted (SHA-256) in the browser and never uploaded; only the fingerprint is
// looked up. A match names the sealing account and links to the certificate.
import { initSite } from "./site.js";
import { el, when, sha256Hex, certificateUrl } from "./tiles.js";

const HEX64 = /^[0-9a-f]{64}$/;
const api = window.SA_API;
const $ = (id) => document.getElementById(id);
const drop = $("drop");
const input = $("file");
let run = 0;

function result(...nodes) { $("result").replaceChildren(...nodes); }

async function check(hash, label) {
  const mine = ++run;
  $("fp").textContent = hash;
  $("fpBox").hidden = false;
  result(el("p", { class: "notice notice--working", text: "Looking it up…" }));
  try {
    const r = await api.verify(hash);
    if (mine !== run) return;
    if (!r?.work) throw new Error("not found");
    let who = null;
    try {
      const full = await api.getWork(r.work.id);
      who = full?.ownerId ? await api.users.get(full.ownerId) : null;
    } catch { /* the match still stands without the account name */ }
    if (mine !== run) return;
    const account = who
      ? (who.handleClaimed ? el("a", { class: "link", href: `/@${encodeURIComponent(who.handle)}`, text: `${who.name || "An account"} (@${who.handle})` }) : who.name || "A SecurityArts account")
      : "A SecurityArts account";
    result(
      el("p", { class: `notice ${r.verified ? "notice--ok" : "notice--problem"}`, text: r.verified
        ? `Match. ${label} is the exact file sealed as “${r.work.title}”.`
        : `This fingerprint is on record as “${r.work.title}”, but its signature doesn't check out. Treat it with care.` }),
      el("dl", { class: "facts" },
        el("dt", { text: "Piece" }), el("dd", { text: r.work.title }),
        el("dt", { text: "Credited to" }), el("dd", { text: r.work.artist || "No one" }),
        el("dt", { text: "Sealed by" }), el("dd", {}, account),
        el("dt", { text: "Sealed" }), el("dd", { text: r.sealedAt ? when(r.sealedAt) : "Unknown" })),
      el("a", { class: "btn btn--red", href: certificateUrl(r.work.id), text: "Open the certificate" }));
  } catch (err) {
    if (mine !== run) return;
    if (/no sealed work|not found/i.test(err?.message || "")) {
      result(el("p", { class: "notice notice--problem", text: `No match. ${label} was never sealed on SecurityArts, or it's a re-saved, resized or screenshotted copy. Copies never match; ask for the original file.` }));
    } else {
      result(el("p", { class: "notice notice--problem", text: "We couldn't reach the record just now. Check your connection and try again." }));
    }
  }
}

async function checkFile(file) {
  if (!file) return;
  result(el("p", { class: "notice notice--working", text: `Fingerprinting “${file.name}” in your browser…` }));
  try { await check(await sha256Hex(file), `“${file.name}”`); }
  catch { result(el("p", { class: "notice notice--problem", text: "Couldn't read that file. Try another." })); }
}

drop.addEventListener("click", () => input.click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); checkFile(e.dataTransfer?.files?.[0]); });
input.addEventListener("change", () => { checkFile(input.files?.[0]); input.value = ""; });

$("hashForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const field = $("hash");
  const hash = field.value.trim().toLowerCase();
  if (!HEX64.test(hash)) {
    field.setAttribute("aria-invalid", "true");
    result(el("p", { class: "notice notice--problem", text: "A fingerprint is 64 characters of 0–9 and a–f. Check you copied all of it." }));
    field.focus();
    return;
  }
  field.removeAttribute("aria-invalid");
  check(hash, "That fingerprint");
});

initSite();
