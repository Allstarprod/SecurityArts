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
//
// Callers hand us an image ALREADY decoded + sniffed by lib/image.mjs ({ bytes, type,
// ext }). This module never parses a data URI or trusts a client Content-Type — the
// old decodeDataUri() here accepted text/html and image/svg+xml verbatim (audit HIGH #3).
import crypto from "node:crypto";

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "work-images";

export const blobStoreActive = Boolean(URL_BASE && KEY);

const PUBLIC_PREFIX = `${URL_BASE}/storage/v1/object/public/${BUCKET}/`;

export function publicUrl(objectPath) {
  return PUBLIC_PREFIX + objectPath;
}

// Upload a sniffed image ({ bytes, type, ext }) for a work; returns the public CDN URL,
// or null on any failure (caller falls back to the repo driver's blob storage — never
// breaks publish).
export async function putImage(workId, image) {
  if (!blobStoreActive) return null;
  try {
    const { bytes, type, ext } = image;
    if (!Buffer.isBuffer(bytes) || !type || !ext) return null;
    // content-addressed-ish name: stable per work, cache-friendly, no collisions
    const objectPath = `${encodeURIComponent(workId)}-${crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.${ext}`;
    const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": type, // from magic bytes, never from the client
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

// Best-effort removal of a work's object given the public URL we stored on it.
// Returns true when the object is gone (or was never ours to delete). Never throws:
// a stale object in the bucket is a cost problem, not a correctness one.
export async function deleteImage(imgUrl) {
  if (!blobStoreActive || typeof imgUrl !== "string" || !imgUrl.startsWith(PUBLIC_PREFIX)) return false;
  const objectPath = imgUrl.slice(PUBLIC_PREFIX.length);
  try {
    const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok && res.status !== 404) console.error(`blobstore delete failed (${res.status}) for ${objectPath}`);
    return res.ok || res.status === 404;
  } catch (e) {
    console.error("blobstore delete error:", e.message);
    return false;
  }
}
