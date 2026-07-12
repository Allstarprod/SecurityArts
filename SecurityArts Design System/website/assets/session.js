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
    if (window.SA_API && (await window.SA_API.available)) {
      var u = await window.SA_API.auth.login({ email: email, password: password });
      return write(Object.assign({ handle: handleFromEmail(email) }, u));
    }
    return write(localUser(email));
  }
  async function register(email, password, name) {
    email = String(email || "").trim().toLowerCase();
    name = String(name || "").trim() || nameFromEmail(email);
    if (window.SA_API && (await window.SA_API.available)) {
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

  var PROFILE_KEYS = ["pronouns", "gender", "bio", "likes", "accent", "visibility", "role", "interests", "onboarded", "bannerUrl"];

  // Merge a partial update into the local mirror (static-demo path): name/handle are
  // top-level, everything else lands in profile.
  function localMerge(cur, fields) {
    var merged = Object.assign({}, cur);
    if (fields.name != null) merged.name = fields.name;
    if (fields.handle != null) merged.handle = String(fields.handle).toLowerCase();
    var pf = {};
    PROFILE_KEYS.forEach(function (k) { if (fields[k] !== undefined) pf[k] = fields[k]; });
    merged.profile = Object.assign({}, cur.profile || {}, pf);
    return merged;
  }

  // Update the signed-in user (name, handle, and profile fields in one call).
  // Live backend: real errors (e.g. "handle taken") PROPAGATE so the UI can show them —
  // we only local-merge when there's genuinely no backend (a statically-opened page).
  async function updateProfile(fields) {
    if (window.SA_API && (await window.SA_API.available)) {
      var u = await window.SA_API.profile.update(fields);
      return write(Object.assign({ handle: handleFromEmail(u.email) }, u));
    }
    return write(localMerge(read() || {}, fields));
  }

  // Upload or remove the profile banner. payload = { image: dataURI } | { remove: true }.
  async function uploadBanner(payload) {
    if (window.SA_API && (await window.SA_API.available)) {
      var u = await window.SA_API.profile.banner(payload);
      return write(Object.assign({ handle: handleFromEmail(u.email) }, u));
    }
    var bannerUrl = payload && payload.remove ? "" : (payload && payload.image) || "";
    return write(localMerge(read() || {}, { bannerUrl: bannerUrl }));
  }

  // Fetch another user's public profile by id or @handle (null when static / offline).
  async function getUser(id) {
    if (window.SA_API) { try { return await window.SA_API.users.get(id); } catch (e) {} }
    return null;
  }
  async function getUserByHandle(handle) {
    if (window.SA_API) { try { return await window.SA_API.users.getByHandle(handle); } catch (e) {} }
    return null;
  }

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
    updateProfile: updateProfile, uploadBanner: uploadBanner, getUser: getUser, getUserByHandle: getUserByHandle,
    nameFromEmail: nameFromEmail, handleFromEmail: handleFromEmail,
  };
})();
