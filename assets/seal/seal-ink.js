// seal-ink.js — the seal picks its colour from the artwork it sits on.
//
// Two rules, because the treatments behave differently:
//  • Flat marks (modernised badge, knockout, rubber, ring text) have no shading of their
//    own, so they need LIGHTNESS contrast: the ink must reach 3:1 (the WCAG minimum for
//    graphics) against 90% of the pixels under the seal.
//  • Wax is an object with its own highlights and cast shadow, so it only has to stand
//    apart in COLOUR (OKLab distance). Red wax on a blue painting reads fine even though
//    red and blue are close in lightness.
//
// Two modes:
//  • "brand": chop red whenever it passes; otherwise the best of paper / ink / blue.
//  • "match": take the artwork's own dominant hue and push its lightness away from
//    what's under the seal until it passes. Greyscale art falls back to red's hue.
//
// Pixels come from a canvas, so images must be same-origin (or served with CORS and
// loaded with crossorigin="anonymous"). If the canvas is tainted, sealColour() returns
// null and the caller keeps the default red.

export const PALETTE = [
  { name: "red", label: "Chop red", hex: "#D42228" },
  { name: "paper", label: "Paper", hex: "#F5F4EF" },
  { name: "ink", label: "Ink", hex: "#171A1F" },
  { name: "blue", label: "Blue", hex: "#0F6DAA" },
];
export const DEFAULT_HEX = PALETTE[0].hex;

const MIN_CONTRAST = 3;          // WCAG 1.4.11 non-text contrast
const COVERAGE = 0.1;            // judge at the 10th-percentile pixel, so it holds over 90%
const WAX_MIN_DISTANCE = 0.16;   // OKLab distance; below this, wax melts into the art
const CAMO_DISTANCE = 0.08;      // pixels this close in colour hide a flat mark
const MAX_CAMO = 0.2;            // share of camouflaging pixels a mark can tolerate
const SAMPLE = 40;               // region is read at SAMPLE × SAMPLE pixels
const HUE_BINS = 24;
const MATCH_CHROMA = [0.08, 0.16];

// ---------- colour math (sRGB ⇄ linear ⇄ OKLab) ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toLinear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const contrast = (y1, y2) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const labDistance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const linearToHex = (lin) => "#" + lin.map((v) => Math.round(clamp(toGamma(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

/** @param {string} hex  "#RRGGBB" */
export function describe(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(toLinear);
  return { hex: hex.toUpperCase(), Y: luminance(lin), lab: linearToOklab(lin) };
}

/** OKLCH → hex, reducing chroma until the colour fits sRGB. */
export function oklchToHex(L, C, h) {
  for (let c = C; c > 0; c -= 0.004) {
    const lin = oklabToLinear([L, c * Math.cos(h), c * Math.sin(h)]);
    if (inGamut(lin)) return linearToHex(lin);
  }
  return linearToHex(oklabToLinear([L, 0, 0]));
}

export function toOklch(hex) {
  const [L, a, b] = describe(hex).lab;
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
}

// ---------- reading pixels ----------
function naturalSize(src) {
  return [src.naturalWidth || src.videoWidth || src.width, src.naturalHeight || src.videoHeight || src.height];
}

/**
 * Samples under a region of an image, canvas or video.
 * @param {CanvasImageSource} source
 * @param {{x:number,y:number,w:number,h:number}} rect  in the source's own pixels
 * @param {{disc?: boolean}} opts  disc: keep only the circle inscribed in the rect (the seal's footprint)
 * @returns {Array<{Y:number, lab:number[]}> | null}  null when the pixels can't be read
 */
export function readRegion(source, rect, { disc = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  let data;
  try {
    g.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, SAMPLE, SAMPLE);
    data = g.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;                                   // tainted (cross-origin) or not decoded yet
  }
  const out = [];
  const mid = (SAMPLE - 1) / 2;
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      if (disc && Math.hypot(x - mid, y - mid) > SAMPLE / 2) continue;
      const i = (y * SAMPLE + x) * 4;
      if (data[i + 3] < 128) continue;             // transparent pixels say nothing about the art
      const lin = [toLinear(data[i]), toLinear(data[i + 1]), toLinear(data[i + 2])];
      out.push({ Y: luminance(lin), lab: linearToOklab(lin) });
    }
  }
  return out.length ? out : null;
}

