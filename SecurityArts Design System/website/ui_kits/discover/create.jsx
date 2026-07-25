const { Seal, Icon, Button, Field, Input, ThemeToggle, Toast } = window.SecurityArtsDesignSystem_f7e889;
const Session = window.SASession;

const CATS = ["illustration", "painting", "3d", "photography", "lettering", "concept", "mixed"];
const CAT_LABEL = { illustration: "Illustration", painting: "Painting", "3d": "3D & CGI", photography: "Photography", lettering: "Lettering", concept: "Concept art", mixed: "Mixed media" };
const MAX_BYTES = 5_500_000; // dataURI stays under the server's 8MB cap

function TopBar() {
  return (
    <header className="top">
      <a className="brand" href="welcome.html" aria-label="SecurityArts"><Seal size={30} /><span className="brand__word">SecurityArts</span></a>
      <span className="top__spacer" />
      <ThemeToggle size={38} />
    </header>
  );
}

function SignedOut() {
  return (
    <React.Fragment>
      <TopBar />
      <main>
        <div className="auth">
          <p className="eyebrow"><span className="dot" /> Seal a work</p>
          <h1 className="h1">Sign in to <em>seal.</em></h1>
          <p className="sub">Sealing stamps your work with a signed certificate tied to your account — so sign in first.</p>
          <a href="login.html?next=create.html"><Button variant="solid" arrow style={{ marginTop: "0.4rem" }}>Sign in</Button></a>
        </div>
      </main>
    </React.Fragment>
  );
}

function Sealed({ work }) {
  const hash = (work.cert && work.cert.hash) || "";
  const short = hash ? hash.slice(0, 10) + "…" + hash.slice(-6) : "sealed";
  return (
    <React.Fragment>
      <TopBar />
      <main>
        <div className="done">
          <div className="done__art"><img src={work.img} alt={work.title} /><span className="done__badge"><Seal size={16} /> Sealed</span></div>
          <p className="eyebrow"><span className="dot" /> Certificate issued</p>
          <h1 className="h1">“{work.title}” is <em>sealed.</em></h1>
          <p className="sub">Signed by SecurityArts and tied to your account. This certificate is permanent and publicly verifiable.</p>
          <div className="cert">
            <div className="cert__row"><span className="cert__k">Work ID</span><span className="cert__v">{work.id}</span></div>
            <div className="cert__row"><span className="cert__k">Seal hash</span><span className="cert__v mono">{short}</span></div>
            <div className="cert__row"><span className="cert__k">Medium</span><span className="cert__v">{work.medium || CAT_LABEL[work.cat]}</span></div>
          </div>
          <div className="done__cta">
            <a href="dashboard.html"><Button variant="solid" arrow>View in your studio</Button></a>
            <a href="create.html"><Button variant="ghost">Seal another</Button></a>
          </div>
        </div>
      </main>
    </React.Fragment>
  );
}

function App() {
  const [user] = React.useState(() => Session && Session.current());
  const [img, setImg] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [cat, setCat] = React.useState("illustration");
  const [artist, setArtist] = React.useState(() => (Session && Session.current() && Session.current().name) || "");
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [sealed, setSealed] = React.useState(null);
  const [note, setNote] = React.useState({ t: "", kind: "" });
  const fileRef = React.useRef();

  if (!user) return <SignedOut />;
  if (sealed) return <Sealed work={sealed} />;

  const readFile = (f) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) { setNote({ t: "Pick an image file (JPG or PNG).", kind: "err" }); return; }
    if (f.size > MAX_BYTES) { setNote({ t: "Image must be under ~5MB.", kind: "err" }); return; }
    const r = new FileReader();
    r.onload = () => { setImg(String(r.result)); setFileName(f.name); setNote({ t: "", kind: "" }); };
    r.readAsDataURL(f);
  };
  const onPick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; readFile(f); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files && e.dataTransfer.files[0]); };

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    const t = title.trim(), a = artist.trim();
    if (!img) { setNote({ t: "Add an image to seal.", kind: "err" }); return; }
    if (!t) { setNote({ t: "Give your work a title.", kind: "err" }); return; }
    if (!a) { setNote({ t: "Add the artist name.", kind: "err" }); return; }
    setBusy(true); setNote({ t: "Sealing your work…", kind: "" });
    try {
      const w = await window.SA_API.publishWork({ title: t, artist: a, cat: cat, image: img });
      setSealed(w);
    } catch (err) {
      setBusy(false);
      setNote({ t: (err && err.message) || "Couldn't seal — try again.", kind: "err" });
    }
  };

  return (
    <React.Fragment>
      <TopBar />
      <main>
        <form className="auth" onSubmit={submit}>
          <p className="eyebrow"><span className="dot" /> Seal a work</p>
          <h1 className="h1">Prove it's <em>yours.</em></h1>
          <p className="sub">Upload your piece — SecurityArts hashes and signs it into a permanent, verifiable certificate. You keep 90% of every sale.</p>

          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
          {img ? (
            <div className="drop drop--has" onClick={() => fileRef.current && fileRef.current.click()}>
              <img className="drop__preview" src={img} alt="Selected artwork preview" />
              <div className="drop__swap">{fileName || "Change image"}</div>
            </div>
          ) : (
            <div className={`drop ${drag ? "drop--over" : ""}`} role="button" tabIndex={0}
              onClick={() => fileRef.current && fileRef.current.click()}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fileRef.current && fileRef.current.click(); } }}
              onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <Seal size={34} />
              <div className="drop__t">Drop your artwork here, or <span className="drop__browse">browse</span></div>
              <div className="drop__hint">JPG or PNG · up to ~5MB</div>
            </div>
          )}

          <div className="card">
            <div className="field"><Field label="Title" htmlFor="cr-title" full>
              <Input id="cr-title" required placeholder="Untitled" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            </Field></div>
            <div className="field"><Field label="Medium" htmlFor="cr-cat" full>
              <select id="cr-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </Field></div>
            <div className="field"><Field label="Artist" htmlFor="cr-artist" full>
              <Input id="cr-artist" required placeholder="Your name" value={artist} maxLength={60} onChange={(e) => setArtist(e.target.value)} />
            </Field></div>

            <div className="submit"><Button type="submit" variant="brass" arrow disabled={busy} style={{ width: "100%" }}>{busy ? "Sealing…" : "Seal this work"}</Button></div>
            <p className={`authnote ${note.kind}`}>{note.t}</p>
          </div>

          <p className="fineprint">Only upload work you made or have the rights to. Every seal is signed by SecurityArts and tied to your account. <a href="pricing.html">Pricing &amp; fees →</a></p>
        </form>
      </main>
      <Toast show={busy}>Sealing…</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
