const { Seal, Icon, Input, Button, Chip, Certificate, VerifiedBadge, Avatar, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog;

/* Deterministic seal record per work (demo stand-in for the public registry). */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
function hex(seed,n){var r=mulberry(strhash(seed));var o="";for(var i=0;i<n;i++)o+="0123456789abcdef"[(r()*16)|0];return o;}
function sealId(id){return "SA-"+((strhash("seal"+id)>>>0).toString(36).toUpperCase()+"000000").slice(0,6);}
function sealDate(id){var d=new Date(2026,0,1+(Math.abs(strhash(id))%180));return d.toISOString().slice(0,10);}

const SEALS = C.works.map((w) => ({
  work: w, artist: C.artistById[w.artistId],
  id: sealId(w.id), hash: hex("h"+w.id, 64), sig: hex("s"+w.id, 96), signer: "sa:key:" + hex("k"+w.artistId, 12), ts: sealDate(w.id),
}));
const BY_ID = {}; SEALS.forEach((s) => { BY_ID[s.id] = s; });
const SAMPLES = [SEALS[3], SEALS[19], SEALS[13]].map((s) => s.id);
const money = (n) => "$" + n.toLocaleString("en-US");

function AppBar() {
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Verify</span>
      </a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="foryou.html" className="optional">For You</a>
        <a href="dms.html" className="optional">DMs</a>
        <a href="verify.html" className="active">Verify</a>
        <a href="me.html" className="optional">You</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function App() {
  const [q, setQ] = React.useState("");
  const [result, setResult] = React.useState(undefined); // undefined = not searched, null = no match
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  const run = (raw) => {
    const v = (raw != null ? raw : q).trim().toUpperCase();
    if (!v) return;
    let hit = BY_ID[v] || BY_ID[v.indexOf("SA-") === 0 ? v : "SA-" + v] || null;
    if (!hit) { // also allow matching by a hash prefix
      const low = v.toLowerCase();
      hit = SEALS.find((s) => s.hash.indexOf(low) === 0 && low.length >= 6) || null;
    }
    setResult(hit);
    show(hit ? "Seal verified — authentic" : "No seal matched");
  };
  const useSample = (id) => { setQ(id); run(id); };

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <section className="hero">
          <span className="hero__eyebrow"><Icon name="shieldCheck" size={14} /> Public authenticity check</span>
          <h1>Verify a <em>seal.</em></h1>
          <p>Every work on SecurityArts carries a cryptographic seal proving a human made it. Paste a seal ID to confirm provenance — no account, no catch.</p>

          <div className="checker">
            <form className="checkform" onSubmit={(e) => { e.preventDefault(); run(); }}>
              <Input shape="pill" icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Seal ID (e.g. SA-XXXXXX) or hash…" aria-label="Seal ID or hash" />
              <Button variant="solid" type="submit" arrow>Verify</Button>
            </form>
            <div className="samples">
              <span className="lbl">Try one:</span>
              {SAMPLES.map((id) => <Chip key={id} onClick={() => useSample(id)}>{id}</Chip>)}
            </div>
          </div>
        </section>

        {result === undefined ? (
          <section className="steps">
            <div className="step"><span className="step__n">01</span><span className="step__t">A human makes it</span><span className="step__b">An artist creates an original work — by hand, on canvas, in-camera, or in 3D.</span></div>
            <div className="step"><span className="step__n">02</span><span className="step__t">We seal it</span><span className="step__b">SecurityArts signs the work's fingerprint with its private key and posts the hash to a public registry.</span></div>
            <div className="step"><span className="step__n">03</span><span className="step__t">Anyone verifies</span><span className="step__b">Buyers, galleries, and platforms check the seal here — provenance without a middleman.</span></div>
          </section>
        ) : result === null ? (
          <div className="notfound">
            <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
            <h2>No seal matched.</h2>
            <p>Check the ID and try again — or tap one of the sample seals above to see a verified result.</p>
          </div>
        ) : (
          <section className="result">
            <div className="result__art">
              <img src={SAGenArt.dataUri(result.work.seed, { cat: result.work.cat })} alt={result.work.title} />
              <VerifiedBadge className="result__badge">Verified</VerifiedBadge>
              <div className="result__cap"><div className="t">{result.work.title}</div><div className="a">{result.work.medium} · {money(result.work.price)}</div></div>
            </div>
            <div className="verdict">
              <div className="verdict__stamp">
                <Seal size={62} className="verdict__seal" />
                <div>
                  <div className="verdict__title">Authentic — <em style={{ fontStyle: "italic", color: "var(--brass)" }}>human-made.</em></div>
                  <div className="verdict__sub">Seal {result.id} · valid</div>
                </div>
              </div>
              <div className="artistrow">
                <Avatar name={result.artist.name} size={44} verified />
                <div className="artistrow__main">
                  <div className="artistrow__name">{result.artist.name}</div>
                  <div className="artistrow__meta">{result.artist.city} · verified artist</div>
                </div>
                <a href={`profile.html?artist=${result.artist.id}`}><Button variant="ghost" size="sm">View artist</Button></a>
              </div>
              <Certificate rows={[
                { k: "Seal ID", v: result.id, brass: true },
                { k: "Algorithm", v: "ECDSA P-256 · SHA-256" },
                { k: "Hash", v: result.hash.slice(0, 40) + "…" + result.hash.slice(-8) },
                { k: "Signature", v: result.sig.slice(0, 40) + "…" + result.sig.slice(-8) },
                { k: "Signer", v: result.signer },
                { k: "Sealed", v: result.ts },
              ]}>
                <div className="verdict__actions">
                  <a href={`seal.html?id=${result.id}`}><Button variant="brass" size="sm" arrow>View full record</Button></a>
                  <Button variant="ghost" size="sm" onClick={() => { setQ(""); setResult(undefined); }}>Verify another</Button>
                </div>
              </Certificate>
            </div>
          </section>
        )}
      </div>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">One seal · One human · Publicly verifiable</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
