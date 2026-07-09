const { Seal, Icon, Button, Avatar, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog;

const FEATURED = ["ines-vela", "kofi-mensah", "theo-brandt", "yuki-sato", "lena-lindqvist", "amara-adeyemi"]
  .map((id) => C.artistById[id]).filter(Boolean);
const CAT_LABEL = { illustration: "Illustration", painting: "Painting", "3d": "3D & CGI", photography: "Photography", lettering: "Lettering", concept: "Concept art", mixed: "Mixed media" };

function AppBar() {
  const [stuck, setStuck] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`appbar ${stuck ? "stuck" : ""}`}>
      <a className="brand" href="welcome.html" aria-label="SecurityArts"><Seal size={30} /><span className="brand__word">SecurityArts</span></a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="../market/index.html" className="optional">Market</a>
        <a href="verify.html" className="optional">Verify</a>
        <a href="dashboard.html" className="optional">For artists</a>
        <a href="pricing.html" className="optional">Pricing</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function App() {
  return (
    <React.Fragment>
      <AppBar />
      <main>
        <section className="hero wrap">
          <div className="hero__bleed"><Seal size="100%" spin spinDuration="110s" /></div>
          <div className="hero__in">
            <span className="hero__eyebrow"><Icon name="shieldCheck" size={14} /> The home of verified human art</span>
            <h1>Real art, <em>proven.</em></h1>
            <p className="hero__lede">SecurityArts is where artists <strong>seal</strong> their work — a cryptographic signature that proves a human made it — and where collectors buy, license, and follow the people behind it. <strong>No generated fakes. No guesswork.</strong> Just provenance you can check.</p>
            <div className="hero__cta">
              <Button variant="solid" href="index.html" arrow>Explore the wall</Button>
              <Button variant="ghost" href="dashboard.html">Sell your work</Button>
            </div>
            <div className="hero__stats">
              <div className="hstat"><b>{C.works.length * 128}+</b><span>Works sealed</span></div>
              <div className="hstat"><b>{C.artists.length * 9}</b><span>Verified artists</span></div>
              <div className="hstat"><b>100%</b><span>Human-made</span></div>
              <div className="hstat"><b>90%</b><span>Goes to the artist</span></div>
            </div>
          </div>
        </section>

        <section className="split">
          <div className="aud aud--collector">
            <span className="aud__k">For collectors</span>
            <h2 className="aud__h">Buy art a human<br />actually made.</h2>
            <p className="aud__b">Every piece carries a seal you can verify in one click. Follow the artists you love, save what moves you, and build a collection with provenance built in.</p>
            <ul className="aud__list">
              <li><Icon name="check" size={17} /> One-click authenticity on every work</li>
              <li><Icon name="check" size={17} /> A For You feed tuned to your taste</li>
              <li><Icon name="check" size={17} /> License personal, commercial, or exclusive</li>
            </ul>
            <div className="aud__cta">
              <Button variant="solid" href="onboarding.html" arrow>Start collecting</Button>
              <Button variant="ghost" href="me.html">Your account</Button>
            </div>
          </div>
          <div className="aud aud--artist">
            <span className="aud__k">For artists</span>
            <h2 className="aud__h">Get the credit —<br />and the sale.</h2>
            <p className="aud__b">Seal your work in seconds and prove it's yours, forever. Set your own licenses, keep 90% of every sale, and talk to collectors directly through message requests.</p>
            <ul className="aud__list">
              <li><Icon name="check" size={17} /> Cryptographic proof of authorship</li>
              <li><Icon name="check" size={17} /> Keep 90% — transparent payouts</li>
              <li><Icon name="check" size={17} /> Direct message requests from buyers</li>
            </ul>
            <div className="aud__cta">
              <Button variant="brass" href="dashboard.html" arrow>Open your studio</Button>
              <Button variant="ghost" href="verify.html">See a seal</Button>
            </div>
          </div>
        </section>

        <section className="band wrap">
          <p className="band__label"><span>01</span> How the seal works</p>
          <h2 className="band__h">Three steps from studio to collector.</h2>
          <div className="steps">
            <div className="step"><Seal size={30} className="step__seal" /><span className="step__n">01 — Create</span><h3 className="step__t">A human makes it</h3><p className="step__b">An artist creates an original — by hand, in-camera, or in 3D. No prompts, no generators.</p></div>
            <div className="step"><Seal size={30} className="step__seal" /><span className="step__n">02 — Seal</span><h3 className="step__t">We sign it</h3><p className="step__b">SecurityArts signs the work's fingerprint with its private key and posts the hash to a public registry.</p></div>
            <div className="step"><Seal size={30} className="step__seal" /><span className="step__n">03 — Verify</span><h3 className="step__t">Anyone can check</h3><p className="step__b">Buyers, galleries, and platforms confirm provenance in one click — trust without a middleman.</p></div>
          </div>
        </section>

        <section className="band wrap" style={{ paddingTop: 0 }}>
          <p className="band__label"><span>02</span> Featured artists</p>
          <h2 className="band__h">The people behind the work.</h2>
          <div className="artists">
            {FEATURED.map((a) => {
              const w = (C.worksByArtist[a.id] || [])[0];
              return (
                <a className="acard" key={a.id} href={`profile.html?artist=${a.id}`}>
                  <div className="acard__art"><img src={SAGenArt.dataUri(w ? w.seed : a.id, { cat: a.cat })} alt="" /></div>
                  <div className="acard__row">
                    <Avatar name={a.name} size={38} verified />
                    <div className="acard__main">
                      <div className="acard__name">{a.name}</div>
                      <div className="acard__meta">{CAT_LABEL[a.cat]} · {a.city.split(",")[0]}</div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section className="close wrap">
          <Seal size={64} className="close__seal" spin spinDuration="100s" />
          <h2>Own something <em>real.</em></h2>
          <p>Join the collectors and artists building an economy where being human is the whole point.</p>
          <div className="close__cta">
            <Button variant="solid" href="onboarding.html" arrow>Get started</Button>
            <Button variant="ghost" href="dashboard.html">Sell your work</Button>
          </div>
        </section>
      </main>

      <footer className="foot">
        <a className="brand" href="welcome.html"><Seal size={30} /><span className="brand__word" style={{ fontSize: "1.2rem" }}>SecurityArts</span></a>
        <nav className="foot__nav">
          <a href="index.html">Discover</a><a href="../market/index.html">Market</a><a href="verify.html">Verify</a>
          <a href="dashboard.html">For artists</a><a href="pricing.html">Pricing</a><a href="me.html">Account</a><a href="../studio/index.html">Security studio</a>
        </nav>
        <span className="m">Verified human · Sealed provenance</span>
      </footer>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
