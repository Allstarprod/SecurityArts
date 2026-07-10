const { Seal, Icon, IconButton, Button, Tag, Avatar, Pin, Modal, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore, Session = window.SASession;
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return (h>>>0);}

function useStoreTick() {
  const [, set] = React.useState(0);
  React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []);
  return null;
}
function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); }
function qsArtist() {
  const id = new URLSearchParams(location.search).get("artist");
  return C.artistById[id] ? id : C.artists[0].id;
}

function AppBar() {
  const pending = S.counts().pending;
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Discover</span>
      </a>
      <nav className="nav">
        <a href="index.html">Discover</a>
        <a href="foryou.html" className="optional">For You</a>
        <a href="dms.html">DMs{pending ? <span className="dot" /> : null}</a>
        <a href="verify.html" className="optional">Verify</a>
        <a href="me.html" className="optional">You</a>
        <a href="../market/index.html" className="optional">Market</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function ArtistProfile({ artistId }) {
  useStoreTick();
  const artist = C.artistById[artistId];
  const works = C.worksByArtist[artistId] || [];
  const [tab, setTab] = React.useState("works");
  const [dmOpen, setDmOpen] = React.useState(false);
  const [dmText, setDmText] = React.useState("");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 2000); };

  React.useEffect(() => { works.forEach((w) => {}); }, [artistId]);

  const following = S.isFollowing(artistId);
  const thread = S.getThread(artistId);
  const dmState = thread ? thread.status : null;

  const toggleFollow = () => { const now = S.toggleFollow(artistId); show(now ? "Following " + artist.name : "Unfollowed"); };
  const openDM = () => { setDmText(""); setDmOpen(true); };
  const sendRequest = () => {
    const text = dmText.trim() || "Hi " + artist.name.split(" ")[0] + " — I love your work and would like to connect.";
    S.requestDM(artistId, text); setDmOpen(false);
    show("Request sent to " + artist.name.split(" ")[0]);
  };

  const messageLabel = dmState === "active" ? "Message" : dmState === "requested" ? "Requested" : "Message";

  return (
    <React.Fragment>
      <AppBar />
      <div className="cover"><img src={SAGenArt.dataUri(artist.id + "-cover", { cat: artist.cat })} alt="" /></div>

      <div className="wrap">
        <div className="phead">
          <Avatar name={artist.name} size={112} verified className="phead__avatar" />
          <div className="phead__id">
            <h1 className="phead__name">{artist.name}<Seal size={22} className="seal" title="Verified human artist" /></h1>
            <div className="phead__handle">
              <span>@{artist.handle}</span>
              <span className="loc"><Icon name="mapPin" size={13} /> {artist.city}</span>
              <span className="loc"><Icon name="shieldCheck" size={13} /> Verified artist</span>
            </div>
          </div>
          <div className="phead__actions">
            <Button variant={following ? "ghost" : "solid"} size="sm" onClick={toggleFollow}>{following ? "Following" : "Follow"}</Button>
            <Button variant="ghost" size="sm" onClick={openDM}>{messageLabel}</Button>
            <IconButton icon="share" label="Share profile" onClick={() => show("Profile link copied")} />
          </div>
        </div>

        <div className="pbody">
          <aside className="aside">
            <p className="bio">{artist.bio}</p>
            <div className="tags">{artist.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            <div className="stats">
              <div className="stat"><b>{artist.works}</b><span>Sealed works</span></div>
              <div className="stat"><b>{fmt(artist.followers)}</b><span>Followers</span></div>
              <div className="stat"><b>{fmt(artist.following)}</b><span>Following</span></div>
            </div>
            {dmState ? (
              <a href="dms.html" style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brass)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                <Icon name="message" size={14} /> {dmState === "requested" ? "Request pending — open DMs" : "Open conversation"}
              </a>
            ) : null}
          </aside>

          <div>
            <div className="tabs">
              <button className={`tab ${tab === "works" ? "active" : ""}`} onClick={() => setTab("works")}>Works · {works.length}</button>
              <button className={`tab ${tab === "about" ? "active" : ""}`} onClick={() => setTab("about")}>About</button>
            </div>

            {tab === "works" ? (
              <div className="masonry">
                {works.map((w) => (
                  <Pin key={w.id}
                    art={<img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title} />}
                    title={w.title} artist={artist.name}
                    badge="Verified"
                    saved={S.isLiked(w.id)} onSave={() => { const n = S.toggleLike(w.id); show(n ? "Added to your likes" : "Removed"); }}
                  />
                ))}
              </div>
            ) : (
              <div className="about">
                <p>{artist.bio}</p>
                <p>Working primarily in <b style={{ color: "var(--bone)" }}>{C.MEDIUM[artist.cat] || artist.cat}</b> from {artist.city}. Every piece is authenticated with a SecurityArts seal — a cryptographic signature proving a human made it, registered so any buyer or gallery can verify provenance.</p>
                <p>To commission or license a work, follow {artist.name.split(" ")[0]} and send a message request.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={dmOpen} onClose={() => setDmOpen(false)} width="min(520px, 94vw)" label="Send a message request">
        <div className="dm">
          <p className="dm__eyebrow">Message request</p>
          <h2 className="dm__title">Reach out to {artist.name.split(" ")[0]}.</h2>
          <div className="dm__who">
            <Avatar name={artist.name} size={40} verified />
            <div><b>{artist.name}</b><br /><span>@{artist.handle} · verified</span></div>
          </div>
          <textarea value={dmText} onChange={(e) => setDmText(e.target.value)} placeholder={"Say hello, ask about a piece, or propose a commission…"} maxLength={500} />
          <p className="dm__note">Artists receive your note as a request. They'll see your profile and can accept to open a conversation — you won't share contact details until they do.</p>
          <div className="dm__actions">
            <Button variant="solid" size="sm" arrow onClick={sendRequest}>Send request</Button>
            <Button variant="ghost" size="sm" onClick={() => setDmOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">Verified human · Sealed provenance · Licensed from the artist</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

function SelfSignedOut() {
  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="about" style={{ textAlign: "center", padding: "clamp(3rem,10vw,7rem) 0" }}>
          <Seal size={54} style={{ margin: "0 auto 1.2rem", color: "var(--bone-faint)" }} />
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 360, fontSize: "1.9rem", letterSpacing: "-0.02em", marginBottom: "0.6rem" }}>Your profile awaits.</h2>
          <p style={{ color: "var(--bone-dim)", maxWidth: "42ch", margin: "0 auto 1.4rem" }}>Sign in to see and share your public profile — your sealed works, all in one place.</p>
          <a href="login.html?next=profile.html%3Fme%3D1"><Button variant="solid" arrow>Sign in</Button></a>
        </div>
      </div>
    </React.Fragment>
  );
}

