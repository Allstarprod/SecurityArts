/* SecurityArts — Discover (verified-work wall) UI kit.
   Catalog-driven wall of sealed human work: live search + medium filters, like
   into your For You feed, open any artist's profile, and the get-verified flow.
   Shares SACatalog + SAStore with Profile, For You and DMs. */
const { Seal, Icon, IconButton, Input, Chip, Button, Field, Pin, Drawer, Modal, Certificate, Toast, ThemeToggle } =
  window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore;

const CATS = [
  ["all", "All work"], ["illustration", "Illustration"], ["painting", "Painting"], ["3d", "3D / CGI"],
  ["photography", "Photography"], ["lettering", "Lettering"], ["concept", "Concept Art"], ["mixed", "Mixed Media"],
];
const rndHex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }

function AppBar({ q, setQ, onLikes, onVerify }) {
  const c = S.counts();
  return (
    <header className="appbar">
      <a className="brand" href="../studio/index.html" aria-label="SecurityArts home">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Discover</span>
      </a>
      <form className="searchform" onSubmit={(e) => e.preventDefault()} role="search">
        <Input shape="pill" icon="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sealed work — artist, title, medium…" aria-label="Search" />
      </form>
      <div className="appbar__actions">
        <a className="navlink optional" href="welcome.html"><Icon name="home" size={15} /><span className="navlink__label">Home</span></a>
        <a className="navlink optional" href="verify.html"><Icon name="shieldCheck" size={15} /><span className="navlink__label">Verify</span></a>
        <a className="navlink optional" href="foryou.html"><Icon name="sparkle" size={15} /><span className="navlink__label">For You</span></a>
        <a className="navlink" href="dms.html"><Icon name="message" size={15} /><span className="navlink__label">DMs</span>{c.pending ? <span className="dot" /> : null}</a>
        <button className="navlink" onClick={onLikes}><Icon name="heart" size={15} /><span className="navlink__label">Likes</span> <span className="navlink__count">{c.likes}</span></button>
        <a className="navlink optional" href="me.html"><Icon name="user" size={15} /><span className="navlink__label">You</span></a>
        <Button variant="solid" size="sm" onClick={onVerify}>Get verified</Button>
        <ThemeToggle size={38} />
      </div>
    </header>
  );
}

