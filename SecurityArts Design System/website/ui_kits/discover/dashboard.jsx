const { Seal, Icon, IconButton, Button, Avatar, VerifiedBadge, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore, Session = window.SASession;

function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
function num(n){ return (n || 0) >= 1000 ? ((n||0)/1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n || 0); }
function money(n){ return "$" + (n || 0).toLocaleString("en-US"); }
function shortDate(iso){ try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch (e) { return ""; } }

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
        <a href="../market/index.html" className="optional">Market</a>
        <a href="verify.html" className="optional">Verify</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function SignedOut() {
  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="empty" style={{ padding: "4rem 0", textAlign: "center" }}>
          <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
          <h2>Sign in to open your studio.</h2>
          <p>Your sealed works, views, likes, and earnings live here.</p>
          <div style={{ marginTop: "1.4rem" }}>
            <a href="login.html?next=dashboard.html"><Button variant="solid" size="sm" arrow>Sign in</Button></a>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

function App() {
  useStoreTick();
  const [user] = React.useState(() => Session && Session.current());
  const [stats, setStats] = React.useState(null);   // { totals, top } from /api/me/stats
  const [sales, setSales] = React.useState(null);   // { sales, totals } from /api/me/sales
  const [ownWorks, setOwnWorks] = React.useState([]);
  const [tab, setTab] = React.useState("works");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 2200); };

  React.useEffect(() => {
    if (!user || !window.SA_API) return;
    let alive = true;
    window.SA_API.myStats().then((d) => { if (alive && d) setStats(d); }).catch(() => {});
    window.SA_API.mySales().then((d) => { if (alive && d) setSales(d); }).catch(() => {});
    window.SA_API.listWorks().then((list) => { if (alive) setOwnWorks((list || []).filter((w) => w.ownerId === user.id)); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  if (!user) return <SignedOut />;

  const t = (stats && stats.totals) || { works: ownWorks.length, views: 0, comments: 0, likes: 0 };
  const top = (stats && stats.top) || [];
  const statOf = (id) => top.find((x) => x.id === id) || { views: 0, likes: 0, comments: 0 };
  const handle = user.handle || (Session && Session.handleFromEmail(user.email)) || "you";
  const worksCount = t.works || ownWorks.length;

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="dhead">
          <Avatar name={user.name} size={92} verified />
          <div className="dhead__id">
            <p className="dhead__eyebrow">Artist studio</p>
            <h1 className="dhead__name">{user.name}<Seal size={20} className="seal" title="Verified" /></h1>
            <div className="dhead__meta">
              <span className="m"><Icon name="shieldCheck" size={13} /> @{handle}</span>
            </div>
          </div>
          <div className="dhead__actions">
            <a href="profile.html?me=1"><Button variant="ghost" size="sm">View public profile</Button></a>
            <a href="create.html"><Button variant="solid" size="sm" arrow>Seal a work</Button></a>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi"><b>{num(worksCount)}</b><span>Sealed works</span></div>
          <div className="kpi accent"><b>{num(t.views)}</b><span>Total views</span></div>
          <div className="kpi"><b>{num(t.likes)}</b><span>Likes</span></div>
          <div className="kpi"><b>{num(t.comments)}</b><span>Comments</span></div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "works" ? "active" : ""}`} onClick={() => setTab("works")}>Works</button>
          <button className={`tab ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>Analytics</button>
          <button className={`tab ${tab === "sales" ? "active" : ""}`} onClick={() => setTab("sales")}>Sales</button>
          <button className={`tab ${tab === "payouts" ? "active" : ""}`} onClick={() => setTab("payouts")}>Payouts</button>
        </div>

        {tab === "works" ? (
          ownWorks.length ? (
            <div className="works">
              {ownWorks.map((w) => {
                const st = statOf(w.id);
                return (
                  <a className="wcard" key={w.id} href={`seal.html?work=${w.id}`}>
                    <div className="wcard__art">
                      <img src={w.img || SAGenArt.dataUri(strhash(w.id), { cat: w.cat })} alt={w.title} />
                      <VerifiedBadge className="wcard__badge">Sealed</VerifiedBadge>
                    </div>
                    <div className="wcard__info">
                      <div className="wcard__title">{w.title}</div>
                      <div className="wcard__row"><span className="wcard__stat">{num(st.views)} views</span><span className="wcard__stat">{num(st.likes)} likes</span></div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="empty" style={{ textAlign: "center" }}>
              <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <h2>No sealed works yet.</h2>
              <p>Seal your first piece — it lands here with its certificate and starts collecting views.</p>
              <div style={{ marginTop: "1.2rem" }}><a href="create.html"><Button variant="solid" size="sm" arrow>Seal a work</Button></a></div>
            </div>
          )
        ) : null}

        {tab === "analytics" ? (
          top.length ? (
            <div className="hubtable">
              <div className="hubrow hubrow--head"><span>Top posts</span><span>Views</span><span>Likes</span><span>Comments</span></div>
              {top.map((w) => (
                <div className="hubrow" key={w.id}>
                  <span className="hubwork"><img src={SAGenArt.dataUri(strhash(w.id), { cat: w.cat })} alt="" /><span className="hubwork__t">{w.title}</span></span>
                  <span className="hubnum">{num(w.views)}</span>
                  <span className="hubnum">{num(w.likes)}</span>
                  <span className="hubnum">{num(w.comments)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ textAlign: "center", padding: "2rem 0" }}>
              <Seal size={40} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <p>No analytics yet. Seal a work — views, likes, and comments land here as people discover it.</p>
            </div>
          )
        ) : null}

        {tab === "sales" ? (
          sales && sales.sales.length ? (
            <div className="rows">
              {sales.sales.map((s, i) => (
                <div className="row" key={s.orderId + "-" + i}>
                  <div className="row__main">
                    <div className="row__title">{s.title}</div>
                    <div className="row__sub">{s.license} license</div>
                  </div>
                  <div className="row__buyer"><Avatar name={s.buyer} size={28} /><span>{s.buyer}</span></div>
                  <div className="row__amt">{money(s.amt)}</div>
                  <div className="row__date">{shortDate(s.date)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ textAlign: "center", padding: "2rem 0" }}>
              <Seal size={40} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <h2>No sales yet.</h2>
              <p>When a collector licenses one of your sealed works, it appears here — you keep 90% of every sale.</p>
            </div>
          )
        ) : null}

        {tab === "payouts" ? (
          (() => {
            const earned = sales ? sales.totals.earned : 0;
            const gross = sales ? sales.totals.gross : 0;
            const count = sales ? sales.totals.count : 0;
            return (
              <div className="paywrap">
                <div className="balance">
                  <p className="balance__k">Available balance</p>
                  <p className="balance__v">{money(earned)}</p>
                  <p className="balance__note">90% of every sale is yours — a flat 10% marketplace fee, nothing else. Payouts settle to your linked account within 2 business days{count ? "" : " once you make your first sale"}.</p>
                  <Button variant="brass" size="sm" arrow onClick={() => show(earned ? "Payout requested — settling to your linked account." : "Nothing to withdraw yet — earnings from sales land here.")}>Withdraw</Button>
                </div>
                <div className="empty" style={{ textAlign: "center", padding: "1.5rem 0" }}>
                  <p>{count ? `${count} sale${count === 1 ? "" : "s"} · ${money(gross)} gross · you keep ${money(earned)}.` : "No payouts yet. Your earnings from sales will show up here."}</p>
                </div>
              </div>
            );
          })()
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
