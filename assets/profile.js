// profile.js — a public profile at /@<handle>: the account's name, handle and bio, and its
// sealed work as wall tiles linking to each certificate. The address bar keeps /@<handle>
// (a rewrite), so the handle comes from the path; ?h= is the fallback.
import { initSite } from "./site.js";
import { createGrid } from "./tiles.js";

const HANDLE_RE = /^[a-z0-9_]{1,30}$/;
const api = window.SA_API;
const $ = (id) => document.getElementById(id);

function handle() {
  const fromPath = /^\/@([^/]+)\/?$/.exec(location.pathname)?.[1];
  const h = (fromPath ? decodeURIComponent(fromPath) : new URLSearchParams(location.search).get("h") || "").toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

function show(view) {
  for (const v of ["loading", "missing", "failed", "found"]) $(`view-${v}`).hidden = v !== view;
}

const grid = createGrid($("grid"), {
  onRemoved: (left) => { setCount(left); if (!left) $("empty").hidden = false; },
});
function setCount(n) { $("count").textContent = n ? `${n} sealed ${n === 1 ? "piece" : "pieces"}` : ""; }

function renderProfile(p) {
  const name = p.name || `@${p.handle}`;
  document.title = `${name} (@${p.handle}) — SecurityArts`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `${name}'s sealed work on SecurityArts. Every piece has a public certificate anyone can check.`);
  $("name").textContent = name;
  $("handle").textContent = [`@${p.handle}`, p.pronouns].filter(Boolean).join(" · ");
  if (p.bio) { $("bio").textContent = p.bio; $("bio").hidden = false; }
  if (/^https:\/\//i.test(p.bannerUrl || "")) {
    const banner = $("banner");
    banner.style.backgroundImage = `url("${encodeURI(p.bannerUrl)}")`;
    banner.hidden = false;
  }
  show("found");
  $("name").focus({ preventScroll: true });
}

async function renderWorks(p) {
  if (p.visibility === "private") {
    $("emptyText").textContent = "This profile is private.";
    $("empty").hidden = false;
    $("works-h").hidden = true;
    return;
  }
  try {
    const works = (await api.users.works(p.id)) || [];
    setCount(works.length);
    if (!works.length) { $("empty").hidden = false; return; }
    grid.show(works);
  } catch {
    $("worksFailed").hidden = false;
  }
}

async function start() {
  const h = handle();
  if (!h) { show("missing"); return; }
  try {
    const p = await api.users.getByHandle(h);
    if (!p) { show("missing"); return; }
    renderProfile(p);
    renderWorks(p);
  } catch (err) {
    show(/no such profile|not found/i.test(err?.message || "") ? "missing" : "failed");
  }
}

initSite();
$("retry").addEventListener("click", () => { show("loading"); start(); });
start();
