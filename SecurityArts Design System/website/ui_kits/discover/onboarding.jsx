const { Seal, Icon, Button, Avatar, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore, Session = window.SASession;

const MEDIUMS = [
  ["painting", "Painting"], ["illustration", "Illustration"], ["3d", "3D & CGI"], ["photography", "Photography"],
  ["lettering", "Lettering"], ["concept", "Concept art"], ["mixed", "Mixed media"],
];
const CAT_LABEL = Object.fromEntries(MEDIUMS);

function App() {
  // Prefill from an existing profile so a returning user sees their prior answers.
  const existingProfile = ((Session && Session.current && Session.current()) || {}).profile || {};
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(existingProfile.role || null);
  const [cats, setCats] = React.useState(() => new Set(existingProfile.interests || []));
  const [saving, setSaving] = React.useState(false);
  const [, tick] = React.useState(0);

  const toggleCat = (k) => setCats((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // suggested artists filtered by chosen mediums (fallback: all)
  const suggested = React.useMemo(() => {
    const list = cats.size ? C.artists.filter((a) => cats.has(a.cat)) : C.artists;
    return (list.length ? list : C.artists).slice(0, 8);
  }, [step]);

  const followCount = S.follows().length;
  const steps = ["Role", "Taste", "Artists", "Done"];

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = step === 0 ? !!role : step === 1 ? cats.size > 0 : true;
  const finishHref = role === "artist" ? "dashboard.html" : "foryou.html";

  // Persist the quiz answers to the signed-in user's profile, then enter the app.
  // Saving is best-effort — a backend hiccup should never trap someone in onboarding.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (Session && Session.updateProfile) {
        await Session.updateProfile({ role: role || "collector", interests: Array.from(cats), onboarded: true });
      }
    } catch (e) { /* non-blocking */ }
    location.href = finishHref;
  };

  return (
    <div className="shell">
      <div className="bar">
        <a className="brand" href="welcome.html" aria-label="SecurityArts"><Seal size={30} /><span className="brand__word">SecurityArts</span></a>
        <div className="bar__right">
          <a className="skip" href="index.html">Skip for now</a>
          <ThemeToggle size={36} />
        </div>
      </div>

      <div className="rail">
        {steps.map((_, i) => <div key={i} className={`rail__seg ${i < step ? "done" : i === step ? "active" : ""}`}><i /></div>)}
      </div>

      <div className="stage">
        <div className="card">
          {step === 0 ? (
            <React.Fragment>
              <p className="step-eyebrow"><Icon name="sparkle" size={14} /> Step 1 of 4</p>
              <h1 className="step-title">Welcome. What brings<br />you <em>here?</em></h1>
              <p className="step-sub">We'll tune SecurityArts around you. You can always do both later.</p>
              <div className="step-body roles">
                <button className={`role ${role === "collector" ? "sel" : ""}`} onClick={() => setRole("collector")}>
                  <Seal size={34} className="role__seal" />
                  <span className="role__t">I collect</span>
                  <span className="role__b">Discover and buy verified human art, follow artists, and build a collection with provenance built in.</span>
                </button>
                <button className={`role ${role === "artist" ? "sel" : ""}`} onClick={() => setRole("artist")}>
                  <Seal size={34} className="role__seal" />
                  <span className="role__t">I make</span>
                  <span className="role__b">Seal your work to prove it's yours, set your own licenses, and keep 80% of every sale.</span>
                </button>
              </div>
            </React.Fragment>
          ) : null}

          {step === 1 ? (
            <React.Fragment>
              <p className="step-eyebrow"><Icon name="sparkle" size={14} /> Step 2 of 4</p>
              <h1 className="step-title">What do you<br />love to <em>look at?</em></h1>
              <p className="step-sub">Pick a few mediums. We'll seed your feed and suggest artists working in them.</p>
              <div className="step-body chips">
                {MEDIUMS.map(([k, label]) => (
                  <button key={k} className={`mchip ${cats.has(k) ? "sel" : ""}`} onClick={() => toggleCat(k)}>
                    {cats.has(k) ? <span className="tick"><Icon name="check" size={13} /></span> : null}{label}
                  </button>
                ))}
              </div>
            </React.Fragment>
          ) : null}

          {step === 2 ? (
            <React.Fragment>
              <p className="step-eyebrow"><Icon name="sparkle" size={14} /> Step 3 of 4</p>
              <h1 className="step-title">Follow a few<br /><em>artists.</em></h1>
              <p className="step-sub">{cats.size ? "Based on what you picked — " + Array.from(cats).map((c) => (CAT_LABEL[c] || c).toLowerCase()).join(", ") + "." : "A few verified artists to start."} Follow anyone that speaks to you.</p>
              <div className="step-body sugg">
                {suggested.map((a) => {
                  const on = S.isFollowing(a.id);
                  return (
                    <div className={`scard ${on ? "sel" : ""}`} key={a.id}>
                      <Avatar name={a.name} size={44} verified />
                      <div className="scard__main">
                        <div className="scard__name">{a.name}</div>
                        <div className="scard__meta">{CAT_LABEL[a.cat] || a.cat} · {a.city.split(",")[0]}</div>
                      </div>
                      <button className={`follow-btn ${on ? "on" : ""}`} onClick={() => { S.toggleFollow(a.id); tick((n) => n + 1); }}>{on ? "Following" : "Follow"}</button>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ) : null}

          {step === 3 ? (
            <div className="done">
              <Seal size={64} className="done__seal" spin spinDuration="80s" />
              <h1 className="step-title">You're all set.</h1>
              <p className="step-sub" style={{ marginInline: "auto" }}>Your feed is sealed and ready. Everything you like and follow from here keeps it sharp.</p>
              <div className="done__summary">
                <div className="ds"><b>{role === "artist" ? "Artist" : "Collector"}</b><span>Your role</span></div>
                <div className="ds"><b>{cats.size}</b><span>Mediums</span></div>
                <div className="ds"><b>{followCount}</b><span>Following</span></div>
              </div>
              <Button variant="solid" arrow disabled={saving} onClick={finish}>{saving ? "Saving…" : (role === "artist" ? "Open your studio" : "Enter your feed")}</Button>
            </div>
          ) : null}
        </div>
      </div>

      {step < 3 ? (
        <div className="foot">
          {step > 0 ? <Button variant="ghost" size="sm" onClick={back}>Back</Button> : <span className="count">Verified human art</span>}
          <span className="count">{step === 2 ? followCount + " following" : steps[step]}</span>
          <Button variant="solid" size="sm" arrow onClick={next} disabled={!canNext}>Continue</Button>
        </div>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
