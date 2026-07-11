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

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

const COPY = {
  signin: { eyebrow: "Welcome back", title: <>Sign <em>in.</em></>, sub: "Sign in to reach your account, your artists, and your sealed collection." },
  signup: { eyebrow: "Join SecurityArts", title: <>Prove it's <em>you.</em></>, sub: "Create an account to collect sealed art, follow artists, and seal your own work." },
  forgot: { eyebrow: "Reset access", title: <>Forgot <em>it?</em></>, sub: "Enter your email and we'll send a link to set a new password." },
  reset: { eyebrow: "New password", title: <>Set a <em>new one.</em></>, sub: "Choose a new password for your account, then you're back in." },
};

function App() {
  const resetToken = new URLSearchParams(location.search).get("token");
  const [user, setUser] = React.useState(() => Session.current());
  const [mode, setMode] = React.useState(resetToken ? "reset" : "signin"); // signin | signup | forgot | reset
  const [googleOn, setGoogleOn] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState({ t: "", kind: "" });

  React.useEffect(() => {
    if (!resetToken) Session.sync().then((u) => { if (u) setUser(u); }).catch(() => {});
    if (window.SA_API) window.SA_API.auth.config().then((c) => setGoogleOn(!!(c && c.google))).catch(() => {});
  }, []);

  const go = (m) => { setMode(m); setNote({ t: "", kind: "" }); };
  const emailValid = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();

    if (mode === "forgot") {
      if (!emailValid(em)) { setNote({ t: "Enter a valid email address.", kind: "err" }); return; }
      setBusy(true); setNote({ t: "Sending…", kind: "" });
      try { await window.SA_API.auth.forgot(em); setNote({ t: "If that email is registered, a reset link is on its way.", kind: "ok" }); }
      catch (err) { setNote({ t: "Couldn't reach the server — try again.", kind: "err" }); }
      setBusy(false); return;
    }
    if (mode === "reset") {
      if (password.length < 8) { setNote({ t: "Password must be at least 8 characters.", kind: "err" }); return; }
      setBusy(true); setNote({ t: "Updating your password…", kind: "" });
      try { await window.SA_API.auth.reset(resetToken, password); setNote({ t: "Password updated — signing you in…", kind: "ok" }); location.href = "me.html"; }
      catch (err) { setNote({ t: (err && err.message) || "This reset link is invalid or has expired.", kind: "err" }); setBusy(false); }
      return;
    }
    // signin / signup
    if (!emailValid(em)) { setNote({ t: "Enter a valid email address.", kind: "err" }); return; }
    if (password.length < 8) { setNote({ t: "Password must be at least 8 characters.", kind: "err" }); return; }
    setBusy(true); setNote({ t: mode === "signup" ? "Creating your account…" : "Signing you in…", kind: "" });
    try {
      if (mode === "signup") { await Session.register(em, password, name.trim()); setNote({ t: "Sealed — let's set you up…", kind: "ok" }); location.href = "onboarding.html"; }
      else { await Session.login(em, password); setNote({ t: "Sealed — taking you in…", kind: "ok" }); location.href = nextUrl(); }
    } catch (err) { setNote({ t: (err && err.message) || "Couldn't sign you in. Try again.", kind: "err" }); setBusy(false); }
  };

  const signOut = async () => { await Session.logout(); setUser(null); setNote({ t: "", kind: "" }); };

  const showSignedIn = user && mode === "signin";
  const c = COPY[mode];
  const submitLabel = busy
    ? ({ signin: "Signing in…", signup: "Creating…", forgot: "Sending…", reset: "Updating…" })[mode]
    : ({ signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Set new password" })[mode];
  const showOAuth = googleOn && (mode === "signin" || mode === "signup");

  return (
    <React.Fragment>
      <Header />
      <main>
        <div className="auth">
          <div className="auth__bleed" aria-hidden="true"><Seal size={352} className="spin" /></div>
          <div className="auth__in">
            {showSignedIn ? (
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
                <span className="auth__eyebrow"><span className="dot" /> {c.eyebrow}</span>
                <h1 className="auth__title">{c.title}</h1>
                <p className="auth__sub">{c.sub}</p>
                <form className="card" onSubmit={submit} noValidate>
                  {showOAuth ? (
                    <React.Fragment>
                      <a className="oauth" href="/api/auth/google">{GOOGLE_G}<span>Continue with Google</span></a>
                      <div className="or"><span>or</span></div>
                    </React.Fragment>
                  ) : null}
                  {mode === "signup" ? (
                    <div className="field"><Field label="Name" htmlFor="au-name" full>
                      <Input id="au-name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                    </Field></div>
                  ) : null}
                  {mode !== "reset" ? (
                    <div className="field"><Field label="Email" htmlFor="au-email" full>
                      <Input id="au-email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field></div>
                  ) : null}
                  {mode !== "forgot" ? (
                    <div className="field"><Field label={mode === "reset" ? "New password" : "Password"} htmlFor="au-pass" full>
                      <Input id="au-pass" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </Field></div>
                  ) : null}
                  <div className={`authnote ${note.kind}`} aria-live="polite">{note.t}</div>
                  <div className="submit">
                    <Button variant="solid" type="submit" arrow disabled={busy} style={{ width: "100%" }}>{submitLabel}</Button>
                  </div>
                  <div className="switch">
                    {mode === "signin" ? <><button type="button" onClick={() => go("forgot")}>Forgot your password?</button><br /><span style={{ opacity: 0.85 }}>New here? </span><button type="button" onClick={() => go("signup")}>Create an account</button></> : null}
                    {mode === "signup" ? <>Already have an account? <button type="button" onClick={() => go("signin")}>Sign in</button></> : null}
                    {mode === "forgot" ? <button type="button" onClick={() => go("signin")}>← Back to sign in</button> : null}
                    {mode === "reset" ? <button type="button" onClick={() => { go("signin"); history.replaceState(null, "", location.pathname); }}>← Back to sign in</button> : null}
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
