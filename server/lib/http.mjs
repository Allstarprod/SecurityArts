// Minimal router + response helpers. No framework.
export function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
export function ok(res, data) { json(res, 200, { data, error: null }); }
export function created(res, data) { json(res, 201, { data, error: null }); }
export function fail(res, status, message) { json(res, status, { data: null, error: message }); }

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const keys = [];
    const rx = new RegExp(
      "^" + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return "([^/]+)"; }) + "/?$"
    );
    this.routes.push({ method, rx, keys, handler });
  }
  get(p, h) { this.add("GET", p, h); }
  post(p, h) { this.add("POST", p, h); }
  del(p, h) { this.add("DELETE", p, h); }
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.rx.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return null;
  }
}

// Validation helpers — fail fast at the boundary (OWASP A03 / input validation).
export function str(v, { min = 0, max = 500 } = {}) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}
export function isEmail(v) {
  return typeof v === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) && v.length <= 254;
}
export const CATS = ["illustration", "painting", "3d", "photography", "lettering", "concept", "mixed"];
