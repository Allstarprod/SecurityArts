const { Seal, Icon, IconButton, Button, Avatar, VerifiedBadge, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore;

/* Seal record. Everything cryptographic on this page comes from `work.cert`
   ({ hash, sig, signer, algo, ts }) as the server stored it — rendered verbatim,
   never derived client-side. Catalog previews carry no cert and say so. */

function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
// Legacy `?id=SA-XXXXXX` links (me.html purchases) — a lookup key for catalog previews only.
function sealId(id){return "SA-"+((strhash("seal"+id)>>>0).toString(36).toUpperCase()+"000000").slice(0,6);}
function fdate(iso){const d=new Date(iso);return isNaN(d)?String(iso):d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});}
// (dateStyle/timeStyle can't be combined with timeZoneName — Intl throws.)
function ftime(iso){const d=new Date(iso);return isNaN(d)?String(iso):d.toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});}

function resolveWork() {
  const p = new URLSearchParams(location.search);
  const sid = (p.get("id") || "").toUpperCase();
  const wid = p.get("work");
  if (wid && C.workById[wid]) return C.workById[wid];
  if (sid) { const hit = C.works.find((w) => sealId(w.id) === sid); if (hit) return hit; }
  return null; // user-published id → fetch from the API; no id at all → not found
}

/* Clean route on the deployed site (/verify via vercel.json); the sibling file when
   this page is opened by its .html path (local dev / plain static host). */
function verifyHref(hash) {
  const q = hash ? "?hash=" + encodeURIComponent(hash) : "";
  return /\.html$/i.test(location.pathname) ? "verify.html" + q : "/verify" + q;
}

// Artist for a work: a catalog artist, or a lightweight stand-in for a user-published
// work (which only carries an artist-name string + ownerId, no catalog profile).
function artistFor(work) {
  return C.artistById[work.artistId] || { id: null, ownerId: work.ownerId || null, name: work.artist || "Artist", city: "", handle: "" };
}
// Image source: generated art for catalog works (they carry a seed), the real uploaded
// image for user works (they carry img/imgUrl from the API).
function artSrc(work) { return work.seed != null ? SAGenArt.dataUri(work.seed, { cat: work.cat }) : (work.img || work.imgUrl || ""); }
// A real seal is the server-issued cert: hash + signature + signer + timestamp.
function certOf(work) { const c = work && work.cert; return c && c.hash && c.sig ? c : null; }