export const wholeImage = (source) => {
  const [w, h] = naturalSize(source);
  return { x: 0, y: 0, w, h };
};

/**
 * Maps an element sitting over an <img> (e.g. a badge) onto the image's own pixels,
 * honouring object-fit: cover / contain (centred) and the default fill.
 */
export function regionUnder(el, img) {
  const s = el.getBoundingClientRect();
  const r = img.getBoundingClientRect();
  const [nw, nh] = naturalSize(img);
  const fit = getComputedStyle(img).objectFit;
  let kx = r.width / nw, ky = r.height / nh, ox = 0, oy = 0;
  if (fit === "cover" || fit === "contain") {
    const k = fit === "cover" ? Math.max(kx, ky) : Math.min(kx, ky);
    kx = ky = k;
    ox = (r.width - nw * k) / 2;
    oy = (r.height - nh * k) / 2;
  }
  const x = clamp((s.left - r.left - ox) / kx, 0, nw - 1);
  const y = clamp((s.top - r.top - oy) / ky, 0, nh - 1);
  return { x, y, w: Math.max(1, Math.min(s.width / kx, nw - x)), h: Math.max(1, Math.min(s.height / ky, nh - y)) };
}

// ---------- scoring ----------
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

function scoreFlat(colour, px) {
  const low = percentile(px.map((p) => contrast(colour.Y, p.Y)), COVERAGE);
  const camo = px.filter((p) => labDistance(colour.lab, p.lab) < CAMO_DISTANCE).length / px.length;
  return { low, camo, passes: low >= MIN_CONTRAST && camo <= MAX_CAMO, value: low * (1 - camo) };
}

function scoreWax(colour, px) {
  const low = percentile(px.map((p) => labDistance(colour.lab, p.lab)), COVERAGE);
  return { low, passes: low >= WAX_MIN_DISTANCE, value: low };
}

const medianL = (px) => percentile(px.map((p) => p.lab[0]), 0.5);

/** Dominant hue by chroma-weighted histogram; null for greyscale art. */
export function dominantHue(px) {
  const bins = Array.from({ length: HUE_BINS }, () => ({ a: 0, b: 0, C: 0, n: 0 }));
  let chromatic = 0;
  for (const { lab: [, a, b] } of px) {
    const C = Math.hypot(a, b);
    if (C < 0.04) continue;
    chromatic++;
    const h = (Math.atan2(b, a) + 2 * Math.PI) % (2 * Math.PI);
    const bin = bins[Math.floor((h / (2 * Math.PI)) * HUE_BINS) % HUE_BINS];
    bin.a += a; bin.b += b; bin.C += C; bin.n++;
  }
  if (chromatic < px.length * 0.05) return null;
  const best = bins.reduce((bi, bin, i) => (bin.C > bins[bi].C ? i : bi), 0);
  // average the winning bin with its neighbours so a hue on a bin edge isn't split
  const near = [-1, 0, 1].map((d) => bins[(best + d + HUE_BINS) % HUE_BINS]);
  const sum = near.reduce((acc, bin) => ({ a: acc.a + bin.a, b: acc.b + bin.b, C: acc.C + bin.C, n: acc.n + bin.n }), { a: 0, b: 0, C: 0, n: 0 });
  return { h: Math.atan2(sum.b, sum.a), C: sum.C / Math.max(1, sum.n) };
}

const fmt = (v) => v.toFixed(1);

function pickFromPalette(px, kind) {
  const score = kind === "wax" ? scoreWax : scoreFlat;
  const rated = PALETTE.map((p) => ({ ...p, ...score(describe(p.hex), px) }));
  const red = rated[0];
  if (red.passes) return { ...red, why: kind === "wax" ? "Chop red wax: it stands apart from the art" : `Red holds at ${fmt(red.low)}:1` };
  // Nothing passing? The best scorer wins; ties go to red (blue shares red's lightness,
  // so on busy black-and-white art it can never actually read better).
  const best = rated.reduce((a, b) => (b.value > a.value + 1e-6 ? b : a));
  if (best === red) return { ...red, why: kind === "wax" ? "Nothing stands apart here; red holds best" : `Nothing reaches 3:1 here; red holds best at ${fmt(red.low)}:1` };
  const why = kind === "wax"
    ? `Red would melt into this art, so ${best.label.toLowerCase()} wax`
    : `Red only reaches ${fmt(red.low)}:1 here, ${best.label.toLowerCase()} reaches ${fmt(best.low)}:1`;
  return { ...best, why };
}

