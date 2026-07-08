/* @ds-bundle: {"format":4,"namespace":"SecurityArtsDesignSystem_f7e889","components":[{"name":"Marquee","sourcePath":"components/brand/Marquee.jsx"},{"name":"SEAL_SCALLOP","sourcePath":"components/brand/Seal.jsx"},{"name":"SEAL_STAR","sourcePath":"components/brand/Seal.jsx"},{"name":"Seal","sourcePath":"components/brand/Seal.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"ICON_PATHS","sourcePath":"components/core/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/Icon.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"SectionLabel","sourcePath":"components/core/SectionLabel.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"ThemeToggle","sourcePath":"components/core/ThemeToggle.jsx"},{"name":"Certificate","sourcePath":"components/feedback/Certificate.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"VerifiedBadge","sourcePath":"components/feedback/VerifiedBadge.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"LicenseOption","sourcePath":"components/forms/LicenseOption.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Drawer","sourcePath":"components/surfaces/Drawer.jsx"},{"name":"Modal","sourcePath":"components/surfaces/Modal.jsx"},{"name":"Pin","sourcePath":"components/surfaces/Pin.jsx"},{"name":"PracticeCard","sourcePath":"components/surfaces/PracticeCard.jsx"},{"name":"ProductCard","sourcePath":"components/surfaces/ProductCard.jsx"}],"sourceHashes":{"assets/catalog.js":"43ae205120ef","assets/genart.js":"d062e90af8d7","assets/store.js":"98a28fe9440d","assets/transition.js":"392bcac76fe8","components/brand/Marquee.jsx":"673e6167c7c7","components/brand/Seal.jsx":"3f249c623120","components/core/Avatar.jsx":"0ba586af0ddb","components/core/Button.jsx":"a5e7290a4a94","components/core/Chip.jsx":"5b16a4109577","components/core/Eyebrow.jsx":"0960a0c8a529","components/core/Icon.jsx":"0b01a6d15dcc","components/core/IconButton.jsx":"202a896192ca","components/core/SectionLabel.jsx":"8eaf424fc311","components/core/Tag.jsx":"fc1c0b115588","components/core/ThemeToggle.jsx":"3a399a330dfd","components/feedback/Certificate.jsx":"6962308523ea","components/feedback/Toast.jsx":"b1458f5f47c0","components/feedback/VerifiedBadge.jsx":"ecc4f85de3e2","components/forms/Field.jsx":"8400ab2927a5","components/forms/Input.jsx":"0fcf69aa2a58","components/forms/LicenseOption.jsx":"18947671b67a","components/forms/Select.jsx":"5f2f49e9c672","components/surfaces/Drawer.jsx":"9455f5f27a85","components/surfaces/Modal.jsx":"6edf365da06a","components/surfaces/Pin.jsx":"86e7a0a434bf","components/surfaces/PracticeCard.jsx":"118398677173","components/surfaces/ProductCard.jsx":"a384f326c962"},"inlinedExternals":[],"unexposedExports":[{"name":"applyTheme","sourcePath":"components/core/ThemeToggle.jsx"}]} */

