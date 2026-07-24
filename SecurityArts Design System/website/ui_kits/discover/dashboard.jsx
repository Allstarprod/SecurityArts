const { Seal, Icon, IconButton, Button, Avatar, VerifiedBadge, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore;

function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }
function money(n) { return "$" + n.toLocaleString("en-US"); }
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const BUYERS = ["Aria Fenn", "Marcus Lowe", "Studio Kite", "Devon Park", "Lena Cho", "Atlas & Co.", "Nadia Rios", "Owen Frost", "Juno Ba", "Halcyon Gallery"];
const TIERS = ["Personal", "Commercial", "Exclusive"];
const TIER_MULT = { Personal: 1, Commercial: 3, Exclusive: 9 };

function qsArtist() {
  const id = new URLSearchParams(location.search).get("artist");
  return C.artistById[id] ? id : C.artists[0].id;
}

/* deterministic sales for an artist, derived from their works */
function salesFor(artistId) {
  const works = C.worksByArtist[artistId] || [];
  const rand = mulberry(Math.abs(strhash("sales" + artistId)) + 1);
  const out = [];
  works.forEach((w, wi) => {
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const tier = TIERS[Math.floor(rand() * TIERS.length)];
      const amt = w.price * TIER_MULT[tier];
      const daysAgo = 2 + Math.floor(rand() * 120);
      out.push({ id: w.id + "-" + i, work: w, buyer: BUYERS[Math.floor(rand() * BUYERS.length)], tier, amt, daysAgo });
    }
  });
  return out.sort((a, b) => a.daysAgo - b.daysAgo);
}
function dateAgo(days) { const d = new Date(Date.now() - days * 864e5); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

function AppBar() {
  const pending = S.counts().pending;
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Studio</span>
      </a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="foryou.html" className="optional">For You</a>
        <a href="me.html" className="optional">You</a>
        <a href="dms.html">DMs{pending ? <span className="dot" /> : null}</a>
        <a href="verify.html" className="optional">Verify</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function App() {
  useStoreTick();
  const [artistId] = React.useState(qsArtist);
  const artist = C.artistById[artistId];
  const works = C.worksByArtist[artistId] || [];
  const sales = React.useMemo(() => salesFor(artistId), [artistId]);
  const [tab, setTab] = React.useState("works");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  const totalSales = sales.reduce((s, x) => s + x.amt, 0);
  const requests = S.threadList().filter((t) => t.status === "incoming");
  const pending = requests.length;

  // payouts: 90% of sales to artist (10% marketplace fee), split into a few deterministic payout rows
  const earned = Math.round(totalSales * 0.9);
  const balance = Math.round(earned * 0.18);
  const payouts = React.useMemo(() => {
    const rand = mulberry(Math.abs(strhash("pay" + artistId)) + 5);
    const rows = []; let remaining = earned - balance;
    for (let i = 0; i < 4 && remaining > 0; i++) {
      const amt = i === 3 ? remaining : Math.round(remaining * (0.28 + rand() * 0.22));
      remaining -= amt;
      rows.push({ id: "po" + i, amt, daysAgo: 12 + i * 30 + Math.floor(rand() * 8), method: rand() > 0.5 ? "Bank ••4471" : "PayPal" });
    }
    return rows;
  }, [artistId, earned, balance]);

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="dhead">
          <Avatar name={artist.name} size={92} verified />
          <div className="dhead__id">
            <p className="dhead__eyebrow">Artist studio</p>
            <h1 className="dhead__name">{artist.name}<Seal size={20} className="seal" title="Verified artist" /></h1>
            <div className="dhead__meta">
              <span className="m"><Icon name="mapPin" size={13} /> {artist.city}</span>
              <span className="m"><Icon name="shieldCheck" size={13} /> Verified · @{artist.handle}</span>
            </div>
          </div>
          <div className="dhead__actions">
            <a href="profile.html?me=1"><Button variant="ghost" size="sm">View public profile</Button></a>
            <Button variant="solid" size="sm" arrow onClick={() => show("Verify flow — seal a new work")}>New work</Button>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi"><b>{works.length}</b><span>Sealed works</span></div>
          <div className="kpi accent"><b>{money(totalSales)}</b><span>Gross sales</span></div>
          <div className="kpi"><b>{artist.followers.toLocaleString()}</b><span>Followers</span></div>
          <div className="kpi"><b>{pending}</b><span>Requests</span></div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "works" ? "active" : ""}`} onClick={() => setTab("works")}>Works</button>
          <button className={`tab ${tab === "sales" ? "active" : ""}`} onClick={() => setTab("sales")}>Sales · {sales.length}</button>
          <button className={`tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>Requests {pending ? <span className="pill">{pending}</span> : null}</button>
          <button className={`tab ${tab === "payouts" ? "active" : ""}`} onClick={() => setTab("payouts")}>Payouts</button>
        </div>

        {tab === "works" ? (
          <div className="works">
            {works.map((w) => (
              <div className="wcard" key={w.id}>
                <div className="wcard__art">
                  <img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title} />
                  <VerifiedBadge className="wcard__badge">Sealed</VerifiedBadge>
                </div>
                <div className="wcard__info">
                  <div className="wcard__title">{w.title}</div>
                  <div className="wcard__row"><span className="wcard__price">{money(w.price)}</span><span className="wcard__stat">{sales.filter((s) => s.work.id === w.id).length} sold</span></div>
                </div>
              </div>
            ))}
            <div className="newwork" onClick={() => show("Verify flow — seal a new work")}>
              <Seal size={40} /><span>+ Seal a new work</span>
            </div>
          </div>
        ) : null}

        {tab === "sales" ? (
          <div className="rows">
            {sales.map((s) => (
              <div className="row" key={s.id}>
                <div className="row__thumb"><img src={SAGenArt.dataUri(s.work.seed, { cat: s.work.cat })} alt="" /></div>
                <div className="row__main">
                  <div className="row__title">{s.work.title}</div>
                  <div className="row__sub">{s.tier} license</div>
                </div>
                <div className="row__buyer"><Avatar name={s.buyer} size={28} /><span>{s.buyer}</span></div>
                <div className="row__amt">{money(s.amt)}</div>
                <div className="row__date">{dateAgo(s.daysAgo)}</div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "requests" ? (
          requests.length ? (
            <div className="rows">
              {requests.map((t) => {
                const a = C.artistById[t.artistId] || { name: "A collector", city: "" };
                return (
                  <div className="row" key={t.artistId}>
                    <Avatar name={a.name} size={40} />
                    <div className="row__main">
                      <div className="row__title">{a.name}</div>
                      <div className="row__sub" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-sans)", fontSize: "0.84rem", color: "var(--bone-dim)" }}>{t.last ? t.last.text : "Wants to connect"}</div>
                    </div>
                    <div className="req__actions">
                      <Button variant="solid" size="sm" onClick={() => { S.accept(t.artistId); show("Request accepted"); }}>Accept</Button>
                      <Button variant="ghost" size="sm" onClick={() => { S.decline(t.artistId); show("Request declined"); }}>Decline</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty"><Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} /><h2>No pending requests.</h2><p>New message requests from collectors land here.</p></div>
          )
        ) : null}

        {tab === "payouts" ? (
          <div className="paywrap">
            <div className="balance">
              <p className="balance__k">Available balance</p>
              <p className="balance__v">{money(balance)}</p>
              <p className="balance__note">90% of every sale is yours — a flat 10% marketplace fee, nothing else. Payouts settle to your linked account within 2 business days.</p>
              <Button variant="brass" size="sm" arrow onClick={() => show("Payout requested — settling to Bank ••4471")}>Withdraw</Button>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--bone-faint)", marginBottom: "0.7rem" }}>Recent payouts · lifetime earned {money(earned)}</p>
              <div className="rows">
                {payouts.map((p) => (
                  <div className="row" key={p.id}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ink-3)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="check" size={16} /></div>
                    <div className="row__main">
                      <div className="row__title" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", letterSpacing: "0.04em" }}>{money(p.amt)}</div>
                      <div className="row__sub">Paid · {p.method}</div>
                    </div>
                    <div className="row__date">{dateAgo(p.daysAgo)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <a href="pricing.html" style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--bone-dim)" }}>Pricing &amp; fees →</a>
        <span className="m">Your studio · 90% to the artist · Every work sealed</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
