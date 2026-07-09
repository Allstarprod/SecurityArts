/* SecurityArts — Market (marketplace) UI kit.
   Buy & license sealed originals: filterable/sortable product grid, a quick-view
   modal with license tiers, a cart slide-over, and a two-step checkout that ends
   in an order confirmation. Composed from the design-system components. */
const { Seal, Icon, Input, Select, Chip, Button, Field, ProductCard, VerifiedBadge, LicenseOption, Drawer, Modal, Toast, ThemeToggle } =
  window.SecurityArtsDesignSystem_f7e889;

const CATS = [
  ["all", "All work"], ["illustration", "Illustration"], ["painting", "Painting"], ["3d", "3D / CGI"],
  ["photography", "Photography"], ["lettering", "Lettering"], ["concept", "Concept Art"],
];
const MEDIUM = { illustration: "Digital illustration", painting: "Oil on linen", "3d": "3D render", photography: "35mm photograph", lettering: "Hand lettering", concept: "Concept art" };
const FIRST = ["Mara", "Theo", "Ines", "Kofi", "Lena", "Diego", "Yuki", "Sol", "Noa", "Amara", "Rune", "Priya", "Cael", "Wren", "Otto", "Nadia"];
const LAST = ["Okafor", "Brandt", "Vela", "Mensah", "Sato", "Reyes", "Lindqvist", "Haddad", "Moreau", "Petrova", "Nakamura", "Adeyemi", "Cole", "Bauer", "Ferro", "Wynn"];
const TITLES = ["Static Bloom", "Low Tide, No.4", "Carrier Signal", "The Long Field", "Afterimage", "Salt & Iron", "Nocturne", "Paper Sun", "Margin Notes", "Quiet Engine", "Ribbon of Smoke", "Index of Birds", "Held Breath", "Slow Tangerine", "Foundry", "Cartographer"];
const CATKEYS = ["illustration", "painting", "3d", "photography", "lettering", "concept"];
const DESC = "An original, hand-made work. Purchase includes a SecurityArts seal — a cryptographic certificate of authenticity registered to this piece.";

const PRODUCTS = TITLES.map((t, i) => {
  const cat = CATKEYS[i % CATKEYS.length];
  const base = 120 + ((i * 47) % 9) * 60; // 120–600
  return { id: "m" + i, seed: i * 11 + 5, cat, title: t, artist: FIRST[i % FIRST.length] + " " + LAST[(i * 3 + 2) % LAST.length], medium: MEDIUM[cat], price: base };
});

const TIERS = (base) => [
  { key: "personal", name: "Personal license", description: "Personal, non-commercial display", price: base },
  { key: "commercial", name: "Commercial license", description: "Use in products, marketing, or client work", price: base * 3 },
  { key: "exclusive", name: "Exclusive — buy the original", description: "Bought outright and removed from the market", price: base * 9 },
];
const money = (n) => "$" + n.toLocaleString("en-US");
const rndHex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

function AppBar({ q, setQ, cartCount, onCart }) {
  return (
    <header className="appbar">
      <a className="brand" href="../studio/index.html" aria-label="SecurityArts home">
        <Seal size={30} /><span className="brand__word">SecurityArts</span><span className="brand__sub">Market</span>
      </a>
      <form className="searchform" onSubmit={(e) => e.preventDefault()} role="search">
        <Input shape="pill" icon="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sealed originals…" aria-label="Search" />
      </form>
      <div className="appbar__actions">
        <a className="applink" href="../discover/index.html">Discover</a>
        <a className="applink" href="../discover/verify.html">Verify</a>
        <Button variant="solid" size="sm" onClick={onCart}>Cart · {cartCount}</Button>
        <ThemeToggle size={38} />
      </div>
    </header>
  );
}