function AppBar() {
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Seal record</span>
      </a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="verify.html">Verify</a>
        <a href="me.html" className="optional">You</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* Discussion on a work — threaded one level, with likes. Talks to window.SAComments
   (real backend when live, localStorage when static). Text is rendered as {text}, so
   React escapes it — no dangerouslySetInnerHTML anywhere. */
function Comments({ workId }) {
  const [items, setItems] = React.useState(null); // null = loading
  const [text, setText] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [user, setUser] = React.useState(() => (window.SASession ? window.SASession.current() : null));
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  React.useEffect(() => {
    let alive = true;
    window.SAComments.list(workId).then((l) => { if (alive) setItems(l || []); }).catch(() => { if (alive) setItems([]); });
    if (window.SASession) window.SASession.sync().then((u) => { if (alive) setUser(u || null); }).catch(() => {});
    return () => { alive = false; };
  }, [workId]);

  const tops = (items || []).filter((c) => !c.parentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const repliesOf = (id) => (items || []).filter((c) => c.parentId === id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const post = async (value, parentId) => {
    const t = (value || "").trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const c = await window.SAComments.add(workId, t, parentId || null);
      setItems((prev) => [...(prev || []), c]);
      if (parentId) { setReplyText(""); setReplyTo(null); } else setText("");
    } catch (e) { show((e && e.message) || "Couldn't post — try again"); }
    finally { setBusy(false); }
  };

  const toggleLike = async (c) => {
    setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, likedByMe: !x.likedByMe, likes: Math.max(0, x.likes + (x.likedByMe ? -1 : 1)) } : x));
    try {
      const r = await window.SAComments.like(c.id, workId);
      if (r) setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, likes: r.likes, likedByMe: r.likedByMe } : x));
    } catch (e) {
      setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, likedByMe: c.likedByMe, likes: c.likes } : x));
      show("Sign in to like comments.");
    }
  };

  const del = async (c) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== c.id && x.parentId !== c.id));
    try { if (!(await window.SAComments.remove(c.id, workId))) throw new Error(); }
    catch (e) { setItems(prev); show("Couldn't delete — try again"); }
  };

  const signInHref = "login.html?next=" + encodeURIComponent("seal.html" + location.search);

  const actions = (c, small) => (
    <div className="citem__act">
      <button className={`clike ${c.likedByMe ? "on" : ""}`} onClick={() => toggleLike(c)} aria-pressed={c.likedByMe}>
        <Icon name="heart" size={small ? 12 : 13} /> {c.likes > 0 ? c.likes : ""}
      </button>
      {!c.parentId ? <button className="creply" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}>Reply</button> : null}
      {user && user.id === c.userId ? <button className="cdel" onClick={() => del(c)}>Delete</button> : null}
    </div>
  );

  return (
    <section className="section" id="discussion">
      <p className="section__h"><span>02</span> Discussion{items ? " · " + items.length : ""}</p>

      {user ? (
        <div className="cbox">
          <Avatar name={user.name} size={38} />
          <div className="cbox__main">
            <textarea className="cinput" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={500} rows={2} />
            <div className="cbox__act"><Button variant="solid" size="sm" onClick={() => post(text, null)} disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post"}</Button></div>
          </div>
        </div>
      ) : (
        <p className="csignin"><Icon name="message" size={16} /> <a href={signInHref}>Sign in</a> to join the discussion.</p>
      )}

      {items === null ? (
        <p className="cempty">Loading comments…</p>
      ) : tops.length === 0 ? (
        <p className="cempty">No comments yet — be the first to weigh in.</p>
      ) : (
        <ul className="clist">
          {tops.map((c) => (
            <li key={c.id} className="citem">
              <Avatar name={c.authorName} size={36} />
              <div className="citem__body">
                <div className="citem__head"><b>{c.authorName}</b><span>{timeAgo(c.createdAt)}</span></div>
                <p className="citem__text">{c.text}</p>
                {actions(c, false)}
                {replyTo === c.id ? (
                  <div className="creplybox">
                    <textarea className="cinput" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={"Reply to " + c.authorName + "…"} maxLength={500} rows={2} autoFocus />
                    <div className="cbox__act">
                      <Button variant="solid" size="sm" onClick={() => post(replyText, c.id)} disabled={busy || !replyText.trim()}>Reply</Button>
                      <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="creplyitem">
                    <Avatar name={r.authorName} size={28} />
                    <div className="citem__body">
                      <div className="citem__head"><b>{r.authorName}</b><span>{timeAgo(r.createdAt)}</span></div>
                      <p className="citem__text">{r.text}</p>
                      {actions(r, true)}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Toast show={!!toast}>{toast}</Toast>
    </section>
  );
}

function App() {
  const [work, setWork] = React.useState(resolveWork);
  const [notFound, setNotFound] = React.useState(false);
  // A work id we don't have in the catalog → user-published; fetch it from the API.
  React.useEffect(() => {
    if (work) return;
    const wid = new URLSearchParams(location.search).get("work");
    if (!wid || !window.SA_API) { setNotFound(true); return; }
    let alive = true;
    window.SA_API.getWork(wid).then((w) => { if (alive) { w ? setWork(w) : setNotFound(true); } }).catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, []);
  const artist = work ? artistFor(work) : null;
  const cert = certOf(work);
  // Live registry check: { status: idle | checking | ok | invalid | notfound | error, at, msg }
  const [check, setCheck] = React.useState({ status: "idle" });
  const checkRef = React.useRef(0);
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  // Count a view for this work's Creator Hub analytics — once per browser session.
  React.useEffect(() => {
    if (!window.SA_API || !work) return;
    const key = "sa-viewed-" + work.id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
    window.SA_API.viewWork(work.id).catch(() => {});
  }, [work]);

  // Work-level likes (the public "❤" signal). Read on load; toggle optimistically.
  const [likes, setLikes] = React.useState(null);
  const [likedByMe, setLikedByMe] = React.useState(false);
  // Keep the local "likes" store in sync with the work's real like state, so a like
  // made here also shows up in the profile's Likes count (one like, counted once).
  const syncLocalLike = (want) => {
    if (!S || !work) return;
    const has = S.isLiked(work.id);
    if (want && !has) S.toggleLike(work.id);
    else if (!want && has) S.toggleLike(work.id);
  };
  React.useEffect(() => {
    if (!window.SA_API || !work) return;
    let alive = true;
    window.SA_API.workLikes(work.id).then((r) => { if (alive && r) { setLikes(r.likes); setLikedByMe(!!r.likedByMe); syncLocalLike(!!r.likedByMe); } }).catch(() => {});
    return () => { alive = false; };
  }, [work]);
  const toggleLike = () => {
    if (!window.SA_API) { show("Sign in to like a work"); return; }
    const nextLiked = !likedByMe;
    setLikedByMe(nextLiked); setLikes((n) => Math.max(0, (n || 0) + (nextLiked ? 1 : -1)));
    syncLocalLike(nextLiked);
    window.SA_API.likeWork(work.id).then((r) => { if (r) { setLikes(r.likes); setLikedByMe(!!r.likedByMe); syncLocalLike(!!r.likedByMe); } })
      .catch(() => { setLikedByMe(!nextLiked); setLikes((n) => Math.max(0, (n || 0) + (nextLiked ? -1 : 1))); syncLocalLike(!nextLiked); show("Sign in to like a work"); });
  };

  // Related works — same medium, from the catalog.
  const related = React.useMemo(() => (work ? C.works.filter((w) => w.cat === work.cat && w.id !== work.id).slice(0, 6) : []), [work]);

  // Ask the registry to re-check this record's hash — GET /api/verify/:hash. Runs once on
  // load and again on demand; the panel renders exactly what the API answered.
  const reverify = React.useCallback(async () => {
    if (!cert) return;
    if (!window.SA_API) { setCheck({ status: "error", msg: "The registry API isn't reachable from this page." }); return; }
    const id = ++checkRef.current;
    setCheck({ status: "checking" });
    try {
      const r = await window.SA_API.verify(cert.hash);
      if (id !== checkRef.current) return;
      setCheck({ status: r && r.verified ? "ok" : "invalid", at: new Date(), signer: r && r.signer, sealedAt: r && r.sealedAt });
    } catch (e) {
      if (id !== checkRef.current) return;
      const m = (e && e.message) || "";
      setCheck(/no sealed work|HTTP 404/i.test(m) ? { status: "notfound", at: new Date() } : { status: "error", at: new Date(), msg: m || "Couldn't reach the registry." });
    }
  }, [cert]);
  React.useEffect(() => { reverify(); }, [reverify]);

  const copyHash = () => { try { navigator.clipboard && navigator.clipboard.writeText(cert.hash); } catch (e) {} show("SHA-256 copied"); };

  if (!work) return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="cempty" style={{ padding: "4rem 0", textAlign: "center" }}>
          {notFound
            ? <React.Fragment><h1 className="lede__title" style={{ marginBottom: "0.6rem" }}>Work not found.</h1><p>This seal record doesn't exist or was removed.</p><p style={{ marginTop: "1.4rem" }}><a href="index.html"><Button variant="solid" size="sm" arrow>Back to Discover</Button></a></p></React.Fragment>
            : <p>Loading seal record…</p>}
        </div>
      </div>
    </React.Fragment>
  );

  const artistHref = artist.id ? `profile.html?artist=${artist.id}` : (artist.ownerId ? `profile.html?u=${encodeURIComponent(artist.ownerId)}` : null);
  const statusLine = !cert ? { t: "No seal on record", s: "This catalog preview hasn't been sealed — nothing to verify." }
    : check.status === "checking" ? { t: "Checking the registry…", s: "GET /api/verify/" + cert.hash.slice(0, 12) + "…" }
    : check.status === "ok" ? { t: "Signature verified", s: "Registry match · checked " + check.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }
    : check.status === "invalid" ? { t: "Signature did not verify", s: "The registry has this hash, but the signature fails against the current key" }
    : check.status === "notfound" ? { t: "Not in the registry", s: "This record's hash returned no match — treat the seal as unconfirmed" }
    : check.status === "error" ? { t: "Couldn't reach the registry", s: check.msg || "Try again in a moment" }
    : { t: "Sealed", s: "Signature on record · not yet re-checked" };
  const statusClass = !cert || check.status === "invalid" || check.status === "notfound" || check.status === "error" ? "bad" : check.status === "ok" ? "ok" : "";

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="crumb"><a href={verifyHref()}>Verify</a> <Icon name="arrowRight" size={11} /> <span>{work.id}</span></div>

        <div className="top">
          <div className="art">
            <img src={artSrc(work)} alt={work.title} />
            {cert && check.status === "ok" ? <VerifiedBadge className="art__badge">Verified</VerifiedBadge> : null}
          </div>
          <div>
            <p className="lede__eyebrow">{cert ? "Seal record · " + work.id : "Catalog preview · " + work.id}</p>
            <h1 className="lede__title">{work.title}</h1>
            <div className="lede__by">
              {artistHref ? <a href={artistHref}><Avatar name={artist.name} size={38} verified /></a> : <Avatar name={artist.name} size={38} verified />}
              <div>
                {artistHref ? <a href={artistHref}><div className="n">{artist.name}</div></a> : <div className="n">{artist.name}</div>}
                <div className="c">{work.medium}{artist.city ? " · " + artist.city : ""}</div>
              </div>
            </div>

            <div className="engage">
              <button className={`likebtn ${likedByMe ? "on" : ""}`} onClick={toggleLike} aria-pressed={likedByMe} title="Like this work">
                <Icon name="heart" size={16} /> <span>{likes != null ? likes : "—"}</span>
              </button>
              <a className="engage__jump" href="#discussion"><Icon name="message" size={15} /> Join the discussion</a>
            </div>

            <div className={`verify-panel ${statusClass}`}>
              <div className="verify-row">
                <Seal size={44} className="verify-seal" />
                <div className="verify-main">
                  <div className="verify-status"><span className="live" />{statusLine.t}</div>
                  <div className="verify-sub">{statusLine.s}</div>
                </div>
              </div>
              {cert ? (
                <div className="verify-actions">
                  <Button variant="brass" size="sm" onClick={reverify} disabled={check.status === "checking"}>{check.status === "checking" ? "Checking…" : "Re-verify now"}</Button>
                  <Button variant="ghost" size="sm" onClick={copyHash}>Copy SHA-256</Button>
                  <a href={verifyHref(cert.hash)}><Button variant="ghost" size="sm">Open in Verify</Button></a>
                </div>
              ) : (
                <div className="verify-actions">
                  <a href={verifyHref()}><Button variant="ghost" size="sm" arrow>Verify a real seal</Button></a>
                </div>
              )}
            </div>

            {cert ? (
              <div className="facts">
                <div className="fact"><div className="fact__k">Algorithm</div><div className="fact__v brass">{cert.algo || "—"}</div></div>
                <div className="fact"><div className="fact__k">Sealed at</div><div className="fact__v">{cert.ts}</div></div>
                <div className="fact"><div className="fact__k">Signer key</div><div className="fact__v">{cert.signer}</div></div>
                <div className="fact"><div className="fact__k">Record</div><div className="fact__v">{work.id}</div></div>
                <div className="fact fact--wide"><div className="fact__k">SHA-256 of the file</div><div className="fact__v">{cert.hash}</div></div>
                <div className="fact fact--wide"><div className="fact__k">Signature</div><div className="fact__v">{cert.sig}</div></div>
              </div>
            ) : null}
          </div>
        </div>

        <section className="section">
          <p className="section__h"><span>01</span> Provenance</p>
          {cert ? (
            <ul className="timeline">
              <li className="event seal">
                <span className="event__dot"><Icon name="shieldCheck" size={13} /></span>
                <div className="event__head"><span className="event__title">Sealed</span><span className="event__date">{fdate(cert.ts)}</span></div>
                <div className="event__body">{ftime(cert.ts)} — the server hashed the uploaded bytes with SHA-256 and signed that hash with key <b>{cert.signer}</b>. This is the only event on record for this work.</div>
                <div className="event__hash">sha256 {cert.hash}</div>
              </li>
            </ul>
          ) : (
            <p className="cempty">No events — this catalog preview was never sealed, so there is no hash, signature, or timestamp to show.</p>
          )}
        </section>

        <Comments workId={work.id} />

        {related.length ? (
          <section className="section">
            <p className="section__h"><span>03</span> More like this</p>
            <div className="rail">
              {related.map((w) => {
                const a = C.artistById[w.artistId];
                return (
                  <a className="railcard" key={w.id} href={`seal.html?work=${w.id}`}>
                    <div className="railcard__art"><img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title} /></div>
                    <div className="railcard__t">{w.title}</div>
                    <div className="railcard__a">{a ? a.name : ""}</div>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="foot">
        <a href="verify.html">← Back to Verify</a>
        <span className="m">One seal · One human · Publicly verifiable</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
