# syntax=docker/dockerfile:1.6
#
# Multi-stage Dockerfile for the Tonbankcard Merchant API service.
#
# Stage 1 (builder)  — installs all dependencies and compiles TypeScript.
# Stage 2 (runtime)  — copies the compiled output plus production dependencies
#                      into a minimal Alpine image that runs as a non-root user.
#
# Build with:
#   docker build -t tonbankcard/merchant-api:local -f api/Dockerfile api/
#
# Run with:
#   docker run --rm -p 3000:3000 --env-file api/.env tonbankcard/merchant-api:local

ARG NODE_VERSION=20.18.1-alpine3.20

############################
# Stage 1 — builder
############################
FROM node:${NODE_VERSION} AS builder

WORKDIR /build

# Install dependencies (use package.json only; lockfile is intentionally
# excluded from version control per .gitignore — see CONTRIBUTING).
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy sources and build TypeScript.
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Re-install only production dependencies to produce a lean node_modules
# that we can copy into the runtime image.
RUN rm -rf node_modules \
    && npm install --omit=dev --no-audit --no-fund

############################
# Stage 2 — runtime
############################
FROM node:${NODE_VERSION} AS runtime

# Tini provides proper PID 1 signal handling for graceful shutdown.
RUN apk add --no-cache tini wget \
    && addgroup -S -g 10001 nodejs \
    && adduser  -S -u 10001 -G nodejs nodejs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --chown=nodejs:nodejs package.json ./
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build/dist ./dist

USER nodejs

EXPOSE 3000

# Built-in container healthcheck — Kubernetes/compose can also probe the
# /v1/health endpoint directly but having one here is useful for `docker ps`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
