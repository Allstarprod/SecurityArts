// Shared filesystem paths. Kept tiny and dependency-free so every module
// (auth, security/audit, the file driver) agrees on where local state lives.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
export const BLOB_DIR = path.join(DATA_DIR, "blobs");

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
export function ensureBlobDir() {
  ensureDataDir();
  if (!fs.existsSync(BLOB_DIR)) fs.mkdirSync(BLOB_DIR, { recursive: true });
}
