/* ============================================================
   SecurityArts — black-screen failsafe (defense-in-depth)
   Two guarantees so a page can never sit silently black:
     1. The page-transition overlay (.sa-tr) is force-cleared on window load
        and after a hard timeout — even if transition.js drops a timer.
     2. If #root never mounts an app (script error, missing global, whatever),
        a visible, styled "couldn't load" panel with a Retry button replaces
        the blank instead of an empty near-black screen.
   Runs before the compiled app script; costs nothing when things work.
   ============================================================ */
(function () {
  "use strict";
  var MOUNT_TIMEOUT = 8000; // ms to wait for #root to get children

  function clearOverlay() {
    document.querySelectorAll(".sa-tr").forEach(function (el) {
      el.classList.remove("on", "is-reveal");
      el.removeAttribute("data-mode");
      el.style.display = "none";
    });
  }
  // Belt-and-suspenders overlay cleanup (transition.js has its own timers).
  window.addEventListener("load", function () { setTimeout(clearOverlay, 1500); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) clearOverlay(); });

  function showFallback(detail) {
    if (document.getElementById("sa-failsafe")) return;
    clearOverlay();
    var d = document.createElement("div");
    d.id = "sa-failsafe";
    d.setAttribute("role", "alert");
    d.style.cssText =
      "position:fixed;inset:0;z-index:100000;display:grid;place-items:center;text-align:center;" +
      "padding:2rem;background:var(--ink,#0c0c0b);color:var(--bone,#f4f1e9);" +
      "font-family:var(--font-sans,system-ui,sans-serif)";
    d.innerHTML =
      '<div style="max-width:32rem">' +
      '<div style="font-family:var(--font-serif,Georgia,serif);font-size:clamp(1.6rem,1rem+2vw,2.4rem);letter-spacing:-0.02em;margin-bottom:0.6rem">This page didn’t finish loading.</div>' +
      '<p style="color:var(--bone-dim,#a39e92);line-height:1.55;margin-bottom:1.4rem">A script failed to load — often a dropped connection or a content blocker. Your data is safe.</p>' +
      '<button id="sa-failsafe-retry" style="cursor:pointer;font-family:var(--font-mono,monospace);text-transform:uppercase;letter-spacing:0.12em;font-size:0.72rem;color:var(--ink,#0c0c0b);background:var(--brass,#c2a14e);border:0;border-radius:100px;padding:0.8rem 1.5rem">Reload page</button>' +
      (detail ? '<p style="margin-top:1.4rem;color:var(--bone-faint,#6f6b62);font-family:var(--font-mono,monospace);font-size:0.66rem;word-break:break-word">' + String(detail).slice(0, 200) + "</p>" : "") +
      "</div>";
    document.body.appendChild(d);
    var btn = document.getElementById("sa-failsafe-retry");
    if (btn) btn.addEventListener("click", function () { location.reload(); });
  }

  var lastError = "";
  window.addEventListener("error", function (e) {
    // a failed <script> tag fires an error event with no message
    if (e && e.target && e.target.tagName === "SCRIPT") lastError = "Failed to load: " + (e.target.src || "script");
    else if (e && e.message) lastError = e.message;
  }, true);

  function checkMount() {
    var root = document.getElementById("root");
    if (!root) return; // static page without an app root — nothing to guard
    if (root.childElementCount > 0) return; // mounted fine
    showFallback(lastError);
  }
  if (document.readyState === "complete") setTimeout(checkMount, MOUNT_TIMEOUT);
  else window.addEventListener("load", function () { setTimeout(checkMount, MOUNT_TIMEOUT); });
})();
