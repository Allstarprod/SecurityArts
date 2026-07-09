const { Seal, Icon, Button, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;

const PLANS = [
  {
    name: "Free", price: { mo: 0, yr: 0 }, who: "Browse, verify, and buy sealed originals. No subscription required to collect.",
    cta: "Start free", variant: "ghost", href: "onboarding.html",
    feats: ["Unlimited browsing & search", "One-click seal verification", "Buy & license any work", "Save likes and boards"],
  },
  {
    name: "Collector+", price: { mo: 5, yr: 50 }, who: "For serious collectors — early access to drops and a sharper, deeper feed.",
    cta: "Go Collector+", variant: "solid", href: "onboarding.html", feat: true, tag: "Most popular",
    feats: ["Everything in Free", "24h early access to new drops", "Advanced For You & saved searches", "Collection provenance export", "Priority message requests"],
  },
  {
    name: "Artist Studio", price: { mo: 15, yr: 150 }, who: "For artists selling their work — unlimited sealing, analytics, and payouts.",
    cta: "Open your studio", variant: "brass", href: "dashboard.html",
    feats: ["Unlimited seals & listings", "Sales & audience analytics", "Custom license tiers", "Direct commissions & DMs", "Fast payouts to your account"],
  },
];

const FEES = [
  { n: "$5–15", per: "/mo", t: "Subscription", b: "Collector+ is $5/mo; Artist Studio is $15/mo. Collecting on the Free plan is always $0." },
  { n: <><em>8%</em></>, t: "Per commission", b: "When a collector commissions an artist directly, SecurityArts takes 8%. The artist keeps 92%." },
  { n: <><em>10%</em></>, t: "On purchases", b: "A flat 10% marketplace fee on every sale — no listing fees, no surprises. The artist keeps 90%." },
];

const FAQ = [
  { q: "Do I need to pay to buy art?", a: "No. Collecting is free — you only ever pay the price of the work. The 10% marketplace fee is on the sale, handled at checkout." },
  { q: "What does the artist actually keep?", a: "90% of a marketplace sale and 92% of a direct commission. Payments settle to your linked account within two business days." },
  { q: "Is verification extra?", a: "No. Every seal and every public verification is free, on every plan — that's the whole point of SecurityArts." },
  { q: "Can I cancel anytime?", a: "Yes. Plans are month-to-month (or annual for two months free). Cancel whenever; your sealed works stay verified forever." },
];

function App() {
  const [yr, setYr] = React.useState(false);
  const money = (n) => n === 0 ? "$0" : "$" + n;

  return (
    <React.Fragment>
      <header className="appbar">
        <a className="brand" href="welcome.html" aria-label="SecurityArts"><Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Pricing</span></a>
        <nav className="nav">
          <a href="welcome.html" className="optional">Home</a>
          <a href="index.html" className="optional">Discover</a>
          <a href="dashboard.html" className="optional">For artists</a>
          <a href="verify.html" className="optional">Verify</a>
          <ThemeToggle size={38} />
        </nav>
      </header>

      <div className="wrap">
        <section className="hero">
          <span className="hero__eyebrow"><Icon name="shieldCheck" size={14} /> Pricing, in plain sight</span>
          <h1>Honest pricing,<br />like <em>everything else.</em></h1>
          <p>Collecting is free. Artists keep the vast majority of every sale. No listing fees, no verification fees, no fine print.</p>
          <div className="billing">
            <button className={!yr ? "on" : ""} onClick={() => setYr(false)}>Monthly</button>
            <button className={yr ? "on" : ""} onClick={() => setYr(true)}>Annual <span className="save">· 2 months free</span></button>
          </div>
        </section>

        <section className="plans">
          {PLANS.map((p) => (
            <div className={`plan ${p.feat ? "feat" : ""}`} key={p.name}>
              {p.tag ? <span className="plan__tag">{p.tag}</span> : null}
              <span className="plan__name">{p.name}</span>
              <div className="plan__price">
                {money(yr ? p.price.yr : p.price.mo)}
                <span className="plan__per">{p.price.mo === 0 ? "forever" : yr ? "/year" : "/month"}</span>
              </div>
              <p className="plan__who">{p.who}</p>
              <ul className="plan__list">
                {p.feats.map((f, i) => <li key={i}><Icon name="check" size={16} /> {f}</li>)}
              </ul>
              <div className="plan__cta"><Button variant={p.variant} href={p.href} arrow style={{ width: "100%" }}>{p.cta}</Button></div>
            </div>
          ))}
        </section>

        <section className="fees">
          <p className="fees__label"><span>01</span> The fees</p>
          <h2 className="fees__h">Three numbers. That's the whole model.</h2>
          <div className="fees__grid">
            {FEES.map((f, i) => (
              <div className="fee" key={i}>
                <Seal size={28} className="fee__seal" />
                <div className="fee__n">{f.n}{f.per ? <span className="plan__per" style={{ fontSize: "0.8rem" }}>{f.per}</span> : null}</div>
                <div className="fee__t">{f.t}</div>
                <p className="fee__b">{f.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="split">
          <div>
            <h2>Where every dollar <em>goes.</em></h2>
            <p>We only make money when artists do. A flat 10% on marketplace sales and 8% on direct commissions keeps the lights on and the registry public — the rest is theirs.</p>
          </div>
          <div className="bars">
            <div className="barrow">
              <div className="barrow__top"><span className="barrow__k">Marketplace sale</span><span className="barrow__v">Artist keeps 90%</span></div>
              <div className="bar"><i style={{ width: "90%" }} /></div>
            </div>
            <div className="barrow">
              <div className="barrow__top"><span className="barrow__k">Direct commission</span><span className="barrow__v">Artist keeps 92%</span></div>
              <div className="bar"><i style={{ width: "92%" }} /></div>
            </div>
            <div className="barrow">
              <div className="barrow__top"><span className="barrow__k">Verification</span><span className="barrow__v">Always free</span></div>
              <div className="bar"><i style={{ width: "100%" }} /></div>
            </div>
          </div>
        </section>

        <section className="faq">
          <p className="fees__label"><span>02</span> Questions</p>
          <h2 className="fees__h">The fine print, unfined.</h2>
          <div className="faq__grid">
            {FAQ.map((f, i) => <div className="qa" key={i}><h3>{f.q}</h3><p>{f.a}</p></div>)}
          </div>
        </section>

        <section className="close">
          <Seal size={60} className="close__seal" spin spinDuration="100s" />
          <h2>Start free. Sell <em>sealed.</em></h2>
          <p>Collect for nothing, or open a studio for $15/mo and keep 90% of everything you sell.</p>
          <div className="close__cta">
            <Button variant="solid" href="onboarding.html" arrow>Get started</Button>
            <Button variant="ghost" href="dashboard.html">Open a studio</Button>
          </div>
        </section>
      </div>

      <footer className="foot">
        <a className="brand" href="welcome.html"><Seal size={30} /><span className="brand__word" style={{ fontSize: "1.2rem" }}>SecurityArts</span></a>
        <nav className="foot__nav">
          <a href="welcome.html">Home</a><a href="index.html">Discover</a><a href="../market/index.html">Market</a>
          <a href="verify.html">Verify</a><a href="dashboard.html">For artists</a><a href="pricing.html">Pricing</a>
        </nav>
        <span className="m">Free to collect · Artists keep 90%</span>
      </footer>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
