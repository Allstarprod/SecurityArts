/* SecurityArts API client.
   Same-origin fetch wrapper around the Node backend. Every page loads this before
   its inline script. When the backend is present (served by `node server/server.mjs`)
   calls hit the real API; when a page is opened statically (file:// or a plain static
   host) the calls reject and each caller falls back to localStorage — nothing breaks. */
(function () {
  "use strict";
  var BASE = "/api";

  async function req(path, opts) {
    opts = opts || {};
    var res = await fetch(BASE + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((json && json.error) || ("HTTP " + res.status));
    return json ? json.data : null;
  }

  window.SA_API = {
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
    myStats: function () { return req("/me/stats"); },
    verify: function (hash) { return req("/verify/" + encodeURIComponent(hash)); },
    checkout: function (payload) { return req("/checkout", { method: "POST", body: payload }); },
    order: function (id) { return req("/orders/" + encodeURIComponent(id)); },
    auth: {
      register: function (p) { return req("/auth/register", { method: "POST", body: p }); },
      login: function (p) { return req("/auth/login", { method: "POST", body: p }); },
      logout: function () { return req("/auth/logout", { method: "POST" }); },
      me: function () { return req("/auth/me"); },
      config: function () { return req("/auth/config"); },
      forgot: function (email) { return req("/auth/forgot", { method: "POST", body: { email: email } }); },
      reset: function (token, password) { return req("/auth/reset", { method: "POST", body: { token: token, password: password } }); },
    },
    // Public profile by user id or @handle (honors the owner's public/private choice server-side).
    users: {
      get: function (id) { return req("/users/" + encodeURIComponent(id)); },
      getByHandle: function (h) { return req("/handle/" + encodeURIComponent(h)); },
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
