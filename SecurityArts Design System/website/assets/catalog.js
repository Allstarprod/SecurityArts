/* ============================================================
   SecurityArts — shared catalog
   A deterministic set of artists and their verified works, used across
   Discover, Profile, For You, DMs and Market so ids line up and the flow
   (click a work → its artist's profile → follow / DM) is coherent.
   window.SACatalog = { artists, works, artistById, worksByArtist, workById }
   ============================================================ */
(function () {
  "use strict";

  const ARTISTS = [
    { id: "ines-vela", name: "Ines Vela", handle: "inesvela", city: "Lisbon, PT", cat: "painting",
      bio: "Oil painter working in long tides of color. Every canvas sealed at the studio, never a print without provenance.", tags: ["Oil on linen", "Abstract", "Seascape"] },
    { id: "kofi-mensah", name: "Kofi Mensah", handle: "kofimake", city: "Accra, GH", cat: "3d",
      bio: "Building quiet machines and impossible fields in 3D. Hand-modelled, human-signed.", tags: ["3D render", "Surreal", "Architectural"] },
    { id: "mara-okafor", name: "Mara Okafor", handle: "maradraws", city: "Lagos, NG", cat: "illustration",
      bio: "Illustrator of folktales and city mornings. Ink first, colour later.", tags: ["Illustration", "Editorial", "Folk"] },
    { id: "theo-brandt", name: "Theo Brandt", handle: "theob", city: "Berlin, DE", cat: "photography",
      bio: "35mm photographer chasing the last light. Grain kept, never smoothed.", tags: ["35mm", "Documentary", "Night"] },
    { id: "yuki-sato", name: "Yuki Sato", handle: "yukisato", city: "Kyoto, JP", cat: "lettering",
      bio: "Letterer and sign painter. One brush, one breath, one stroke.", tags: ["Hand lettering", "Brush", "Type"] },
    { id: "lena-lindqvist", name: "Lena Lindqvist", handle: "lenalind", city: "Stockholm, SE", cat: "concept",
      bio: "Concept artist for worlds that don't exist yet. Cold palettes, warm intentions.", tags: ["Concept art", "Environment", "Sci-fi"] },
    { id: "diego-reyes", name: "Diego Reyes", handle: "dreyes", city: "Mexico City, MX", cat: "mixed",
      bio: "Mixed-media collagist. Paper, paint, and found things, held together by hand.", tags: ["Mixed media", "Collage", "Texture"] },
    { id: "amara-adeyemi", name: "Amara Adeyemi", handle: "amaraa", city: "Nairobi, KE", cat: "painting",
      bio: "Painter of interiors and the light that visits them.", tags: ["Acrylic", "Interior", "Warm"] },
    { id: "sol-moreau", name: "Sol Moreau", handle: "solmoreau", city: "Paris, FR", cat: "illustration",
      bio: "Illustrator with a soft spot for margins, birds, and small machines.", tags: ["Illustration", "Line", "Whimsy"] },
    { id: "rune-haddad", name: "Rune Haddad", handle: "runeh", city: "Beirut, LB", cat: "3d",
      bio: "Sculpting light in 3D. Foundries, ribbons, and slow tangerine skies.", tags: ["3D render", "Abstract", "Light"] },
    { id: "priya-kapoor", name: "Priya Kapoor", handle: "priyak", city: "Mumbai, IN", cat: "photography",
      bio: "Street and monsoon photographer. Held breath, pressed shutter.", tags: ["35mm", "Street", "Monsoon"] },
    { id: "noa-petrova", name: "Noa Petrova", handle: "noap", city: "Tbilisi, GE", cat: "concept",
      bio: "Concept and matte painting. Mapping cities that only exist at dusk.", tags: ["Concept art", "Matte", "Cities"] },
  ];

  // [artistId, title, category, basePrice]
  const RAW = [
    ["ines-vela", "Low Tide, No.4", "painting", 420],
    ["ines-vela", "Salt & Iron", "painting", 380],
    ["ines-vela", "Held Breath", "painting", 540],
    ["kofi-mensah", "The Long Field", "3d", 180],
    ["kofi-mensah", "Quiet Engine", "3d", 240],
    ["kofi-mensah", "Carrier Signal", "3d", 300],
    ["mara-okafor", "Index of Birds", "illustration", 160],
    ["mara-okafor", "Paper Sun", "illustration", 140],
    ["mara-okafor", "Margin Notes", "illustration", 120],
    ["theo-brandt", "Nocturne for a City", "photography", 220],
    ["theo-brandt", "Warm Static", "photography", 200],
    ["theo-brandt", "Afterimage", "photography", 260],
    ["yuki-sato", "Foundry", "lettering", 300],
    ["yuki-sato", "One Breath", "lettering", 340],
    ["lena-lindqvist", "Cartographer", "concept", 280],
    ["lena-lindqvist", "Cold Harbor", "concept", 320],
    ["lena-lindqvist", "Folded Light", "concept", 360],
    ["diego-reyes", "Ribbon of Smoke", "mixed", 190],
    ["diego-reyes", "Foundling", "mixed", 210],
    ["amara-adeyemi", "Slow Tangerine", "painting", 400],
    ["amara-adeyemi", "The Visitor", "painting", 460],
    ["sol-moreau", "Static Bloom", "illustration", 150],
    ["sol-moreau", "Small Machines", "illustration", 170],
    ["rune-haddad", "Molten Ribbon", "3d", 260],
    ["rune-haddad", "Slow Tangerine Sky", "3d", 290],
    ["priya-kapoor", "Monsoon, 6am", "photography", 210],
    ["priya-kapoor", "Held City", "photography", 230],
    ["noa-petrova", "City at Dusk", "concept", 300],
    ["noa-petrova", "Index of Cities", "concept", 340],
  ];

  const MEDIUM = { illustration: "Digital illustration", painting: "Oil on linen", "3d": "3D render", photography: "35mm photograph", lettering: "Hand lettering", concept: "Concept art", mixed: "Mixed media" };

  const works = RAW.map((r, i) => ({
    id: "w" + i, artistId: r[0], title: r[1], cat: r[2], price: r[3],
    medium: MEDIUM[r[2]] || "Original work", seed: i * 7 + 3,
  }));

  const artistById = {}; ARTISTS.forEach((a) => { artistById[a.id] = a; });
  const workById = {}; works.forEach((w) => { workById[w.id] = w; });
  const worksByArtist = {};
  works.forEach((w) => { (worksByArtist[w.artistId] = worksByArtist[w.artistId] || []).push(w); });
  // derive a stat count per artist so numbers stay stable
  ARTISTS.forEach((a) => {
    const h = a.id.split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 7);
    a.followers = 400 + (Math.abs(h) % 8600);
    a.following = 40 + (Math.abs(h >> 3) % 260);
    a.works = (worksByArtist[a.id] || []).length;
  });

  window.SACatalog = { artists: ARTISTS, works, artistById, worksByArtist, workById, MEDIUM };
})();
