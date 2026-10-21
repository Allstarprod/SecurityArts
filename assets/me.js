// me.js — your account: who you're signed in as, your numbers, your sealed work, and your
// name and handle. Signed out, it points you to sign in. Numbers are the API's, zero included.
import { initSite } from "./site.js";
import { createGrid } from "./tiles.js";

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;
const api = window.SA_API;
const $ = (id) => document.getElementById(id);

function show(view) {
  for (const v of ["loading", "out", "in"]) $(`view-${v}`).hidden = v !== view;
}

function note(text, kind) {
  const n = $("editNote");
  n.hidden = !text;
  n.textContent = text || "";
  n.className = `notice${kind ? ` notice--${kind}` : ""}`;
}

function paintUser(user) {
  $("name").textContent = user.name || "Your account";
  // An unclaimed handle is only a suggestion made from the email, and nobody else sees it,
  // so it isn't shown as if it were yours yet.
  const handle = user.handleClaimed && user.handle ? `@${user.handle}` : "No handle yet";
  $("meta").textContent = [handle, user.email].filter(Boolean).join(" · ");
  // Only a claimed handle has a public profile page; until then the button explains how.
  const link = $("profileLink");
  if (user.handleClaimed && user.handle) { link.href = `/@${encodeURIComponent(user.handle)}`; link.textContent = "Your public profile"; }
  else { link.href = "#edit-h"; link.textContent = "Claim a handle for your profile"; }
  $("f-name").value = user.name || "";
  $("f-handle").value = user.handle || "";
}

async function totals() {
  try {
    const s = await api.myStats();
    const t = s?.totals || {};
    for (const k of ["works", "views", "likes"]) $(`t-${k}`).textContent = String(t[k] ?? 0);
  } catch {
    $("totalsFailed").hidden = false;
  }
}

async function works(user) {
  const grid = createGrid($("grid"), { onRemoved: (left) => { if (!left) $("empty").hidden = false; } });
  try {
    const list = (await api.users.works(user.id)) || [];
    if (!list.length) { $("empty").hidden = false; return; }
    $("worksHint").hidden = false;
    grid.show(list);
  } catch {
    $("worksFailed").hidden = false;
  }
}

function editForm(user) {
  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("f-name").value.trim();
    const handle = $("f-handle").value.trim().toLowerCase();
    $("f-name").toggleAttribute("aria-invalid", !name);
    $("f-handle").toggleAttribute("aria-invalid", !HANDLE_RE.test(handle));
    if (!name) { note("Add a name, 1–80 characters.", "problem"); $("f-name").focus(); return; }
    if (!HANDLE_RE.test(handle)) { note("Handles are 3–30 characters: lowercase letters, numbers and underscores.", "problem"); $("f-handle").focus(); return; }
    const save = $("save");
    save.disabled = true;
    note("Saving…", "working");
    try {
      const updated = await api.profile.update({ name, handle });
      Object.assign(user, updated);
      paintUser(user);
      note("Saved.", "ok");
    } catch (err) {
      note(err?.message && !/^HTTP 5|Failed to fetch|NetworkError|Load failed/i.test(err.message) ? err.message : "We couldn't save that just now. Try again.", "problem");
    }
    save.disabled = false;
  });
}

$("signOut").addEventListener("click", async () => {
  try { await api.auth.logout(); } catch { /* going home shows whether the session is still there */ }
  location.href = "/";
});

const user = await initSite();
if (!user) {
  show("out");
} else {
  paintUser(user);
  show("in");
  if (new URLSearchParams(location.search).get("deleted") === "1") {
    $("deletedNote").hidden = false;
    history.replaceState(null, "", "/me");   // a reload shouldn't repeat the notice
  }
  $("name").focus({ preventScroll: true });
  editForm(user);
  totals();
  works(user);
}
