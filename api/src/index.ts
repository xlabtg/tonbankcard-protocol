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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// Security middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

// Disable x-powered-by header
app.disable('x-powered-by');

// Set up routes
setupInvoiceRoutes(app);

// Start server
app.listen(Number(PORT), HOST, () => {
  console.log(`Merchant API listening on ${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/v1/health`);
});

export default app;
