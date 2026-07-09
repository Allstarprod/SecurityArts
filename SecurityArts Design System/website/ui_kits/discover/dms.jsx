const { Seal, Icon, IconButton, Button, Avatar, ThemeToggle } = window.SecurityArtsDesignSystem_f7e889;
const C = window.SACatalog, S = window.SAStore;

function useStoreTick() { const [, set] = React.useState(0); React.useEffect(() => S.subscribe(() => set((n) => n + 1)), []); }
function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
function clock(ts) { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

function AppBar() {
  const pending = S.counts().pending;
  return (
    <header className="appbar">
      <a className="brand" href="index.html" aria-label="SecurityArts Discover">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Messages</span>
      </a>
      <nav className="nav">
        <a href="index.html" className="optional">Discover</a>
        <a href="foryou.html" className="optional">For You</a>
        <a href="dms.html" className="active">DMs</a>
        <a href="verify.html" className="optional">Verify</a>
        <a href="me.html" className="optional">You</a>
        <a href="../market/index.html" className="optional">Market</a>
        <ThemeToggle size={38} />
      </nav>
    </header>
  );
}

function App() {
  useStoreTick();
  const list = S.threadList();
  const requests = list.filter((t) => t.status === "incoming");
  const convos = list.filter((t) => t.status !== "incoming");
  const [sel, setSel] = React.useState(() => (convos[0] || list[0] || {}).artistId || null);
  const [draft, setDraft] = React.useState("");
  const [view, setView] = React.useState("list"); // mobile
  const scrollRef = React.useRef();

  React.useEffect(() => { if (sel) S.markRead(sel); }, [sel]);
  React.useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });

  const open = (id) => { setSel(id); setView("thread"); };
  const thread = sel ? S.getThread(sel) : null;
  const artist = sel ? C.artistById[sel] : null;

  const send = () => { const t = draft.trim(); if (!t || !sel) return; S.sendMessage(sel, t); setDraft(""); };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const Rows = ({ items }) => items.map((t) => {
    const a = C.artistById[t.artistId]; if (!a) return null;
    return (
      <button key={t.artistId} className={`row ${sel === t.artistId ? "active" : ""}`} onClick={() => open(t.artistId)}>
        <Avatar name={a.name} size={46} verified />
        <div className="row__main">
          <div className="row__top"><span className="row__name">{a.name}</span><span className="row__time">{t.last ? ago(t.last.ts) : ""}</span></div>
          <div className={`row__prev ${t.status === "incoming" ? "req" : ""}`}>
            {t.status === "requested" ? "Request sent · " : ""}{t.last ? (t.last.from === "me" ? "You: " : "") + t.last.text : "No messages yet"}
          </div>
        </div>
        {t.unread ? <span className="row__unread" /> : null}
      </button>
    );
  });

  return (
    <React.Fragment>
      <AppBar />
      <div className="shell" data-view={view}>
        <div className="list">
          <div className="list__head"><h1 className="list__title">Messages</h1></div>
          <div className="list__scroll">
            {requests.length ? <div className="group-label"><Icon name="bell" size={12} /> Requests <span className="n">· {requests.length}</span></div> : null}
            <Rows items={requests} />
            <div className="group-label">Conversations</div>
            {convos.length ? <Rows items={convos} /> : <p style={{ padding: "0.5rem var(--gutter-app)", color: "var(--bone-faint)", fontSize: "0.85rem" }}>No conversations yet.</p>}
          </div>
        </div>

        <div className="thread">
          {thread && artist ? (
            <React.Fragment>
              <div className="thread__head">
                <IconButton icon="arrowLeft" label="Back" className="thread__back" onClick={() => setView("list")} />
                <Avatar name={artist.name} size={40} verified />
                <div className="thread__id">
                  <div className="thread__name">{artist.name}<Seal size={15} className="seal" /></div>
                  <div className="thread__sub">@{artist.handle} · {artist.city}</div>
                </div>
                <a href={`profile.html?artist=${artist.id}`}><Button variant="ghost" size="sm">View profile</Button></a>
              </div>

              <div className="thread__scroll" ref={scrollRef}>
                <span className="daystamp">{thread.status === "incoming" ? "Message request" : "Sealed conversation"}</span>
                {thread.messages.map((m, i) => (
                  <div key={i} className={`bubble ${m.from}`}>
                    {m.text}
                    <span className="bubble__time">{clock(m.ts)}</span>
                  </div>
                ))}
              </div>

              {thread.status === "incoming" ? (
                <div className="reqbar">
                  <p><b>{artist.name.split(" ")[0]}</b> wants to connect. Accept to open a conversation, or reply to accept.</p>
                  <Button variant="solid" size="sm" onClick={() => S.accept(sel)}>Accept</Button>
                  <Button variant="ghost" size="sm" onClick={() => { S.decline(sel); setSel((convos[0] || {}).artistId || null); }}>Decline</Button>
                </div>
              ) : thread.status === "requested" ? (
                <div className="pending"><Icon name="shieldCheck" size={14} /> Request sent — waiting for {artist.name.split(" ")[0]} to accept</div>
              ) : null}

              <div className="composer">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} rows={1}
                  placeholder={thread.status === "incoming" ? "Reply to accept…" : "Write a message…"} />
                <IconButton icon="send" variant="outline" active={!!draft.trim()} label="Send" onClick={send} />
              </div>
            </React.Fragment>
          ) : (
            <div className="empty"><div className="empty__in">
              <Seal size={54} style={{ margin: "0 auto", color: "var(--bone-faint)" }} />
              <h2>Your messages, sealed.</h2>
              <p>Open a request or a conversation on the left. New requests arrive when you reach out to an artist from their profile.</p>
              <div style={{ marginTop: "1.4rem" }}><a href="index.html"><Button variant="ghost" size="sm">Browse Discover</Button></a></div>
            </div></div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
