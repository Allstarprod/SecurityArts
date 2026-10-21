// join.js — sign up, sign in, forgot password and reset password on one page.
// Same API calls as the old login page (window.SA_API.auth.*); new design and voice.
import { initSite, showSignedIn, currentUser } from "./site.js";

const MODES = {
  signup: {
    eyebrow: "Join SecurityArts", title: ["Your work, ", "on the record."],
    sub: "Make an account to seal finished pieces, get a public certificate for each one, and put them up on the wall.",
    submit: "Create account", busy: "Creating your account…", doc: "Join",
  },
  signin: {
    eyebrow: "Welcome back", title: ["Good to see ", "you."],
    sub: "Sign in to seal new work and keep up with the wall.",
    submit: "Sign in", busy: "Signing you in…", doc: "Sign in",
  },
  forgot: {
    eyebrow: "Reset access", title: ["Forgot it? ", "Happens."],
    sub: "Tell us your email and we'll send a link to set a new password.",
    submit: "Send reset link", busy: "Sending…", doc: "Reset your password",
  },
  reset: {
    eyebrow: "New password", title: ["Set a ", "new one."],
    sub: "Pick a new password and you're back in.",
    submit: "Set new password", busy: "Updating…", doc: "New password",
  },
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASS = 8;
const MAX_PASS = 200;
const DEFAULT_NEXT = "/wall";

const $ = (id) => document.getElementById(id);
const api = window.SA_API;
const params = new URLSearchParams(location.search);
const resetToken = params.get("token");
let mode = resetToken ? "reset" : (MODES[params.get("mode")] ? params.get("mode") : "signin");
if (mode === "reset" && !resetToken) mode = "forgot";
let googleOn = false;
let busy = false;                       // a request is in flight: don't let the mode change under it

// Where to go after signing in: only a path on this site (no open redirect: no //host, no scheme).
function nextUrl() {
  const n = params.get("next");
  return n && /^\/(?![/\\])[A-Za-z0-9_\-/@.]*(\?[^\s#\\]*)?$/.test(n) && !n.includes("..") ? n : DEFAULT_NEXT;
}

function firstName(user) { return String(user?.name || "there").trim().split(/\s+/)[0].slice(0, 24); }

function button(text, onClick, cls = "linkish") {
  const b = document.createElement("button");
  b.type = "button"; b.className = cls; b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function link(text, href, cls) {
  const a = document.createElement("a");
  a.href = href; a.className = cls; a.textContent = text;
  return a;
}

// ---------- notices (red is the brand, so problems are ink-on-sky, not red) ----------
function note(el, text, kind) {
  el.hidden = !text;
  el.textContent = text || "";
  el.className = `notice${kind ? ` notice--${kind}` : ""}`;
}
// The visible notice plus an always-present live region, written a frame later so
// screen readers announce it even when the same text repeats.
function say(text, kind) {
  note($("note"), text, kind);
  const live = $("live");
  live.textContent = "";
  if (text) requestAnimationFrame(() => { live.textContent = text; });
}

function markInvalid(input, bad) {
  if (bad) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

// ---------- modes ----------
function render() {
  const m = MODES[mode];
  document.title = `${m.doc} — SecurityArts`;
  $("eyebrow").textContent = m.eyebrow;
  const em = document.createElement("em");
  em.textContent = m.title[1];
  $("title").replaceChildren(m.title[0], em);
  $("sub").textContent = m.sub;
  $("submit").textContent = m.submit;
  $("nameField").hidden = mode !== "signup";
  $("emailField").hidden = mode === "reset";
  $("passField").hidden = mode === "forgot";
  $("passLabel").textContent = mode === "reset" ? "New password" : "Password";
  $("passHint").hidden = !(mode === "signup" || mode === "reset");
  $("password").autocomplete = mode === "signin" ? "current-password" : "new-password";
  $("oauth").hidden = !(googleOn && (mode === "signin" || mode === "signup"));
  $("terms").hidden = mode !== "signup";
  for (const id of ["name", "email", "password"]) markInvalid($(id), false);
  say("");

  const sw = $("switch");
  if (mode === "signin") sw.replaceChildren(button("Forgot your password?", () => go("forgot")), button("New here? Make an account", () => go("signup")));
  else if (mode === "signup") sw.replaceChildren(button("Already have an account? Sign in", () => go("signin")));
  else sw.replaceChildren(button("← Back to sign in", () => go("signin")));
}

function go(next, { focus = true } = {}) {
  if (busy) return;
  mode = next;
  const q = new URLSearchParams();
  if (mode !== "signin") q.set("mode", mode);
  if (params.get("next")) q.set("next", params.get("next"));
  history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}`);
  render();
  if (focus) (mode === "signup" ? $("name") : $("email")).focus();
}

// ---------- done / signed-in view ----------
// After clicking the link in the confirmation email. Shown on the form and, since most
// people confirm in the browser they're already signed in on, on the signed-in view too.
const VERIFIED = {
  1: { text: "Email confirmed — thanks. You're all set.", kind: "ok" },
  0: { text: "That confirmation link didn't work. It may have expired.", kind: "problem" },
}[params.get("verified")] || null;

// Somewhere to go back to: only when the visitor arrived with a ?next= of their own.
const hasNext = () => params.has("next") && nextUrl() !== DEFAULT_NEXT;

function welcomeActions() {
  return hasNext()
    ? [link("Pick up where you left off", nextUrl(), "btn btn--red"), link("Seal your first piece", "/seal-a-piece", "btn btn--ghost")]
    : [link("Seal your first piece", "/seal-a-piece", "btn btn--red"), link("Browse the wall", "/wall", "btn btn--ghost")];
}

function showDone(title, sub, actions) {
  $("formView").hidden = true;
  const view = $("doneView");
  $("doneTitle").textContent = title;
  $("doneSub").textContent = sub;
  note($("doneNote"), VERIFIED?.text, VERIFIED?.kind);
  $("doneActions").replaceChildren(...actions);
  view.hidden = false;
  view.focus();
  const art = $("art");
  art.classList.remove("is-pressed"); void art.offsetWidth; art.classList.add("is-pressed");
}

function signedInView(user) {
  showDone(`You're signed in, ${firstName(user)}.`, user.email ? `As ${user.email}.` : "", [
    ...(hasNext() ? [link("Continue", nextUrl(), "btn btn--red")] : []),
    link("Go to the wall", "/wall", hasNext() ? "btn btn--ghost" : "btn btn--red"),
    link("Seal a piece", "/seal-a-piece", "btn btn--ghost"),
    button("Sign out", async () => { try { await api.auth.logout(); } catch { /* reload shows the real state */ } location.reload(); }, "btn btn--ghost"),
  ]);
}

// ---------- submit ----------
function validate(fields) {
  if (fields.email !== null && !EMAIL.test(fields.email)) return ["email", "That email doesn't look quite right."];
  if (fields.password !== null && fields.password.length < MIN_PASS) return ["password", `Passwords need ${MIN_PASS} characters or more.`];
  if (fields.password !== null && fields.password.length > MAX_PASS) return ["password", "That password is too long."];
  return null;
}

async function submit(e) {
  e.preventDefault();
  const fields = {
    name: mode === "signup" ? $("name").value.trim() : null,
    email: mode === "reset" ? null : $("email").value.trim().toLowerCase(),
    password: mode === "forgot" ? null : $("password").value,
  };
  for (const id of ["name", "email", "password"]) markInvalid($(id), false);
  const problem = validate(fields);
  if (problem) {
    markInvalid($(problem[0]), true);
    say(problem[1], "problem");
    $(problem[0]).focus();
    return;
  }

  const btn = $("submit");
  btn.disabled = true;
  busy = true;
  btn.textContent = MODES[mode].busy;
  say(MODES[mode].busy, "working");
  try {
    if (mode === "signup") {
      const user = await api.auth.register({ email: fields.email, password: fields.password, name: fields.name || undefined });
      showSignedIn(user);
      showDone(`You're in, ${firstName(user)}.`,
        `We've sent a link to ${fields.email}. Confirm it when you get a sec — it keeps the account yours.`,
        welcomeActions());
      return;
    }
    if (mode === "signin") {
      await api.auth.login({ email: fields.email, password: fields.password });
      say("Signed in. Taking you through…", "ok");
      location.href = nextUrl();
      return;
    }
    if (mode === "forgot") {
      await api.auth.forgot(fields.email);
      say("If that email has an account, a reset link is on its way. Check your inbox (and spam).", "ok");
    } else {
      await api.auth.reset(resetToken, fields.password);
      say("Password updated. Taking you to the wall…", "ok");
      location.href = DEFAULT_NEXT;
      return;
    }
  } catch (err) {
    const msg = (err && err.message) || "Something went wrong. Try again.";
    say(/^HTTP 5|Failed to fetch|NetworkError|Load failed/i.test(msg) ? "We couldn't reach the server. Check your connection and try again." : msg, "problem");
    if (mode === "signup" && /already registered/i.test(msg)) {
      $("note").append(" ", button("Sign in instead", () => go("signin")));
    }
  }
  busy = false;
  btn.disabled = false;
  btn.textContent = MODES[mode].submit;
}

// ---------- wiring ----------
$("form").addEventListener("submit", submit);
$("showPass").addEventListener("click", () => {
  const input = $("password");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("showPass").textContent = show ? "Hide" : "Show";
  $("showPass").setAttribute("aria-pressed", String(show));
});

if (VERIFIED) note($("banner"), VERIFIED.text, VERIFIED.kind);

// ---------- Clerk ----------
// When sign-in runs on Clerk, Clerk's own form (restyled to match) replaces ours. It
// handles email codes, passwords, Google, resets and bot checks; after sign-up it
// comes back here with ?mode=welcome.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#D42228", colorPrimaryForeground: "#F5F4EF",
    colorForeground: "#171A1F", colorMutedForeground: "#3E4450", colorNeutral: "#171A1F",
    colorBackground: "#FFFFFF", colorInput: "#FFFFFF", colorInputForeground: "#171A1F",
    colorBorder: "#5F646C", colorRing: "#1585CF",
    colorDanger: "#171A1F",                       // red is the brand: problems are ink, like our notices
    fontFamily: "Inter, system-ui, sans-serif", fontFamilyButtons: "\"Instrument Sans\", system-ui, sans-serif",
    borderRadius: "12px",
  },
  elements: {
    header: { display: "none" },                  // the page already says what this is
    cardBox: { boxShadow: "none", border: "2px solid #171A1F", borderRadius: "16px", width: "100%" },
    rootBox: { width: "100%" },
    formButtonPrimary: { borderRadius: "100px", minHeight: "48px", fontSize: "1rem", fontWeight: 600, textTransform: "none" },
  },
};
const isWelcome = params.get("mode") === "welcome";

