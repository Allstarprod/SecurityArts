// Transactional email — pluggable and inert-by-default.
//
// Configured (production): set RESEND_API_KEY (https://resend.com) and MAIL_FROM
// (a verified sender, e.g. "SecurityArts <noreply@yourdomain>"). Emails go out via
// Resend's HTTP API — no SDK, no dependency.
//
// Unconfigured (dev / self-host without a provider): mail is NOT sent; instead the
// message is logged server-side so flows like password reset are still usable locally.
// `sendMail` returns { delivered, dev } so callers can adapt.
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "SecurityArts <onboarding@resend.dev>";

export const mailerActive = Boolean(RESEND_KEY);

export async function sendMail({ to, subject, text, html }) {
  if (!mailerActive) {
    // Dev fallback: make the content visible in server logs (never in an API response).
    console.log(`[mailer:dev] would email ${to} — ${subject}\n${text || ""}`);
    return { delivered: false, dev: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text, html: html || undefined }),
    });
    if (!res.ok) {
      console.error(`[mailer] send failed (${res.status}) to ${to}`);
      return { delivered: false, dev: false };
    }
    return { delivered: true, dev: false };
  } catch (e) {
    console.error("[mailer] send error:", e.message);
    return { delivered: false, dev: false };
  }
}
