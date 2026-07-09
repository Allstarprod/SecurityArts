/* SecurityArts — Studio (marketing home) UI kit.
   A faithful recreation of the studio homepage, composed from the design-system
   components. Interactive: sticky header state + working mobile menu + newsletter. */
const { Seal, Marquee, Button, Eyebrow, SectionLabel, PracticeCard, Input, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;

const NAV = [
  ["01", "Practice", "#practice"], ["02", "The Seal", "#seal"],
  ["03", "Identity", "#identity"], ["04", "Standards", "#standards"], ["05", "Discover", "../discover/index.html"],
];

const PRACTICE = [
  { i: "01", t: "Offensive Security", wide: true, body: "We attack the way real adversaries do — not a checklist sweep. Goal-oriented red teaming, full-scope penetration testing, and adversary simulation that ends at the crown jewels, with the path written down.", tags: ["Red teaming", "Penetration testing", "Adversary simulation", "Social engineering"] },
  { i: "02", t: "Application Security", body: "Threat modeling, deep code review, and a secure SDLC your engineers will actually keep using after we leave.", tags: ["Code review", "Threat modeling", "Secure SDLC"] },
  { i: "03", t: "Cloud & Infrastructure", body: "AWS, GCP and Azure hardened against real attack paths. Identity, network, and infrastructure-as-code reviewed line by line.", tags: ["IAM & identity", "IaC review", "Segmentation"] },
  { i: "04", t: "Detection & Response", body: "Detection engineering and threat hunting that close the gap between breach and alert — plus the runbooks for the night it matters.", tags: ["Detection engineering", "Threat hunting", "IR readiness"] },
  { i: "05", t: "Security Architecture", body: "Design review before the build, not after the incident. Zero-trust, segmentation, and defensible boundaries drawn deliberately.", tags: ["Design review", "Zero-trust", "Boundary design"] },
  { i: "06", t: "Advisory & Training", brass: true, body: "Fractional CISO guidance and secure-by-design coaching that raises the floor for your whole team — so the next thing you build starts already sealed.", tags: ["vCISO", "Workshops", "Secure-by-design"] },
];

const SURFACES = [
  ["var(--sw-green)", "var(--bone)"], ["var(--sw-red)", "var(--bone)"], ["var(--sw-blue)", "var(--bone)"], ["var(--sw-gold)", "var(--jet)"],
  ["#f3efe6", "var(--jet)"], ["var(--sw-taupe)", "var(--bone)"], ["var(--ink)", "var(--bone)"], ["var(--bone)", "var(--jet)"],
];

const STANDARDS = ["OWASP", "MITRE ATT&CK", "NIST CSF", "ISO 27001", "SOC 2", "CIS Benchmarks"];

function Header({ onMenu, menuOpen, stuck }) {
  return (
    <header className={`head ${stuck ? "stuck" : ""}`}>
      <a className="brand" href="#top"><Seal size={30} /><span className="brand__word">SecurityArts</span></a>
      <nav className="nav">
        {NAV.map(([n, label, href]) => <a key={label} href={href}><i>{n}</i> {label}</a>)}
      </nav>
      <div style={{ marginLeft: "auto" }} className="head-cta-wrap">
        <Button size="sm" href="#contact" arrow>Request engagement</Button>
      </div>
      <ThemeToggle size={38} className="theme-btn" />
      <button className={`menu-btn ${menuOpen ? "open" : ""}`} onClick={onMenu} aria-label="Menu"><span></span><span></span></button>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__bleed"><Seal size="100%" spin spinDuration="90s" /></div>
      <div className="hero__inner">
        <div className="eyebrow-wrap"><Eyebrow>Security studio — offensive &amp; defensive</Eyebrow></div>
        <h1 className="hero__title"><span>Security is</span><span>a craft. We</span><span>sign <em>our work.</em></span></h1>
        <div className="hero__aside">
          <p className="hero__lede">SecurityArts is a security studio. We break what you've built before an adversary does, harden what actually matters, and leave behind a mark you can verify — not a PDF you file away and forget.</p>
          <div className="hero__actions">
            <Button variant="solid" href="#contact">Request an engagement</Button>
            <Button variant="ghost" href="#practice">See the practice</Button>
          </div>
        </div>
      </div>
      <div className="hero__foot">
        <div className="meta"><span className="meta-k">Based</span><span className="meta-v">Remote-first · Worldwide</span></div>
        <div className="meta"><span className="meta-k">Engagements</span><span className="meta-v">Q3 2026 — limited</span></div>
        <div className="meta meta--end"><span className="meta-k">Est.</span><span className="meta-v">MMXXVI</span></div>
      </div>
    </section>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [stuck, setStuck] = React.useState(false);
  const [news, setNews] = React.useState("");
  const [newsMsg, setNewsMsg] = React.useState("");

  React.useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submitNews = async (e) => {
    e.preventDefault();
    const email = news.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setNewsMsg("Enter a valid email address."); return; }
    try {
      if (window.SA_API) await window.SA_API.subscribe(email); // real backend capture
      else throw new Error("offline");
    } catch (_) {
      // Backend unreachable (opened statically) — keep it locally so nothing is lost.
      try {
        const list = JSON.parse(localStorage.getItem("sa_news") || "[]");
        if (list.indexOf(email) === -1) list.push(email);
        localStorage.setItem("sa_news", JSON.stringify(list));
      } catch (__) {}
    }
    setNewsMsg("You're on the list — watch your inbox for the seal."); setNews("");
  };

  return (
    <React.Fragment>
      <Header onMenu={() => setMenuOpen(!menuOpen)} menuOpen={menuOpen} stuck={stuck} />
      <div className={`mmenu ${menuOpen ? "open" : ""}`}>
        <nav>{NAV.map(([n, label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)}><i>{n}</i> {label}</a>)}</nav>
        <a href="#contact" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "0.85rem", color: "var(--brass)", border: 0 }}>Request an engagement →</a>
      </div>

      <main>
        <div className="wrap"><Hero /></div>
        <Marquee items={["Offensive Security", "Application Security", "Cloud & Infrastructure", "Detection & Response", "Security Architecture", "Advisory & Training"]} />

        <section className="wrap band manifesto">
          <SectionLabel index="00" className="lbl">Position</SectionLabel>
          <h2 className="manifesto__text">Most security work disappears into a report nobody reads twice. Ours ends in a <span className="ul">seal</span> — a verifiable record of what we tested, what we fixed, and what still needs your attention.</h2>
        </section>

        <section className="wrap band--sm pad" id="practice">
          <div className="phead">
            <SectionLabel index="01" className="lbl">Practice</SectionLabel>
            <h2 className="h-section">Six disciplines,<br />one standard of proof.</h2>
            <p className="pintro">We work across the full surface — the systems you ship, the cloud they run on, and the team that defends them. Each engagement is scoped to a named outcome, not a fixed bundle of hours.</p>
          </div>
          <div className="grid">
            {PRACTICE.map((p) => (
              <PracticeCard key={p.i} className={p.wide ? "wide" : ""} seamless index={p.i} title={p.t} variant={p.brass ? "brass" : "default"} tags={p.tags}>{p.body}</PracticeCard>
            ))}
          </div>
        </section>

        <section className="wrap band pad sealsec" id="seal">
          <div className="sealsec__art"><Seal size="clamp(15rem, 34vw, 26rem)" spin spinDuration="120s" /></div>
          <div>
            <SectionLabel index="02" className="lbl">The Seal</SectionLabel>
            <h2 className="h-section">Every engagement<br />ends in a mark.</h2>
            <p className="sealsec__lede">The seal is the whole idea. A notary's stamp says <em>a person stood here and verified this.</em> Ours says the same about your systems. When we close an engagement, you don't get a wall of findings — you get a record of exactly what was tested, what was proven safe, and what is still open, signed and dated.</p>
            <ul className="points">
              <li><span className="points__k">Verifiable</span><span className="points__v">Every claim traces to a test you can re-run.</span></li>
              <li><span className="points__k">Honest</span><span className="points__v">We mark what's still open as plainly as what's fixed.</span></li>
              <li><span className="points__k">Durable</span><span className="points__v">A retest re-issues the seal — it isn't a one-day snapshot.</span></li>
            </ul>
          </div>
        </section>

        <section className="identity" id="identity">
          <SectionLabel index="03" className="lbl">Identity</SectionLabel>
          <h2 className="identity__title">One logo. Any surface.</h2>
          <p className="identity__intro">The mark is contrast-aware. A single-ink master drops onto anything — from a billboard to a 16-pixel favicon — and takes black or white depending on what the surface needs.</p>
          <div className="surfaces">
            {SURFACES.map(([bg, fg], i) => <div key={i} className="surface" style={{ background: bg, color: fg }}><Seal size="46%" /></div>)}
          </div>
          <div className="pair">
            <figure className="lockup lockup--light"><div className="lockup__mark"><Seal size={42} /><span className="lockup__word">SecurityArts</span></div><figcaption><span className="a">Jet Black</span><span className="b">#0C0C0B · LIGHT BG</span></figcaption></figure>
            <figure className="lockup lockup--dark"><div className="lockup__mark"><Seal size={42} /><span className="lockup__word">SecurityArts</span></div><figcaption><span className="a">Pale White</span><span className="b">#F4F1E9 · DARK BG</span></figcaption></figure>
          </div>
        </section>

        <section className="wrap band pad" id="standards">
          <SectionLabel index="04" className="lbl">Standards</SectionLabel>
          <h2 className="h-section" style={{ marginBottom: "clamp(2.5rem,5vw,3.5rem)" }}>We work to the frameworks<br />your auditors already trust.</h2>
          <ul className="std">{STANDARDS.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>

        <section className="wrap band pad contact" id="contact">
          <SectionLabel index="05" className="lbl">Contact</SectionLabel>
          <h2 className="contact__title">Let's put a mark<br />on it.</h2>
          <div className="contact__row">
            <a className="mail" href="mailto:hello@securityarts.studio">hello@securityarts.studio</a>
            <p className="contact__note">Tell us what you're protecting and what keeps you up at night. We reply to every serious enquiry within two business days.</p>
          </div>
        </section>

        <section className="wrap band--sm pad news">
          <div className="news__inner">
            <Eyebrow tone="brass" dot={false}>Newsletter</Eyebrow>
            <h2 className="news__title">Dispatches from the<br />authenticity economy.</h2>
            <p className="news__lede">Once a month: newly verified artists, how provenance is reshaping who gets paid for original work, and the tools we ship. No noise, no filler.</p>
            <form className="news__form" onSubmit={submitNews}>
              <Input shape="pill" type="email" placeholder="you@studio.com" value={news} onChange={(e) => setNews(e.target.value)} aria-label="Email address" />
              <Button variant="solid" type="submit" arrow>Subscribe</Button>
            </form>
            {newsMsg ? <p className="news__note">{newsMsg}</p> : null}
          </div>
        </section>
      </main>

      <footer className="wrap foot">
        <div className="foot__top">
          <a className="brand" href="#top"><Seal size={34} /><span className="brand__word" style={{ fontSize: "1.5rem" }}>SecurityArts</span></a>
          <nav className="foot__nav">
            <a href="#practice">Practice</a><a href="#seal">The Seal</a><a href="#identity">Identity</a>
            <a href="../discover/index.html">Discover</a><a href="../discover/welcome.html">Art platform</a><a href="../market/index.html">Market</a><a href="../discover/verify.html">Verify</a><a href="../discover/pricing.html">Pricing</a>
          </nav>
        </div>
        <div className="foot__base"><span>© MMXXVI SecurityArts</span><span>A security studio that signs its work</span></div>
      </footer>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

