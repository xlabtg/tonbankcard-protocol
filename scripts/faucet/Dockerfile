# =============================================================================
# TBC faucet — sandbox image
# =============================================================================
# Multi-stage build that compiles the TypeScript sources, then ships a slim
# runtime image. Designed for the sandbox environment described in
# docs/sandbox.md.
#
# The image runs as a non-root user and exposes only the faucet HTTP port.
# Real signing keys must be injected at runtime via Docker / Kubernetes
# secrets, never baked into the image.
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && addgroup -S faucet \
 && adduser -S faucet -G faucet

COPY --from=builder /app/dist ./dist

USER faucet

EXPOSE 4500
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${FAUCET_PORT:-4500}/health || exit 1

CMD ["node", "dist/index.js"]
