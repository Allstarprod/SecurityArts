// Clerk sign-in: token verification and account linking (server/lib/clerk.mjs).
// Runs offline: tokens are signed with a throwaway RSA key and the Clerk API is faked.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySessionToken, frontendApiHost, primaryEmail, linkClerkUser, tokenFrom } from "../lib/clerk.mjs";

const ISSUER = "https://sharp-seal-12.clerk.accounts.dev";
const ORIGIN = "http://127.0.0.1:4174";
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const { privateKey: otherKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const nowS = Math.floor(NOW / 1000);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(claims, { key = privateKey, alg = "RS256", kid = "ins_test" } = {}) {
  const head = b64({ alg, kid, typ: "JWT" });
  const body = b64({ iss: ISSUER, sub: "user_abc", azp: ORIGIN, iat: nowS, nbf: nowS - 1, exp: nowS + 60, ...claims });
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const opts = { now: NOW, issuer: ISSUER, parties: new Set([ORIGIN]), keyFor: async (kid) => (kid === "ins_test" ? publicKey : null) };

test("frontendApiHost decodes the host from a publishable key", () => {
  const pk = "pk_test_" + Buffer.from("sharp-seal-12.clerk.accounts.dev$").toString("base64");
  assert.equal(frontendApiHost(pk), "sharp-seal-12.clerk.accounts.dev");
  assert.equal(frontendApiHost("sk_test_nope"), null);
  assert.equal(frontendApiHost("pk_test_" + Buffer.from("evil.com/<x>$").toString("base64")), null);
});

test("a valid token verifies and returns its claims", async () => {
  const claims = await verifySessionToken(jwt({}), opts);
  assert.equal(claims.sub, "user_abc");
});

test("tokens are rejected when forged, expired, early, foreign or malformed", async () => {
  const cases = {
    "signed by another key": jwt({}, { key: otherKey }),
    "expired": jwt({ exp: nowS - 60 }),
    "not yet valid": jwt({ nbf: nowS + 60 }),
    "wrong issuer": jwt({ iss: "https://evil.clerk.accounts.dev" }),
    "minted for another site": jwt({ azp: "https://evil.example" }),
    "no authorized party": jwt({ azp: undefined }),
    "not a user subject": jwt({ sub: "org_123" }),
    "unknown key id": jwt({}, { kid: "ins_other" }),
  };
  for (const [why, token] of Object.entries(cases)) assert.equal(await verifySessionToken(token, opts), null, why);
  const [h, p] = jwt({}).split(".");
  const none = `${Buffer.from(JSON.stringify({ alg: "none", kid: "ins_test" })).toString("base64url")}.${p}.`;
  assert.equal(await verifySessionToken(none, opts), null, "alg none");
  assert.equal(await verifySessionToken(`${h}.${p}`, opts), null, "two parts");
  assert.equal(await verifySessionToken("", opts), null, "empty");
  assert.equal(await verifySessionToken(null, opts), null, "null");
});

test("tokenFrom prefers the Authorization header, then the __session cookie", () => {
  assert.equal(tokenFrom({ headers: { authorization: "Bearer abc" } }, { __session: "xyz" }), "abc");
  assert.equal(tokenFrom({ headers: {} }, { __session: "xyz" }), "xyz");
  assert.equal(tokenFrom({ headers: {} }, {}), null);
});

// ---- linking ----
function fakeUsers(initial = []) {
  const rows = initial.map((u) => ({ clerkId: null, ...u }));
  return {
    rows,
    async findByClerkId(id) { return rows.find((u) => u.clerkId === id) || null; },
    async findById(id) { return rows.find((u) => u.id === id) || null; },
    async findByEmail(email) { return rows.find((u) => u.email === email) || null; },
    async update(id, patch) { const u = rows.find((x) => x.id === id); Object.assign(u, patch); return u; },
    async create(u) {
      if (rows.some((x) => x.clerkId && x.clerkId === u.clerkId)) throw Object.assign(new Error("taken"), { code: "CLERK_ID_TAKEN" });
      rows.push(u); return u;
    },
  };
}
function fakeApi(clerkUser) {
  const calls = { externalIds: [] };
  return {
    calls,
    async get() { return clerkUser; },
    async setExternalId(id, ext) { calls.externalIds.push([id, ext]); },
  };
}
const clerkUser = (over = {}) => ({
  id: "user_abc", external_id: null, first_name: "Ana", last_name: "Ruiz", username: null,
  primary_email_address_id: "idn_1",
  email_addresses: [{ id: "idn_1", email_address: "Ana@Example.com", verification: { status: "verified" } }],
  ...over,
});

test("the repo exposes every user method Clerk linking and the import rely on", async () => {
  const { repo } = await import("../lib/repo.mjs");
  for (const m of ["findByClerkId", "findById", "findByEmail", "update", "create", "listAll"]) {
    assert.equal(typeof repo.users[m], "function", `repo.users.${m}`);
  }
});

test("primaryEmail lowercases and reports verification", () => {
  assert.deepEqual(primaryEmail(clerkUser()), { email: "ana@example.com", verified: true });
});

test("an already-linked user is returned without calling Clerk", async () => {
  const users = fakeUsers([{ id: "usr_1", email: "ana@example.com", clerkId: "user_abc" }]);
  const api = { get: async () => { throw new Error("should not be called"); } };
  assert.equal((await linkClerkUser("user_abc", { users, api })).id, "usr_1");
});

test("an imported user links through external_id", async () => {
  const users = fakeUsers([{ id: "usr_old", email: "someone@else.com", emailVerified: false }]);
  const user = await linkClerkUser("user_abc", { users, api: fakeApi(clerkUser({ external_id: "usr_old" })), welcome: () => assert.fail("no welcome for imports") });
  assert.equal(user.id, "usr_old");
  assert.equal(user.clerkId, "user_abc");
  assert.equal(user.emailVerified, true);
});

test("a verified email links an existing account and records the external id", async () => {
  const users = fakeUsers([{ id: "usr_2", email: "ana@example.com" }]);
  const api = fakeApi(clerkUser());
  const user = await linkClerkUser("user_abc", { users, api, welcome: () => assert.fail("no welcome for existing accounts") });
  assert.equal(user.id, "usr_2");
  assert.equal(user.clerkId, "user_abc");
  assert.deepEqual(api.calls.externalIds, [["user_abc", "usr_2"]]);
});

test("an unverified email never links or creates anything", async () => {
  const users = fakeUsers([{ id: "usr_2", email: "ana@example.com" }]);
  const api = fakeApi(clerkUser({ email_addresses: [{ id: "idn_1", email_address: "ana@example.com", verification: { status: "unverified" } }] }));
  assert.equal(await linkClerkUser("user_abc", { users, api }), null);
  assert.equal(users.rows[0].clerkId, null);
  assert.equal(users.rows.length, 1);
});

test("an account already linked to a different Clerk user is not taken over", async () => {
  const users = fakeUsers([{ id: "usr_2", email: "ana@example.com", clerkId: "user_other" }]);
  assert.equal(await linkClerkUser("user_abc", { users, api: fakeApi(clerkUser()) }), null);
  assert.equal(users.rows[0].clerkId, "user_other");
});

test("a new Clerk user gets a fresh account, an external id and a welcome", async () => {
  const users = fakeUsers([]);
  const api = fakeApi(clerkUser());
  const welcomed = [];
  const user = await linkClerkUser("user_abc", { users, api, welcome: (u) => welcomed.push(u.email) });
  assert.match(user.id, /^usr_[0-9a-f-]{36}$/);
  assert.equal(user.email, "ana@example.com");
  assert.equal(user.name, "Ana Ruiz");
  assert.equal(user.pass, "clerk");
  assert.equal(user.emailVerified, true);
  assert.deepEqual(api.calls.externalIds, [["user_abc", user.id]]);
  assert.deepEqual(welcomed, ["ana@example.com"]);
});