function App() {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [sort, setSort] = React.useState("featured");
  const [active, setActive] = React.useState(null); // product in quick view
  const [tier, setTier] = React.useState("commercial");
  const [cart, setCart] = React.useState([]);
  const [drawer, setDrawer] = React.useState(false);
  const [checkout, setCheckout] = React.useState(false);
  const [order, setOrder] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const toastRef = React.useRef();
  const showToast = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 1900); };

  let visible = PRODUCTS.filter((p) => (cat === "all" || p.cat === cat) && (!q || (p.title + " " + p.artist + " " + p.medium).toLowerCase().includes(q.toLowerCase())));
  if (sort === "asc") visible = [...visible].sort((a, b) => a.price - b.price);
  if (sort === "desc") visible = [...visible].sort((a, b) => b.price - a.price);

  const openQuick = (p) => { setActive(p); setTier("commercial"); };
  const addToCart = (p, tKey) => {
    const t = TIERS(p.price).find((x) => x.key === tKey);
    setCart((c) => [...c, { uid: p.id + "_" + tKey + "_" + Date.now(), id: p.id, seed: p.seed, cat: p.cat, title: p.title, artist: p.artist, license: t.key, licName: t.name, price: t.price }]);
    showToast("Added to cart");
  };
  const removeItem = (uid) => setCart((c) => c.filter((i) => i.uid !== uid));
  const subtotal = cart.reduce((s, i) => s + i.price, 0);

  const placeOrder = async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById("ck-email");
    const email = emailEl ? emailEl.value.trim() : "";
    let oid = "SA-" + rndHex(6).toUpperCase();
    try {
      if (window.SA_API) {
        // Server verifies prices + records the order (no card is charged).
        const r = await window.SA_API.checkout({ items: cart.map((i) => ({ id: i.id, license: i.license })), email });
        if (r && r.orderId) oid = r.orderId;
      }
    } catch (_) { /* backend unreachable — keep the local order id */ }
    setOrder({ id: oid, count: cart.length, total: subtotal });
    setCart([]);
  };
  const closeCheckout = () => { setCheckout(false); setOrder(null); };

  return (
    <React.Fragment>
      <AppBar q={q} setQ={setQ} cartCount={cart.length} onCart={() => setDrawer(true)} />

      <main>
        <section className="intro">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--brass)" }}>Marketplace — sealed originals</p>
          <h1>Own work made<br />by a <em>human hand.</em></h1>
          <p>Every listing is a verified original — signed with a SecurityArts seal and licensed directly from the artist. <strong>Buy the piece, license the use, or acquire it outright.</strong></p>
        </section>

        <div className="toolbar">
          <div className="chips">{CATS.map(([k, label]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{label}</Chip>)}</div>
          <div className="sortwrap">
            <label htmlFor="sort">Sort</label>
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}
              options={[{ value: "featured", label: "Featured" }, { value: "asc", label: "Price ↑" }, { value: "desc", label: "Price ↓" }]} />
          </div>
        </div>

        {visible.length ? (
          <section className="grid">
            {visible.map((p) => (
              <ProductCard key={p.id} art={<img src={SAGenArt.dataUri(p.seed, { cat: p.cat })} alt={p.title + " by " + p.artist} />}
                title={p.title} artist={p.artist} medium={p.medium} price={money(p.price)}
                onQuickView={() => openQuick(p)} onAdd={() => addToCart(p, "commercial")} addLabel={"License — " + money(p.price * 3)} />
            ))}
          </section>
        ) : (
          <div className="empty"><h2>No works match.</h2><p>Try a different medium or clear your search.</p></div>
        )}
      </main>

      <footer className="foot">
        <a href="../studio/index.html">← Back to SecurityArts</a>
        <span className="m">Every original sealed · Licensed from the artist · Verified human</span>
      </footer>

      {/* Quick view */}
      <Modal open={!!active} onClose={() => setActive(null)} width="min(860px, 96vw)" label="Work detail">
        {active ? (
          <div className="qv">
            <div className="qv__art"><img src={SAGenArt.dataUri(active.seed, { cat: active.cat })} alt={active.title} /><VerifiedBadge style={{ position: "absolute", top: "0.8rem", left: "0.8rem" }}>Verified</VerifiedBadge></div>
            <div className="qv__body">
              <p className="qv__eyebrow">{active.medium}</p>
              <h2 className="qv__title">{active.title}</h2>
              <p className="qv__artist">by <b>{active.artist}</b></p>
              <p className="qv__desc">{DESC}</p>
              <div className="lic">
                {TIERS(active.price).map((t) => (
                  <LicenseOption key={t.key} name={t.name} description={t.description} price={money(t.price)} selected={tier === t.key} onClick={() => setTier(t.key)} />
                ))}
              </div>
              <div className="qv__actions">
                <Button variant="solid" onClick={() => { addToCart(active, tier); setActive(null); }} arrow>Add to cart</Button>
                <Button variant="ghost" onClick={() => setActive(null)}>Keep browsing</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Cart */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Your cart"
        footer={cart.length ? (
          <React.Fragment>
            <div className="cart-sub"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <Button variant="solid" style={{ width: "100%" }} arrow onClick={() => { setDrawer(false); setCheckout(true); }}>Checkout</Button>
          </React.Fragment>
        ) : null}>
        {cart.length ? cart.map((i) => (
          <div className="citem" key={i.uid}>
            <div className="citem__thumb"><img src={SAGenArt.dataUri(i.seed, { cat: i.cat })} alt="" /></div>
            <div className="citem__main">
              <div className="citem__title">{i.title}</div>
              <div className="citem__lic">{i.artist} · {i.licName}</div>
              <div className="citem__price">{money(i.price)}</div>
            </div>
            <button onClick={() => removeItem(i.uid)} aria-label="Remove" style={{ background: "none", border: 0, color: "var(--bone-faint)", cursor: "pointer", alignSelf: "flex-start" }}><Icon name="close" size={16} /></button>
          </div>
        )) : <p className="cart-empty">Your cart is empty.<br />Every piece you add comes sealed.</p>}
      </Drawer>

      {/* Checkout */}
      <Modal open={checkout} onClose={closeCheckout} width="min(560px, 94vw)" label="Checkout">
        <div className="checkout">
          {order ? (
            <div className="ckdone">
              <Seal size={64} style={{ margin: "0 auto 1.2rem", color: "var(--brass)" }} />
              <h3>Sealed &amp; sent.</h3>
              <p>Your license and certificates are on the way.</p>
              <p className="oid">Order {order.id} · {order.count} work{order.count > 1 ? "s" : ""} · {money(order.total)}</p>
              <div style={{ marginTop: "1.6rem" }}><Button variant="ghost" onClick={closeCheckout}>Back to the market</Button></div>
            </div>
          ) : (
            <React.Fragment>
              <p className="checkout__eyebrow">Checkout</p>
              <h2 className="checkout__title">Complete your purchase.</h2>
              <div className="cksum">
                {cart.slice(0, 4).map((i) => <div className="ckline" key={i.uid}><span><b>{i.title}</b> — {i.licName}</span><span>{money(i.price)}</span></div>)}
                {cart.length > 4 ? <div className="ckline"><span>+ {cart.length - 4} more</span><span></span></div> : null}
                <div className="cktotal"><span>Total</span><span>{money(subtotal)}</span></div>
              </div>
              <form onSubmit={placeOrder}>
                <div className="ckfields">
                  <Field label="Email for receipt & license" htmlFor="ck-email" full><Input id="ck-email" type="email" required placeholder="you@studio.com" /></Field>
                  <Field label="Card number" htmlFor="ck-card" full><Input id="ck-card" required placeholder="4242 4242 4242 4242" /></Field>
                  <Field label="Expiry" htmlFor="ck-exp"><Input id="ck-exp" required placeholder="MM / YY" /></Field>
                  <Field label="CVC" htmlFor="ck-cvc"><Input id="ck-cvc" required placeholder="123" /></Field>
                </div>
                <Button variant="solid" type="submit" style={{ width: "100%" }} arrow>Pay {money(subtotal)}</Button>
                <p className="cknote">Demo checkout — no card is charged. On purchase, each work's seal is transferred to your account and its certificate emailed to you.</p>
              </form>
            </React.Fragment>
          )}
        </div>
      </Modal>

      <Toast show={!!toast}>{toast}</Toast>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

