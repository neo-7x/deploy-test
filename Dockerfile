# Multi-stage Node runtime image. The container auto-migrates on boot via
# the server/plugins/migrate.ts plugin (node-server preset only).
#
# Build:   docker build -t deploy-test .
# Run:     docker run -p 3000:3000 \
#            -e DATABASE_URL=postgresql://... \
#            -e BETTER_AUTH_SECRET=<32-char-random> \
#            -e SEED_DEFAULT_ADMIN=true \
#            deploy-test

# ---------- deps ----------
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ---------- builder ----------
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV MIGRATIONS_DIR=/app/.output/server/db/migrations
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