function SelfProfile({ user }) {
  useStoreTick();
  const [ownWorks, setOwnWorks] = React.useState([]);
  const [tab, setTab] = React.useState("works");
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 2000); };
  React.useEffect(() => {
    let alive = true;
    if (window.SA_API) window.SA_API.listWorks().then((list) => { if (alive) setOwnWorks((list || []).filter((w) => w.ownerId === user.id)); }).catch(() => {});
    return () => { alive = false; };
  }, [user.id]);

  const handle = user.handle || Session.handleFromEmail(user.email);
  const likes = S.likes().length, follows = S.follows().length;
  const logout = async () => { await Session.logout(); location.href = "login.html"; };

  return (
    <React.Fragment>
      <AppBar />
      <div className="cover"><img src={SAGenArt.dataUri(user.id + "-cover", { cat: "concept" })} alt="" /></div>
      <div className="wrap">
        <div className="phead">
          <Avatar name={user.name} size={112} className="phead__avatar" />
          <div className="phead__id">
            <h1 className="phead__name">{user.name}<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass)", border: "1px solid var(--line-strong)", borderRadius: "100px", padding: "0.2rem 0.6rem", marginLeft: "0.5rem", verticalAlign: "middle" }}>You</span></h1>
            <div className="phead__handle">
              <span>@{handle}</span>
              <span className="loc">{user.email}</span>
              <span className="loc"><Icon name="shieldCheck" size={13} /> Member</span>
            </div>
          </div>
          <div className="phead__actions">
            <a href="index.html"><Button variant="solid" size="sm" arrow>Seal a work</Button></a>
            <IconButton icon="share" label="Share profile" onClick={() => show("Profile link copied")} />
            <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
          </div>
        </div>

        <div className="pbody">
          <aside className="aside">
            <p className="bio">This is your public SecurityArts profile. Seal a piece and it appears here — proof a human made it, for any buyer or gallery to verify.</p>
            <div className="stats">
              <div className="stat"><b>{ownWorks.length}</b><span>Sealed works</span></div>
              <div className="stat"><b>{likes}</b><span>Likes given</span></div>
              <div className="stat"><b>{follows}</b><span>Following</span></div>
            </div>
            <a href="me.html" style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brass)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
              <Icon name="user" size={14} /> Back to your account
            </a>
          </aside>

          <div>
            <div className="tabs">
              <button className={`tab ${tab === "works" ? "active" : ""}`} onClick={() => setTab("works")}>Works · {ownWorks.length}</button>
              <button className={`tab ${tab === "about" ? "active" : ""}`} onClick={() => setTab("about")}>About</button>
            </div>
            {tab === "works" ? (
              ownWorks.length ? (
                <div className="masonry">
                  {ownWorks.map((w) => (
                    <Pin key={w.id} art={<img src={SAGenArt.dataUri(strhash(w.id), { cat: w.cat })} alt={w.title} />}
                      title={w.title} artist={user.name} badge="Sealed" />
                  ))}
                </div>
              ) : (
                <div className="about" style={{ textAlign: "center" }}>
                  <Seal size={44} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
                  <p style={{ marginBottom: "1.2rem" }}>You haven't sealed any work yet. Seal your first piece — it lands here with its certificate.</p>
                  <a href="index.html"><Button variant="solid" size="sm" arrow>Seal a work</Button></a>
                </div>
              )
            ) : (
              <div className="about">
                <p>This is your public profile on SecurityArts. When you seal a work, it's signed with the SecurityArts key and registered so anyone can verify a human made it.</p>
                <p>Signed in as <b style={{ color: "var(--bone)" }}>{user.email}</b>.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="foot">
        <a href="me.html">← Back to your account</a>
        <span className="m">Your public profile · Sealed provenance</span>
      </footer>
      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

function App() {
  const params = new URLSearchParams(location.search);
  const isMe = params.get("me") === "1" || params.get("artist") === "me";
  if (isMe) {
    const user = Session.current();
    return user ? <SelfProfile user={user} /> : <SelfSignedOut />;
  }
  return <ArtistProfile artistId={qsArtist()} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
