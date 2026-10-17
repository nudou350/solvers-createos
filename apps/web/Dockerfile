# Solvers web (Next.js). Build from the repo root: docker build -f apps/web/Dockerfile --build-arg API_PROXY_URL=... .
# API_PROXY_URL: the API origin that /api, /mcp, /oauth, /.well-known are rewritten to (next.config.ts). Rewrites are
# fixed at build time, so it is a build argument.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY . .
ARG API_PROXY_URL
ENV API_PROXY_URL=${API_PROXY_URL} NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile --filter "@solvers/web..." \
 && pnpm --filter "@solvers/web..." build

WORKDIR /app/apps/web
# Server components call the API directly (src/lib/api.ts serverApi).
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3041 API_INTERNAL_URL=${API_PROXY_URL}
EXPOSE 3041
CMD ["node", "start.mjs"]
