# Portable production image — deploy to Fly.io, Railway, a VPS, Cloud Run, anywhere.
# The server serves BOTH the static site (from the repo root) and the API, so the
# whole repo is copied and WORKDIR stays at the root; the entrypoint is server/server.mjs.
FROM node:22-slim

WORKDIR /app

# Install server deps first (better layer caching)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# App code + static site
COPY . .

ENV NODE_ENV=production \
    DB_DRIVER=postgres \
    RATELIMIT_DRIVER=postgres \
    TRUST_PROXY=1 \
    TRUST_PROXY_HTTPS=1 \
    PORT=8137
# Secrets (DATABASE_URL, SESSION_SECRET, SUPABASE_SERVICE_KEY, SEAL_*_B64,
# SUPABASE_URL) are injected at runtime by the host — never baked into the image.

EXPOSE 8137
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8137)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.mjs"]
