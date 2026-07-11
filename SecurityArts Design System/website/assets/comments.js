/* ============================================================
   SecurityArts — comments data layer (window.SAComments)
   One place the UI reads/writes discussion on a work.

   • Real backend when reachable: window.SA_API.comments (httpOnly-cookie auth).
   • Local demo fallback when opened statically (no backend), so the pages still
     work — comments persist in localStorage per work.

   The UI (seal.jsx) owns rendering; this owns the data, mirroring the
   store.js / session.js split.
   ============================================================ */
(function () {
  "use strict";
  function keyFor(workId) { return "sa-comments-" + workId; }
  function readLocal(workId) { try { return JSON.parse(localStorage.getItem(keyFor(workId))) || []; } catch (e) { return []; } }
  function writeLocal(workId, list) { try { localStorage.setItem(keyFor(workId), JSON.stringify(list)); } catch (e) {} }
  function localId() { return "cmt_local_" + Math.random().toString(36).slice(2, 10); }
  function currentUser() { return (window.SASession && window.SASession.current()) || null; }

  async function list(workId) {
    if (window.SA_API) { try { return await window.SA_API.comments.list(workId); } catch (e) {} }
    return readLocal(workId);
  }

  async function add(workId, text, parentId) {
    text = String(text || "").trim().slice(0, 500);
    if (!text) throw new Error("Say something first.");
    if (window.SA_API) return await window.SA_API.comments.add(workId, text, parentId || null);
    // local demo
    var u = currentUser();
    var c = {
      id: localId(), workId: workId, userId: (u && u.id) || "usr_local",
      authorName: (u && u.name) || "You", text: text, parentId: parentId || null,
      likes: 0, createdAt: new Date().toISOString(), likedByMe: false,
    };
    var l = readLocal(workId); l.push(c); writeLocal(workId, l); return c;
  }

  // workId is needed for the local fallback's lookup; the API ignores it.
  async function like(id, workId) {
    if (window.SA_API) return await window.SA_API.comments.like(id);
    var l = readLocal(workId);
    var c = l.filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    c.likedByMe = !c.likedByMe;
    c.likes = Math.max(0, (c.likes || 0) + (c.likedByMe ? 1 : -1));
    writeLocal(workId, l);
    return { likes: c.likes, likedByMe: c.likedByMe };
  }

  async function remove(id, workId) {
    if (window.SA_API) { await window.SA_API.comments.remove(id); return true; }
    var l = readLocal(workId).filter(function (x) { return x.id !== id && x.parentId !== id; });
    writeLocal(workId, l); return true;
  }

  window.SAComments = { list: list, add: add, like: like, remove: remove };
})();
