const { Seal, Icon, Button, Avatar, Pin, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore;

function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }

function AppBar() {
  const pending = S.counts().pending;
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">For You</span>
      </a>
      <nav className="nav">
        <a href="index.html">Discover</a>
        <a href="foryou.html" className="active">For You</a>
        <a href="dms.html">DMs{pending ? <span className="dot" /> : null}</a>
        <a href="verify.html" className="optional">Verify</a>
        <a href="me.html" className="optional">You</a>
        <a href="../market/index.html" className="optional">Market</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

const CAT_LABEL = { illustration: "Illustration", painting: "Painting", "3d": "3D & CGI", photography: "Photography", lettering: "Lettering", concept: "Concept art", mixed: "Mixed media" };

function PinCard({ w, onToast }) {
  const a = C.artistById[w.artistId];
  return (
    <a href={`seal.html?work=${w.id}`} style={{ display: "block" }}>
      <Pin
        art={<img src={SAGenArt.dataUri(w.seed, { cat: w.cat })} alt={w.title} />}
        title={w.title} artist={a.name} badge="Verified"
        saved={S.isLiked(w.id)}
        onSave={() => { const n = S.toggleLike(w.id); onToast(n ? "Added to your likes" : "Removed"); }}
      />
    </a>
  );
}

function ArtistCard({ a, why, onToast }) {
  const following = S.isFollowing(a.id);
  return (
    <div className="acard">
      <a href={`profile.html?artist=${a.id}`}><Avatar name={a.name} size={72} verified /></a>
      <div>
        <a href={`profile.html?artist=${a.id}`}><div className="acard__name">{a.name}</div></a>
        <div className="acard__meta">{CAT_LABEL[a.cat]} · {a.city.split(",")[0]}</div>
      </div>
      <p className="acard__why">{why}</p>
      <Button variant={following ? "ghost" : "solid"} size="sm"
        onClick={() => { const n = S.toggleFollow(a.id); onToast(n ? "Following " + a.name : "Unfollowed"); }}>
        {following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}

function App() {
  useStoreTick();
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const onToast = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  const likedIds = S.likes();
  const liked = likedIds.map((id) => C.workById[id]).filter(Boolean);
  const likedArtistIds = Array.from(new Set(liked.map((w) => w.artistId)));
  const likedCats = Array.from(new Set(liked.map((w) => w.cat)));

  // recommended works: score by shared artist / category, exclude already-liked
  const recommended = C.works
    .filter((w) => likedIds.indexOf(w.id) === -1)
    .map((w) => ({ w, score: (likedArtistIds.indexOf(w.artistId) !== -1 ? 3 : 0) + (likedCats.indexOf(w.cat) !== -1 ? 2 : 0) + (w.seed % 3) * 0.1 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);

  // artists for you: authored liked work, or work in a liked category
  const artistScore = {};
  C.artists.forEach((a) => {
    let s = 0;
    if (likedArtistIds.indexOf(a.id) !== -1) s += 3;
    if (likedCats.indexOf(a.cat) !== -1) s += 2;
    artistScore[a.id] = s;
  });
  const artistsForYou = C.artists
    .filter((a) => artistScore[a.id] > 0)
    .sort((a, b) => artistScore[b.id] - artistScore[a.id])
    .slice(0, 8);

  const whyArtist = (a) => {
    if (likedArtistIds.indexOf(a.id) !== -1) return "You liked their work";
    if (likedCats.indexOf(a.cat) !== -1) return "Because you like " + (CAT_LABEL[a.cat] || a.cat).toLowerCase();
    return "New to discover";
  };

  // "because you liked" — take the most recent liked work whose artist has siblings
  const because = liked.find((w) => (C.worksByArtist[w.artistId] || []).length > 1);
  const becauseWorks = because ? (C.worksByArtist[because.artistId] || []).filter((x) => x.id !== because.id) : [];

  const hasLikes = liked.length > 0;

  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <section className="intro">
          <span className="intro__eyebrow"><Icon name="sparkle" size={14} /> For you · built from your taste</span>
          {hasLikes ? (
            <React.Fragment>
              <h1>More of what<br />you <em>love.</em></h1>
              <p>Built from the <b>{liked.length} work{liked.length > 1 ? "s" : ""}</b> you've liked{likedCats.length ? <> across <b>{likedCats.map((c) => (CAT_LABEL[c] || c).toLowerCase()).join(", ")}</b></> : null}. The more you like, the sharper this gets.</p>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <h1>This page<br />becomes <em>yours.</em></h1>
              <p>Like a few works on <b>Discover</b> — or on any artist's profile — and SecurityArts starts surfacing the artists and pieces you'll want next, right here.</p>
            </React.Fragment>
          )}
        </section>

        {!hasLikes ? (
          <section className="section">
            <div className="section__head"><h2 className="section__title">Start here</h2><a className="section__link" href="index.html">Open Discover →</a></div>
            <div className="masonry">
              {C.works.slice(0, 12).map((w) => <PinCard key={w.id} w={w} onToast={onToast} />)}
            </div>
            <div className="empty">
              <p>Tap the save button on any piece to add it to your likes — the seal means a human made it.</p>
              <a href="index.html"><Button variant="solid" arrow>Browse the wall</Button></a>
            </div>
          </section>
        ) : (
          <React.Fragment>
            <section className="section">
              <div className="section__head"><h2 className="section__title">Artists <em>for you</em></h2></div>
              <div className="artists">
                {artistsForYou.map((a) => <ArtistCard key={a.id} a={a} why={whyArtist(a)} onToast={onToast} />)}
              </div>
            </section>

            {because && becauseWorks.length ? (
              <section className="section">
                <div className="section__head">
                  <h2 className="section__title">Because you liked <em>{because.title}</em></h2>
                  <a className="section__link" href={`profile.html?artist=${because.artistId}`}>{C.artistById[because.artistId].name} →</a>
                </div>
                <div className="rail">
                  {becauseWorks.map((w) => <div key={w.id} style={{ minWidth: 0 }}><PinCard w={w} onToast={onToast} /></div>)}
                </div>
              </section>
            ) : null}

            <section className="section">
              <div className="section__head"><h2 className="section__title">Recommended for you</h2></div>
              <div className="masonry">
                {recommended.slice(0, 15).map((w) => <PinCard key={w.id} w={w} onToast={onToast} />)}
              </div>
            </section>
          </React.Fragment>
        )}
      </div>

      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">Recommendations from your likes · Every work verified human</span>
      </footer>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
