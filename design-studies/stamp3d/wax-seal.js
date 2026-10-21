// SecurityArts wax seal — programmatic Three.js object.
//
// Geometry is the real mark (seal.svg): 16 semicircular lobes on a notch circle,
// the die ring, and the five-point star, scaled so the seal's outer radius is 1.
// The surface is a radial heightfield whose outer ring of vertices sits exactly on
// the scalloped rim, so the silhouette is the mark itself, not an approximation.
// Die text and wax grain live in a bump map; the star is cut through with an alpha map
// so whatever the seal sits on shows through it, like the 2D wax.svg.
//
// mountWaxSeal(container, { mode: "hero" | "slam", art?, color? })
//   -> { slam(), setArt(source) -> { canvas, spot }, setColor(hex), setFallback(bool), dispose() }
// In "slam" mode the seal lands on a sheet of paper carrying `art` (any image/canvas),
// near the artwork's lower-right corner; setColor() re-inks the wax (e.g. from seal-ink.js).

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------- the mark, in seal units (outer radius = 1) ----------
const LOBES = 16;
const HALF = Math.PI / LOBES;                 // half the angle one lobe spans
const R_NOTCH = 0.8506;                       // where lobes meet (88.8 / 104.4)
const LOBE_D = R_NOTCH * Math.cos(HALF);      // lobe centre distance from seal centre
const LOBE_R = R_NOTCH * Math.sin(HALF);      // lobe radius (semicircle on the chord)
const RING_R = 0.6207;                        // die ring (64.8 / 104.4)
const STAR_OUT = 0.3563, STAR_IN = 0.1471;    // star circum / inner radius
const HEIGHT = 0.2;                           // wax thickness at the plateau
const BEVEL = 0.19;                           // how far in from the rim the edge rounds off

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Distance from centre to the scalloped rim along angle theta (seal space, +y = top, notch at top).
function rimRadius(theta) {
  let a = theta - Math.PI / 2 - HALF;
  a -= 2 * HALF * Math.round(a / (2 * HALF));           // angle to the nearest lobe centre
  const s = LOBE_D * Math.sin(a);
  return LOBE_D * Math.cos(a) + Math.sqrt(Math.max(0, LOBE_R * LOBE_R - s * s));
}

const STAR = Array.from({ length: 10 }, (_, i) => {
  const ang = Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? STAR_OUT : STAR_IN;
  return [r * Math.cos(ang), r * Math.sin(ang)];
});

