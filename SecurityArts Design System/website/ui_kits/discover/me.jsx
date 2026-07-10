const { Seal, Icon, IconButton, Button, Avatar, Pin, VerifiedBadge, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore, Session = window.SASession;

function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }
function money(n) { return "$" + n.toLocaleString("en-US"); }
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}
function sealId(id){return "SA-"+((strhash("seal"+id)>>>0).toString(36).toUpperCase()+"000000").slice(0,6);}

/* Purchases: derived from the first liked works, so buying feels connected to taste.
   Falls back to two seeded purchases so the tab is never empty on a fresh visit. */
function derivePurchases(likedIds) {
  const base = likedIds.slice(0, 3);
  const ids = base.length ? base : ["w3", "w13"];
  return ids.map((id, i) => {
    const w = C.workById[id]; if (!w) return null;
    const tier = ["Personal", "Commercial", "Exclusive"][strhash(id) % 3];
    const mult = { Personal: 1, Commercial: 3, Exclusive: 9 }[tier];
    return { work: w, tier, amt: w.price * mult, seal: sealId(id), daysAgo: 8 + i * 21 };
  }).filter(Boolean);
}
function dateAgo(days) { const d = new Date(Date.now() - days * 864e5); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function AppBar() {
  const pending = S.counts().pending;
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Account</span>
      </a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="foryou.html" className="optional">For You</a>
        <a href="dms.html">DMs{pending ? <span className="dot" /> : null}</a>
        <a href="verify.html" className="optional">Verify</a>
        <a href="me.html" className="active">You</a>
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
        <div className="empty" style={{ paddingTop: "clamp(3rem,10vw,7rem)" }}>
          <Seal size={54} style={{ margin: "0 auto 1.2rem", color: "var(--bone-faint)" }} />
          <h2>Your account, sealed.</h2>
          <p>Sign in to see your likes, the artists you follow, and your sealed collection — all in one place.</p>
          <a href="login.html?next=me.html"><Button variant="solid" arrow>Sign in</Button></a>
        </div>
      </div>
    </React.Fragment>
  );
}

function App() {
  useStoreTick();
  const [user, setUser] = React.useState(() => Session.current());
  const [tab, setTab] = React.useState("likes");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };
  React.useEffect(() => { Session.sync().then((u) => setUser(u || null)).catch(() => {}); }, []);
  const logout = async () => { await Session.logout(); location.href = "login.html"; };

  if (!user) return <SignedOut />;
  const handle = user.handle || Session.handleFromEmail(user.email);

  const likedIds = S.likes();
  const liked = likedIds.map((id) => C.workById[id]).filter(Boolean);
  const followIds = S.follows();
  const following = followIds.map((id) => C.artistById[id]).filter(Boolean);
  const purchases = derivePurchases(likedIds);

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="mehead">
          <a href="profile.html?me=1" aria-label="View your profile"><Avatar name={user.name} size={108} className="mehead__avatar" /></a>
          <div className="mehead__id">
            <p className="mehead__eyebrow">Your account</p>
            <h1 className="mehead__name">{user.name}</h1>
            <div className="mehead__handle">
              <span className="m">@{handle}</span>
              <span className="m"><Icon name="heart" size={13} /> Collector</span>
              <span className="m"><Icon name="shieldCheck" size={13} /> {user.email}</span>
            </div>
          </div>
          <div className="mehead__actions">
            <a href="profile.html?me=1"><Button variant="solid" size="sm" arrow>View your profile</Button></a>
            <a href="dashboard.html"><Button variant="ghost" size="sm">Artist studio</Button></a>
            <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
          </div>
        </div>

        <div className="stats">
          <div className={`stat ${tab === "likes" ? "active" : ""}`} onClick={() => setTab("likes")}><b>{liked.length}</b><span>Likes</span></div>
          <div className={`stat ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}><b>{following.length}</b><span>Following</span></div>
          <div className={`stat ${tab === "purchases" ? "active" : ""}`} onClick={() => setTab("purchases")}><b>{purchases.length}</b><span>Purchases</span></div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "likes" ? "active" : ""}`} onClick={() => setTab("likes")}>Likes</button>
          <button className={`tab ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}>Following</button>
          <button className={`tab ${tab === "purchases" ? "active" : ""}`} onClick={() => setTab("purchases")}>Purchases</button>
        </div>

        {tab === "likes" ? (
          liked.length ? (
            <div className="masonry">
              {liked.map((w) => {
                const a = C.artistById[w.artistId];
                return (
                  <a className="pinlink" key={w.id} href={a ? `profile.html?artist=${a.id}` : "#"}>
                    <Pin art={<img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title} />}
                      title={w.title} artist={a ? a.name : "You"} badge="Verified"
                      saved onSave={() => { S.toggleLike(w.id); show("Removed from likes"); }} />
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <h2>No likes yet.</h2>
              <p>Tap the heart on any work in Discover — the pieces you like collect here and shape your For You feed.</p>
              <a href="index.html"><Button variant="solid" arrow>Browse the wall</Button></a>
            </div>
          )
        ) : null}

        {tab === "following" ? (
          following.length ? (
            <div className="follows">
              {following.map((a) => (
                <div className="fcard" key={a.id}>
                  <a href={`profile.html?artist=${a.id}`}><Avatar name={a.name} size={52} verified /></a>
                  <div className="fcard__main">
                    <a href={`profile.html?artist=${a.id}`}><div className="fcard__name">{a.name}</div></a>
                    <div className="fcard__meta">{C.MEDIUM[a.cat] || a.cat} · {a.city.split(",")[0]}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { S.toggleFollow(a.id); show("Unfollowed " + a.name); }}>Following</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <h2>You're not following anyone yet.</h2>
              <p>Open an artist from Discover and follow them — they'll show up here, and their new work will reach your feed.</p>
              <a href="index.html"><Button variant="solid" arrow>Find artists</Button></a>
            </div>
          )
        ) : null}

        {tab === "purchases" ? (
          purchases.length ? (
            <div className="buys">
              {purchases.map((p) => {
                const a = C.artistById[p.work.artistId];
                return (
                  <div className="bcard" key={p.work.id}>
                    <div className="bcard__art">
                      <img src={SAGenArt.dataUri(p.work.seed, { cat: p.work.cat })} alt={p.work.title} />
                      <VerifiedBadge className="bcard__badge">Owned</VerifiedBadge>
                    </div>
                    <div className="bcard__info">
                      <div className="bcard__title">{p.work.title}</div>
                      <div className="bcard__sub">{a ? a.name : ""} · {p.tier} license · {money(p.amt)}</div>
                      <a href={`seal.html?id=${p.seal}`} className="bcard__seal"><Seal size={15} /> Seal {p.seal} · {dateAgo(p.daysAgo)}</a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <Seal size={48} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
              <h2>Nothing purchased yet.</h2>
              <p>When you buy or license a sealed original in the market, it lands here with its certificate.</p>
              <a href="../market/index.html"><Button variant="solid" arrow>Open the market</Button></a>
            </div>
          )
        ) : null}
      </div>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">Your likes · Your artists · Your sealed collection</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
