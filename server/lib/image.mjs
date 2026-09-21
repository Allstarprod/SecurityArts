// Image intake — the ONLY way client-supplied image bytes enter the system.
//
// The client's declared MIME type is never trusted (audit HIGH #3: an "image" of
// text/html or image/svg+xml was accepted and hosted on our bucket). We require a
// base64 data URL with an image/* prefix, decode it, and identify the real format
// from magic bytes. Only raster formats are accepted — SVG is XML, can carry scripts,
// and is rejected on purpose. The sniffed type drives the stored Content-Type.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF = Buffer.from("RIFF", "ascii");
const WEBP = Buffer.from("WEBP", "ascii");

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Identify a raster format from its leading bytes; null for anything else.
export function sniffImageType(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return { type: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG)) return { type: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).equals(RIFF) && bytes.subarray(8, 12).equals(WEBP)) return { type: "image/webp", ext: "webp" };
  return null;
}

// Decode a `data:image/*;base64,…` string into { bytes, type, ext, dataUri } where
// `type`/`ext` come from the bytes and `dataUri` is re-encoded with THAT type (so what
// we store and serve never carries the client's claimed MIME). Returns null when the
// input isn't a base64 image data URL, exceeds maxBytes, or isn't PNG/JPEG/WebP.
export function decodeImageDataUri(input, { maxBytes = 6 * 1024 * 1024 } = {}) {
  if (typeof input !== "string") return null;
  const m = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(input);
  if (!m) return null;
  const payload = m[1].replace(/\s+/g, "");
  if (payload.length > Math.ceil(maxBytes / 3) * 4 + 4) return null; // cheap pre-check before decoding
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length || bytes.length > maxBytes) return null;
  const kind = sniffImageType(bytes);
  if (!kind) return null;
  return { bytes, type: kind.type, ext: kind.ext, dataUri: `data:${kind.type};base64,${bytes.toString("base64")}` };
}