// Signed distance to the star polygon (negative inside).
function sdStar(px, py) {
  let d = (px - STAR[0][0]) ** 2 + (py - STAR[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = STAR.length - 1; i < STAR.length; j = i, i++) {
    const [vix, viy] = STAR[i], [vjx, vjy] = STAR[j];
    const ex = vjx - vix, ey = vjy - viy, wx = px - vix, wy = py - viy;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= viy, c2 = py < vjy, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

// Wax height at a point. Mirrors the height map inside wax.svg.
function heightAt(x, y) {
  const r = Math.hypot(x, y);
  const e = rimRadius(Math.atan2(y, x)) - r;
  const t = clamp(e / BEVEL, 0, 1);
  let h = HEIGHT * Math.sqrt(1 - (1 - t) * (1 - t));             // rounded wax edge
  h *= 1 - 0.16 * smooth(R_NOTCH - 0.06, 1.0, r);                // lobes thin toward their tips
  h -= 0.055 * (1 - smooth(RING_R - 0.035, RING_R - 0.008, r));  // field pressed flat by the die
  h += 0.048 * Math.exp(-(((r - RING_R) / 0.02) ** 2));          // wax squeezed up round the die edge
  h = mix(0.01, h, smooth(0, 0.034, sdStar(x, y)));              // star pressed all the way through
  return Math.max(0, h);
}

function buildTop(NR, NT) {
  const count = 1 + NR * NT;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const put = (k, x, y) => {
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = heightAt(x, y);
    uv[k * 2] = (x + 1) / 2; uv[k * 2 + 1] = (y + 1) / 2;
  };
  put(0, 0, 0);
  for (let j = 0; j < NT; j++) {
    const th = (j / NT) * Math.PI * 2;
    const R = rimRadius(th), c = Math.cos(th), s = Math.sin(th);
    for (let i = 1; i <= NR; i++) {
      const r = (i / NR) * R;
      put(1 + (i - 1) * NT + j, r * c, r * s);
    }
  }
  const idx = (i, j) => 1 + (i - 1) * NT + (j % NT);
  const index = [];
  for (let j = 0; j < NT; j++) index.push(0, idx(1, j), idx(1, j + 1));
  for (let i = 1; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = idx(i, j), b = idx(i, j + 1), c = idx(i + 1, j), d = idx(i + 1, j + 1);
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function buildBottom(NT) {
  const shape = new THREE.Shape();
  for (let j = 0; j <= NT; j++) {
    const th = (j / NT) * Math.PI * 2, R = rimRadius(th);
    j === 0 ? shape.moveTo(R * Math.cos(th), R * Math.sin(th)) : shape.lineTo(R * Math.cos(th), R * Math.sin(th));
  }
  return new THREE.ShapeGeometry(shape, 1);
}

// ---------- textures (seal space -> canvas: x right, y up) ----------
const S = 2048;
const cx = (x) => ((x + 1) / 2) * S;
const cy = (y) => (1 - (y + 1) / 2) * S;

function starAlphaTexture() {
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, S, S);
  g.fillStyle = "#000"; g.beginPath();
  STAR.forEach(([x, y], i) => (i ? g.lineTo(cx(x), cy(y)) : g.moveTo(cx(x), cy(y))));
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function arcText(g, text, radius, center, span, top) {
  const chars = [...text];
  const w = chars.map((ch) => g.measureText(ch).width);
  const gap = (span * radius - w.reduce((a, b) => a + b, 0)) / (chars.length - 1);
  let s = (-span * radius) / 2;
  chars.forEach((ch, i) => {
    const mid = s + w[i] / 2;
    const ang = top ? center + mid / radius : center - mid / radius;
    g.save();
    g.translate(S / 2 + radius * Math.cos(ang), S / 2 + radius * Math.sin(ang));
    g.rotate(top ? ang + Math.PI / 2 : ang - Math.PI / 2);
    g.fillText(ch, -w[i] / 2, 0);
    g.restore();
    s += w[i] + gap;
  });
}

function bumpTexture() {
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  // poured wax is never perfectly smooth: low-amplitude grain around mid-grey
  const img = g.createImageData(S, S);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = 128 + (Math.random() - 0.5) * 14;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(2px)";
  g.drawImage(c, 0, 0);
  // the die text, pressed in (darker = lower). Soft edges read as a bevel.
  g.filter = "blur(1.6px)";
  g.fillStyle = "#2a2a2a";
  g.font = `700 ${Math.round(0.072 * S / 2)}px "Instrument Sans", system-ui, sans-serif`;
  g.textBaseline = "alphabetic";
  const px = S / 2;
  arcText(g, "SEALED BY SECURITYARTS", 0.445 * px, -Math.PI / 2, 1.188 / 0.445, true);
  arcText(g, "SHA-256 · ECDSA P-256", 0.501 * px, Math.PI / 2, 1.13 / 0.501, false);
  [-0.473, 0.473].forEach((x) => { g.beginPath(); g.arc(cx(x), cy(0), 0.016 * px, 0, Math.PI * 2); g.fill(); });
  g.filter = "none";
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- the art sheet the seal lands on ----------
const SHEET_W = 3.2, SHEET_H = 4.0;             // world units (4:5)
const ART_W = 1024, ART_H = 1280;               // texture pixels, same 4:5
const SEAL_SCALE = 0.58;                        // the seal's size in the slam scene (outer radius, world units)
const SHEET_PAD = 56;

/**
 * A 4:5 sheet of paper with `source` contain-fitted on it, plus where the seal lands:
 * spot = { x, y, r } in sheet pixels, just inside the artwork's lower-right corner.
 * With no source, the letterpress placeholder fills the sheet.
 */
export function artSheet(source) {
  const c = document.createElement("canvas"); c.width = ART_W; c.height = ART_H;
  const g = c.getContext("2d");
  const r = (SEAL_SCALE / SHEET_W) * ART_W;
  if (!source) {
    placeholderArt(g, ART_W, ART_H);
    return { canvas: c, spot: { x: ((0.95 + SHEET_W / 2) / SHEET_W) * ART_W, y: ((1.25 + SHEET_H / 2) / SHEET_H) * ART_H, r } };
  }
  g.fillStyle = "#F5F4EF"; g.fillRect(0, 0, ART_W, ART_H);
  const w = source.naturalWidth || source.videoWidth || source.width;
  const h = source.naturalHeight || source.videoHeight || source.height;
  const k = Math.min((ART_W - 2 * SHEET_PAD) / w, (ART_H - 2 * SHEET_PAD) / h);
  const dw = w * k, dh = h * k, dx = (ART_W - dw) / 2, dy = (ART_H - dh) / 2;
  g.drawImage(source, dx, dy, dw, dh);
  const inset = Math.min(r * 0.85, dw / 2, dh / 2);
  return { canvas: c, spot: { x: dx + dw - inset, y: dy + dh - inset, r } };
}
const sheetToWorld = ({ x, y }) => ({ x: (x / ART_W) * SHEET_W - SHEET_W / 2, z: (y / ART_H) * SHEET_H - SHEET_H / 2 });

function textureFrom(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// letterpress placeholder artwork (used when no real piece is given)
function placeholderArt(g, W, Hh) {
  g.fillStyle = "#D8E9F3"; g.fillRect(0, 0, W, Hh);
  g.fillStyle = "#171A1F"; g.fillRect(0, Hh * 0.62, W, Hh * 0.38);
  g.fillStyle = "#1585CF"; g.beginPath(); g.arc(W * 0.42, Hh * 0.42, W * 0.34, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#D42228"; g.beginPath(); g.moveTo(W * 0.1, Hh); g.lineTo(W * 0.95, Hh * 0.28); g.lineTo(W, Hh * 0.42); g.lineTo(W * 0.3, Hh); g.fill();
  g.strokeStyle = "#F5F4EF"; g.lineWidth = 10;
  for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(W * 0.06, Hh * (0.08 + k * 0.035)); g.lineTo(W * 0.34, Hh * (0.08 + k * 0.035)); g.stroke(); }
}

// ---------- capability ----------
// Lives in capability.js so pages can check it without loading Three.js.
import { shouldUseFallback } from "./capability.js";
export { shouldUseFallback };

// ---------- mount ----------
export async function mountWaxSeal(container, { mode = "hero", onStats, pointerTarget, art = null, color = "#D42228" } = {}) {
  const pointerEl = pointerTarget || container;   // e.g. the whole hero, when the seal sits behind the copy
  const canvas = container.querySelector("canvas");
  const fallback = container.querySelector(".fallback");

  let useFallback = shouldUseFallback();
  const applyFallback = () => {
    container.classList.toggle("is-fallback", useFallback);
    canvas.hidden = useFallback;
    if (fallback) fallback.hidden = !useFallback;
  };
  applyFallback();

  // The die text needs the display face loaded before it is painted into the bump map.
  try { await document.fonts.load('700 72px "Instrument Sans"'); } catch { /* falls back to system sans */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;   // keeps brand red and the artwork colours true (ACES desaturates)
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(mode === "hero" ? 28 : 30, 1, 0.1, 50);
  const camHome = mode === "hero" ? new THREE.Vector3(0, 4.4, 3.9) : new THREE.Vector3(0, 6.2, 4.6);
  const camLook = mode === "hero" ? new THREE.Vector3(0, 0.02, 0) : new THREE.Vector3(0, 0, 0.35);
  camera.position.copy(camHome); camera.lookAt(camLook);

  // light from the upper left, like the SVG (feDistantLight azimuth 225, elevation 40)
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-2.6, 4.4, -2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff1ec, 0.55);
  fill.position.set(2.2, 2.0, 3.2);
  scene.add(fill);

  // ground
  let artPlane = null;
  let sheet = artSheet(art);
  if (mode === "slam") {
    artPlane = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H),
      new THREE.MeshStandardMaterial({ map: textureFrom(sheet.canvas), roughness: 0.92 }));
    artPlane.rotation.x = -Math.PI / 2; artPlane.receiveShadow = true;
    scene.add(artPlane);
  } else {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.26 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
  }

  // the seal
  const NR = 200, NT = 640;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const bump = bumpTexture(); bump.anisotropy = aniso;
  const alpha = starAlphaTexture();
  const wax = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#B5171F"),          // replaced by applyColor() below
    roughness: 0.26, metalness: 0,
    clearcoat: 1.0, clearcoatRoughness: 0.06,     // fresh, just-set wax: a wet top coat
    specularIntensity: 1.0, ior: 1.5,
    sheen: 0.22, sheenRoughness: 0.45, sheenColor: new THREE.Color("#FF7A70"),
    bumpMap: bump, bumpScale: 3.6,
    alphaMap: alpha, alphaTest: 0.5,
  });
  const top = new THREE.Mesh(buildTop(NR, NT), wax);
  top.castShadow = true; top.receiveShadow = true;
  const bottom = new THREE.Mesh(buildBottom(NT), new THREE.MeshStandardMaterial({ color: "#8E141A", side: THREE.BackSide }));
  // Ink the wax so it READS as `hex` under this lighting: the lit clearcoat brightens the
  // base, so the base sits darker (×0.7 in linear light; #D42228 → ≈#B5171F, the tuned red).
  const WHITE = new THREE.Color("#ffffff");
  let splatMat = null;
  function applyColor(hex) {
    const c = new THREE.Color(hex);
    wax.color.copy(c).multiplyScalar(0.7);
    wax.sheenColor.copy(c).lerp(WHITE, 0.25);
    bottom.material.color.copy(c).multiplyScalar(0.41);
    if (splatMat) splatMat.color.set(hex);
  }

  const sealFlat = new THREE.Group();             // lie the XY-built seal flat, height up
  sealFlat.rotation.x = -Math.PI / 2;
  sealFlat.add(top, bottom);
  const spin = new THREE.Group(); spin.add(sealFlat);
  const tilt = new THREE.Group(); tilt.add(spin);
  const slamRig = new THREE.Group(); slamRig.add(tilt);
  if (mode === "slam") { const p = sheetToWorld(sheet.spot); slamRig.position.set(p.x, 0, p.z); slamRig.scale.setScalar(SEAL_SCALE); }
  const restScale = slamRig.scale.x;
  const restPos = slamRig.position.clone();       // updated in place by setArt()
  scene.add(slamRig);

  // pointer tilt
  const target = { x: 0, z: 0 };
  const onMove = (e) => {
    const r = pointerEl.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    target.x = ny * 0.22; target.z = -nx * 0.22;
  };
  const onLeave = () => { target.x = 0; target.z = 0; };
  pointerEl.addEventListener("pointermove", onMove);
  pointerEl.addEventListener("pointerleave", onLeave);

  // size
  // The slam scene is framed for a landscape-ish panel; in a narrow (portrait) one the
  // camera backs away along its line of sight so the whole sheet, and the seal, stay in frame.
  const camBase = camHome.clone();
  const SLAM_FIT_ASPECT = 1.05;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (mode === "slam") {
      const k = Math.max(1, SLAM_FIT_ASPECT / camera.aspect);
      camHome.copy(camLook).addScaledVector(camBase.clone().sub(camLook), k);
    }
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // splat: a ring of wax-red that spreads out across the surface on impact, then fades
  splatMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const splat = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.14, 128), splatMat);
  applyColor(color);
  splat.rotation.x = -Math.PI / 2;
  splat.position.set(restPos.x, 0.003, restPos.z);
  splat.visible = false;
  scene.add(splat);

  // slam: a heavy drop, a hard squash that spreads the wax, a wobble to rest, a camera jolt
  let slamT = mode === "slam" ? 0 : -1;
  const slowMo = Math.max(1, Number(new URLSearchParams(location.search).get("slow")) || 1); // ?slow=6 to review the press
  let shake = 0;
  const FALL = 0.5;
  const SETTLE = 1.05;
  const updateSlam = (dt) => {
    if (slamT < 0) return;
    slamT += dt / slowMo;
    if (slamT < FALL) {
      const e = (slamT / FALL) ** 4;                            // accelerates like something heavy
      slamRig.position.set(restPos.x, mix(4.4, restPos.y, e), restPos.z);
      slamRig.rotation.set(0, mix(-1.3, 0, e), mix(0.7, 0, e));
      slamRig.scale.setScalar(restScale * mix(1.5, 1, e));
      splat.visible = false;
      return;
    }
    const t = slamT - FALL;
    const sq = 1 - 0.38 * Math.exp(-t / 0.08) * Math.cos(t * 32);
    const spread = 1 + (1 - sq) * 0.7;
    slamRig.position.copy(restPos);
    slamRig.rotation.set(0, 0, 0);
    slamRig.scale.set(restScale * spread, restScale * sq, restScale * spread);
    shake = 0.12 * Math.exp(-t / 0.08);
    const p = clamp(t / 0.38, 0, 1);                              // splat ring: 380ms out and gone
    splat.visible = p < 1;
    splat.scale.setScalar(restScale * mix(1.0, 1.95, 1 - (1 - p) ** 3));
    splat.material.opacity = 0.55 * (1 - p);
    if (t > SETTLE) { slamT = -1; shake = 0; slamRig.scale.setScalar(restScale); splat.visible = false; }
  };

  // loop — paused when off screen or the tab is hidden
  let running = true, visible = true, raf = 0;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: 0.01 });
  io.observe(container);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVis);

  const clock = new THREE.Clock();
  let frames = 0, acc = 0;
  const frame = () => {
    raf = 0;
    if (!running || !visible || document.hidden || useFallback) return;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (mode === "hero") spin.rotation.y += dt * 0.28;
    tilt.rotation.x += (target.x - tilt.rotation.x) * 0.08;
    tilt.rotation.z += (target.z - tilt.rotation.z) * 0.08;
    updateSlam(dt);
    camera.position.set(camHome.x + (Math.random() - 0.5) * shake, camHome.y + (Math.random() - 0.5) * shake, camHome.z);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    frames++; acc += dt;
    if (acc > 0.5 && onStats) { onStats({ fps: Math.round(frames / acc), tris: top.geometry.index.count / 3 }); frames = 0; acc = 0; }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } };
  kick();

  return {
    slam() {
      if (useFallback) {
        if (fallback) { fallback.classList.remove("slam"); void fallback.offsetWidth; fallback.classList.add("slam"); }
        return;
      }
      slamT = 0; kick();
    },
    setFallback(on) { useFallback = on; applyFallback(); if (!on) kick(); },
    /** Put a new artwork under the seal; returns the sheet canvas and the landing spot (sheet px). */
    setArt(source) {
      sheet = artSheet(source);
      if (artPlane) {
        artPlane.material.map?.dispose();
        artPlane.material.map = textureFrom(sheet.canvas);
        artPlane.material.needsUpdate = true;
        const p = sheetToWorld(sheet.spot);
        restPos.set(p.x, 0, p.z);
        slamRig.position.copy(restPos);
        splat.position.set(p.x, 0.003, p.z);
      }
      kick();
      return sheet;
    },
    /** Re-ink the wax, e.g. with the colour seal-ink.js picked for this artwork. */
    setColor(hex) { applyColor(hex); kick(); },
    /** The current sheet (canvas + landing spot), for sampling the colour under the seal. */
    get sheet() { return sheet; },
    dispose() {
      running = false; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      pointerEl.removeEventListener("pointermove", onMove);
      pointerEl.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); }); });
      pmrem.dispose(); renderer.dispose();
    },
  };
}