async function startClerk() {
  const clerk = await api.clerk();
  if (!clerk) return false;
  for (const id of ["form", "oauth", "switch"]) $(id).hidden = true;
  if (isWelcome || clerk.user) {
    const user = await currentUser();
    if (!user) {
      // Clerk says signed in but our API couldn't open the account (e.g. email not confirmed yet).
      note($("banner"), "You're signed in, but we couldn't open your SecurityArts account yet. If you just signed up, confirm your email address, then reload this page.", "problem");
      return true;
    }
    if (isWelcome) {
      showDone(`You're in, ${firstName(user)}.`, "Your account is ready. Seal something you finished and it goes up on the wall with its certificate.",
        welcomeActions());
    } else signedInView(user);
    return true;
  }
  const mount = $("clerkMount");
  mount.hidden = false;
  $("terms").hidden = mode !== "signup";
  const common = { routing: "hash", appearance: CLERK_APPEARANCE };
  const welcome = hasNext() ? `/join?mode=welcome&next=${encodeURIComponent(nextUrl())}` : "/join?mode=welcome";
  if (mode === "signup") clerk.mountSignUp(mount, { ...common, signInUrl: "/join", fallbackRedirectUrl: welcome });
  else clerk.mountSignIn(mount, { ...common, signUpUrl: "/join?mode=signup", fallbackRedirectUrl: nextUrl() });
  return true;
}

render();
initSite();
if (!(await startClerk())) {
  // Clerk isn't switched on: our own form talks to the legacy auth routes.
  api.auth.config().then((c) => {
    googleOn = !!c?.google;
    $("oauth").hidden = !(googleOn && (mode === "signin" || mode === "signup"));
  }).catch(() => {});
  if (mode === "signin" || mode === "signup") {
    const user = await currentUser();
    if (user) signedInView(user);
  }
}
