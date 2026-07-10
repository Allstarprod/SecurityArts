/* ============================================================
   SecurityArts — client session helper (window.SASession)
   One place every page reads "who is logged in."

   • Real backend when reachable: window.SA_API.auth (httpOnly-cookie session).
   • Local demo fallback when opened statically (no backend), so the design-system
     pages still work — a believable mock identity.

   Stores ONLY the public user profile (id / email / name) in localStorage, for
   instant synchronous reads. NEVER a token — the real session lives in the
   server's httpOnly cookie.
   ============================================================ */
(function () {
  "use strict";
  var KEY = "sa-session-user";

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function write(u) {
    try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch (e) {}
    window.dispatchEvent(new CustomEvent("sa-session-change", { detail: u || null }));
    return u;
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function nameFromEmail(e) {
    return String(e || "").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || "You";
  }
  function handleFromEmail(e) { return String(e || "").split("@")[0].replace(/[^a-z0-9]+/gi, "").toLowerCase() || "you"; }

  function localUser(email, name) {
    email = String(email || "").trim().toLowerCase();
    return { id: "usr_local_" + hash(email), email: email, name: name || nameFromEmail(email), handle: handleFromEmail(email), demo: true };
  }

  async function login(email, password) {
    email = String(email || "").trim().toLowerCase();
    if (window.SA_API) {
      var u = await window.SA_API.auth.login({ email: email, password: password });
      return write(Object.assign({ handle: handleFromEmail(email) }, u));
    }
    return write(localUser(email));
  }
  async function register(email, password, name) {
    email = String(email || "").trim().toLowerCase();
    name = String(name || "").trim() || nameFromEmail(email);
    if (window.SA_API) {
      var u = await window.SA_API.auth.register({ email: email, password: password, name: name });
      return write(Object.assign({ handle: handleFromEmail(email) }, u));
    }
    return write(localUser(email, name));
  }
  async function logout() {
    try { if (window.SA_API) await window.SA_API.auth.logout(); } catch (e) {}
    write(null);
  }

  // Synchronous — the localStorage mirror. Pages gate on this so they render instantly.
  function current() { return read(); }

  // Background reconcile with the server's real session (keeps the mirror honest when live).
  async function sync() {
    if (!window.SA_API) return read();
    try {
      var u = await window.SA_API.auth.me();
      if (u) return write(Object.assign({ handle: handleFromEmail(u.email) }, u));
      var cur = read();
      if (cur && !cur.demo) write(null); // server says logged out — drop a stale real mirror
      return read();
    } catch (e) { return read(); }
  }

  window.SASession = {
    current: current, login: login, register: register, logout: logout, sync: sync,
    nameFromEmail: nameFromEmail, handleFromEmail: handleFromEmail,
  };
})();
