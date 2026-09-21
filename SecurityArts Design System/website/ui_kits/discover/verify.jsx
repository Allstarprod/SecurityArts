const { Seal, Icon, Input, Button, Certificate, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;

/* /verify — public registry check. Nothing here is simulated: the only source of
   truth is GET /api/verify/:hash (js/api.js → SA_API.verify), which answers
   { verified, signer, sealedAt, work: { id, title, artist, medium } } or 404. */

const HASH_RE = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 64 * 1024 * 1024; // hashing happens in-browser; keep it sane

/* Trim, lowercase, and drop an optional "sha256:" prefix so a copy-pasted
   `shasum` / `sha256sum` line verifies without cleanup. */
function normalizeHash(raw) {
  return String(raw || "").trim().toLowerCase().replace(/^sha-?256:\s*/, "").split(/\s+/)[0] || "";
}

/* SHA-256 of a File in the browser — the same bytes the server hashed at seal time. */
async function hashFile(file) {
  if (!(window.crypto && window.crypto.subtle)) throw new Error("This browser can't hash files here — it needs a secure (https) page.");
  if (file.size > MAX_FILE_BYTES) throw new Error("That file is over 64 MB — hash it locally with `shasum -a 256` and paste the result.");
  const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtDate(iso) {
  const d = new Date(iso);
  // (dateStyle/timeStyle can't be combined with timeZoneName — Intl throws.)
  return isNaN(d) ? String(iso) : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
function fmtBytes(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB"; }

/* Clean route on the deployed site (/seal/:id via vercel.json); the sibling file
   when this page is opened by its .html path (local dev / plain static host). */
function sealHref(id) {
  return /\.html$/i.test(location.pathname) ? "seal.html?work=" + encodeURIComponent(id) : "/seal/" + encodeURIComponent(id);
}

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

/* Drop zone + file picker. Hashing is local; only the 64-char digest leaves the browser. */
function FileDrop({ onFile, busy, file }) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef();
  const pick = (list) => { const f = list && list[0]; if (f) onFile(f); };
  return (
    <div
      className={`drop ${over ? "over" : ""} ${busy ? "busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" className="drop__input" id="verify-file" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} disabled={busy} />
      <label htmlFor="verify-file" className="drop__label">
        <Icon name="plus" size={16} />
        <span className="drop__t">{busy ? "Hashing…" : "Drop the original file here"}</span>
        <span className="drop__b">{file ? file.name + " · " + fmtBytes(file.size) : "or click to choose one — hashed in your browser, never uploaded"}</span>
      </label>
    </div>
  );
}

function App() {
  const [q, setQ] = React.useState(() => normalizeHash(new URLSearchParams(location.search).get("hash")));
  // idle | hashing | checking | verified | invalid | notfound | badinput | error
  const [phase, setPhase] = React.useState("idle");
  const [hash, setHash] = React.useState("");      // the digest that was checked
  const [result, setResult] = React.useState(null); // raw API answer, rendered verbatim
  const [file, setFile] = React.useState(null);
  const [errMsg, setErrMsg] = React.useState("");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const reqRef = React.useRef(0); // ignore answers from superseded requests
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  const run = async (raw) => {
    const h = normalizeHash(raw != null ? raw : q);
    if (!h) return;
    setHash(h); setResult(null); setErrMsg("");
    if (!HASH_RE.test(h)) { setPhase("badinput"); return; }
    if (!window.SA_API) { setPhase("error"); setErrMsg("The registry API isn't reachable from this page."); return; }
    const id = ++reqRef.current;
    setPhase("checking");
    try { history.replaceState(null, "", "?hash=" + encodeURIComponent(h)); } catch (e) {}
    try {
      const r = await window.SA_API.verify(h);
      if (id !== reqRef.current) return;
      setResult(r || null);
      const good = !!(r && r.verified);
      setPhase(good ? "verified" : "invalid");
      show(good ? "Seal verified — registry match" : "Record found, signature did not verify");
    } catch (e) {
      if (id !== reqRef.current) return;
      const m = (e && e.message) || "";
      if (/no sealed work|HTTP 404/i.test(m)) { setPhase("notfound"); show("No seal matched this hash"); }
      else { setPhase("error"); setErrMsg(m || "Couldn't reach the registry."); }
    }
  };

  const onFile = async (f) => {
    setFile({ name: f.name, size: f.size });
    setPhase("hashing"); setResult(null); setErrMsg("");
    try { const h = await hashFile(f); setQ(h); await run(h); }
    catch (e) { setPhase("error"); setErrMsg((e && e.message) || "Couldn't hash that file."); }
  };

  const reset = () => {
    reqRef.current++;
    setQ(""); setHash(""); setResult(null); setFile(null); setErrMsg(""); setPhase("idle");
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  };

  // Deep link: /verify?hash=<sha256> (also what the no-JS form in verify.html submits).
  React.useEffect(() => { if (q) run(q); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = phase === "hashing" || phase === "checking";
  const work = (result && result.work) || null;

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <section className="hero">
          <span className="hero__eyebrow"><Icon name="shieldCheck" size={14} /> Public registry check</span>
          <h1>Verify a <em>seal.</em></h1>
          <p>A SecurityArts seal is a signature over one exact file's SHA-256. Paste that hash, or drop the original file and we'll compute it here — then the registry answers whether it was sealed, by which key, and when.</p>

          <div className="checker">
            <form className="checkform" onSubmit={(e) => { e.preventDefault(); run(); }}>
              <Input shape="pill" icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SHA-256 hash — 64 hex characters" aria-label="SHA-256 hash of the original file" autoComplete="off" spellCheck={false} disabled={busy} />
              <Button variant="solid" type="submit" arrow disabled={busy || !q.trim()}>{phase === "checking" ? "Checking…" : "Verify"}</Button>
            </form>
            <FileDrop onFile={onFile} busy={busy} file={file} />
          </div>
        </section>

        {phase === "idle" || phase === "hashing" || phase === "checking" ? (
          <section className="steps" aria-busy={busy}>
            <div className="step"><span className="step__n">01</span><span className="step__t">A file is sealed</span><span className="step__b">An artist uploads the original. The server hashes the exact bytes with SHA-256 and signs that hash with the SecurityArts key.</span></div>
            <div className="step"><span className="step__n">02</span><span className="step__t">The record is public</span><span className="step__b">Hash, signature, signer key, and timestamp are stored in the registry and shown on the work's seal page.</span></div>
            <div className="step"><span className="step__n">03</span><span className="step__t">Anyone checks it</span><span className="step__b">Re-hash the file you were given. If the registry has that hash and the signature verifies, the bytes are the ones that were sealed.</span></div>
          </section>
        ) : phase === "badinput" ? (
          <div className="notfound" role="alert">
            <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
            <h2>That isn't a SHA-256 hash.</h2>
            <p>A SHA-256 digest is exactly 64 hexadecimal characters (0–9, a–f). You entered {hash.length} character{hash.length === 1 ? "" : "s"}. Paste the full hash, or drop the original file above and we'll compute it.</p>
          </div>
        ) : phase === "notfound" ? (
          <div className="notfound" role="status">
            <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
            <h2>No seal matched this hash.</h2>
            <p>The registry has no record for <code className="hashcode">{hash}</code>.</p>
            <p>Seals are bound to the exact original bytes. A re-saved, resized, screenshotted, or re-exported copy hashes differently and will not match — compute the SHA-256 of the file as it was uploaded (<code>shasum -a 256 file.png</code> on macOS/Linux, <code>certutil -hashfile file.png SHA256</code> on Windows), or drop that original file above.</p>
            <div className="verdict__actions" style={{ justifyContent: "center", marginTop: "1.2rem" }}>
              <Button variant="ghost" size="sm" onClick={reset}>Try another</Button>
            </div>
          </div>
        ) : phase === "error" ? (
          <div className="notfound" role="alert">
            <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
            <h2>Couldn't complete the check.</h2>
            <p>{errMsg || "The registry didn't answer. Try again in a moment."}</p>
            <div className="verdict__actions" style={{ justifyContent: "center", marginTop: "1.2rem" }}>
              <Button variant="ghost" size="sm" onClick={reset}>Start over</Button>
            </div>
          </div>
        ) : (
          <section className="result">
            <div className="verdict">
              <div className="verdict__stamp">
                <Seal size={62} className={`verdict__seal ${phase === "invalid" ? "bad" : ""}`} />
                <div>
                  {phase === "verified"
                    ? <div className="verdict__title">Seal <em style={{ fontStyle: "italic", color: "var(--brass)" }}>verified.</em></div>
                    : <div className="verdict__title">Record found — signature <em style={{ fontStyle: "italic", color: "var(--error)" }}>did not verify.</em></div>}
                  <div className="verdict__sub">{phase === "verified" ? "Registry match · signature valid" : "Registry match · signature did not verify against the key on record"}</div>
                </div>
              </div>
              <Certificate
                title={phase === "verified" ? "Seal verified" : "Signature check failed"}
                eyebrow="SecurityArts registry · ECDSA P-256 over SHA-256"
                rows={[
                  work ? { k: "Work", v: [work.title, work.artist].filter(Boolean).join(" · ") } : null,
                  work && work.medium ? { k: "Medium", v: work.medium } : null,
                  { k: "SHA-256", v: hash, brass: true },
                  { k: "Signer", v: result.signer || "—" },
                  { k: "Sealed at", v: result.sealedAt || "—" },
                ].filter(Boolean)}
              >
                <div className="verdict__actions">
                  {work && work.id ? <a href={sealHref(work.id)}><Button variant="brass" size="sm" arrow>View seal record</Button></a> : null}
                  <Button variant="ghost" size="sm" onClick={reset}>Verify another</Button>
                </div>
              </Certificate>
              <p className="fine">
                {phase === "verified"
                  ? <React.Fragment>What this proves: the SecurityArts key signed this exact file's SHA-256 on {fmtDate(result.sealedAt)}. It says who sealed which bytes and when — it makes no claim about how the work was made.</React.Fragment>
                  : <React.Fragment>The registry holds a record for this hash, but its signature doesn't verify against the current SecurityArts public key. Treat the seal as unconfirmed and contact SecurityArts with this hash.</React.Fragment>}
              </p>
            </div>
          </section>
        )}
      </div>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">One file · One hash · One signature · Publicly checkable</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
