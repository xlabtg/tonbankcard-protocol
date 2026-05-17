/**
 * Merchant API Entry Point
 *
 * Non-custodial payment orchestration API for TONBANKCARD Protocol.
 * This API is informational only — the blockchain is the single source of truth.
 *
 * @see docs/merchant-api-spec.md
 */

import express from 'express';
import cors from 'cors';
import { setupInvoiceRoutes, corsOptions } from './routes/invoiceRoutes';
import { setupApiKeyRoutes } from './routes/apiKeyRoutes';
import { installSandboxMode, isSandboxMode } from './middleware/sandbox';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// Security middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

// Disable x-powered-by header
app.disable('x-powered-by');

// Sandbox relaxations (header + anonymous auth + /v1/sandbox/info).
// Inert in production: `installSandboxMode` returns false when
// `TONBANKCARD_SANDBOX` / `NODE_ENV=sandbox` are not set.
const sandboxInstalled = installSandboxMode(app);

// API key management endpoints must be mounted before the invoice
// routes so their 404 handler does not swallow `/v1/keys/*`.
setupApiKeyRoutes(app);
setupInvoiceRoutes(app);

// Start server
app.listen(Number(PORT), HOST, () => {
  console.log(`Merchant API listening on ${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/v1/health`);
  if (sandboxInstalled && isSandboxMode()) {
    console.log(`Sandbox mode: ON  →  GET http://${HOST}:${PORT}/v1/sandbox/info`);
  }
});

export default app;
