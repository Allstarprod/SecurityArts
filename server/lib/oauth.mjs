// Google OAuth 2.0 (authorization-code flow) — dependency-free, inert-by-default.
//
// Configure (both required): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Google Cloud →
// APIs & Services → Credentials → OAuth client ID, type "Web application"). Optional
// GOOGLE_REDIRECT_URI overrides the one derived from the request host. Register the
// redirect URI (…/api/auth/google/callback) in that same OAuth client.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export const googleConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function redirectUri(req, https) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${https ? "https" : "http"}://${req.headers.host}/api/auth/google/callback`;
}

export function authUrl({ state, redirect }) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

// Exchange the authorization code for tokens, then read the id_token's claims. The
// id_token is trusted WITHOUT re-verifying its JWT signature: it arrives straight from
// Google's token endpoint over TLS in a server-to-server request authenticated by our
// client secret — there is no untrusted party in this path to forge it.
export async function exchangeCode({ code, redirect }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw Object.assign(new Error("google token exchange failed"), { status: 502 });
  const tok = await res.json();
  const claims = decodeIdToken(tok.id_token);
  if (!claims || !claims.email) throw Object.assign(new Error("google returned no email"), { status: 502 });
  return {
    email: String(claims.email).toLowerCase(),
    name: claims.name || "",
    emailVerified: claims.email_verified === true || claims.email_verified === "true", // absent claim ≠ verified
    sub: claims.sub,
  };
}

function decodeIdToken(idToken) {
  try {
    const payload = String(idToken).split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return null; }
}