(() => {

const __ds_ns = (window.SecurityArtsDesignSystem_f7e889 = window.SecurityArtsDesignSystem_f7e889 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/catalog.js
try { (() => {
/* ============================================================
   SecurityArts — shared catalog
   A deterministic set of artists and their verified works, used across
   Discover, Profile, For You, DMs and Market so ids line up and the flow
   (click a work → its artist's profile → follow / DM) is coherent.
   window.SACatalog = { artists, works, artistById, worksByArtist, workById }
   ============================================================ */
(function () {
  "use strict";

  const ARTISTS = [{
    id: "ines-vela",
    name: "Ines Vela",
    handle: "inesvela",
    city: "Lisbon, PT",
    cat: "painting",
    bio: "Oil painter working in long tides of color. Every canvas sealed at the studio, never a print without provenance.",
    tags: ["Oil on linen", "Abstract", "Seascape"]
  }, {
    id: "kofi-mensah",
    name: "Kofi Mensah",
    handle: "kofimake",
    city: "Accra, GH",
    cat: "3d",
    bio: "Building quiet machines and impossible fields in 3D. Hand-modelled, human-signed.",
    tags: ["3D render", "Surreal", "Architectural"]
  }, {
    id: "mara-okafor",
    name: "Mara Okafor",
    handle: "maradraws",
    city: "Lagos, NG",
    cat: "illustration",
    bio: "Illustrator of folktales and city mornings. Ink first, colour later.",
    tags: ["Illustration", "Editorial", "Folk"]
  }, {
    id: "theo-brandt",
    name: "Theo Brandt",
    handle: "theob",
    city: "Berlin, DE",
    cat: "photography",
    bio: "35mm photographer chasing the last light. Grain kept, never smoothed.",
    tags: ["35mm", "Documentary", "Night"]
  }, {
    id: "yuki-sato",
    name: "Yuki Sato",
    handle: "yukisato",
    city: "Kyoto, JP",
    cat: "lettering",
    bio: "Letterer and sign painter. One brush, one breath, one stroke.",
    tags: ["Hand lettering", "Brush", "Type"]
  }, {
    id: "lena-lindqvist",
    name: "Lena Lindqvist",
    handle: "lenalind",
    city: "Stockholm, SE",
    cat: "concept",
    bio: "Concept artist for worlds that don't exist yet. Cold palettes, warm intentions.",
    tags: ["Concept art", "Environment", "Sci-fi"]
  }, {
    id: "diego-reyes",
    name: "Diego Reyes",
    handle: "dreyes",
    city: "Mexico City, MX",
    cat: "mixed",
    bio: "Mixed-media collagist. Paper, paint, and found things, held together by hand.",
    tags: ["Mixed media", "Collage", "Texture"]
  }, {
    id: "amara-adeyemi",
    name: "Amara Adeyemi",
    handle: "amaraa",
    city: "Nairobi, KE",
    cat: "painting",
    bio: "Painter of interiors and the light that visits them.",
    tags: ["Acrylic", "Interior", "Warm"]
  }, {
    id: "sol-moreau",
    name: "Sol Moreau",
    handle: "solmoreau",
    city: "Paris, FR",
    cat: "illustration",
    bio: "Illustrator with a soft spot for margins, birds, and small machines.",
    tags: ["Illustration", "Line", "Whimsy"]
  }, {
    id: "rune-haddad",
    name: "Rune Haddad",
    handle: "runeh",
    city: "Beirut, LB",
    cat: "3d",
    bio: "Sculpting light in 3D. Foundries, ribbons, and slow tangerine skies.",
    tags: ["3D render", "Abstract", "Light"]
  }, {
    id: "priya-kapoor",
    name: "Priya Kapoor",
    handle: "priyak",
    city: "Mumbai, IN",
    cat: "photography",
    bio: "Street and monsoon photographer. Held breath, pressed shutter.",
    tags: ["35mm", "Street", "Monsoon"]
  }, {
    id: "noa-petrova",
    name: "Noa Petrova",
    handle: "noap",
    city: "Tbilisi, GE",
    cat: "concept",
    bio: "Concept and matte painting. Mapping cities that only exist at dusk.",
    tags: ["Concept art", "Matte", "Cities"]
  }];

  // [artistId, title, category, basePrice]
  const RAW = [["ines-vela", "Low Tide, No.4", "painting", 420], ["ines-vela", "Salt & Iron", "painting", 380], ["ines-vela", "Held Breath", "painting", 540], ["kofi-mensah", "The Long Field", "3d", 180], ["kofi-mensah", "Quiet Engine", "3d", 240], ["kofi-mensah", "Carrier Signal", "3d", 300], ["mara-okafor", "Index of Birds", "illustration", 160], ["mara-okafor", "Paper Sun", "illustration", 140], ["mara-okafor", "Margin Notes", "illustration", 120], ["theo-brandt", "Nocturne for a City", "photography", 220], ["theo-brandt", "Warm Static", "photography", 200], ["theo-brandt", "Afterimage", "photography", 260], ["yuki-sato", "Foundry", "lettering", 300], ["yuki-sato", "One Breath", "lettering", 340], ["lena-lindqvist", "Cartographer", "concept", 280], ["lena-lindqvist", "Cold Harbor", "concept", 320], ["lena-lindqvist", "Folded Light", "concept", 360], ["diego-reyes", "Ribbon of Smoke", "mixed", 190], ["diego-reyes", "Foundling", "mixed", 210], ["amara-adeyemi", "Slow Tangerine", "painting", 400], ["amara-adeyemi", "The Visitor", "painting", 460], ["sol-moreau", "Static Bloom", "illustration", 150], ["sol-moreau", "Small Machines", "illustration", 170], ["rune-haddad", "Molten Ribbon", "3d", 260], ["rune-haddad", "Slow Tangerine Sky", "3d", 290], ["priya-kapoor", "Monsoon, 6am", "photography", 210], ["priya-kapoor", "Held City", "photography", 230], ["noa-petrova", "City at Dusk", "concept", 300], ["noa-petrova", "Index of Cities", "concept", 340]];
  const MEDIUM = {
    illustration: "Digital illustration",
    painting: "Oil on linen",
    "3d": "3D render",
    photography: "35mm photograph",
    lettering: "Hand lettering",
    concept: "Concept art",
    mixed: "Mixed media"
  };
  const works = RAW.map((r, i) => ({
    id: "w" + i,
    artistId: r[0],
    title: r[1],
    cat: r[2],
    price: r[3],
    medium: MEDIUM[r[2]] || "Original work",
    seed: i * 7 + 3
  }));
  const artistById = {};
  ARTISTS.forEach(a => {
    artistById[a.id] = a;
  });
  const workById = {};
  works.forEach(w => {
    workById[w.id] = w;
  });
  const worksByArtist = {};
  works.forEach(w => {
    (worksByArtist[w.artistId] = worksByArtist[w.artistId] || []).push(w);
  });
  // derive a stat count per artist so numbers stay stable
  ARTISTS.forEach(a => {
    const h = a.id.split("").reduce((s, c) => s * 31 + c.charCodeAt(0) | 0, 7);
    a.followers = 400 + Math.abs(h) % 8600;
    a.following = 40 + Math.abs(h >> 3) % 260;
    a.works = (worksByArtist[a.id] || []).length;
  });
  window.SACatalog = {
    artists: ARTISTS,
    works,
    artistById,
    worksByArtist,
    workById,
    MEDIUM
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/catalog.js", error: String((e && e.message) || e) }); }

// assets/genart.js
try { (() => {
/* ============================================================
   SecurityArts — generative placeholder art
   Copied from the product source (discover.html / market.html). These
   deterministic tiles stand in for real uploaded works in specimens and
   UI-kit demos — the brand's own placeholder visual language. Real works
   replace them with photographs/scans.

   Usage:
     SAGenArt.svg(seed)                -> "<svg …>…</svg>" string
     SAGenArt.svg(seed, { cat })       -> generator chosen to fit a category
     SAGenArt.dataUri(seed)            -> "data:image/svg+xml,…" for <img src>
   ============================================================ */
(function () {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shade(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) {
      return x + x;
    }).join('');
    var n = parseInt(c, 16),
      r = n >> 16 & 255,
      g = n >> 8 & 255,
      b = n & 255;
    var f = amt < 0 ? 0 : 255,
      t = Math.abs(amt) / 100;
    r = Math.round((f - r) * t) + r;
    g = Math.round((f - g) * t) + g;
    b = Math.round((f - b) * t) + b;
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  var PAL = [{
    bg: '#1f7a55',
    fg: '#e8e4d8',
    accent: '#c2a14e'
  }, {
    bg: '#b23a2c',
    fg: '#f4f1e9',
    accent: '#100f0e'
  }, {
    bg: '#3667cf',
    fg: '#e8e4d8',
    accent: '#c2a14e'
  }, {
    bg: '#a8862a',
    fg: '#100f0e',
    accent: '#f4f1e9'
  }, {
    bg: '#0c0c0b',
    fg: '#c2a14e',
    accent: '#b23a2c'
  }, {
    bg: '#e8e4d8',
    fg: '#100f0e',
    accent: '#b23a2c'
  }, {
    bg: '#7c7468',
    fg: '#f4f1e9',
    accent: '#100f0e'
  }, {
    bg: '#15302a',
    fg: '#c2a14e',
    accent: '#1f7a55'
  }, {
    bg: '#2a1d16',
    fg: '#c2a14e',
    accent: '#b23a2c'
  }, {
    bg: '#1a2740',
    fg: '#e8e4d8',
    accent: '#c2a14e'
  }];
  function aField(p, r) {
    var cx = 80 + r() * 240,
      cy = 120 + r() * 360,
      rad = 170 + r() * 200,
      cx2 = r() * 400,
      cy2 = 220 + r() * 360,
      rad2 = 120 + r() * 170;
    return "<rect width='400' height='600' fill='" + shade(p.bg, -22) + "'/><circle cx='" + cx2 + "' cy='" + cy2 + "' r='" + rad2 + "' fill='" + p.fg + "' opacity='0.16'/><circle cx='" + cx + "' cy='" + cy + "' r='" + rad + "' fill='" + p.accent + "' opacity='0.6'/><circle cx='" + cx + "' cy='" + cy + "' r='" + rad * 0.46 + "' fill='" + p.fg + "' opacity='0.92'/>";
  }
  function aArcs(p, r) {
    var cx = 140 + r() * 120,
      cy = 200 + r() * 200,
      n = 5 + (r() * 4 | 0),
      s = "<rect width='400' height='600' fill='" + p.bg + "'/>";
    for (var i = 0; i < n; i++) s += "<circle cx='" + cx + "' cy='" + cy + "' r='" + (50 + i * (46 + r() * 22)) + "' fill='none' stroke='" + (i % 2 ? p.accent : p.fg) + "' stroke-width='" + (4 + r() * 7).toFixed(1) + "' opacity='" + (0.45 + 0.4 * r()).toFixed(2) + "'/>";
    return s + "<circle cx='" + cx + "' cy='" + cy + "' r='30' fill='" + p.accent + "'/>";
  }
  function aBau(p, r) {
    var s = "<rect width='400' height='600' fill='" + p.bg + "'/>";
    s += "<circle cx='" + (90 + r() * 200) + "' cy='" + (140 + r() * 130) + "' r='" + (85 + r() * 70) + "' fill='" + p.accent + "'/>";
    s += "<path d='M0 " + (380 + r() * 120) + " a 200 200 0 0 1 400 0 Z' fill='" + p.fg + "' opacity='0.92'/>";
    s += "<polygon points='" + r() * 180 + ",90 " + (300 + r() * 80) + ",300 70,360' fill='" + p.accent + "' opacity='0.75'/>";
    s += "<rect x='" + r() * 260 + "' y='" + (60 + r() * 80) + "' width='" + (34 + r() * 36) + "' height='540' fill='" + p.fg + "' opacity='0.55'/>";
    return s;
  }
  function aPoster(p, r) {
    var G = 'AKMRSVZBQGW&',
      g = G[r() * G.length | 0];
    return "<rect width='400' height='600' fill='" + p.bg + "'/><text x='200' y='405' text-anchor='middle' font-family='Fraunces, serif' font-size='440' font-weight='500' fill='" + p.fg + "'>" + g + "</text><rect x='40' y='520' width='" + (110 + r() * 170 | 0) + "' height='6' fill='" + p.accent + "'/>";
  }
  function aWaves(p, r) {
    var cols = [shade(p.bg, 14), p.accent, p.fg, shade(p.bg, -16), p.accent],
      s = "<rect width='400' height='600' fill='" + p.bg + "'/>",
      base = 110 + r() * 60;
    for (var i = 0; i < 6; i++) {
      var yy = base + i * 78,
        amp = 18 + r() * 42;
      s += "<path d='M0 " + yy.toFixed(0) + " C 130 " + (yy - amp).toFixed(0) + ", 270 " + (yy + amp).toFixed(0) + ", 400 " + yy.toFixed(0) + " L400 600 L0 600 Z' fill='" + cols[i % cols.length] + "' opacity='0.9'/>";
    }
    return s;
  }
  function aHalf(p, r) {
    var s = "<rect width='400' height='600' fill='" + p.bg + "'/>",
      gap = 38,
      ph = r() * 6.28;
    for (var y = 0; y < 600; y += gap) for (var x = 0; x < 400; x += gap) {
      var t = (x / 400 + y / 600) / 2,
        rad = 2 + t * 14 * (0.55 + 0.7 * Math.abs(Math.sin(x * 0.05 + y * 0.04 + ph)));
      s += "<circle cx='" + (x + gap / 2) + "' cy='" + (y + gap / 2) + "' r='" + rad.toFixed(1) + "' fill='" + p.fg + "'/>";
    }
    return s + "<circle cx='" + (110 + r() * 180 | 0) + "' cy='" + (150 + r() * 260 | 0) + "' r='42' fill='" + p.accent + "'/>";
  }
  var GENS = {
    field: aField,
    arcs: aArcs,
    bau: aBau,
    poster: aPoster,
    waves: aWaves,
    half: aHalf
  };
  var GEN_BY_CAT = {
    illustration: ['bau', 'half', 'field'],
    painting: ['field', 'waves'],
    '3d': ['arcs', 'bau'],
    photography: ['field', 'half'],
    lettering: ['poster'],
    concept: ['waves', 'arcs', 'field'],
    mixed: ['half', 'bau', 'waves']
  };
  var GEN_KEYS = Object.keys(GENS);
  function inner(seed, opts) {
    opts = opts || {};
    var s = typeof seed === 'string' ? hashStr(seed) : seed | 0;
    var r0 = mulberry32(s * 2654435761 + 12345);
    var pal = PAL[Math.abs(s * 3 + (r0() * PAL.length | 0)) % PAL.length];
    var key;
    if (opts.gen && GENS[opts.gen]) key = opts.gen;else if (opts.cat && GEN_BY_CAT[opts.cat]) {
      var pool = GEN_BY_CAT[opts.cat];
      key = pool[r0() * pool.length | 0];
    } else key = GEN_KEYS[Math.abs(s) % GEN_KEYS.length];
    return GENS[key](pal, mulberry32(Math.abs(s) * 99 + 7));
  }
  function hashStr(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h;
  }
  function svg(seed, opts) {
    return "<svg viewBox='0 0 400 600' preserveAspectRatio='xMidYMid slice' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style='width:100%;height:100%;display:block'>" + inner(seed, opts) + "</svg>";
  }
  function dataUri(seed, opts) {
    return "data:image/svg+xml," + encodeURIComponent(svg(seed, opts));
  }
  window.SAGenArt = {
    svg: svg,
    dataUri: dataUri,
    PAL: PAL,
    GEN_KEYS: GEN_KEYS,
    hashStr: hashStr
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/genart.js", error: String((e && e.message) || e) }); }

// assets/store.js
try { (() => {
/* ============================================================
   SecurityArts — shared client store (demo)
   A tiny localStorage-backed store shared across Discover, Profile, For You
   and DMs so actions persist and interconnect: likes drive the For You feed,
   follows show on profiles, and a DM request from a profile appears in DMs.

   window.SAStore — methods below. Subscribe with SAStore.subscribe(fn) or the
   "sa-store-change" window event. Not production state — a believable mock.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "sa-store-v1";
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s._v === 1) return s;
    } catch (e) {}
    return seed();
  }
  function seed() {
    var now = Date.now();
    return {
      _v: 1,
      seeded: true,
      likes: [],
      follows: [],
      seen: [],
      threads: {
        // one live conversation
        "ines-vela": {
          status: "active",
          unread: 0,
          messages: [{
            from: "them",
            text: "Thank you for saving Low Tide — it's part of a triptych I'm sealing this week.",
            ts: now - 1000 * 60 * 60 * 26
          }, {
            from: "me",
            text: "It's beautiful. Is the third piece going to the market?",
            ts: now - 1000 * 60 * 60 * 25
          }, {
            from: "them",
            text: "Yes — verified Friday. I'll send you the seal first.",
            ts: now - 1000 * 60 * 60 * 24
          }]
        },
        // one incoming request (someone messaging you)
        "theo-brandt": {
          status: "incoming",
          unread: 1,
          messages: [{
            from: "them",
            text: "Hi — saw you saved a couple of my night frames. Would love to send you a print set. Open to a request?",
            ts: now - 1000 * 60 * 90
          }]
        }
      }
    };
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("sa-store-change", {
      detail: state
    }));
    subs.forEach(function (fn) {
      try {
        fn(state);
      } catch (e) {}
    });
  }
  var subs = [];
  function subscribe(fn) {
    subs.push(fn);
    return function () {
      subs = subs.filter(function (f) {
        return f !== fn;
      });
    };
  }

  // ── Likes ──────────────────────────────────────────────
  function isLiked(id) {
    return state.likes.indexOf(id) !== -1;
  }
  function toggleLike(id) {
    var i = state.likes.indexOf(id);
    if (i === -1) state.likes.unshift(id);else state.likes.splice(i, 1);
    save();
    return isLiked(id);
  }
  // ── Follows ────────────────────────────────────────────
  function isFollowing(id) {
    return state.follows.indexOf(id) !== -1;
  }
  function toggleFollow(id) {
    var i = state.follows.indexOf(id);
    if (i === -1) state.follows.unshift(id);else state.follows.splice(i, 1);
    save();
    return isFollowing(id);
  }
  // ── Seen (for "you've been looking at…") ───────────────
  function addSeen(id) {
    state.seen = [id].concat(state.seen.filter(function (x) {
      return x !== id;
    })).slice(0, 60);
    save();
  }
  // ── DMs ────────────────────────────────────────────────
  function getThread(artistId) {
    return state.threads[artistId] || null;
  }
  function threadList() {
    return Object.keys(state.threads).map(function (id) {
      var t = state.threads[id];
      var last = t.messages[t.messages.length - 1];
      return {
        artistId: id,
        status: t.status,
        unread: t.unread || 0,
        last: last,
        messages: t.messages
      };
    }).sort(function (a, b) {
      return (b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0);
    });
  }
  function requestDM(artistId, text) {
    var t = state.threads[artistId];
    if (!t) {
      t = state.threads[artistId] = {
        status: "requested",
        unread: 0,
        messages: []
      };
    }
    if (t.status === "incoming") t.status = "active"; // replying accepts
    else if (!t.messages.length) t.status = "requested";
    t.messages.push({
      from: "me",
      text: text,
      ts: Date.now()
    });
    save();
    return t;
  }
  function sendMessage(artistId, text) {
    return requestDM(artistId, text);
  }
  function accept(artistId) {
    var t = state.threads[artistId];
    if (t) {
      t.status = "active";
      t.unread = 0;
      save();
    }
  }
  function decline(artistId) {
    if (state.threads[artistId]) {
      delete state.threads[artistId];
      save();
    }
  }
  function markRead(artistId) {
    var t = state.threads[artistId];
    if (t && t.unread) {
      t.unread = 0;
      save();
    }
  }
  function counts() {
    var pending = 0;
    Object.keys(state.threads).forEach(function (id) {
      if (state.threads[id].status === "incoming") pending++;
    });
    var active = 0;
    Object.keys(state.threads).forEach(function (id) {
      if (state.threads[id].status !== "incoming") active++;
    });
    return {
      likes: state.likes.length,
      follows: state.follows.length,
      pending: pending,
      threads: active
    };
  }
  function reset() {
    state = seed();
    save();
  }
  window.SAStore = {
    get: function () {
      return state;
    },
    subscribe: subscribe,
    isLiked: isLiked,
    toggleLike: toggleLike,
    likes: function () {
      return state.likes.slice();
    },
    isFollowing: isFollowing,
    toggleFollow: toggleFollow,
    follows: function () {
      return state.follows.slice();
    },
    addSeen: addSeen,
    seen: function () {
      return state.seen.slice();
    },
    getThread: getThread,
    threadList: threadList,
    requestDM: requestDM,
    sendMessage: sendMessage,
    accept: accept,
    decline: decline,
    markRead: markRead,
    counts: counts,
    reset: reset
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/store.js", error: String((e && e.message) || e) }); }

// assets/transition.js
try { (() => {
/* ============================================================
   SecurityArts — seal page transition
   A wax-seal stamp flies across the screen and presses down before a page is
   shown; on navigation it sweeps across as the page hands off. Self-contained
   (no bundle dependency), theme-aware (uses --ink / --bone / --brass), and
   disabled under prefers-reduced-motion. Include on every page:
     <script src="../../assets/transition.js"></script>
   ============================================================ */
(function () {
  "use strict";

  if (window.__saTransition) return;
  window.__saTransition = true;
  var EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var reduce = false;
  try {
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}
  var SEAL = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' + '<path fill="none" stroke="currentColor" stroke-width="2.1" d="M 50 13 A 7.22 7.22 0 0 1 64.16 15.82 A 7.22 7.22 0 0 1 76.16 23.84 A 7.22 7.22 0 0 1 84.18 35.84 A 7.22 7.22 0 0 1 87 50 A 7.22 7.22 0 0 1 84.18 64.16 A 7.22 7.22 0 0 1 76.16 76.16 A 7.22 7.22 0 0 1 64.16 84.18 A 7.22 7.22 0 0 1 50 87 A 7.22 7.22 0 0 1 35.84 84.18 A 7.22 7.22 0 0 1 23.84 76.16 A 7.22 7.22 0 0 1 15.82 64.16 A 7.22 7.22 0 0 1 13 50 A 7.22 7.22 0 0 1 15.82 35.84 A 7.22 7.22 0 0 1 23.84 23.84 A 7.22 7.22 0 0 1 35.84 15.82 A 7.22 7.22 0 0 1 50 13 Z"/>' + '<circle fill="none" stroke="currentColor" stroke-width="1.5" cx="50" cy="50" r="27"/>' + '<path fill="currentColor" d="M 50 34.5 L 53.76 44.82 L 64.74 45.21 L 56.09 51.98 L 59.11 62.54 L 50 56.4 L 40.89 62.54 L 43.91 51.98 L 35.26 45.21 L 46.24 44.82 Z"/></svg>';
  var css = "@keyframes saFlyIn{0%{transform:translateX(-82vw) rotate(-170deg) scale(.45);opacity:0}24%{opacity:1}70%{transform:translateX(0) rotate(0) scale(1.06)}100%{transform:translateX(0) rotate(0) scale(1)}}" + "@keyframes saPunch{0%{transform:scale(1)}45%{transform:scale(1.16)}100%{transform:scale(1)}}" + "@keyframes saRipple{0%{transform:scale(.5);opacity:.55}100%{transform:scale(2.3);opacity:0}}" + "@keyframes saSweep{0%{transform:translateX(-84vw) rotate(-180deg) scale(.5);opacity:0}22%{opacity:1}100%{transform:translateX(88vw) rotate(220deg) scale(.85);opacity:0}}" + "@keyframes saCover{0%{opacity:0}100%{opacity:1}}" + "@keyframes saReveal{0%{opacity:1}100%{opacity:0}}" + "@keyframes saWord{0%{opacity:0;letter-spacing:.5em}60%{opacity:0}100%{opacity:1;letter-spacing:.22em}}" + ".sa-tr{position:fixed;inset:0;z-index:99999;display:none;place-items:center;background:var(--ink,#0c0c0b);overflow:hidden}" + ".sa-tr.on{display:grid}" + ".sa-tr__stage{position:relative;display:grid;place-items:center;gap:1.1rem;text-align:center}" + ".sa-tr__seal{position:relative;width:clamp(92px,16vw,176px);height:clamp(92px,16vw,176px);color:var(--bone,#f4f1e9);will-change:transform,opacity}" + ".sa-tr__seal::after{content:'';position:absolute;inset:-8%;border-radius:50%;border:1.5px solid var(--brass,#c2a14e);opacity:0}" + ".sa-tr__word{font-family:var(--font-mono,monospace);font-size:.66rem;text-transform:uppercase;letter-spacing:.22em;color:var(--bone-dim,#a39e92);opacity:0}" + ".sa-tr[data-mode='enter'] .sa-tr__seal{animation:saFlyIn .64s " + EASE + " both, saPunch .32s " + EASE + " .60s both}" + ".sa-tr[data-mode='enter'] .sa-tr__seal::after{animation:saRipple .6s " + EASE + " .62s both}" + ".sa-tr[data-mode='enter'] .sa-tr__word{animation:saWord .6s " + EASE + " .5s both}" + ".sa-tr[data-mode='exit']{animation:saCover .2s " + EASE + " both}" + ".sa-tr[data-mode='exit'] .sa-tr__seal{animation:saSweep .6s " + EASE + " both}" + ".sa-tr[data-mode='exit'] .sa-tr__word{display:none}" + ".sa-tr.is-reveal{animation:saReveal .44s " + EASE + " both;pointer-events:none}";
  var style = document.createElement("style");
  style.textContent = css;
  var ov = document.createElement("div");
  ov.className = "sa-tr";
  ov.innerHTML = '<div class="sa-tr__stage"><span class="sa-tr__seal">' + SEAL + '</span><span class="sa-tr__word">SecurityArts</span></div>';
  function mount() {
    document.head.appendChild(style);
    document.body.appendChild(ov);
    enter();
  }
  if (document.body) mount();else document.addEventListener("DOMContentLoaded", mount);
  function enter() {
    if (reduce) return;
    ov.setAttribute("data-mode", "enter");
    ov.classList.add("on");
    setTimeout(function () {
      ov.classList.add("is-reveal");
    }, 800);
    setTimeout(function () {
      ov.classList.remove("on", "is-reveal");
      ov.removeAttribute("data-mode");
    }, 1280);
  }
  function exit(href) {
    if (reduce) {
      window.location.href = href;
      return;
    }
    ov.classList.remove("is-reveal");
    ov.setAttribute("data-mode", "exit");
    ov.classList.add("on");
    var go = function () {
      window.location.href = href;
    };
    setTimeout(go, 560);
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.host && a.host !== window.location.host) return; // external origin
    if (a.href === window.location.href) return; // same page
    if (a.pathname === window.location.pathname && a.hash) return; // in-page anchor
    e.preventDefault();
    exit(a.href);
  }, true);

  // Coming back via bfcache: never leave the overlay stuck on.
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) {
      ov.classList.remove("on", "is-reveal");
      ov.removeAttribute("data-mode");
    }
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/transition.js", error: String((e && e.message) || e) }); }

// components/brand/Seal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SEAL_PATHS — the SecurityArts mark, copied verbatim from the product source.
 * A scalloped wax-seal rosette (16 lobes) + inner ring + 5-point star, drawn in
 * a 0–100 viewBox so stroke widths read as absolute at any rendered size.
 */
const SEAL_SCALLOP = "M 50.00 13.00 A 7.22 7.22 0 0 1 64.16 15.82 A 7.22 7.22 0 0 1 76.16 23.84 A 7.22 7.22 0 0 1 84.18 35.84 A 7.22 7.22 0 0 1 87.00 50.00 A 7.22 7.22 0 0 1 84.18 64.16 A 7.22 7.22 0 0 1 76.16 76.16 A 7.22 7.22 0 0 1 64.16 84.18 A 7.22 7.22 0 0 1 50.00 87.00 A 7.22 7.22 0 0 1 35.84 84.18 A 7.22 7.22 0 0 1 23.84 76.16 A 7.22 7.22 0 0 1 15.82 64.16 A 7.22 7.22 0 0 1 13.00 50.00 A 7.22 7.22 0 0 1 15.82 35.84 A 7.22 7.22 0 0 1 23.84 23.84 A 7.22 7.22 0 0 1 35.84 15.82 A 7.22 7.22 0 0 1 50.00 13.00 Z";
const SEAL_STAR = "M 50.00 34.50 L 53.76 44.82 L 64.74 45.21 L 56.09 51.98 L 59.11 62.54 L 50.00 56.40 L 40.89 62.54 L 43.91 51.98 L 35.26 45.21 L 46.24 44.82 Z";

/**
 * Seal — the SecurityArts brand mark.
 *
 * Single-ink and contrast-aware: it always draws in `currentColor`, so it takes
 * the ink of whatever surface it sits on (bone on ink, jet on cream). Never
 * recolor the scallop and star independently — the mark is one ink by design.
 */
function Seal({
  size = 32,
  spin = false,
  spinDuration,
  scallopWidth = 2.1,
  ringWidth = 1.5,
  title,
  className,
  style,
  ...rest
}) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const animation = spin ? `sa-seal-spin ${spinDuration || "var(--spin-dur, 90s)"} linear infinite` : undefined;
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 100 100",
    width: dim,
    height: dim,
    className: className,
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
    focusable: "false",
    style: {
      display: "block",
      color: "inherit",
      overflow: "visible",
      flex: "0 0 auto",
      animation,
      ...style
    }
  }, rest), title ? /*#__PURE__*/React.createElement("title", null, title) : null, /*#__PURE__*/React.createElement("path", {
    d: SEAL_SCALLOP,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: scallopWidth
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "27",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: ringWidth
  }), /*#__PURE__*/React.createElement("path", {
    d: SEAL_STAR,
    fill: "currentColor",
    stroke: "none"
  }));
}
Object.assign(__ds_scope, { SEAL_SCALLOP, SEAL_STAR, Seal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Seal.jsx", error: String((e && e.message) || e) }); }

// components/brand/Marquee.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-marquee { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); overflow: hidden; padding: 1.15rem 0; background: var(--ink-2); }
.sa-marquee__track { display: flex; align-items: center; gap: 2.5rem; width: max-content; animation: sa-marquee var(--sa-marquee-dur, 48s) linear infinite; }
.sa-marquee:hover .sa-marquee__track { animation-play-state: paused; }
.sa-marquee__item { font-family: var(--font-serif, serif); font-size: clamp(1.3rem, 3vw, 2.1rem); font-weight: 360; letter-spacing: -0.01em; color: var(--bone); white-space: nowrap; }
.sa-marquee__tick { color: var(--brass); flex: 0 0 auto; }
@keyframes sa-marquee { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .sa-marquee__track { animation: none; } }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-marquee-css")) {
  const s = document.createElement("style");
  s.id = "sa-marquee-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Marquee — the endless serif ticker of disciplines, each item followed by a
 * brass seal. Pauses on hover, and freezes for reduced-motion. Pass `items` as
 * an array of strings; the list is duplicated internally for a seamless loop.
 */
function Marquee({
  items = [],
  duration = "48s",
  className = "",
  style,
  ...rest
}) {
  const loop = [...items, ...items];
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `sa-marquee ${className}`.trim(),
    style: {
      "--sa-marquee-dur": duration,
      ...style
    },
    "aria-hidden": "true"
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-marquee__track"
  }, loop.map((it, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-marquee__item"
  }, it), /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: 22,
    className: "sa-marquee__tick"
  })))));
}
Object.assign(__ds_scope, { Marquee, __ds_default_components_brand_Marquee_bx5azk: Marquee });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Marquee.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Deterministic warm tint from a name/seed — stays within the studio palette. */
const TINTS = [["#2a2622", "#c2a14e"], ["#22281f", "#9db08a"], ["#2a1f1c", "#d98a72"], ["#20262c", "#8fb0c8"], ["#2a2618", "#c2a14e"], ["#261f28", "#b79ec8"]];
function hash(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h);
}
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * Avatar — a round identity chip for artists and viewers. Renders a monogram
 * (Fraunces initials on a deterministic warm tint) or an image if `src` is set.
 * `verified` adds a brass ring with a seal notch; `ring` adds a plain accent ring.
 * No faces are drawn — the studio identity stays abstract and typographic.
 */
function Avatar({
  name,
  src,
  size = 44,
  verified = false,
  ring = false,
  className = "",
  style,
  ...rest
}) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const [bg, fg] = TINTS[hash(name || src || "x") % TINTS.length];
  const border = verified ? "var(--brass)" : ring ? "var(--brass)" : "var(--line-strong)";
  const bw = verified ? 2 : 1;
  const fontSize = `calc(${dim} * 0.4)`;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `sa-avatar ${className}`.trim(),
    style: {
      position: "relative",
      display: "inline-grid",
      placeItems: "center",
      flex: "0 0 auto",
      width: dim,
      height: dim,
      borderRadius: "50%",
      overflow: "hidden",
      background: src ? "var(--ink-3)" : bg,
      color: fg,
      border: `${bw}px solid ${border}`,
      fontFamily: "var(--font-serif, serif)",
      fontWeight: 500,
      fontSize,
      letterSpacing: "-0.01em",
      userSelect: "none",
      ...style
    },
    title: name
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials(name), verified ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      right: "-2%",
      bottom: "-2%",
      width: `calc(${dim} * 0.42)`,
      height: `calc(${dim} * 0.42)`,
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      background: "var(--ink)",
      border: "1.5px solid var(--ink)",
      color: "var(--brass)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: "86%"
  })) : null);
}
Object.assign(__ds_scope, { Avatar, __ds_default_components_core_Avatar_4ed3sh: Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-chip {
  flex: 0 0 auto; cursor: pointer; white-space: nowrap;
  font-family: var(--font-mono, monospace); font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: var(--ls-mono, 0.1em);
  color: var(--bone-dim); background: none;
  border: 1px solid var(--line-strong); border-radius: var(--radius-pill, 100px);
  padding: 0.55rem 0.9rem; line-height: 1;
  transition: color var(--dur-fast,0.25s) var(--ease), background var(--dur-fast,0.25s) var(--ease), border-color var(--dur-fast,0.25s) var(--ease);
}
.sa-chip:hover { color: var(--bone); border-color: var(--bone); }
.sa-chip:focus-visible { outline: 2px solid var(--focus-ring,#c2a14e); outline-offset: 3px; }
.sa-chip[aria-pressed="true"] { background: var(--bone); color: var(--ink); border-color: var(--bone); }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-chip-css")) {
  const s = document.createElement("style");
  s.id = "sa-chip-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Chip — a filter toggle used in the discover/market toolbars. Mono, uppercase,
 * pill-shaped. The active chip fills bone; inactive chips are outlined and dim.
 * Controlled via `active`.
 */
function Chip({
  children,
  active = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: `sa-chip ${className}`.trim(),
    "aria-pressed": active
  }, rest), children);
}
Object.assign(__ds_scope, { Chip, __ds_default_components_core_Chip_pwdwza: Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Eyebrow — the small mono kicker above a headline, led by a glowing brass dot.
 * `tone="brass"` tints the label brass (used on app intros); the default is dim
 * ink (used on the marketing site). Set `dot={false}` to drop the dot.
 */
function Eyebrow({
  children,
  tone = "dim",
  dot = true,
  className = "",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    className: `sa-eyebrow ${className}`.trim(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.6rem",
      fontFamily: "var(--font-mono, monospace)",
      fontWeight: 500,
      fontSize: "0.72rem",
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      color: tone === "brass" ? "var(--brass)" : "var(--bone-dim)",
      margin: 0,
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: "7px",
      height: "7px",
      borderRadius: "50%",
      background: "var(--brass)",
      boxShadow: "0 0 0 4px var(--brass-glow, rgba(194,161,78,0.16))",
      flex: "0 0 auto"
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Eyebrow, __ds_default_components_core_Eyebrow_jini1b: Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SecurityArts uses a small set of Lucide-style line icons (2px stroke, round
 * caps/joins, 24×24 viewBox) alongside the brand Seal. This registry holds the
 * exact glyphs the product uses. Add new glyphs here rather than dropping raw
 * <svg> into screens, so weight and sizing stay consistent.
 *
 * Icons are outline (stroke) by design — do not fill them.
 */
const ICON_PATHS = {
  search: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.3-4.3"
  })),
  cart: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 6h15l-1.5 9h-12z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "20",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "20",
    r: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 6 5 3H2"
  })),
  board: /*#__PURE__*/React.createElement("path", {
    d: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
  }),
  shieldCheck: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3 4 6v6c0 4.5 3.4 7.6 8 9 4.6-1.4 8-4.5 8-9V6l-8-3Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 12 2 2 4-4"
  })),
  close: /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }),
  trash: /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }),
  check: /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }),
  plus: /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }),
  minus: /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }),
  arrowRight: /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 6l6 6-6 6"
  }),
  arrowLeft: /*#__PURE__*/React.createElement("path", {
    d: "M19 12H5M11 6l-6 6 6 6"
  }),
  chevronDown: /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }),
  external: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M15 3h6v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14 21 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
  })),
  heart: /*#__PURE__*/React.createElement("path", {
    d: "M12 20s-7-4.4-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C19 15.6 12 20 12 20Z"
  }),
  user: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21c0-4 3.6-7 8-7s8 3 8 7"
  })),
  userPlus: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 21c0-3.9 3.1-7 7-7 1.3 0 2.6.4 3.7 1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 11v6M14 14h6"
  })),
  message: /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5a8 8 0 0 1-11.6 7.1L3 21l2.4-6.4A8 8 0 1 1 21 11.5Z"
  }),
  send: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M22 2 11 13"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 2 15 22l-4-9-9-4Z"
  })),
  bell: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.7 21a2 2 0 0 1-3.4 0"
  })),
  dots: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1.4"
  })),
  grid: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  })),
  checkCircle: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8.5 12 2.4 2.4 4.6-5"
  })),
  share: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "19",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"
  })),
  mapPin: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "2.5"
  })),
  globe: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"
  })),
  image: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "8.5",
    r: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 15-5-5L5 21"
  })),
  sparkle: /*#__PURE__*/React.createElement("path", {
    d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"
  }),
  home: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 11.5 12 4l8 7.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"
  })),
  sun: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  })),
  moon: /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
  })
};

