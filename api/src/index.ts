/**
 * Merchant API Entry Point
 *
 * Non-custodial payment orchestration API for TONBANKCARD Protocol.
 * This API is informational only — the blockchain is the single source of truth.
 *
 * @see docs/merchant-api-spec.md
 */

import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupInvoiceRoutes, corsOptions } from './routes/invoiceRoutes';
import { setupApiKeyRoutes } from './routes/apiKeyRoutes';
import { installSandboxMode, isSandboxMode } from './middleware/sandbox';
import { configureTrustProxy } from './config/trustProxy';
import { assertApiKeySecretConfigured } from './config/secrets';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Build and configure the Merchant API Express app.
 *
 * Extracted from the boot sequence so tests can exercise the fully wired
 * middleware chain (helmet, CORS, routes) without binding a port. The server
 * is only started when this module is run directly (see the bottom of the
 * file).
 *
 * @returns The configured Express app (not yet listening).
 */
export function createApp(): Express {
  const app = express();

  // Configure how many reverse proxies / load balancers sit in front of the
  // API so `req.ip` (and therefore the per-IP rate limiter) resolves to the
  // real client rather than the proxy. Controlled by the TRUST_PROXY env var;
  // defaults to `false` (no proxy) so a misconfiguration fails closed. See
  // `config/trustProxy.ts` for the accepted values.
  configureTrustProxy(app);

  // Security middleware. `helmet` must run early so every response — including
  // errors and 404s emitted further down the chain — carries the baseline
  // hardening headers (HSTS, `X-Content-Type-Options: nosniff`, frame options,
  // etc.). Without it responses ship without those defenses (audit API-M3).
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10kb' }));

  // Disable x-powered-by header (helmet also removes it, but keep this explicit
  // so the guarantee holds even if helmet's defaults change).
  app.disable('x-powered-by');

  // Sandbox relaxations (header + anonymous auth + /v1/sandbox/info).
  // Inert in production: `installSandboxMode` returns false when
  // `TONBANKCARD_SANDBOX` / `NODE_ENV=sandbox` are not set.
  installSandboxMode(app);

  // API key management endpoints must be mounted before the invoice
  // routes so their 404 handler does not swallow `/v1/keys/*`.
  setupApiKeyRoutes(app);
  setupInvoiceRoutes(app);

  return app;
}

/**
 * Boot the server: fail fast on insecure secrets, then bind the port.
 */
function startServer(): void {
  // Fail fast before binding any port if the API-key HMAC secret is missing or
  // insecurely configured. Without this guard a misconfigured deployment would
  // silently hash every API key with a publicly known constant (audit API-H1).
  try {
    assertApiKeySecretConfigured();
  } catch (err) {
    console.error(`[FATAL] ${(err as Error).message}`);
    process.exit(1);
  }

  const app = createApp();

  app.listen(Number(PORT), HOST, () => {
    console.log(`Merchant API listening on ${HOST}:${PORT}`);
    console.log(`Health check: http://${HOST}:${PORT}/v1/health`);
    if (isSandboxMode()) {
      console.log(`Sandbox mode: ON  →  GET http://${HOST}:${PORT}/v1/sandbox/info`);
    }
  });
}

// Only start the server when this file is the entry point. Importing the module
// (e.g. from tests) just exposes `createApp` without binding a port.
if (require.main === module) {
  startServer();
}

export default createApp;
