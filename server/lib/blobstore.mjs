// Supabase Storage blob store — moves image bytes OUT of the database entirely.
//
// When active, published images are uploaded to the public `work-images` bucket and
// works carry a CDN-served `imgUrl` instead of megabytes of base64. Detail requests
// return that URL (an <img src> takes a URL exactly like a data URI, so no frontend
// changes), and the DB/API hot path never touches image bytes again — the biggest
// single lever for RAM, DB size, and egress at scale.
//
// Activation (both required, else this module is inert and blobs stay in the repo
// driver exactly as before — zero behavior change):
//   SUPABASE_URL          e.g. https://ixdkfakibuctwhgwngsw.supabase.co
//   SUPABASE_SERVICE_KEY  service_role key (Dashboard → Settings → API). Server-only,
//                         NEVER shipped to a browser — uploads bypass RLS with it.
// Optional:
//   SUPABASE_BUCKET       bucket name (default: work-images; created, public)
import crypto from "node:crypto";

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "work-images";

export const blobStoreActive = Boolean(URL_BASE && KEY);

function decodeDataUri(input) {
  const s = String(input);
  if (!s.startsWith("data:")) {
    // raw base64 (no data: prefix) — treat as png bytes
    return { bytes: Buffer.from(s, "base64"), type: "image/png", ext: "png" };
  }
  const comma = s.indexOf(",");
  const header = s.slice(5, comma); // e.g. "image/svg+xml" or "image/png;base64"
  const isB64 = /;base64$/i.test(header);
  const type = header.replace(/;base64$/i, "") || "application/octet-stream";
  const payload = s.slice(comma + 1);
  const bytes = isB64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  const ext = { "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[type] || "bin";
  return { bytes, type, ext };
}

export function publicUrl(objectPath) {
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

// Upload a data-URI image for a work; returns the public CDN URL, or null on any
// failure (caller falls back to the repo driver's blob storage — never breaks publish).
export async function putImage(workId, dataUri) {
  if (!blobStoreActive) return null;
  try {
    const { bytes, type, ext } = decodeDataUri(dataUri);
    // content-addressed-ish name: stable per work, cache-friendly, no collisions
    const objectPath = `${encodeURIComponent(workId)}-${crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.${ext}`;
    const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": type,
        "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: bytes,
    });
    if (!res.ok) {
      console.error(`blobstore upload failed (${res.status}) for ${workId}`);
      return null;
    }
    return publicUrl(objectPath);
  } catch (e) {
    console.error("blobstore upload error:", e.message);
    return null;
  }
}
