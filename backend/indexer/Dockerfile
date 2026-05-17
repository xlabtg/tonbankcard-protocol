# syntax=docker/dockerfile:1.6
#
# Multi-stage Dockerfile for the Tonbankcard Payment Status Indexer.
#
# The indexer uses better-sqlite3 (a native module), so the builder stage
# must include python3, make and g++ to compile the SQLite bindings. The
# runtime stage drops those toolchains and runs as an unprivileged user.
#
# Build with:
#   docker build -t tonbankcard/indexer:local -f backend/indexer/Dockerfile backend/indexer/
#
# Run with:
#   docker run --rm -p 3000:3000 \
#     -v indexer-data:/app/data \
#     --env-file backend/indexer/.env \
#     tonbankcard/indexer:local

ARG NODE_VERSION=20.18.1-alpine3.20

############################
# Stage 1 — builder
############################
FROM node:${NODE_VERSION} AS builder

WORKDIR /build

# Native build toolchain for better-sqlite3.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
# IndexerDatabase loads migration SQL files via path.join(__dirname,
# 'migrations'), which after compilation resolves to dist/db/migrations/.
# tsc does not copy non-TypeScript assets, so we stage them manually.
RUN npx tsc \
    && mkdir -p dist/db/migrations \
    && cp -R src/db/migrations/. dist/db/migrations/

# Strip dev dependencies for the runtime image. better-sqlite3's prebuilt
# binary is kept under node_modules and remains usable.
RUN npm prune --omit=dev

############################
# Stage 2 — runtime
############################
FROM node:${NODE_VERSION} AS runtime

# SQLite client is handy for ad-hoc inspection; tini gives us PID-1 signal
# handling so SIGTERM reaches the Node process for graceful shutdown.
RUN apk add --no-cache tini wget sqlite \
    && addgroup -S -g 10001 nodejs \
    && adduser  -S -u 10001 -G nodejs nodejs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/app/data/indexer.db \
    LOG_LEVEL=info \
    LOG_PRETTY=false

COPY --chown=nodejs:nodejs package.json ./
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build/dist ./dist

RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
