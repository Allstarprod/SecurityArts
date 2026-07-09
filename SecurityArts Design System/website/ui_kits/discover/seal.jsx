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
