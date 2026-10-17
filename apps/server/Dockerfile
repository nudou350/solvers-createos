# Solvers API (Express + MCP). Build from the repo root: docker build -f apps/server/Dockerfile .
# Configuration comes from the environment (src/env.ts); no .env file is copied into the image.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile --filter "@solvers/server..." \
 && pnpm --filter "@solvers/server..." build

WORKDIR /app/apps/server
# The embedding model (src/knowledge/embeddings.ts) is downloaded at boot. Images with it baked in failed the
# CreateOS artifact upload (ERR22), so it stays out of the image.

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3038
EXPOSE 3038
CMD ["node", "dist/index.js"]
