/* SecurityArts API client.
   Same-origin fetch wrapper around the Node backend. Every page loads this before
   its inline script. When the backend is present (served by `node server/server.mjs`)
   calls hit the real API; when a page is opened statically (file:// or a plain static
   host) the calls reject and each caller falls back to localStorage — nothing breaks. */
(function () {
  "use strict";
  var BASE = "/api";
  var CLERK_JS = "/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
  var CLERK_UI = "/npm/@clerk/ui@1/dist/ui.browser.js";
  var CLERK_LOAD_TIMEOUT = 15000;

  /* ---- Clerk (sign-in) ----------------------------------------------------
     When the server reports a Clerk publishable key, Clerk's scripts load from its
     Frontend API (the host is encoded in the key) and every API call carries the
     short-lived Clerk session token. Without a key this resolves to null and the
     page works exactly as before. Loaded once per page, lazily. */
  var clerkPromise = null;
  function clerkHost(pk) {
    var m = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(pk || "");
    if (!m) return null;
    try { var host = atob(m[1]).replace(/\$$/, ""); return /^[a-z0-9.-]+$/i.test(host) ? host : null; } catch (_) { return null; }
  }
  function addScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Couldn't load sign-in (" + src + ")")); };
      document.head.appendChild(s);
    });
  }
  async function loadClerk() {
    var res = await fetch(BASE + "/auth/config", { headers: { "X-Requested-With": "fetch" }, credentials: "same-origin" });
    if (!res.ok) return null;
    var pk = ((await res.json()) || {}).data;
    pk = pk && pk.clerk;
    var host = clerkHost(pk);
    if (!host) return null;
    await Promise.all([
      addScript("https://" + host + CLERK_UI),
      addScript("https://" + host + CLERK_JS, { "data-clerk-publishable-key": pk }),
    ]);
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    return window.Clerk;
  }
  function clerk() {
    if (!clerkPromise) {
      var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, CLERK_LOAD_TIMEOUT); });
      clerkPromise = Promise.race([loadClerk(), timeout]).catch(function () { return null; });
    }
    return clerkPromise;
  }

  async function authHeader() {
    var c = await clerk();
    if (!c || !c.session) return {};
    var token = await c.session.getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  async function req(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json", "X-Requested-With": "fetch" }, await authHeader());
    var res = await fetch(BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((json && json.error) || ("HTTP " + res.status));
    return json ? json.data : null;
  }

  window.SA_API = {
    // The loaded Clerk instance, or null when Clerk isn't switched on.
    clerk: clerk,
    // Resolves true once the backend answers /health. Lazy: nothing fires at load
    // time, so a statically-opened page makes no request and logs no console error.
    // Callers can await this, but they don't have to — a failed method call is
    // enough to trigger fallback.
    _availability: null,
    get available() {
      return this._availability || (this._availability = req("/health").then(function () { return true; }).catch(function () { return false; }));
    },
    health: function () { return req("/health"); },
    subscribe: function (email) { return req("/newsletter", { method: "POST", body: { email: email } }); },
    publishWork: function (w) { return req("/works", { method: "POST", body: w }); },
    listWorks: function (qs) { return req("/works" + (qs ? "?" + qs : "")); },
    getWork: function (id) { return req("/works/" + encodeURIComponent(id)); },
    viewWork: function (id) { return req("/works/" + encodeURIComponent(id) + "/view", { method: "POST" }); },
    workLikes: function (id) { return req("/works/" + encodeURIComponent(id) + "/likes"); },
    likeWork: function (id) { return req("/works/" + encodeURIComponent(id) + "/like", { method: "POST" }); },
    // Owner only: takes the piece off the wall and its certificate stops resolving.
    deleteWork: function (id) { return req("/works/" + encodeURIComponent(id), { method: "DELETE" }); },
    myStats: function () { return req("/me/stats"); },
    mySales: function () { return req("/me/sales"); },
    verify: function (hash) { return req("/verify/" + encodeURIComponent(hash)); },
    checkout: function (payload) { return req("/checkout", { method: "POST", body: payload }); },
    order: function (id) { return req("/orders/" + encodeURIComponent(id)); },
    auth: {
      register: function (p) { return req("/auth/register", { method: "POST", body: p }); },
      login: function (p) { return req("/auth/login", { method: "POST", body: p }); },
      logout: async function () {
        var c = await clerk();
        if (c && c.session) await c.signOut();
        return req("/auth/logout", { method: "POST" });
      },
      me: function () { return req("/auth/me"); },
      config: function () { return req("/auth/config"); },
      forgot: function (email) { return req("/auth/forgot", { method: "POST", body: { email: email } }); },
      reset: function (token, password) { return req("/auth/reset", { method: "POST", body: { token: token, password: password } }); },
    },
    // Public profile by user id or @handle (honors the owner's public/private choice server-side).
    users: {
      get: function (id) { return req("/users/" + encodeURIComponent(id)); },
      getByHandle: function (h) { return req("/handle/" + encodeURIComponent(h)); },
      works: function (id) { return req("/users/" + encodeURIComponent(id) + "/works"); },
    },
    // Update your own profile (auth required). `update` also accepts name + handle.
    profile: {
      update: function (fields) { return req("/profile", { method: "POST", body: fields }); },
      banner: function (payload) { return req("/profile/banner", { method: "POST", body: payload }); },
    },
    // Threaded comments on a work.
    comments: {
      list: function (workId) { return req("/works/" + encodeURIComponent(workId) + "/comments"); },
      add: function (workId, text, parentId) { return req("/works/" + encodeURIComponent(workId) + "/comments", { method: "POST", body: { text: text, parentId: parentId || null } }); },
      like: function (id) { return req("/comments/" + encodeURIComponent(id) + "/like", { method: "POST" }); },
      remove: function (id) { return req("/comments/" + encodeURIComponent(id), { method: "DELETE" }); },
    },
    boards: {
      list: function () { return req("/boards"); },
      create: function (name) { return req("/boards", { method: "POST", body: { name: name } }); },
      remove: function (id) { return req("/boards/" + id, { method: "DELETE" }); },
      togglePin: function (id, workId) { return req("/boards/" + id + "/pins", { method: "POST", body: { workId: workId } }); },
    },
  };
})();