/** Names available in the SecurityArts icon set. */
const ICON_NAMES = Object.keys(ICON_PATHS);

/**
 * Icon — renders a named line glyph from the SecurityArts set.
 * Inherits `currentColor`; size it with the `size` prop or CSS `width/height`.
 */
function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  title,
  className,
  style,
  ...rest
}) {
  const glyph = ICON_PATHS[name];
  const dim = typeof size === "number" ? `${size}px` : size;
  if (!glyph) {
    if (typeof console !== "undefined") console.warn(`<Icon>: unknown name "${name}". Known: ${ICON_NAMES.join(", ")}`);
    return null;
  }
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: dim,
    height: dim,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className,
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
    focusable: "false",
    style: {
      display: "block",
      flex: "0 0 auto",
      ...style
    }
  }, rest), title ? /*#__PURE__*/React.createElement("title", null, title) : null, glyph);
}
Object.assign(__ds_scope, { ICON_PATHS, ICON_NAMES, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Scoped styles — injected once. References design tokens from styles.css. */
const CSS = `
.sa-btn {
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: var(--ls-mono, 0.1em);
  line-height: 1;
  border-radius: var(--radius-pill, 100px);
  border: 1px solid transparent;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 0.5rem; cursor: pointer; white-space: nowrap;
  text-decoration: none;
  transition: background var(--dur-fast,0.25s) var(--ease), color var(--dur-fast,0.25s) var(--ease),
              border-color var(--dur-fast,0.25s) var(--ease), transform var(--dur-fast,0.25s) var(--ease), gap var(--dur-fast,0.25s) var(--ease);
}
.sa-btn--md { font-size: 0.78rem; padding: 0.95rem 1.5rem; }
.sa-btn--sm { font-size: 0.72rem; padding: 0.62rem 0.95rem; }
.sa-btn--solid { background: var(--bone); color: var(--ink); border-color: var(--bone); }
.sa-btn--solid:hover { background: var(--brass); border-color: var(--brass); transform: translateY(var(--lift,-2px)); }
.sa-btn--brass { background: var(--brass); color: var(--ink); border-color: var(--brass); }
.sa-btn--brass:hover { background: var(--brass-deep); border-color: var(--brass-deep); transform: translateY(var(--lift,-2px)); }
.sa-btn--ghost { background: transparent; color: var(--bone); border-color: var(--line-strong); }
.sa-btn--ghost:hover { border-color: var(--bone); background: rgba(244,241,233,0.04); transform: translateY(var(--lift,-2px)); }
.sa-btn:focus-visible { outline: 2px solid var(--focus-ring,#c2a14e); outline-offset: 3px; }
.sa-btn[disabled], .sa-btn[aria-disabled="true"] { opacity: 0.4; cursor: not-allowed; pointer-events: none; transform: none; }
.sa-btn__arrow { display: inline-block; transition: transform var(--dur-fast,0.25s) var(--ease); }
.sa-btn:hover .sa-btn__arrow { transform: translateX(2px); }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-btn-css")) {
  const s = document.createElement("style");
  s.id = "sa-btn-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Button — the studio's pill action. Mono, uppercase, fully rounded.
 * `solid` (bone → brass on hover) is primary; `ghost` is secondary; `brass`
 * is the rare committed action. Add `arrow` for the "→" that nudges on hover.
 * Renders as <a> when `href` is set, otherwise <button>.
 */
function Button({
  children,
  variant = "solid",
  size = "md",
  arrow = false,
  href,
  type = "button",
  disabled = false,
  className = "",
  ...rest
}) {
  const cls = `sa-btn sa-btn--${size} sa-btn--${variant} ${className}`.trim();
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, children, arrow ? /*#__PURE__*/React.createElement("span", {
    className: "sa-btn__arrow",
    "aria-hidden": "true"
  }, "\u2192") : null);
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      className: cls
    }, rest), content);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled
  }, rest), content);
}
Object.assign(__ds_scope, { Button, __ds_default_components_core_Button_51d4zy: Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-iconbtn {
  display: grid; place-items: center; cursor: pointer;
  border-radius: var(--radius-full, 50%); border: 1px solid var(--line-strong);
  background: transparent; color: var(--bone); padding: 0; flex: 0 0 auto;
  transition: background var(--dur-fast,0.25s) var(--ease), color var(--dur-fast,0.25s) var(--ease),
              border-color var(--dur-fast,0.25s) var(--ease), transform var(--dur-fast,0.25s) var(--ease);
}
.sa-iconbtn:hover { border-color: var(--bone); background: var(--ink-3); }
.sa-iconbtn:focus-visible { outline: 2px solid var(--focus-ring,#c2a14e); outline-offset: 3px; }
.sa-iconbtn--glass {
  border-color: rgba(244,241,233,0.2);
  background: color-mix(in srgb, var(--ink) 72%, transparent);
  backdrop-filter: blur(var(--blur-badge,6px)); -webkit-backdrop-filter: blur(var(--blur-badge,6px));
}
.sa-iconbtn--glass:hover { background: var(--bone); color: var(--ink); border-color: var(--bone); }
.sa-iconbtn--active { background: var(--brass); color: var(--ink); border-color: var(--brass); }
.sa-iconbtn--active:hover { background: var(--brass); color: var(--ink); border-color: var(--brass); }
.sa-iconbtn[disabled] { opacity: 0.4; cursor: not-allowed; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-iconbtn-css")) {
  const s = document.createElement("style");
  s.id = "sa-iconbtn-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * IconButton — a round, single-glyph control. `outline` is the standard dialog
 * close / nav button; `glass` is the frosted button that floats over artwork
 * (e.g. save-to-board). Pass `active` for the filled brass selected state.
 * Provide either an `icon` name or custom `children`.
 */
function IconButton({
  icon,
  children,
  variant = "outline",
  active = false,
  size = 36,
  iconSize,
  label,
  className = "",
  ...rest
}) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const glyph = iconSize || Math.round((parseInt(size, 10) || 36) * 0.44);
  return /*#__PURE__*/React.createElement("button", _extends({
    className: `sa-iconbtn sa-iconbtn--${variant} ${active ? "sa-iconbtn--active" : ""} ${className}`.trim(),
    style: {
      width: dim,
      height: dim
    },
    "aria-label": label,
    "aria-pressed": active || undefined
  }, rest), children ? children : /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: glyph
  }));
}
Object.assign(__ds_scope, { IconButton, __ds_default_components_core_IconButton_p7lntj: IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SectionLabel — the numbered mono heading that opens each band on the marketing
 * site ("00 Position", "01 Practice"). The `index` sits in brass, divided from
 * the label by a hairline rule. Use real sequence numbers; don't invent them.
 */
function SectionLabel({
  index,
  children,
  className = "",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    className: `sa-section-label ${className}`.trim(),
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "0.75rem",
      fontFamily: "var(--font-mono, monospace)",
      fontWeight: 500,
      fontSize: "0.72rem",
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      color: "var(--bone-dim)",
      margin: 0,
      ...style
    }
  }, rest), index != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--brass)",
      paddingRight: "0.75rem",
      borderRight: "1px solid var(--line-strong)"
    }
  }, index) : null, children);
}
Object.assign(__ds_scope, { SectionLabel, __ds_default_components_core_SectionLabel_9tikav: SectionLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionLabel.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tag — a small static mono capsule used to list an engagement's methods or a
 * work's attributes (e.g. inside PracticeCard). Outlined, uppercase, dim ink.
 * Not interactive — for a clickable filter use Chip instead.
 */
function Tag({
  children,
  className = "",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `sa-tag ${className}`.trim(),
    style: {
      fontFamily: "var(--font-mono, monospace)",
      fontWeight: 500,
      fontSize: "0.68rem",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--bone-dim)",
      border: "1px solid var(--line-strong)",
      borderRadius: "var(--radius-pill, 100px)",
      padding: "0.32rem 0.6rem",
      lineHeight: 1,
      display: "inline-block",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag, __ds_default_components_core_Tag_1gfzecu: Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/ThemeToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Reads/writes the site theme. The theme lives as `data-theme` on <html> and is
 * persisted in localStorage under "sa-theme". Pages should also run a tiny
 * no-flash script in <head> that applies the stored value before first paint.
 */
const KEY = "sa-theme";
function currentTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch (e) {}
  window.dispatchEvent(new CustomEvent("sa-theme-change", {
    detail: t
  }));
  return t;
}

/**
 * ThemeToggle — a round control that flips the site between the dark studio and
 * the light (paper) theme. Shows a moon while dark (tap → light) and a sun while
 * light (tap → dark). Persists the choice and stays in sync with other toggles.
 */
function ThemeToggle({
  size = 40,
  className = "",
  ...rest
}) {
  const [theme, setTheme] = React.useState(currentTheme);
  React.useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener("sa-theme-change", sync);
    window.addEventListener("storage", e => {
      if (e.key === KEY) sync();
    });
    sync();
    return () => window.removeEventListener("sa-theme-change", sync);
  }, []);
  const toggle = () => setTheme(applyTheme(theme === "light" ? "dark" : "light"));
  const dark = theme !== "light";
  return /*#__PURE__*/React.createElement(__ds_scope.IconButton, _extends({
    icon: dark ? "moon" : "sun",
    size: size,
    className: className,
    onClick: toggle,
    label: dark ? "Switch to light theme" : "Switch to dark theme"
  }, rest));
}
Object.assign(__ds_scope, { applyTheme, ThemeToggle, __ds_default_components_core_ThemeToggle_j950g7: ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Certificate.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-cert { border: 1px solid var(--brass); border-radius: var(--radius-card, 14px); overflow: hidden; background: linear-gradient(160deg, #19150d, var(--ink-2) 70%); }
.sa-cert__head { display: flex; align-items: center; gap: 0.8rem; padding: 1.1rem 1.3rem; border-bottom: 1px solid var(--line); }
.sa-cert__head-seal { color: var(--brass); flex: 0 0 auto; }
.sa-cert__title { font-family: var(--font-serif, serif); font-weight: 440; font-size: 1.15rem; margin: 0; }
.sa-cert__eyebrow { font-family: var(--font-mono, monospace); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brass); margin: 0.1rem 0 0; }
.sa-cert__rows { padding: 1rem 1.3rem 1.3rem; display: grid; gap: 0.8rem; }
.sa-cert__row { display: grid; grid-template-columns: 7.5rem 1fr; gap: 0.8rem; align-items: start; }
.sa-cert__k { font-family: var(--font-mono, monospace); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--bone-faint); padding-top: 0.15rem; }
.sa-cert__v { font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--bone); word-break: break-all; line-height: 1.5; }
.sa-cert__v--brass { color: var(--brass); }
.sa-cert__foot { padding: 0 1.3rem 1.3rem; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-cert-css")) {
  const s = document.createElement("style");
  s.id = "sa-cert-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Certificate — the cryptographic seal record shown after a work is verified.
 * Brass-bordered, warm gradient, mono data rows. Pass `rows` as
 * [{ k, v, brass? }]; anything in `children` renders as a footer action.
 */
function Certificate({
  title = "Verified — human-made",
  eyebrow = "SecurityArts seal",
  rows = [],
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `sa-cert ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-cert__head"
  }, /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: 40,
    className: "sa-cert__head-seal"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "sa-cert__title"
  }, title), eyebrow ? /*#__PURE__*/React.createElement("p", {
    className: "sa-cert__eyebrow"
  }, eyebrow) : null)), rows.length ? /*#__PURE__*/React.createElement("div", {
    className: "sa-cert__rows"
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "sa-cert__row",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-cert__k"
  }, r.k), /*#__PURE__*/React.createElement("span", {
    className: `sa-cert__v ${r.brass ? "sa-cert__v--brass" : ""}`.trim()
  }, r.v)))) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "sa-cert__foot"
  }, children) : null);
}
Object.assign(__ds_scope, { Certificate, __ds_default_components_feedback_Certificate_vs6yb5: Certificate });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Certificate.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-toast {
  position: fixed; left: 50%; bottom: 1.6rem; z-index: 120;
  display: inline-flex; align-items: center; gap: 0.6rem;
  background: var(--bone); color: var(--ink);
  font-family: var(--font-mono, monospace); font-size: 0.72rem;
  text-transform: uppercase; letter-spacing: 0.1em;
  padding: 0.7rem 1.1rem; border-radius: var(--radius-pill, 100px);
  box-shadow: var(--shadow-pop, 0 20px 50px -20px rgba(0,0,0,0.7));
  transition: transform var(--dur-mid,0.4s) var(--ease); pointer-events: none;
  transform: translate(-50%, 160%);
}
.sa-toast.is-shown { transform: translate(-50%, 0); }
.sa-toast__seal { color: var(--brass-deep); flex: 0 0 auto; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-toast-css")) {
  const s = document.createElement("style");
  s.id = "sa-toast-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Toast — the seal-led confirmation pill that slides up from the bottom center
 * ("Added to cart", "Published — your work is on the wall"). Presentational and
 * controlled: mount it always and toggle `show`; drive dismissal from the host.
 */
function Toast({
  children,
  show = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `sa-toast ${show ? "is-shown" : ""} ${className}`.trim(),
    role: "status",
    "aria-live": "polite"
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: 17,
    className: "sa-toast__seal"
  }), children);
}
Object.assign(__ds_scope, { Toast, __ds_default_components_feedback_Toast_sfbpi1: Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/VerifiedBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-vbadge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-family: var(--font-mono, monospace); font-size: 0.56rem;
  text-transform: uppercase; letter-spacing: 0.14em; color: var(--bone);
  border-radius: var(--radius-pill, 100px); padding: 0.3rem 0.6rem 0.3rem 0.45rem;
}
.sa-vbadge__seal { color: var(--brass); display: block; }
.sa-vbadge--glass {
  background: color-mix(in srgb, var(--ink) 78%, transparent);
  backdrop-filter: blur(var(--blur-badge,6px)); -webkit-backdrop-filter: blur(var(--blur-badge,6px));
  border: 1px solid rgba(244,241,233,0.18);
}
.sa-vbadge--line {
  gap: 0.55rem; font-size: 0.62rem; letter-spacing: 0.1em; color: var(--bone-dim);
  border: 1px solid var(--line); border-radius: var(--radius-md, 10px); padding: 0.6rem 0.8rem;
}
`;
if (typeof document !== "undefined" && !document.getElementById("sa-vbadge-css")) {
  const s = document.createElement("style");
  s.id = "sa-vbadge-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * VerifiedBadge — the seal-led "Verified" chip that marks authenticated work.
 * `glass` (default) floats over artwork with a frosted backdrop; `line` is the
 * bordered row used beside provenance text in a detail view.
 */
function VerifiedBadge({
  children = "Verified",
  variant = "glass",
  sealSize,
  className = "",
  ...rest
}) {
  const size = sealSize || (variant === "line" ? 20 : 15);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `sa-vbadge sa-vbadge--${variant} ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: size,
    className: "sa-vbadge__seal"
  }), children);
}
Object.assign(__ds_scope, { VerifiedBadge, __ds_default_components_feedback_VerifiedBadge_dzqvzj: VerifiedBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/VerifiedBadge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Field — a labelled form control wrapper. The label is a small mono uppercase
 * key sitting above its control (Input / Select). `full` makes it span both
 * columns in a two-up grid.
 */
function Field({
  label,
  htmlFor,
  full = false,
  children,
  className = "",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `sa-field ${className}`.trim(),
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.4rem",
      gridColumn: full ? "1 / -1" : undefined,
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "0.62rem",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "var(--bone-dim)"
    }
  }, label) : null, children);
}
Object.assign(__ds_scope, { Field, __ds_default_components_forms_Field_jq849g: Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-input {
  width: 100%; font-family: var(--font-sans, sans-serif); font-size: 0.95rem;
  color: var(--bone); background: var(--ink-2);
  border: 1px solid var(--line); border-radius: var(--radius-md, 10px);
  padding: 0.7rem 0.85rem; line-height: 1.4;
  transition: border-color var(--dur-fast,0.25s) var(--ease), background var(--dur-fast,0.25s) var(--ease);
}
.sa-input::placeholder { color: var(--bone-faint); }
.sa-input:focus { outline: none; border-color: var(--brass); background: var(--ink-3); }
.sa-input--pill { border-radius: var(--radius-pill, 100px); padding: 0.75rem 1rem; }
.sa-input--has-icon { padding-left: 2.6rem; }
.sa-inputwrap { position: relative; width: 100%; }
.sa-inputwrap__icon { position: absolute; left: 0.95rem; top: 50%; transform: translateY(-50%); color: var(--bone-faint); pointer-events: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-input-css")) {
  const s = document.createElement("style");
  s.id = "sa-input-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Input — text/search/email field. `shape="box"` (default, radius 10) for forms;
 * `shape="pill"` for the search and newsletter bars. Pass an `icon` name to get
 * a leading glyph (used for search). Focus ring is brass.
 */
function Input({
  shape = "box",
  icon,
  type = "text",
  className = "",
  style,
  ...rest
}) {
  const cls = `sa-input ${shape === "pill" ? "sa-input--pill" : ""} ${icon ? "sa-input--has-icon" : ""} ${className}`.trim();
  const field = /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    className: cls,
    style: style
  }, rest));
  if (!icon) return field;
  return /*#__PURE__*/React.createElement("span", {
    className: "sa-inputwrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-inputwrap__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })), field);
}
Object.assign(__ds_scope, { Input, __ds_default_components_forms_Input_jsghkw: Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/LicenseOption.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-lic {
  display: flex; align-items: center; gap: 0.8rem; width: 100%; text-align: left;
  border: 1px solid var(--line); border-radius: var(--radius-lg, 12px);
  padding: 0.8rem 1rem; cursor: pointer; background: transparent; color: var(--bone);
  transition: border-color var(--dur-fast,0.25s) var(--ease), background var(--dur-fast,0.25s) var(--ease);
}
.sa-lic:hover { border-color: var(--line-strong); }
.sa-lic:focus-visible { outline: 2px solid var(--focus-ring,#c2a14e); outline-offset: 3px; }
.sa-lic[aria-pressed="true"], .sa-lic.is-selected {
  border-color: var(--brass);
  background: linear-gradient(160deg, #19150d, var(--ink-2) 70%);
}
.sa-lic__radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--bone-faint); flex: 0 0 auto; position: relative; }
.sa-lic[aria-pressed="true"] .sa-lic__radio, .sa-lic.is-selected .sa-lic__radio { border-color: var(--brass); }
.sa-lic[aria-pressed="true"] .sa-lic__radio::after, .sa-lic.is-selected .sa-lic__radio::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--brass); }
.sa-lic__main { flex: 1 1 auto; min-width: 0; }
.sa-lic__name { font-weight: 460; }
.sa-lic__desc { font-size: 0.74rem; color: var(--bone-faint); }
.sa-lic__price { font-family: var(--font-mono, monospace); font-size: 0.85rem; color: var(--brass); white-space: nowrap; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-lic-css")) {
  const s = document.createElement("style");
  s.id = "sa-lic-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * LicenseOption — a radio-style tier row used in the marketplace quick view
 * (Personal / Commercial / Exclusive). Selected state fills a brass radio and a
 * warm gradient. Controlled via `selected`.
 */
function LicenseOption({
  name,
  description,
  price,
  selected = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: `sa-lic ${selected ? "is-selected" : ""} ${className}`.trim(),
    "aria-pressed": selected
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "sa-lic__radio",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sa-lic__main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-lic__name"
  }, name), description ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "sa-lic__desc"
  }, description)) : null), price != null ? /*#__PURE__*/React.createElement("span", {
    className: "sa-lic__price"
  }, price) : null);
}
Object.assign(__ds_scope, { LicenseOption, __ds_default_components_forms_LicenseOption_2qhl2k: LicenseOption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/LicenseOption.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-selectwrap { position: relative; display: inline-flex; align-items: center; }
.sa-selectwrap--block { display: flex; width: 100%; }
.sa-select {
  appearance: none; -webkit-appearance: none; cursor: pointer; width: 100%;
  color: var(--bone); background: var(--ink-2);
  border: 1px solid var(--line); border-radius: var(--radius-pill, 100px);
  font-family: var(--font-mono, monospace); font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0.5rem 2rem 0.5rem 0.7rem; line-height: 1;
  transition: border-color var(--dur-fast,0.25s) var(--ease);
}
.sa-select:focus { outline: none; border-color: var(--brass); }
.sa-select--box {
  font-family: var(--font-sans, sans-serif); font-size: 0.95rem;
  text-transform: none; letter-spacing: normal;
  background: var(--ink); border-radius: var(--radius-md, 10px);
  padding: 0.7rem 2.2rem 0.7rem 0.85rem;
}
.sa-selectwrap__chev { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--bone-faint); pointer-events: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-select-css")) {
  const s = document.createElement("style");
  s.id = "sa-select-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Select — native dropdown styled to the brand. `variant="pill"` (default) is
 * the mono, uppercase sort control; `variant="box"` matches form inputs.
 * Pass `options` as [{value,label}] or use children <option>s.
 */
function Select({
  options,
  variant = "pill",
  block = false,
  className = "",
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `sa-selectwrap ${block ? "sa-selectwrap--block" : ""}`.trim(),
    style: block ? undefined : style
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: `sa-select ${variant === "box" ? "sa-select--box" : ""} ${className}`.trim(),
    style: block ? style : undefined
  }, rest), options ? options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)) : children), /*#__PURE__*/React.createElement("span", {
    className: "sa-selectwrap__chev"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevronDown",
    size: 16
  })));
}
Object.assign(__ds_scope, { Select, __ds_default_components_forms_Select_k3ngq8: Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Drawer.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-drawer-scrim { position: fixed; inset: 0; z-index: 90; background: rgba(6,6,5,0.62); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); opacity: 0; visibility: hidden; transition: opacity 0.35s var(--ease), visibility 0.35s var(--ease); }
.sa-drawer-scrim.is-open { opacity: 1; visibility: visible; }
.sa-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 95; width: min(440px, 94vw); background: var(--ink-2); border-left: 1px solid var(--line-strong); transform: translateX(100%); transition: transform 0.45s var(--ease); display: flex; flex-direction: column; }
.sa-drawer.is-open { transform: translateX(0); }
.sa-drawer__head { display: flex; align-items: center; justify-content: space-between; padding: 1.4rem var(--gutter-app, 1.5rem); border-bottom: 1px solid var(--line); }
.sa-drawer__title { font-family: var(--font-serif, serif); font-weight: 400; font-size: 1.5rem; letter-spacing: -0.01em; margin: 0; }
.sa-drawer__body { overflow-y: auto; padding: 1.2rem var(--gutter-app, 1.5rem); flex: 1 1 auto; }
.sa-drawer__foot { border-top: 1px solid var(--line); padding: 1.2rem var(--gutter-app, 1.5rem) 1.6rem; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-drawer-css")) {
  const s = document.createElement("style");
  s.id = "sa-drawer-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Drawer — a right-hand slide-over used for the cart and the boards panel.
 * Controlled via `open`; `onClose` fires on scrim click, the close button, and
 * Escape. Provide a `title`, body `children`, and an optional pinned `footer`.
 */
function Drawer({
  open = false,
  onClose,
  title,
  footer,
  label,
  children,
  className = "",
  ...rest
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: `sa-drawer-scrim ${open ? "is-open" : ""}`,
    onClick: onClose,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("aside", _extends({
    className: `sa-drawer ${open ? "is-open" : ""} ${className}`.trim(),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": label || title
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-drawer__head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sa-drawer__title"
  }, title), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "close",
    label: "Close",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    className: "sa-drawer__body"
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    className: "sa-drawer__foot"
  }, footer) : null));
}
Object.assign(__ds_scope, { Drawer, __ds_default_components_surfaces_Drawer_jd5sfe: Drawer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Drawer.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Modal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-scrim { position: fixed; inset: 0; z-index: 90; background: rgba(6,6,5,0.62); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); opacity: 0; visibility: hidden; transition: opacity 0.35s var(--ease), visibility 0.35s var(--ease); }
.sa-scrim.is-open { opacity: 1; visibility: visible; }
.sa-modal { position: fixed; z-index: 96; left: 50%; top: 50%; transform: translate(-50%, calc(-50% + 16px)); max-height: 92vh; overflow-y: auto; background: var(--ink-2); border: 1px solid var(--line-strong); border-radius: var(--radius-modal, 18px); opacity: 0; visibility: hidden; transition: opacity 0.35s var(--ease), transform 0.35s var(--ease), visibility 0.35s var(--ease); }
.sa-modal.is-open { opacity: 1; visibility: visible; transform: translate(-50%, -50%); }
.sa-modal__close { position: absolute; top: 1rem; right: 1rem; z-index: 3; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-modal-css")) {
  const s = document.createElement("style");
  s.id = "sa-modal-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Modal — a centered dialog over a blurred scrim, with the studio's fade+rise
 * entrance. Controlled via `open`; `onClose` fires on scrim click, the close
 * button, and Escape. Size with `width` (defaults to a comfortable 640px cap).
 */
function Modal({
  open = false,
  onClose,
  width = "min(640px, 94vw)",
  label,
  closeButton = true,
  children,
  className = "",
  ...rest
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: `sa-scrim ${open ? "is-open" : ""}`,
    onClick: onClose,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", _extends({
    className: `sa-modal ${open ? "is-open" : ""} ${className}`.trim(),
    style: {
      width
    },
    role: "dialog",
    "aria-modal": "true",
    "aria-label": label
  }, rest), closeButton ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    className: "sa-modal__close",
    icon: "close",
    label: "Close",
    onClick: onClose
  }) : null, children));
}
Object.assign(__ds_scope, { Modal, __ds_default_components_surfaces_Modal_2wwmj6: Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Modal.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Pin.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-pin {
  break-inside: avoid; position: relative; display: block; width: 100%;
  border-radius: var(--radius-card, 14px); overflow: hidden;
  background: var(--ink-2); border: 1px solid var(--line);
  transition: transform var(--dur-mid,0.4s) var(--ease), border-color var(--dur-fast,0.25s) var(--ease), box-shadow var(--dur-mid,0.4s) var(--ease);
}
.sa-pin:hover { transform: translateY(var(--lift-card,-3px)); border-color: var(--line-strong); box-shadow: var(--shadow-hover, 0 18px 40px -24px rgba(0,0,0,0.8)); }
.sa-pin__art { position: relative; width: 100%; overflow: hidden; display: block; }
.sa-pin__art > img, .sa-pin__art > svg { width: 100%; height: auto; display: block; }
.sa-pin__badge { position: absolute; top: 0.7rem; left: 0.7rem; z-index: 3; }
.sa-pin__save { position: absolute; top: 0.7rem; right: 0.7rem; z-index: 3; opacity: 0; transform: translateY(-4px); transition: opacity var(--dur-fast,0.25s) var(--ease), transform var(--dur-fast,0.25s) var(--ease); }
.sa-pin:hover .sa-pin__save, .sa-pin:focus-within .sa-pin__save, .sa-pin__save.is-saved { opacity: 1; transform: translateY(0); }
.sa-pin__own { position: absolute; bottom: 0.7rem; left: 0.7rem; z-index: 3; font-family: var(--font-mono, monospace); font-size: 0.54rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); background: var(--brass); padding: 0.25rem 0.5rem; border-radius: var(--radius-pill, 100px); }
.sa-pin__meta { position: absolute; inset: auto 0 0 0; z-index: 2; padding: 1.7rem 0.85rem 0.75rem; background: linear-gradient(to top, rgba(7,7,6,0.94), rgba(7,7,6,0.55) 55%, transparent); opacity: 0; transform: translateY(8px); transition: opacity var(--dur-fast,0.25s) var(--ease), transform var(--dur-fast,0.25s) var(--ease); }
.sa-pin:hover .sa-pin__meta, .sa-pin:focus-within .sa-pin__meta { opacity: 1; transform: translateY(0); }
.sa-pin__title { display: block; font-family: var(--font-serif, serif); font-weight: 460; font-size: 1.05rem; line-height: 1.15; letter-spacing: -0.01em; }
.sa-pin__artist { display: block; margin-top: 0.2rem; font-size: 0.78rem; color: var(--bone-dim); }
.sa-pin__artist b { color: var(--brass); font-weight: 500; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-pin-css")) {
  const s = document.createElement("style");
  s.id = "sa-pin-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Pin — a masonry tile of verified work for the discovery wall. Shows a glass
 * VerifiedBadge, a save-to-board button that appears on hover, and a title/artist
 * overlay that rises on hover. `own` flags the viewer's own published work.
 * Pass artwork as an `<img>`/`<svg>` in `art` (or `children`); size the tile by
 * its natural image ratio (masonry column layout is the container's job).
 */
function Pin({
  art,
  children,
  title,
  artist,
  own = false,
  saved = false,
  onSave,
  badge = "Verified",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("article", _extends({
    className: `sa-pin ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-pin__art"
  }, art || children, badge ? /*#__PURE__*/React.createElement(__ds_scope.VerifiedBadge, {
    className: "sa-pin__badge"
  }, badge) : null, onSave ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "glass",
    icon: "board",
    active: saved,
    size: 38,
    className: `sa-pin__save ${saved ? "is-saved" : ""}`,
    label: saved ? "Saved to board" : "Save to board",
    onClick: onSave
  }) : null, own ? /*#__PURE__*/React.createElement("span", {
    className: "sa-pin__own"
  }, "Your work") : null, title || artist ? /*#__PURE__*/React.createElement("div", {
    className: "sa-pin__meta"
  }, title ? /*#__PURE__*/React.createElement("span", {
    className: "sa-pin__title"
  }, title) : null, artist ? /*#__PURE__*/React.createElement("span", {
    className: "sa-pin__artist"
  }, "by ", /*#__PURE__*/React.createElement("b", null, artist)) : null) : null));
}
Object.assign(__ds_scope, { Pin, __ds_default_components_surfaces_Pin_1rzm298: Pin });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Pin.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/PracticeCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-pcard {
  position: relative; display: flex; flex-direction: column; gap: 1rem;
  background: var(--ink); padding: clamp(1.6rem, 3vw, 2.6rem); min-height: 270px;
  border: 1px solid var(--line); border-radius: var(--radius-card, 14px);
  transition: background var(--dur-mid,0.4s) var(--ease);
}
.sa-pcard--seamless { border: 0; border-radius: 0; }
.sa-pcard:hover { background: var(--ink-3); }
.sa-pcard--brass { background: linear-gradient(160deg, #1a1712, var(--ink) 60%); }
.sa-pcard--brass:hover { background: linear-gradient(160deg, #221d14, var(--ink-2) 70%); }
.sa-pcard__top { display: flex; align-items: flex-start; justify-content: space-between; }
.sa-pcard__idx { font-family: var(--font-mono, monospace); font-weight: 500; font-size: 0.74rem; letter-spacing: 0.1em; color: var(--brass); }
.sa-pcard__seal { color: var(--bone-faint); transition: transform var(--dur-mid,0.4s) var(--ease), color var(--dur-mid,0.4s) var(--ease); }
.sa-pcard:hover .sa-pcard__seal { transform: rotate(45deg); color: var(--brass); }
.sa-pcard__title { font-family: var(--font-serif, serif); font-weight: 420; font-size: clamp(1.4rem, 1rem + 1vw, 1.95rem); letter-spacing: -0.015em; line-height: 1.05; margin: 0; }
.sa-pcard__body { color: var(--bone-dim); font-size: 0.97rem; line-height: 1.55; max-width: 46ch; margin: 0; }
.sa-pcard__tags { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: auto; padding-top: 0.6rem; }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-pcard-css")) {
  const s = document.createElement("style");
  s.id = "sa-pcard-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * PracticeCard — a service / discipline card. A mono index and a seal (which
 * rotates to brass on hover) sit above a serif title, body copy, and method
 * Tags. `variant="brass"` gives the featured warm-gradient treatment;
 * `seamless` drops the border/radius for use inside a hairline grid.
 */
function PracticeCard({
  index,
  title,
  children,
  tags = [],
  variant = "default",
  seamless = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("article", _extends({
    className: `sa-pcard ${variant === "brass" ? "sa-pcard--brass" : ""} ${seamless ? "sa-pcard--seamless" : ""} ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-pcard__top"
  }, index != null ? /*#__PURE__*/React.createElement("span", {
    className: "sa-pcard__idx"
  }, index) : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement(__ds_scope.Seal, {
    size: 30,
    className: "sa-pcard__seal"
  })), title ? /*#__PURE__*/React.createElement("h3", {
    className: "sa-pcard__title"
  }, title) : null, children ? /*#__PURE__*/React.createElement("p", {
    className: "sa-pcard__body"
  }, children) : null, tags.length ? /*#__PURE__*/React.createElement("div", {
    className: "sa-pcard__tags"
  }, tags.map((t, i) => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: i
  }, t))) : null);
}
Object.assign(__ds_scope, { PracticeCard, __ds_default_components_surfaces_PracticeCard_rcbm4q: PracticeCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/PracticeCard.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ProductCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.sa-prod {
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--ink-2); border: 1px solid var(--line); border-radius: var(--radius-card, 14px);
  transition: transform var(--dur-mid,0.4s) var(--ease), border-color var(--dur-fast,0.25s) var(--ease), box-shadow var(--dur-mid,0.4s) var(--ease);
}
.sa-prod:hover { transform: translateY(var(--lift-card,-3px)); border-color: var(--line-strong); box-shadow: var(--shadow-hover, 0 18px 40px -24px rgba(0,0,0,0.8)); }
.sa-prod__art { position: relative; aspect-ratio: 4 / 5; overflow: hidden; cursor: pointer; }
.sa-prod__art > img, .sa-prod__art > svg { width: 100%; height: 100%; object-fit: cover; display: block; }
.sa-prod__badge { position: absolute; top: 0.6rem; left: 0.6rem; z-index: 2; }
.sa-prod__own { position: absolute; top: 0.6rem; right: 0.6rem; z-index: 2; font-family: var(--font-mono, monospace); font-size: 0.5rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); background: var(--brass); padding: 0.24rem 0.45rem; border-radius: var(--radius-pill, 100px); }
.sa-prod__view { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity var(--dur-fast,0.25s) var(--ease); background: linear-gradient(to top, rgba(7,7,6,0.55), transparent 60%); }
.sa-prod__art:hover .sa-prod__view { opacity: 1; }
.sa-prod__view span { font-family: var(--font-mono, monospace); font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--bone); border: 1px solid var(--bone); border-radius: var(--radius-pill, 100px); padding: 0.5rem 0.9rem; background: rgba(7,7,6,0.4); }
.sa-prod__info { padding: 0.9rem 0.95rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; flex: 1 1 auto; }
.sa-prod__row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
.sa-prod__title { font-family: var(--font-serif, serif); font-weight: 460; font-size: 1.05rem; letter-spacing: -0.01em; line-height: 1.1; }
.sa-prod__price { font-family: var(--font-mono, monospace); font-size: 0.85rem; color: var(--brass); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sa-prod__artist { font-size: 0.78rem; color: var(--bone-dim); }
.sa-prod__add { margin-top: auto; font-family: var(--font-mono, monospace); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--bone); background: none; border: 1px solid var(--line-strong); border-radius: var(--radius-pill, 100px); padding: 0.6rem; cursor: pointer; transition: background var(--dur-fast,0.25s) var(--ease), color var(--dur-fast,0.25s) var(--ease), border-color var(--dur-fast,0.25s) var(--ease); }
.sa-prod__add:hover { background: var(--bone); color: var(--ink); border-color: var(--bone); }
`;
if (typeof document !== "undefined" && !document.getElementById("sa-prod-css")) {
  const s = document.createElement("style");
  s.id = "sa-prod-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * ProductCard — a marketplace tile. A 4:5 artwork area (with VerifiedBadge and a
 * "Quick view" hover overlay) sits above the title/price row, artist·medium
 * line, and an add-to-cart button. Pass artwork in `art`/`children`.
 */
function ProductCard({
  art,
  children,
  title,
  artist,
  medium,
  price,
  own = false,
  onQuickView,
  onAdd,
  addLabel,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("article", _extends({
    className: `sa-prod ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "sa-prod__art",
    onClick: onQuickView,
    role: onQuickView ? "button" : undefined,
    tabIndex: onQuickView ? 0 : undefined
  }, art || children, /*#__PURE__*/React.createElement(__ds_scope.VerifiedBadge, {
    className: "sa-prod__badge"
  }, "Verified"), own ? /*#__PURE__*/React.createElement("span", {
    className: "sa-prod__own"
  }, "Artist") : null, onQuickView ? /*#__PURE__*/React.createElement("span", {
    className: "sa-prod__view"
  }, /*#__PURE__*/React.createElement("span", null, "Quick view")) : null), /*#__PURE__*/React.createElement("div", {
    className: "sa-prod__info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sa-prod__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-prod__title"
  }, title), price != null ? /*#__PURE__*/React.createElement("span", {
    className: "sa-prod__price"
  }, price) : null), artist || medium ? /*#__PURE__*/React.createElement("span", {
    className: "sa-prod__artist"
  }, [artist, medium].filter(Boolean).join(" · ")) : null, onAdd ? /*#__PURE__*/React.createElement("button", {
    className: "sa-prod__add",
    onClick: onAdd
  }, addLabel || (price != null ? `Add — ${price}` : "Add to cart")) : null));
}
Object.assign(__ds_scope, { ProductCard, __ds_default_components_surfaces_ProductCard_1e7g5xc: ProductCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ProductCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Marquee = __ds_scope.Marquee;

__ds_ns.SEAL_SCALLOP = __ds_scope.SEAL_SCALLOP;

__ds_ns.SEAL_STAR = __ds_scope.SEAL_STAR;

__ds_ns.Seal = __ds_scope.Seal;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.ICON_PATHS = __ds_scope.ICON_PATHS;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.SectionLabel = __ds_scope.SectionLabel;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.Certificate = __ds_scope.Certificate;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.VerifiedBadge = __ds_scope.VerifiedBadge;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.LicenseOption = __ds_scope.LicenseOption;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Drawer = __ds_scope.Drawer;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Pin = __ds_scope.Pin;

__ds_ns.PracticeCard = __ds_scope.PracticeCard;

__ds_ns.ProductCard = __ds_scope.ProductCard;

})();
