// tiles.js — pieces of the wall shared by profiles, your account, the certificate and
// verify pages: safe DOM building, the Modernised seal badge (its ink picked from the art
// under it), lazily loaded tiles that link to a work's certificate, and file fingerprints.
// Nothing from the API is ever parsed as HTML.
import { sealColour } from "./seal/seal-ink.js";

export const CAT_LABEL = {
  painting: "Painting", illustration: "Illustration", photography: "Photography", "3d": "3D",
  lettering: "Lettering", concept: "Concept art", mixed: "Mixed media",
};
const IMAGE_CONCURRENCY = 4;
const RETRY_DELAYS = [2500, 8000];
const SVG = "http://www.w3.org/2000/svg";
// Geometry of /assets/seal/modern.svg, inked with currentColor so the badge can change ink.
const MODERN_PATHS = [
  ["path", { fill: "none", stroke: "currentColor", "stroke-width": "7.5", "stroke-linejoin": "round",
    d: "M120,35.1 A21.97,21.97 0 0 1 162.45,46.47 A21.97,21.97 0 0 1 193.53,77.55 A21.97,21.97 0 0 1 204.9,120 A21.97,21.97 0 0 1 193.53,162.45 A21.97,21.97 0 0 1 162.45,193.53 A21.97,21.97 0 0 1 120,204.9 A21.97,21.97 0 0 1 77.55,193.53 A21.97,21.97 0 0 1 46.47,162.45 A21.97,21.97 0 0 1 35.1,120 A21.97,21.97 0 0 1 46.47,77.55 A21.97,21.97 0 0 1 77.55,46.47 A21.97,21.97 0 0 1 120,35.1 Z" }],
  ["circle", { cx: "120", cy: "120", r: "62", fill: "none", stroke: "currentColor", "stroke-width": "6" }],
  ["path", { fill: "currentColor", d: "M120,80 L131.64,107.98 L161.85,110.4 L138.83,130.12 L145.86,159.6 L120,143.8 L94.14,159.6 L101.17,130.12 L78.15,110.4 L108.36,107.98 Z" }],
];

/** Builds an element; props.text sets textContent, props.class the class name. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.filter(Boolean));
  return node;
}

export function modernMark() {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 240 240");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of MODERN_PATHS) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}

export const when = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

export async function sha256Hex(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const certificateUrl = (id) => `/seal/${encodeURIComponent(id)}`;

/** The badge takes whichever palette ink holds against the art right under it. */
function colourBadge(badge, img) {
  const kx = img.naturalWidth / img.clientWidth;
  const ky = img.naturalHeight / img.clientHeight;
  if (!Number.isFinite(kx) || !Number.isFinite(ky)) return;
  const rect = { x: badge.offsetLeft * kx, y: badge.offsetTop * ky, w: badge.offsetWidth * kx, h: badge.offsetHeight * ky };
  const pick = sealColour(img, rect, { kind: "flat" });
  if (pick) badge.style.color = pick.hex;
}

class PermanentImageError extends Error {}

/**
 * A grid of tiles linking to certificates. Images load lazily, a few at a time;
 * a piece whose image can't be shown leaves the grid (its certificate still exists).
 * @param {HTMLElement} list the <ul class="masonry">
 * @param {{ onRemoved?: (left:number) => void }} [opts]
 */
export function createGrid(list, { onRemoved } = {}) {
  let active = 0;
  const waiting = [];
  const pump = () => {
    while (active < IMAGE_CONCURRENCY && waiting.length) {
      const job = waiting.shift();
      active++;
      job().finally(() => { active--; pump(); });
    }
  };
  const queue = (tile, attempt) => { waiting.push(() => load(tile, attempt)); pump(); };
  const seen = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      seen.unobserve(target);
      queue(target, 0);
    }
  }, { rootMargin: "400px 0px" });

  async function source(w) {
    if (w.imgUrl) return w.imgUrl;
    let full;
    try { full = await window.SA_API.getWork(w.id); }
    catch (err) {
      if (/not found/i.test(err?.message || "")) throw new PermanentImageError("gone");
      throw err;
    }
    if (!full?.img) throw new PermanentImageError("no image");
    return full.img;
  }

  async function load(tile, attempt) {
    if (!tile.isConnected) return;
    const frame = tile.querySelector(".piece__frame");
    const img = frame.querySelector("img");
    try {
      const src = await source(tile._work);
      if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
      img.src = src;
      try { await img.decode(); } catch { throw new PermanentImageError("undecodable"); }
      frame.classList.add("is-loaded");
      colourBadge(frame.querySelector(".piece__badge"), img);
    } catch (err) {
      if (!tile.isConnected) return;
      if (!(err instanceof PermanentImageError) && attempt < RETRY_DELAYS.length) {
        setTimeout(() => queue(tile, attempt + 1), RETRY_DELAYS[attempt]);
        return;
      }
      if (err instanceof PermanentImageError) {
        tile.remove();
        onRemoved?.(list.children.length);
      } else {
        frame.classList.add("is-loaded", "is-failed");
        frame.prepend(el("span", { class: "piece__failed", text: "Image didn't load" }));
      }
    }
  }

  function tile(w) {
    const credit = w.artist || "Uncredited";
    const medium = CAT_LABEL[w.cat] || "";
    const li = el("li", { class: "piece" },
      el("a", { class: "piece__open", href: certificateUrl(w.id), "aria-label": `Certificate for “${w.title}”, credited to ${credit}` },
        el("span", { class: "piece__frame" },
          el("img", { alt: `${w.title}, credited to ${credit}`, decoding: "async" }),
          el("span", { class: "piece__badge" }, modernMark()))),
      el("p", { class: "piece__cap" },
        el("span", { class: "piece__title", text: w.title }),
        el("span", { class: "piece__meta", text: medium ? `${credit} · ${medium}` : credit })));
    li._work = w;
    seen.observe(li);
    return li;
  }

  return {
    show(works) { list.replaceChildren(...works.map(tile)); },
    clear() { seen.disconnect(); waiting.length = 0; list.replaceChildren(); },
  };
}
