// Google OAuth 2.0 (authorization-code flow + PKCE) — dependency-free, inert-by-default.
//
// Configure (both required): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Google Cloud →
// APIs & Services → Credentials → OAuth client ID, type "Web application"). Optional
// GOOGLE_REDIRECT_URI overrides the one derived from the request host. Register the
// redirect URI (…/api/auth/google/callback) in that same OAuth client.
import crypto from "node:crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export const googleConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export function redirectUri(req, https) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${https ? "https" : "http"}://${req.headers.host}/api/auth/google/callback`;
}

// PKCE (RFC 7636): a per-login secret the callback must present when redeeming the
// code, so an intercepted authorization code alone is worthless. The verifier lives
// in our HttpOnly state cookie; only its S256 digest goes to Google.
export function pkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url"); // 64 chars, within 43–128
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authUrl({ state, redirect, codeChallenge }) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

// Exchange the authorization code for tokens, then read the id_token's claims. The
// id_token is trusted WITHOUT re-verifying its JWT signature: it arrives straight from
// Google's token endpoint over TLS in a server-to-server request authenticated by our
// client secret — there is no untrusted party in this path to forge it. We DO check
// the claims that bind the token to us (aud = our client id, iss = Google, not expired;
// finding 15) so a token minted for some other client can never sign a user in here.
export async function exchangeCode({ code, redirect, codeVerifier }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirect,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!res.ok) throw Object.assign(new Error("google token exchange failed"), { status: 502 });
  const tok = await res.json();
  const claims = verifyIdTokenClaims(decodeIdToken(tok.id_token));
  if (!claims || !claims.email || !claims.sub) throw Object.assign(new Error("google id_token rejected"), { status: 502 });
  return {
    email: String(claims.email).toLowerCase(),
    name: claims.name || "",
    emailVerified: claims.email_verified === true || claims.email_verified === "true", // absent claim ≠ verified
    sub: String(claims.sub),
  };
}

// Claim checks per OpenID Connect Core §3.1.3.7 (the parts that matter once the
// signature is vouched for by the TLS + client-secret channel above). Exported for tests.
export function verifyIdTokenClaims(claims, { clientId = CLIENT_ID, now = Date.now() } = {}) {
  if (!claims || typeof claims !== "object") return null;
  if (!ISSUERS.includes(claims.iss)) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!clientId || !aud.includes(clientId)) return null;
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 <= now) return null;
  return claims;
}

function decodeIdToken(idToken) {
  try {
    const payload = String(idToken).split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return null; }
}