function App() {
  useStoreTick();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [extra, setExtra] = React.useState([]); // published (session) works
  const [likesOpen, setLikesOpen] = React.useState(false);
  const [modal, setModal] = React.useState(false);
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const [vTitle, setVTitle] = React.useState("");
  const [vArtist, setVArtist] = React.useState("");
  const [cert, setCert] = React.useState(null);
  const showToast = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  const works = [...extra, ...C.works];
  const visible = works.filter((w) => {
    const a = C.artistById[w.artistId];
    const hay = (w.title + " " + (w.artistName || (a && a.name) || "") + " " + w.medium).toLowerCase();
    return (cat === "all" || w.cat === cat) && (!q || hay.includes(q.toLowerCase()));
  });

  const like = (id) => { const n = S.toggleLike(id); showToast(n ? "Added to your likes" : "Removed from likes"); };

  const generateSeal = () => setCert({ algo: "ECDSA P-256 · SHA-256", hash: rndHex(64), sig: rndHex(96), signer: "sa:key:" + rndHex(12), ts: new Date().toISOString() });
  const publish = async () => {
    const id = "u_" + Date.now();
    const cat = "illustration";
    const title = vTitle.trim() || "Untitled";
    const artist = vArtist.trim() || "You";
    try {
      // Server re-hashes the bytes and signs with the SecurityArts key — the
      // authoritative seal. (The client-side cert above is a preview.)
      if (window.SA_API) await window.SA_API.publishWork({ title, artist, cat, image: SAGenArt.dataUri(SAGenArt.hashStr(id), { cat }) });
    } catch (_) { /* backend unreachable — the local pin below still stands */ }
    setExtra([{ id, seed: SAGenArt.hashStr(id), cat, title, artistName: artist, medium: "Your work", own: true }, ...extra]);
    setModal(false); setCert(null); setVTitle(""); setVArtist("");
    showToast("Published — your work is on the wall");
  };

  const likedWorks = S.likes().map((id) => C.workById[id]).filter(Boolean);

  return (
    <React.Fragment>
      <AppBar q={q} setQ={setQ} onLikes={() => setLikesOpen(true)} onVerify={() => setModal(true)} />

      <main>
        <section className="intro">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--brass)" }}>Discover — verified human work</p>
          <h1>A wall of work<br />no machine <em>made.</em></h1>
          <p>Every piece here carries a SecurityArts seal — proof a <strong>human</strong> made it. Like what moves you to shape your <strong>For You</strong> feed, open an artist to follow or message them, and <strong>get your own work verified</strong> in seconds.</p>
        </section>

        <div className="filterbar">
          <div className="chips">{CATS.map(([k, label]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{label}</Chip>)}</div>
          <span className="count">{visible.length} sealed works</span>
        </div>

        {visible.length ? (
          <section className="board">
            {visible.map((w) => {
              const a = C.artistById[w.artistId];
              const artistName = w.artistName || (a && a.name) || "Unknown";
              const pin = (
                <Pin art={<img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title + " by " + artistName} />}
                  title={w.title} artist={artistName} own={w.own}
                  saved={S.isLiked(w.id)} onSave={() => like(w.id)} />
              );
              return a
                ? <a key={w.id} className="pinlink" href={`profile.html?artist=${a.id}`}>{pin}</a>
                : <div key={w.id} className="pinlink">{pin}</div>;
            })}
          </section>
        ) : (
          <div className="empty"><h2>Nothing here — yet.</h2><p>Try a different medium, clear your search, or get a new piece verified.</p></div>
        )}
      </main>

      <footer className="foot">
        <a href="../studio/index.html">← Back to SecurityArts</a>
        <span className="m">Every work sealed · Authentic · Verified · Human</span>
      </footer>

      <Drawer open={likesOpen} onClose={() => setLikesOpen(false)} title="Your likes"
        footer={likedWorks.length ? <a href="foryou.html"><Button variant="solid" style={{ width: "100%" }} arrow>See your For You feed</Button></a> : null}>
        {likedWorks.length ? likedWorks.map((w) => {
          const a = C.artistById[w.artistId];
          return (
            <div className="like-row" key={w.id}>
              <a className="like-row__thumb" href={a ? `profile.html?artist=${a.id}` : "#"}><img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt="" /></a>
              <div className="like-row__main">
                <div className="like-row__title">{w.title}</div>
                <div className="like-row__artist">{a ? a.name : "You"} · {w.medium}</div>
              </div>
              <IconButton icon="heart" active label="Unlike" onClick={() => S.toggleLike(w.id)} />
            </div>
          );
        }) : <p className="likes-empty">No likes yet.<br />Tap the heart on any work — your For You feed is built from these.</p>}
      </Drawer>

      <Modal open={modal} onClose={() => { setModal(false); setCert(null); }} width="min(640px, 94vw)" label="Get your work verified">
        <div className="mhead"><p className="meyebrow">Human authentication</p><h2 className="mtitle">Get your work verified.</h2></div>
        <div className="mbody">
          <p className="msub">Drop in a piece you made by hand. We compute a cryptographic seal in-browser, then you can publish it to the wall.</p>
          <div className="dropzone" onClick={generateSeal}>
            <Seal size={44} style={{ margin: "0 auto", color: "var(--bone-faint)" }} />
            <p><b>Click to seal a sample piece</b> or drop an image</p>
            <small>PNG · JPG · WEBP — hashed locally, never uploaded</small>
          </div>
          <div className="fields">
            <Field label="Title" htmlFor="vt"><Input id="vt" value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="Untitled" /></Field>
            <Field label="Artist" htmlFor="va"><Input id="va" value={vArtist} onChange={(e) => setVArtist(e.target.value)} placeholder="Your name" /></Field>
          </div>
          {cert ? (
            <div style={{ marginTop: "1.4rem" }}>
              <Certificate rows={[
                { k: "Algorithm", v: cert.algo, brass: true },
                { k: "Hash", v: cert.hash },
                { k: "Signature", v: cert.sig.slice(0, 48) + "…" + cert.sig.slice(-16) },
                { k: "Signer", v: cert.signer },
                { k: "Sealed", v: cert.ts },
              ]}>
                <Button variant="brass" size="sm" arrow onClick={publish}>Publish to the wall</Button>
              </Certificate>
            </div>
          ) : (
            <div className="mactions"><Button variant="solid" size="sm" arrow onClick={generateSeal}>Generate seal &amp; verify</Button></div>
          )}
          <p className="mnote">Demo — the seal is computed from a sample. In production the SecurityArts key signs server-side and the hash is added to a public registry anyone can check.</p>
        </div>
      </Modal>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
