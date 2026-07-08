/* ============================================================
   SecurityArts — shared client store (demo)
   A tiny localStorage-backed store shared across Discover, Profile, For You
   and DMs so actions persist and interconnect: likes drive the For You feed,
   follows show on profiles, and a DM request from a profile appears in DMs.

   window.SAStore — methods below. Subscribe with SAStore.subscribe(fn) or the
   "sa-store-change" window event. Not production state — a believable mock.
   ============================================================ */
(function () {
  "use strict";
  var KEY = "sa-store-v1";
  var state = load();

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s._v === 1) return s; } catch (e) {}
    return seed();
  }
  function seed() {
    var now = Date.now();
    return {
      _v: 1, seeded: true,
      likes: [], follows: [], seen: [],
      threads: {
        // one live conversation
        "ines-vela": { status: "active", unread: 0, messages: [
          { from: "them", text: "Thank you for saving Low Tide — it's part of a triptych I'm sealing this week.", ts: now - 1000 * 60 * 60 * 26 },
          { from: "me", text: "It's beautiful. Is the third piece going to the market?", ts: now - 1000 * 60 * 60 * 25 },
          { from: "them", text: "Yes — verified Friday. I'll send you the seal first.", ts: now - 1000 * 60 * 60 * 24 },
        ] },
        // one incoming request (someone messaging you)
        "theo-brandt": { status: "incoming", unread: 1, messages: [
          { from: "them", text: "Hi — saw you saved a couple of my night frames. Would love to send you a print set. Open to a request?", ts: now - 1000 * 60 * 90 },
        ] },
      },
    };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    window.dispatchEvent(new CustomEvent("sa-store-change", { detail: state }));
    subs.forEach(function (fn) { try { fn(state); } catch (e) {} });
  }

  var subs = [];
  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }

  // ── Likes ──────────────────────────────────────────────
  function isLiked(id) { return state.likes.indexOf(id) !== -1; }
  function toggleLike(id) {
    var i = state.likes.indexOf(id);
    if (i === -1) state.likes.unshift(id); else state.likes.splice(i, 1);
    save(); return isLiked(id);
  }
  // ── Follows ────────────────────────────────────────────
  function isFollowing(id) { return state.follows.indexOf(id) !== -1; }
  function toggleFollow(id) {
    var i = state.follows.indexOf(id);
    if (i === -1) state.follows.unshift(id); else state.follows.splice(i, 1);
    save(); return isFollowing(id);
  }
  // ── Seen (for "you've been looking at…") ───────────────
  function addSeen(id) {
    state.seen = [id].concat(state.seen.filter(function (x) { return x !== id; })).slice(0, 60);
    save();
  }
  // ── DMs ────────────────────────────────────────────────
  function getThread(artistId) { return state.threads[artistId] || null; }
  function threadList() {
    return Object.keys(state.threads).map(function (id) {
      var t = state.threads[id]; var last = t.messages[t.messages.length - 1];
      return { artistId: id, status: t.status, unread: t.unread || 0, last: last, messages: t.messages };
    }).sort(function (a, b) { return (b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0); });
  }
  function requestDM(artistId, text) {
    var t = state.threads[artistId];
    if (!t) { t = state.threads[artistId] = { status: "requested", unread: 0, messages: [] }; }
    if (t.status === "incoming") t.status = "active"; // replying accepts
    else if (!t.messages.length) t.status = "requested";
    t.messages.push({ from: "me", text: text, ts: Date.now() });
    save(); return t;
  }
  function sendMessage(artistId, text) { return requestDM(artistId, text); }
  function accept(artistId) { var t = state.threads[artistId]; if (t) { t.status = "active"; t.unread = 0; save(); } }
  function decline(artistId) { if (state.threads[artistId]) { delete state.threads[artistId]; save(); } }
  function markRead(artistId) { var t = state.threads[artistId]; if (t && t.unread) { t.unread = 0; save(); } }

  function counts() {
    var pending = 0; Object.keys(state.threads).forEach(function (id) { if (state.threads[id].status === "incoming") pending++; });
    var active = 0; Object.keys(state.threads).forEach(function (id) { if (state.threads[id].status !== "incoming") active++; });
    return { likes: state.likes.length, follows: state.follows.length, pending: pending, threads: active };
  }
  function reset() { state = seed(); save(); }

  window.SAStore = {
    get: function () { return state; },
    subscribe: subscribe,
    isLiked: isLiked, toggleLike: toggleLike, likes: function () { return state.likes.slice(); },
    isFollowing: isFollowing, toggleFollow: toggleFollow, follows: function () { return state.follows.slice(); },
    addSeen: addSeen, seen: function () { return state.seen.slice(); },
    getThread: getThread, threadList: threadList, requestDM: requestDM, sendMessage: sendMessage,
    accept: accept, decline: decline, markRead: markRead,
    counts: counts, reset: reset,
  };
})();
