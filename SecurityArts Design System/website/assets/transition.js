/* ============================================================
   SecurityArts — seal page transition
   A wax-seal stamp flies across the screen and presses down before a page is
   shown; on navigation it sweeps across as the page hands off. Self-contained
   (no bundle dependency), theme-aware (uses --ink / --bone / --brass), and
   disabled under prefers-reduced-motion. Include on every page:
     <script src="../../assets/transition.js"></script>
   ============================================================ */
(function () {
  "use strict";
  if (window.__saTransition) return; window.__saTransition = true;

  var EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var SEAL =
    '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="2.1" d="M 50 13 A 7.22 7.22 0 0 1 64.16 15.82 A 7.22 7.22 0 0 1 76.16 23.84 A 7.22 7.22 0 0 1 84.18 35.84 A 7.22 7.22 0 0 1 87 50 A 7.22 7.22 0 0 1 84.18 64.16 A 7.22 7.22 0 0 1 76.16 76.16 A 7.22 7.22 0 0 1 64.16 84.18 A 7.22 7.22 0 0 1 50 87 A 7.22 7.22 0 0 1 35.84 84.18 A 7.22 7.22 0 0 1 23.84 76.16 A 7.22 7.22 0 0 1 15.82 64.16 A 7.22 7.22 0 0 1 13 50 A 7.22 7.22 0 0 1 15.82 35.84 A 7.22 7.22 0 0 1 23.84 23.84 A 7.22 7.22 0 0 1 35.84 15.82 A 7.22 7.22 0 0 1 50 13 Z"/>' +
    '<circle fill="none" stroke="currentColor" stroke-width="1.5" cx="50" cy="50" r="27"/>' +
    '<path fill="currentColor" d="M 50 34.5 L 53.76 44.82 L 64.74 45.21 L 56.09 51.98 L 59.11 62.54 L 50 56.4 L 40.89 62.54 L 43.91 51.98 L 35.26 45.21 L 46.24 44.82 Z"/></svg>';

  var css =
    "@keyframes saFlyIn{0%{transform:translateX(-82vw) rotate(-170deg) scale(.45);opacity:0}24%{opacity:1}70%{transform:translateX(0) rotate(0) scale(1.06)}100%{transform:translateX(0) rotate(0) scale(1)}}" +
    "@keyframes saPunch{0%{transform:scale(1)}45%{transform:scale(1.16)}100%{transform:scale(1)}}" +
    "@keyframes saRipple{0%{transform:scale(.5);opacity:.55}100%{transform:scale(2.3);opacity:0}}" +
    "@keyframes saSweep{0%{transform:translateX(-84vw) rotate(-180deg) scale(.5);opacity:0}22%{opacity:1}100%{transform:translateX(88vw) rotate(220deg) scale(.85);opacity:0}}" +
    "@keyframes saCover{0%{opacity:0}100%{opacity:1}}" +
    "@keyframes saReveal{0%{opacity:1}100%{opacity:0}}" +
    "@keyframes saWord{0%{opacity:0;letter-spacing:.5em}60%{opacity:0}100%{opacity:1;letter-spacing:.22em}}" +
    ".sa-tr{position:fixed;inset:0;z-index:99999;display:none;place-items:center;background:var(--ink,#0c0c0b);overflow:hidden}" +
    ".sa-tr.on{display:grid}" +
    ".sa-tr__stage{position:relative;display:grid;place-items:center;gap:1.1rem;text-align:center}" +
    ".sa-tr__seal{position:relative;width:clamp(92px,16vw,176px);height:clamp(92px,16vw,176px);color:var(--bone,#f4f1e9);will-change:transform,opacity}" +
    ".sa-tr__seal::after{content:'';position:absolute;inset:-8%;border-radius:50%;border:1.5px solid var(--brass,#c2a14e);opacity:0}" +
    ".sa-tr__word{font-family:var(--font-mono,monospace);font-size:.66rem;text-transform:uppercase;letter-spacing:.22em;color:var(--bone-dim,#a39e92);opacity:0}" +
    ".sa-tr[data-mode='enter'] .sa-tr__seal{animation:saFlyIn .64s " + EASE + " both, saPunch .32s " + EASE + " .60s both}" +
    ".sa-tr[data-mode='enter'] .sa-tr__seal::after{animation:saRipple .6s " + EASE + " .62s both}" +
    ".sa-tr[data-mode='enter'] .sa-tr__word{animation:saWord .6s " + EASE + " .5s both}" +
    ".sa-tr[data-mode='exit']{animation:saCover .2s " + EASE + " both}" +
    ".sa-tr[data-mode='exit'] .sa-tr__seal{animation:saSweep .6s " + EASE + " both}" +
    ".sa-tr[data-mode='exit'] .sa-tr__word{display:none}" +
    ".sa-tr.is-reveal{animation:saReveal .44s " + EASE + " both;pointer-events:none}";

  var style = document.createElement("style");
  style.textContent = css;
  var ov = document.createElement("div");
  ov.className = "sa-tr";
  ov.innerHTML = '<div class="sa-tr__stage"><span class="sa-tr__seal">' + SEAL + '</span><span class="sa-tr__word">SecurityArts</span></div>';

  function mount() {
    document.head.appendChild(style);
    document.body.appendChild(ov);
    enter();
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  function enter() {
    if (reduce) return;
    ov.setAttribute("data-mode", "enter");
    ov.classList.add("on");
    setTimeout(function () { ov.classList.add("is-reveal"); }, 800);
    setTimeout(function () { ov.classList.remove("on", "is-reveal"); ov.removeAttribute("data-mode"); }, 1280);
  }

  function exit(href) {
    if (reduce) { window.location.href = href; return; }
    ov.classList.remove("is-reveal");
    ov.setAttribute("data-mode", "exit");
    ov.classList.add("on");
    var go = function () { window.location.href = href; };
    setTimeout(go, 560);
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.host && a.host !== window.location.host) return;         // external origin
    if (a.href === window.location.href) return;                    // same page
    if (a.pathname === window.location.pathname && a.hash) return;  // in-page anchor
    e.preventDefault();
    exit(a.href);
  }, true);

  // Coming back via bfcache: never leave the overlay stuck on.
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) { ov.classList.remove("on", "is-reveal"); ov.removeAttribute("data-mode"); }
  });
})();
