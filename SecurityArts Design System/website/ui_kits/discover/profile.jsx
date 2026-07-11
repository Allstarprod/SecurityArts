const { Seal, Icon, IconButton, Button, Tag, Avatar, Pin, Modal, Toast, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore, Session = window.SASession;
function strhash(s){var h=0;for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return (h>>>0);}

// Profile accent palette. Keys mirror the server whitelist; `brass` = the site default
// (no override). The chosen hex is applied as a scoped `--brass` override on the profile.
const ACCENTS = { brass: null, rose: "#d98a8a", violet: "#b39ddb", teal: "#5cbfae", amber: "#e0b050", sky: "#86b3e0" };

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

// Creator Hub — analytics for the signed-in creator: real views + comment counts on
// their sealed works, ranked by engagement. Numbers grow as work gets seen and discussed.
function hubFmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); }
function CreatorHub() {
  const empty = { totals: { works: 0, views: 0, comments: 0 }, top: [] };
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    if (window.SA_API) window.SA_API.myStats().then((d) => { if (alive) setData(d || empty); }).catch(() => { if (alive) setData(empty); });
    else setData(empty);
    return () => { alive = false; };
  }, []);

  if (!data) return <p className="hub__loading">Loading your analytics…</p>;
  const t = data.totals;
  return (
    <div className="hub">
      <div className="hub__cards">
        <div className="hubcard"><b>{hubFmt(t.works)}</b><span>Sealed works</span></div>
        <div className="hubcard"><b>{hubFmt(t.views)}</b><span>Total views</span></div>
        <div className="hubcard"><b>{hubFmt(t.comments)}</b><span>Comments</span></div>
      </div>
      {data.top.length ? (
        <div className="hubtable">
          <div className="hubrow hubrow--head"><span>Top posts</span><span>Views</span><span>Comments</span></div>
          {data.top.map((w) => (
            <div className="hubrow" key={w.id}>
              <span className="hubwork"><img src={SAGenArt.dataUri(strhash(w.id), { cat: w.cat })} alt="" /><span className="hubwork__t">{w.title}</span></span>
              <span className="hubnum">{hubFmt(w.views)}</span>
              <span className="hubnum">{hubFmt(w.comments)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="about" style={{ textAlign: "center", padding: "2rem 0" }}>
          <Seal size={40} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
          <p>No analytics yet. Seal a work — then views and comments land here as people discover it.</p>
        </div>
      )}
    </div>
  );
}

function SelfProfile({ user }) {
  useStoreTick();
  const [profile, setProfile] = React.useState(() => user.profile || {});
  const [acct, setAcct] = React.useState(() => ({ name: user.name, handle: user.handle || Session.handleFromEmail(user.email), handleClaimed: !!user.handleClaimed }));
  const [ownWorks, setOwnWorks] = React.useState([]);
  const [tab, setTab] = React.useState("works");
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [bannerBusy, setBannerBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [pronouns, setPronouns] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [likesText, setLikesText] = React.useState("");
  const [accent, setAccent] = React.useState("brass");
  const [visibility, setVisibility] = React.useState("public");
  const [toast, setToast] = React.useState("");
  const fileRef = React.useRef();
  const toastRef = React.useRef();
  const show = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 2200); };

  React.useEffect(() => {
    let alive = true;
    if (window.SA_API) window.SA_API.listWorks().then((list) => { if (alive) setOwnWorks((list || []).filter((w) => w.ownerId === user.id)); }).catch(() => {});
    return () => { alive = false; };
  }, [user.id]);

  const likes = S.likes().length, follows = S.follows().length;
  const logout = async () => { await Session.logout(); location.href = "login.html"; };
  const isPrivate = profile.visibility === "private";
  const likeTags = profile.likes || [];
  const accentStyle = ACCENTS[profile.accent] ? { "--brass": ACCENTS[profile.accent] } : undefined;
  const coverSrc = profile.bannerUrl || SAGenArt.dataUri(user.id + "-cover", { cat: "concept" });

  const openEdit = () => {
    setName(acct.name || ""); setHandle(acct.handle || "");
    setPronouns(profile.pronouns || ""); setGender(profile.gender || "");
    setBio(profile.bio || ""); setLikesText((profile.likes || []).join("\n"));
    setAccent(profile.accent in ACCENTS ? profile.accent : "brass");
    setVisibility(profile.visibility === "private" ? "private" : "public");
    setEditing(true);
  };
  const save = () => {
    if (saving) return;
    const h = handle.trim().toLowerCase();
    if (!name.trim()) { show("Your name can't be empty."); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(h)) { show("Handle: 3–30 letters, numbers, or _"); return; }
    setSaving(true);
    const fields = {
      name: name.trim().slice(0, 80),
      handle: h,
      pronouns: pronouns.trim().slice(0, 40),
      gender: gender.trim().slice(0, 40),
      bio: bio.trim().slice(0, 600),
      likes: likesText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12),
      accent: accent, visibility: visibility,
    };
    Promise.resolve(Session.updateProfile(fields)).then((u) => {
      if (u) { setProfile(u.profile || {}); setAcct({ name: u.name, handle: u.handle, handleClaimed: !!u.handleClaimed }); }
      else { setProfile(Object.assign({}, profile, fields)); setAcct((a) => ({ ...a, name: fields.name, handle: fields.handle })); }
      setEditing(false); setSaving(false); show("Profile saved");
    }).catch((e) => { setSaving(false); show((e && e.message) || "Couldn't save — try again"); });
  };
  const pickBanner = () => { if (fileRef.current) fileRef.current.click(); };
  const onBannerFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!/^image\//.test(file.type)) { show("Pick an image file."); return; }
    if (file.size > 2_200_000) { show("Banner must be under ~2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setBannerBusy(true);
      Promise.resolve(Session.uploadBanner({ image: String(reader.result) })).then((u) => {
        if (u) setProfile(u.profile || {}); else setProfile((p) => ({ ...p, bannerUrl: String(reader.result) }));
        setBannerBusy(false); show("Banner updated");
      }).catch((err) => { setBannerBusy(false); show((err && err.message) || "Couldn't upload banner"); });
    };
    reader.readAsDataURL(file);
  };
  const removeBanner = () => {
    setBannerBusy(true);
    Promise.resolve(Session.uploadBanner({ remove: true })).then((u) => {
      if (u) setProfile(u.profile || {}); else setProfile((p) => ({ ...p, bannerUrl: "" }));
      setBannerBusy(false); show("Banner removed");
    }).catch(() => { setBannerBusy(false); show("Couldn't remove banner"); });
  };
  const shareProfile = () => {
    const link = acct.handleClaimed ? location.origin + "/@" + acct.handle : location.origin + location.pathname + "?u=" + encodeURIComponent(user.id);
    if (navigator.clipboard) { try { navigator.clipboard.writeText(link); } catch (e) {} }
    show(isPrivate ? "Link copied — your profile is private" : "Profile link copied");
  };

  return (
    <div className="self" style={accentStyle}>
      <AppBar />
      <div className="cover"><img src={coverSrc} alt="" /></div>
      <div className="wrap">
        <div className="phead">
          <Avatar name={acct.name} size={112} className="phead__avatar" />
          <div className="phead__id">
            <h1 className="phead__name">{acct.name}<span className="youchip">You</span></h1>
            <div className="phead__handle">
              <span>@{acct.handle}</span>
              {profile.pronouns ? <span className="loc">{profile.pronouns}</span> : null}
              {profile.gender ? <span className="loc">{profile.gender}</span> : null}
              <span className="loc">{user.email}</span>
              {isPrivate
                ? <span className="vis vis--private">Private</span>
                : <span className="vis"><Icon name="shieldCheck" size={12} /> Public</span>}
            </div>
          </div>
          <div className="phead__actions">
            <Button variant="solid" size="sm" onClick={openEdit}>Edit profile</Button>
            <IconButton icon="share" label="Copy profile link" onClick={shareProfile} />
            <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
          </div>
        </div>

        <div className="pbody">
          <aside className="aside">
            <p className="bio">{profile.bio || "This is your public SecurityArts profile. Add a bio, your pronouns, and what you love — then seal a piece and it appears here, proof a human made it."}</p>
            {likeTags.length ? (
              <div className="likes-blk">
                <p className="asidek">What I like</p>
                <div className="tags">{likeTags.map((t, i) => <Tag key={i}>{t}</Tag>)}</div>
              </div>
            ) : null}
            <div className="stats">
              <div className="stat"><b>{ownWorks.length}</b><span>Sealed works</span></div>
              <div className="stat"><b>{likes}</b><span>Likes given</span></div>
              <div className="stat"><b>{follows}</b><span>Following</span></div>
            </div>
            <a href="me.html" className="asidelink"><Icon name="user" size={14} /> Back to your account</a>
          </aside>

          <div>
            <div className="tabs">
              <button className={`tab ${tab === "works" ? "active" : ""}`} onClick={() => setTab("works")}>Works · {ownWorks.length}</button>
              <button className={`tab ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>Analytics</button>
              <button className={`tab ${tab === "about" ? "active" : ""}`} onClick={() => setTab("about")}>About</button>
            </div>
            {tab === "analytics" ? <CreatorHub /> : tab === "works" ? (
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

      <Modal open={editing} onClose={() => setEditing(false)} width="min(560px, 94vw)" label="Edit your profile">
        <div className="pset">
          <p className="dm__eyebrow">Your profile</p>
          <h2 className="dm__title">Make it yours.</h2>

          <div className="fld"><span>Banner</span>
            <div className="banner-up">
              <div className="banner-up__prev">{profile.bannerUrl ? <img src={profile.bannerUrl} alt="" /> : <span className="banner-up__empty">No banner yet</span>}</div>
              <div className="banner-up__act">
                <input ref={fileRef} type="file" accept="image/*" onChange={onBannerFile} style={{ display: "none" }} />
                <Button variant="ghost" size="sm" onClick={pickBanner} disabled={bannerBusy}>{bannerBusy ? "Uploading…" : (profile.bannerUrl ? "Replace" : "Upload")}</Button>
                {profile.bannerUrl ? <Button variant="ghost" size="sm" onClick={removeBanner} disabled={bannerBusy}>Remove</Button> : null}
              </div>
            </div>
            <p className="pset__note">2048×1152 looks best · JPG or PNG under ~2MB.</p>
          </div>

          <div className="pset__grid">
            <label className="fld"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} /></label>
            <label className="fld"><span>Handle</span><div className="handle-in"><span>@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="yourname" maxLength={30} /></div></label>
          </div>

          <div className="pset__grid">
            <label className="fld"><span>Pronouns</span><input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="she/her · he/him · they/them" maxLength={40} /></label>
            <label className="fld"><span>Gender</span><input value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Woman · Man · Non-binary · …" maxLength={40} /></label>
          </div>
          <label className="fld"><span>Bio</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line about you and your work…" maxLength={600} rows={3} /></label>
          <label className="fld"><span>What I like <em>(one per line)</em></span><textarea value={likesText} onChange={(e) => setLikesText(e.target.value)} placeholder={"Analog photography\nBrutalist type\nRisograph"} rows={4} /></label>
          <div className="fld"><span>Accent</span>
            <div className="swatches">
              {Object.keys(ACCENTS).map((k) => (
                <button key={k} type="button" className={`sw ${accent === k ? "on" : ""}`} onClick={() => setAccent(k)} aria-label={k} title={k} style={{ background: ACCENTS[k] || "var(--brass)" }} />
              ))}
            </div>
          </div>
          <div className="fld"><span>Board visibility</span>
            <div className="seg">
              <button type="button" className={visibility === "public" ? "on" : ""} onClick={() => setVisibility("public")}>Public</button>
              <button type="button" className={visibility === "private" ? "on" : ""} onClick={() => setVisibility("private")}>Private</button>
            </div>
            <p className="pset__note">{visibility === "private" ? "Only you can see your profile and sealed works." : "Anyone with your link can see your profile and sealed works."}</p>
          </div>
          <div className="dm__actions">
            <Button variant="solid" size="sm" onClick={save}>{saving ? "Saving…" : "Save profile"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <footer className="foot">
        <a href="me.html">← Back to your account</a>
        <span className="m">Your public profile · Sealed provenance</span>
      </footer>
      <Toast show={!!toast}>{toast}</Toast>
    </div>
  );
}

// Centered full-page message (loading / private / missing states).
function Notice({ title, body }) {
  return (
    <React.Fragment>
      <AppBar />
      <div className="wrap">
        <div className="about" style={{ textAlign: "center", padding: "clamp(3rem,10vw,7rem) 0" }}>
          <Seal size={54} style={{ margin: "0 auto 1.2rem", color: "var(--bone-faint)" }} />
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 360, fontSize: "1.9rem", letterSpacing: "-0.02em", marginBottom: "0.6rem" }}>{title}</h2>
          <p style={{ color: "var(--bone-dim)", maxWidth: "44ch", margin: "0 auto 1.4rem" }}>{body}</p>
          <a href="index.html"><Button variant="ghost" arrow>Back to Discover</Button></a>
        </div>
      </div>
    </React.Fragment>
  );
}

// Another member's public profile (profile.html?u=<userId>). The server decides what
// to return — a private profile arrives with only { name, visibility:"private" }, so
// the privacy choice is enforced server-side, not just hidden here.
function PublicUserProfile({ userId, handle }) {
  const [status, setStatus] = React.useState("loading"); // loading | ok | private | missing
  const [prof, setProf] = React.useState(null);
  const [works, setWorks] = React.useState([]);

  React.useEffect(() => {
    let alive = true;
    const load = handle ? Session.getUserByHandle(handle) : Session.getUser(userId);
    Promise.resolve(load).then((p) => {
      if (!alive) return;
      if (!p) { setStatus("missing"); return; }
      if (p.visibility === "private") { setProf(p); setStatus("private"); return; }
      setProf(p); setStatus("ok");
      if (window.SA_API) window.SA_API.listWorks().then((list) => { if (alive) setWorks((list || []).filter((w) => w.ownerId === p.id)); }).catch(() => {});
    }).catch(() => { if (alive) setStatus("missing"); });
    return () => { alive = false; };
  }, [userId, handle]);

  if (status === "loading") return <Notice title="Loading profile…" body="Fetching this creator's public profile." />;
  if (status === "missing") return <Notice title="Profile unavailable." body="This profile can't be loaded — it may be offline, or the link is broken." />;
  if (status === "private") return <Notice title={(prof && prof.name ? prof.name + "’s" : "This") + " profile is private."} body="The owner has chosen to keep their board private." />;

  const accentStyle = ACCENTS[prof.accent] ? { "--brass": ACCENTS[prof.accent] } : undefined;
  const likeTags = prof.likes || [];
  const coverSrc = prof.bannerUrl || SAGenArt.dataUri(prof.id + "-cover", { cat: "concept" });
  return (
    <div className="self" style={accentStyle}>
      <AppBar />
      <div className="cover"><img src={coverSrc} alt="" /></div>
      <div className="wrap">
        <div className="phead">
          <Avatar name={prof.name} size={112} className="phead__avatar" />
          <div className="phead__id">
            <h1 className="phead__name">{prof.name}</h1>
            <div className="phead__handle">
              <span>@{prof.handle}</span>
              {prof.pronouns ? <span className="loc">{prof.pronouns}</span> : null}
              {prof.gender ? <span className="loc">{prof.gender}</span> : null}
              <span className="vis"><Icon name="shieldCheck" size={12} /> Public</span>
            </div>
          </div>
        </div>
        <div className="pbody">
          <aside className="aside">
            <p className="bio">{prof.bio || "A SecurityArts member."}</p>
            {likeTags.length ? (
              <div className="likes-blk">
                <p className="asidek">What they like</p>
                <div className="tags">{likeTags.map((t, i) => <Tag key={i}>{t}</Tag>)}</div>
              </div>
            ) : null}
            <div className="stats"><div className="stat"><b>{works.length}</b><span>Sealed works</span></div></div>
          </aside>
          <div>
            <div className="tabs"><button className="tab active">Works · {works.length}</button></div>
            {works.length ? (
              <div className="masonry">
                {works.map((w) => (
                  <Pin key={w.id} art={<img src={SAGenArt.dataUri(strhash(w.id), { cat: w.cat })} alt={w.title} />}
                    title={w.title} artist={prof.name} badge="Sealed" />
                ))}
              </div>
            ) : (
              <div className="about" style={{ textAlign: "center" }}>
                <Seal size={44} style={{ margin: "0 auto 1rem", color: "var(--bone-faint)" }} />
                <p>No sealed works yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="foot">
        <a href="index.html">← Back to Discover</a>
        <span className="m">Verified human · Sealed provenance</span>
      </footer>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(location.search);
  const uid = params.get("u");
  const h = params.get("h");
  const isMe = params.get("me") === "1" || params.get("artist") === "me";
  if (isMe) {
    const user = Session.current();
    return user ? <SelfProfile user={user} /> : <SelfSignedOut />;
  }
  if (h) return <PublicUserProfile handle={h} />;
  if (uid) return <PublicUserProfile userId={uid} />;
  return <ArtistProfile artistId={qsArtist()} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
