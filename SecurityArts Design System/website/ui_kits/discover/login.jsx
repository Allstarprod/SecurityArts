const { Seal, Icon, Input, Field, Button, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const Session = window.SASession;

// Where to go after auth. Only same-folder *.html targets (no open-redirect).
function nextUrl() {
  const n = new URLSearchParams(location.search).get("next");
  return n && /^[a-z0-9_.-]+\.html([?#][^\s]*)?$/i.test(n) ? n : "me.html";
}

function Header() {
  return (
    <div className="top">
      <a className="brand" href="welcome.html" aria-label="SecurityArts"><Seal size={30} /><span className="brand__word">SecurityArts</span></a>
      <span className="top__spacer" />
      <ThemeToggle size={38} />
    </div>
  );
}

function App() {
  const [user, setUser] = React.useState(() => Session.current());
  const [mode, setMode] = React.useState("signin"); // "signin" | "signup"
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState({ t: "", kind: "" });

  // Reconcile with the server session in the background.
  React.useEffect(() => { Session.sync().then((u) => { if (u) setUser(u); }).catch(() => {}); }, []);

  const isSignup = mode === "signup";

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setNote({ t: "Enter a valid email address.", kind: "err" }); return; }
    if (password.length < 8) { setNote({ t: "Password must be at least 8 characters.", kind: "err" }); return; }
    setBusy(true);
    setNote({ t: isSignup ? "Creating your account…" : "Signing you in…", kind: "" });
    try {
      if (isSignup) await Session.register(em, password, name.trim());
      else await Session.login(em, password);
      setNote({ t: "Sealed — taking you in…", kind: "ok" });
      location.href = nextUrl();
    } catch (err) {
      setNote({ t: (err && err.message) || "Couldn't sign you in. Try again.", kind: "err" });
      setBusy(false);
    }
  };

  const signOut = async () => { await Session.logout(); setUser(null); setNote({ t: "", kind: "" }); };

  return (
    <React.Fragment>
      <Header />
      <main>
        <div className="auth">
          <div className="auth__bleed" aria-hidden="true"><Seal size={352} className="spin" /></div>
          <div className="auth__in">
            {user ? (
              <React.Fragment>
                <span className="auth__eyebrow"><span className="dot" /> Welcome back</span>
                <h1 className="auth__title">You're <em>in.</em></h1>
                <p className="auth__sub">Signed in as <b style={{ color: "var(--bone)" }}>{user.name}</b> · {user.email}</p>
                <div className="card">
                  <a href="me.html"><Button variant="solid" arrow style={{ width: "100%" }}>Continue to your account</Button></a>
                  <div className="switch"><button type="button" onClick={signOut}>Not you? Sign in as someone else</button></div>
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <span className="auth__eyebrow"><span className="dot" /> {isSignup ? "Join SecurityArts" : "Welcome back"}</span>
                <h1 className="auth__title">{isSignup ? <>Prove it's <em>you.</em></> : <>Sign <em>in.</em></>}</h1>
                <p className="auth__sub">{isSignup ? "Create an account to collect sealed art, follow artists, and seal your own work." : "Sign in to reach your account, your artists, and your sealed collection."}</p>
                <form className="card" onSubmit={submit} noValidate>
                  {isSignup ? (
                    <div className="field">
                      <Field label="Name" htmlFor="au-name" full>
                        <Input id="au-name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                      </Field>
                    </div>
                  ) : null}
                  <div className="field">
                    <Field label="Email" htmlFor="au-email" full>
                      <Input id="au-email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                  </div>
                  <div className="field">
                    <Field label="Password" htmlFor="au-pass" full>
                      <Input id="au-pass" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </Field>
                  </div>
                  <div className={`authnote ${note.kind}`} aria-live="polite">{note.t}</div>
                  <div className="submit">
                    <Button variant="solid" type="submit" arrow disabled={busy} style={{ width: "100%" }}>
                      {busy ? (isSignup ? "Creating…" : "Signing in…") : (isSignup ? "Create account" : "Sign in")}
                    </Button>
                  </div>
                  <div className="switch">
                    {isSignup ? <>Already have an account? <button type="button" onClick={() => { setMode("signin"); setNote({ t: "", kind: "" }); }}>Sign in</button></>
                              : <>New here? <button type="button" onClick={() => { setMode("signup"); setNote({ t: "", kind: "" }); }}>Create an account</button></>}
                  </div>
                </form>
                <p className="fineprint">
                  By continuing you agree to the <a href="../../../../terms.html">Terms</a> &amp; <a href="../../../../privacy.html">Privacy</a>.<br />
                  We sign our work — and protect yours.
                </p>
              </React.Fragment>
            )}
          </div>
        </div>
      </main>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
