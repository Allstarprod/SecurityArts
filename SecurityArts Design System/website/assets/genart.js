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
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shade(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
    var n = parseInt(c, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = amt < 0 ? 0 : 255, t = Math.abs(amt) / 100;
    r = Math.round((f - r) * t) + r; g = Math.round((f - g) * t) + g; b = Math.round((f - b) * t) + b;
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  var PAL = [
    { bg: '#1f7a55', fg: '#e8e4d8', accent: '#c2a14e' },
    { bg: '#b23a2c', fg: '#f4f1e9', accent: '#100f0e' },
    { bg: '#3667cf', fg: '#e8e4d8', accent: '#c2a14e' },
    { bg: '#a8862a', fg: '#100f0e', accent: '#f4f1e9' },
    { bg: '#0c0c0b', fg: '#c2a14e', accent: '#b23a2c' },
    { bg: '#e8e4d8', fg: '#100f0e', accent: '#b23a2c' },
    { bg: '#7c7468', fg: '#f4f1e9', accent: '#100f0e' },
    { bg: '#15302a', fg: '#c2a14e', accent: '#1f7a55' },
    { bg: '#2a1d16', fg: '#c2a14e', accent: '#b23a2c' },
    { bg: '#1a2740', fg: '#e8e4d8', accent: '#c2a14e' }
  ];

  function aField(p, r) { var cx = 80 + r() * 240, cy = 120 + r() * 360, rad = 170 + r() * 200, cx2 = r() * 400, cy2 = 220 + r() * 360, rad2 = 120 + r() * 170; return "<rect width='400' height='600' fill='" + shade(p.bg, -22) + "'/><circle cx='" + cx2 + "' cy='" + cy2 + "' r='" + rad2 + "' fill='" + p.fg + "' opacity='0.16'/><circle cx='" + cx + "' cy='" + cy + "' r='" + rad + "' fill='" + p.accent + "' opacity='0.6'/><circle cx='" + cx + "' cy='" + cy + "' r='" + (rad * 0.46) + "' fill='" + p.fg + "' opacity='0.92'/>"; }
  function aArcs(p, r) { var cx = 140 + r() * 120, cy = 200 + r() * 200, n = 5 + (r() * 4 | 0), s = "<rect width='400' height='600' fill='" + p.bg + "'/>"; for (var i = 0; i < n; i++) s += "<circle cx='" + cx + "' cy='" + cy + "' r='" + (50 + i * (46 + r() * 22)) + "' fill='none' stroke='" + (i % 2 ? p.accent : p.fg) + "' stroke-width='" + (4 + r() * 7).toFixed(1) + "' opacity='" + (0.45 + 0.4 * r()).toFixed(2) + "'/>"; return s + "<circle cx='" + cx + "' cy='" + cy + "' r='30' fill='" + p.accent + "'/>"; }
  function aBau(p, r) { var s = "<rect width='400' height='600' fill='" + p.bg + "'/>"; s += "<circle cx='" + (90 + r() * 200) + "' cy='" + (140 + r() * 130) + "' r='" + (85 + r() * 70) + "' fill='" + p.accent + "'/>"; s += "<path d='M0 " + (380 + r() * 120) + " a 200 200 0 0 1 400 0 Z' fill='" + p.fg + "' opacity='0.92'/>"; s += "<polygon points='" + (r() * 180) + ",90 " + (300 + r() * 80) + ",300 70,360' fill='" + p.accent + "' opacity='0.75'/>"; s += "<rect x='" + (r() * 260) + "' y='" + (60 + r() * 80) + "' width='" + (34 + r() * 36) + "' height='540' fill='" + p.fg + "' opacity='0.55'/>"; return s; }
  function aPoster(p, r) { var G = 'AKMRSVZBQGW&', g = G[r() * G.length | 0]; return "<rect width='400' height='600' fill='" + p.bg + "'/><text x='200' y='405' text-anchor='middle' font-family='Fraunces, serif' font-size='440' font-weight='500' fill='" + p.fg + "'>" + g + "</text><rect x='40' y='520' width='" + (110 + r() * 170 | 0) + "' height='6' fill='" + p.accent + "'/>"; }
  function aWaves(p, r) { var cols = [shade(p.bg, 14), p.accent, p.fg, shade(p.bg, -16), p.accent], s = "<rect width='400' height='600' fill='" + p.bg + "'/>", base = 110 + r() * 60; for (var i = 0; i < 6; i++) { var yy = base + i * 78, amp = 18 + r() * 42; s += "<path d='M0 " + yy.toFixed(0) + " C 130 " + (yy - amp).toFixed(0) + ", 270 " + (yy + amp).toFixed(0) + ", 400 " + yy.toFixed(0) + " L400 600 L0 600 Z' fill='" + cols[i % cols.length] + "' opacity='0.9'/>"; } return s; }
  function aHalf(p, r) { var s = "<rect width='400' height='600' fill='" + p.bg + "'/>", gap = 38, ph = r() * 6.28; for (var y = 0; y < 600; y += gap) for (var x = 0; x < 400; x += gap) { var t = (x / 400 + y / 600) / 2, rad = 2 + t * 14 * (0.55 + 0.7 * Math.abs(Math.sin(x * 0.05 + y * 0.04 + ph))); s += "<circle cx='" + (x + gap / 2) + "' cy='" + (y + gap / 2) + "' r='" + rad.toFixed(1) + "' fill='" + p.fg + "'/>"; } return s + "<circle cx='" + (110 + r() * 180 | 0) + "' cy='" + (150 + r() * 260 | 0) + "' r='42' fill='" + p.accent + "'/>"; }

  var GENS = { field: aField, arcs: aArcs, bau: aBau, poster: aPoster, waves: aWaves, half: aHalf };
  var GEN_BY_CAT = { illustration: ['bau', 'half', 'field'], painting: ['field', 'waves'], '3d': ['arcs', 'bau'], photography: ['field', 'half'], lettering: ['poster'], concept: ['waves', 'arcs', 'field'], mixed: ['half', 'bau', 'waves'] };
  var GEN_KEYS = Object.keys(GENS);

  function inner(seed, opts) {
    opts = opts || {};
    var s = (typeof seed === 'string') ? hashStr(seed) : (seed | 0);
    var r0 = mulberry32(s * 2654435761 + 12345);
    var pal = PAL[Math.abs(s * 3 + (r0() * PAL.length | 0)) % PAL.length];
    var key;
    if (opts.gen && GENS[opts.gen]) key = opts.gen;
    else if (opts.cat && GEN_BY_CAT[opts.cat]) { var pool = GEN_BY_CAT[opts.cat]; key = pool[(r0() * pool.length) | 0]; }
    else key = GEN_KEYS[Math.abs(s) % GEN_KEYS.length];
    return GENS[key](pal, mulberry32(Math.abs(s) * 99 + 7));
  }
  function hashStr(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; } return h; }

  function svg(seed, opts) {
    return "<svg viewBox='0 0 400 600' preserveAspectRatio='xMidYMid slice' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style='width:100%;height:100%;display:block'>" + inner(seed, opts) + "</svg>";
  }
  function dataUri(seed, opts) {
    return "data:image/svg+xml," + encodeURIComponent(svg(seed, opts));
  }

  window.SAGenArt = { svg: svg, dataUri: dataUri, PAL: PAL, GEN_KEYS: GEN_KEYS, hashStr: hashStr };
})();
