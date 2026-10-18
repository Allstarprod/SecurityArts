// Should this device get the flat (2D) seal instead of the 3D one? Kept apart from
// wax-seal.js so a page can decide without downloading Three.js first.
// ?force3d / ?fallback override for review.
export function shouldUseFallback() {
  const q = new URLSearchParams(location.search);
  if (q.has("force3d")) return false;
  if (q.has("fallback")) return true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse && (navigator.hardwareConcurrency || 4) <= 6) return true;   // most phones: pre-rendered instead
  try {
    const c = document.createElement("canvas");
    return !(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return true; }
}
