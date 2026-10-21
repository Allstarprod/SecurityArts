// site.js — behaviour shared by the rebuilt pages: the mobile menu and a header that
// knows who's signed in. Talks to the API through window.SA_API (/js/api.js).

const api = () => window.SA_API;

/** The signed-in user, or null (signed out, or the API can't be reached). */
export async function currentUser() {
  try { return (await api()?.auth.me()) || null; } catch { return null; }
}

// The open menu covers the page, so it behaves as a modal: the page behind is inert
// (Tab can't wander under the sheet) and focus starts on the first link.
function initMenu() {
  const btn = document.getElementById("menuBtn");
  const menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;
  const behind = () => document.querySelectorAll("main, .site-foot");
  const set = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    for (const node of behind()) node.inert = open;
    if (open) menu.querySelector("a, button")?.focus();
  };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); }
  });
  matchMedia("(min-width: 981px)").addEventListener("change", (e) => { if (e.matches) set(false); });
}

async function signOut() {
  try { await api()?.auth.logout(); } catch { /* the reload shows whether the session is still there */ }
  location.reload();
}

// Signed in: "Sign in · Join" becomes "Hi, Ana · Sign out" in both navs.
export function showSignedIn(user) {
  const first = String(user.name || "there").trim().split(/\s+/)[0].slice(0, 24);
  for (const slot of document.querySelectorAll("[data-auth-slot]")) {
    const hi = document.createElement("a");
    hi.href = "/me";
    hi.textContent = `Hi, ${first}`;
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Sign out";
    out.addEventListener("click", signOut);
    slot.replaceChildren(hi, out);
  }
  for (const cta of document.querySelectorAll("[data-seal-cta]")) cta.href = "/seal-a-piece";
}

export async function initSite() {
  initMenu();
  const user = await currentUser();
  if (user) showSignedIn(user);
  return user;
}