function pickMatched(px, whole, kind) {
  const dom = dominantHue(whole);
  const redHue = toOklch(DEFAULT_HEX);
  const h = dom ? dom.h : redHue.h;
  const C = dom ? clamp(dom.C, ...MATCH_CHROMA) : redHue.C;
  const under = medianL(px);
  const ideal = kind === "wax" ? (under > 0.5 ? 0.46 : 0.84) : (under > 0.6 ? 0.36 : 0.9);
  const score = kind === "wax" ? scoreWax : scoreFlat;
  const candidates = [];
  for (let L = 0.18; L <= 0.97; L += 0.02) {
    const hex = oklchToHex(L, C, h);
    candidates.push({ L, hex, ...score(describe(hex), px) });
  }
  const passing = candidates.filter((c) => c.passes);
  const pick = passing.length
    ? passing.reduce((a, b) => (Math.abs(b.L - ideal) < Math.abs(a.L - ideal) ? b : a))
    : candidates.reduce((a, b) => (b.value > a.value ? b : a));
  const source = dom ? "the art's own hue" : "red (the art is greyscale)";
  const why = kind === "wax" ? `Matched to ${source}` : `Matched to ${source}, ${fmt(pick.low)}:1`;
  return { name: "match", label: "Matched", hex: pick.hex, low: pick.low, passes: pick.passes, why };
}

/**
 * The colour a seal should be, given the art under it.
 * @param {CanvasImageSource} source  the artwork (same-origin)
 * @param {{x:number,y:number,w:number,h:number}} rect  the seal's footprint, in source pixels
 * @param {{kind?: "flat"|"wax", mode?: "brand"|"match"}} opts
 * @returns {{hex:string, label:string, name:string, why:string, passes:boolean} | null}
 */
export function sealColour(source, rect, { kind = "flat", mode = "brand" } = {}) {
  const px = readRegion(source, rect);
  if (!px) return null;
  if (mode === "match") {
    const whole = readRegion(source, wholeImage(source), { disc: false }) || px;
    return pickMatched(px, whole, kind);
  }
  return pickFromPalette(px, kind);
}

// ---------- recolouring the 2D wax (wax.svg) ----------
// wax.svg is lit with SVG filters around one red ramp. To tint it, each ramp colour
// keeps its lightness offset, chroma ratio and hue offset from the base red.
const WAX_RAMP = ["#D42228", "#A8161C", "#FF9A92", "#FFC2BC", "#FFF4F2"];
const svgCache = new Map();

function rampFor(hex) {
  const base = toOklch(WAX_RAMP[0]);
  const target = toOklch(hex);
  return WAX_RAMP.map((c) => {
    const o = toOklch(c);
    const L = clamp(target.L + (o.L - base.L), 0.08, 0.99);
    const C = target.C * (o.C / base.C);
    return oklchToHex(L, C, target.h + (o.h - base.h));
  });
}

/**
 * A blob: URL for wax.svg tinted to `hex`. Cached per colour.
 * @param {string} hex
 * @param {string|URL} [src]  the wax.svg to tint
 */
export async function tintedWaxUrl(hex, src = new URL("./wax.svg", import.meta.url)) {
  const key = `${src}|${hex}`;
  if (svgCache.has(key)) return svgCache.get(key);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`wax.svg: HTTP ${res.status}`);
  const ramp = rampFor(hex);
  const swap = new Map(WAX_RAMP.map((from, i) => [from, ramp[i]]));
  const text = (await res.text()).replace(new RegExp(WAX_RAMP.join("|"), "gi"), (m) => swap.get(m.toUpperCase()));
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  svgCache.set(key, url);
  return url;
}
