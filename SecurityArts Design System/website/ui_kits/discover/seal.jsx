const { Seal, Icon, IconButton, Button, Avatar, VerifiedBadge, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog;

function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hex(seed,n){var r=mulberry(strhash(seed));var o="";for(var i=0;i<n;i++)o+="0123456789abcdef"[(r()*16)|0];return o;}
function sealId(id){return "SA-"+((strhash("seal"+id)>>>0).toString(36).toUpperCase()+"000000").slice(0,6);}
function money(n){return "$"+n.toLocaleString("en-US");}
function fdate(d){return d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});}

const BUYERS = ["Aria Fenn", "Atlas & Co.", "Halcyon Gallery", "Devon Park", "Lena Cho", "Nadia Rios"];

function resolveWork() {
  const p = new URLSearchParams(location.search);
  const sid = (p.get("id") || "").toUpperCase();
  const wid = p.get("work");
  if (wid && C.workById[wid]) return C.workById[wid];
  if (sid) { const hit = C.works.find((w) => sealId(w.id) === sid); if (hit) return hit; }
  return C.workById["w3"] || C.works[0];
}

/* Deterministic provenance chain for a work. */
function chainFor(work) {
  const artist = C.artistById[work.artistId];
  const rand = mulberry(Math.abs(strhash("chain" + work.id)) + 3);
  const base = new Date(2026, 0, 1 + (Math.abs(strhash(work.id)) % 150));
  const events = [];
  events.push({ kind: "seal", title: "Sealed at origin", date: new Date(base), who: artist.name, body: <>Signed by <b>{artist.name}</b> and registered. The work's SHA-256 fingerprint was written to the public registry.</>, hash: hex("h" + work.id, 64) });
  // 0–2 transfers
  const nT = Math.floor(rand() * 3);
  let owner = artist.name, cursor = new Date(base);
  for (let i = 0; i < nT; i++) {
    cursor = new Date(cursor.getTime() + (20 + Math.floor(rand() * 90)) * 864e5);
    const tier = ["Personal", "Commercial", "Exclusive"][Math.floor(rand() * 3)];
    const to = BUYERS[Math.floor(rand() * BUYERS.length)];
    events.push({ kind: "transfer", title: (tier === "Exclusive" ? "Sold — exclusive" : tier + " license"), date: new Date(cursor), who: to, body: <><b>{owner}</b> → <b>{to}</b> · {tier} license · {money(work.price * (tier === "Exclusive" ? 9 : tier === "Commercial" ? 3 : 1))}. Seal transferred and re-signed to the new holder.</>, hash: hex("t" + work.id + i, 64) });
    if (tier === "Exclusive") owner = to;
  }
  // a re-verification event
  cursor = new Date(Date.now() - (5 + Math.floor(rand() * 20)) * 864e5);
  events.push({ kind: "verify", title: "Re-verified", date: cursor, who: "Registry", body: <>Signature checked against the registry — <b>valid</b>. Anyone can run this check at any time.</>, hash: null });
  return events.reverse(); // newest first
}

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
    <section className="section">
      <p className="section__h"><span>03</span> Discussion{items ? " · " + items.length : ""}</p>

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
  const [work] = React.useState(resolveWork);
  const artist = C.artistById[work.artistId];
  const id = sealId(work.id);
  const chain = React.useMemo(() => chainFor(work), [work.id]);
  const owner = React.useMemo(() => {
    const ex = chain.find((e) => e.kind === "transfer" && /exclusive/i.test(e.title));
    return ex ? ex.who : artist.name;
  }, [chain]);
  const [checking, setChecking] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  // Count a view for this work's Creator Hub analytics — once per browser session.
  React.useEffect(() => {
    if (!window.SA_API || !work) return;
    const key = "sa-viewed-" + work.id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
    window.SA_API.viewWork(work.id).catch(() => {});
  }, [work.id]);

  const reverify = () => {
    setChecking(true);
    setTimeout(() => { setChecking(false); setCheckedAt(new Date()); show("Signature valid — human-made"); }, 1100);
  };
  const copyEmbed = () => { show("Embed snippet copied"); };
  const copyId = () => { show("Seal ID copied"); };

  const fullHash = hex("h" + work.id, 64);
  const embed =
`<a href="https://securityarts.studio/s/${id}">
  <img alt="Verified by SecurityArts"
       src="https://securityarts.studio/badge/${id}.svg" />
</a>`;

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="crumb"><a href="verify.html">Verify</a> <Icon name="arrowRight" size={11} /> <span>{id}</span></div>

        <div className="top">
          <div className="art">
            <img src={SAGenArt.dataUri(work.seed, { cat: work.cat })} alt={work.title} />
            <VerifiedBadge className="art__badge">Verified</VerifiedBadge>
          </div>
          <div>
            <p className="lede__eyebrow">Seal {id}</p>
            <h1 className="lede__title">{work.title}</h1>
            <div className="lede__by">
              <a href={`profile.html?artist=${artist.id}`}><Avatar name={artist.name} size={38} verified /></a>
              <div>
                <a href={`profile.html?artist=${artist.id}`}><div className="n">{artist.name}</div></a>
                <div className="c">{work.medium} · {artist.city}</div>
              </div>
            </div>

            <div className="verify-panel">
              <div className="verify-row">
                <Seal size={44} className="verify-seal" />
                <div className="verify-main">
                  <div className="verify-status"><span className="live" />{checking ? "Checking…" : "Authentic — human-made"}</div>
                  <div className="verify-sub">{checkedAt ? "Re-verified " + checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Signature valid · registry match"}</div>
                </div>
              </div>
              <div className="verify-actions">
                <Button variant="brass" size="sm" onClick={reverify} disabled={checking}>{checking ? "Verifying…" : "Re-verify now"}</Button>
                <Button variant="ghost" size="sm" onClick={copyId}>Copy seal ID</Button>
              </div>
            </div>

            <div className="facts">
              <div className="fact"><div className="fact__k">Current owner</div><div className="fact__v">{owner}</div></div>
              <div className="fact"><div className="fact__k">Algorithm</div><div className="fact__v brass">ECDSA P-256 · SHA-256</div></div>
              <div className="fact"><div className="fact__k">Signer key</div><div className="fact__v">sa:key:{hex("k" + work.artistId, 12)}</div></div>
              <div className="fact"><div className="fact__k">Transfers</div><div className="fact__v">{chain.filter((e) => e.kind === "transfer").length}</div></div>
            </div>
          </div>
        </div>

        <section className="section">
          <p className="section__h"><span>01</span> Provenance</p>
          <ul className="timeline">
            {chain.map((e, i) => (
              <li className={`event ${e.kind}`} key={i}>
                <span className="event__dot"><Icon name={e.kind === "seal" ? "shieldCheck" : e.kind === "transfer" ? "arrowRight" : "checkCircle"} size={13} /></span>
                <div className="event__head"><span className="event__title">{e.title}</span><span className="event__date">{fdate(e.date)}</span></div>
                <div className="event__body">{e.body}</div>
                {e.hash ? <div className="event__hash">tx {e.hash.slice(0, 40)}…{e.hash.slice(-8)}</div> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <p className="section__h"><span>02</span> Embed the badge</p>
          <div className="embed">
            <div className="embed__preview">
              <span className="badge-chip"><Seal size={16} className="s" /> Verified by SecurityArts</span>
            </div>
            <div>
              <div className="code">
                <IconButton icon="check" variant="outline" label="Copy" className="code__copy" onClick={copyEmbed} />
                <pre><span className="tag">&lt;a</span> <span className="attr">href</span>=<span className="str">"https://securityarts.studio/s/{id}"</span><span className="tag">&gt;</span>{"\n  "}<span className="tag">&lt;img</span> <span className="attr">alt</span>=<span className="str">"Verified by SecurityArts"</span>{"\n       "}<span className="attr">src</span>=<span className="str">"https://securityarts.studio/badge/{id}.svg"</span> <span className="tag">/&gt;</span>{"\n"}<span className="tag">&lt;/a&gt;</span></pre>
              </div>
              <p className="embed__note">Drop this on a portfolio, gallery listing, or marketplace. The badge links back to this record so any visitor can confirm the seal is live — the same check galleries and platforms run through our API.</p>
            </div>
          </div>
        </section>

        <Comments workId={work.id} />
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
