# Merchant API Reference Implementation

**Issue**: [#24 — Merchant API (Non-Custodial Payment Orchestration)](https://github.com/xlabtg/tonbankcard-protocol/issues/24)

This directory contains the reference implementation of the Tonbankcard Merchant API, a stateless, non-custodial payment orchestration layer that enables merchants to accept TBC payments.

> **Quickstart.** New to the protocol? The fastest way to see invoice creation,
> settlement verification, and webhooks working end-to-end is the
> [`examples/merchant-demo/`](../examples/merchant-demo/) Express.js storefront
> against the public C3 sandbox. From a fresh clone: `npm run setup` (see the
> [root README quickstart](../README.md#quickstart--5-minutes)), then `npm run demo`.

---

> **⚠️ PRODUCTION WARNING**
>
> **This implementation MUST NOT be used in production without persistent storage.**
>
> The reference implementation uses **in-memory storage** for invoices and idempotency keys.
> This means:
>
> - All data is lost on server restart
> - No horizontal scaling (each instance has its own store)
> - No durability guarantees
>
> For production use, replace the in-memory stores with:
>
> - **PostgreSQL** or **MongoDB** for invoice storage
> - **Redis** for rate limiting and idempotency key storage
> - **A blockchain indexer** for settlement verification
>
> When `NODE_ENV=production`, the API fails fast during boot if the default
> in-memory invoice or idempotency storage is still configured.
>
> See [Deployment](#deployment) for the complete production checklist.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Installation](#installation)
5. [Usage](#usage)
6. [API Endpoints](#api-endpoints)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Security](#security)
10. [Contributing](#contributing)

---

## Overview

The Merchant API is a **read-only, stateless** orchestration layer that:

- ✅ Creates payment intents (invoices)
- ✅ Allows wallets to resolve invoices
- ✅ Verifies on-chain settlement
- ❌ **NEVER** holds private keys
- ❌ **NEVER** custody funds
- ❌ **NEVER** authorizes payments

### Key Characteristics

- **Stateless**: No mutable server-side state
- **Non-Custodial**: Never controls user funds
- **Read-Only**: Blockchain access is read-only
- **Informational**: API responses are not authoritative

**The blockchain is the single source of truth.**

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Merchant  │         │ Merchant API │         │  Blockchain │
│   Website   │         │  (Stateless) │         │   (Truth)   │
└─────────────┘         └──────────────┘         └─────────────┘
       │                       │                         │
       │ 1. POST /invoice/create                         │
       ├──────────────────────>│                         │
       │                       │                         │
       │ 2. Invoice Details    │                         │
       │<──────────────────────┤                         │
       │                       │                         │
       │ 3. User Wallet → GET /invoice/:id               │
       │                   │                             │
       │                   │                             │
       │ 4. User Signs TX ─────────────────────────────> │
       │                       │                         │
       │                       │ 5. MerchantPayment Event│
       │                       │<────────────────────────┤
       │                       │                         │
       │ 6. GET /invoice/:id/status                      │
       ├──────────────────────>│                         │
       │                       │ 7. Verify On-Chain      │
       │                       ├────────────────────────>│
       │                       │                         │
       │ 8. Settlement Proof   │                         │
       │<──────────────────────┤                         │
```

---

## Directory Structure

```
api/
├── src/
│   ├── types/
│   │   └── invoice.ts              # TypeScript type definitions
│   ├── utils/
│   │   ├── validation.ts           # Input validation functions
│   │   └── helpers.ts              # Helper utilities
│   ├── services/
│   │   └── InvoiceService.ts       # Invoice business logic
│   └── routes/
│       └── invoiceRoutes.ts        # Express.js route handlers
├── tests/
│   ├── validation.test.ts          # Validation tests
│   └── InvoiceService.test.ts      # Service tests
├── README.md                       # This file
└── package.json                    # Dependencies
```

---

## Installation

### Prerequisites

- Node.js ≥ 18.0.0
- TypeScript ≥ 5.0.0
- npm or yarn

### Install Dependencies

```bash
cd api
npm install
```

### Required Packages

```json
{
  "dependencies": {
    "@ton/ton": "^13.11.0",
    "@ton/core": "^0.56.0",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11"
  }
}
```

---

## Usage

### Example: Create Express.js Server

```typescript
import express from 'express';
import cors from 'cors';
import { setupInvoiceRoutes, corsOptions } from './src/routes/invoiceRoutes';

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Setup routes
setupInvoiceRoutes(app);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Merchant API listening on port ${PORT}`);
});
```

### Environment Variables

Create a `.env` file:

```env
# Server
PORT=3000
NODE_ENV=production

# API Configuration
BASE_URL=https://api.tonbankcard.io
WALLET_URL=https://wallet.tonbankcard.io

# Security
ALLOWED_ORIGINS=https://merchant1.com,https://merchant2.com

# Number of reverse proxies / load balancers in front of the API. Express uses
# this to resolve the real client IP (req.ip) from X-Forwarded-For, which the
# per-IP rate limiter keys on. Match your topology exactly (e.g. 1 for a single
# nginx/ALB hop). Avoid the blanket value "true": it lets clients spoof
# X-Forwarded-For to bypass rate limiting. Defaults to false (no proxy).
TRUST_PROXY=1

# Blockchain
TON_API_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
TON_API_KEY=your_ton_api_key

# Database (if using)
DATABASE_URL=postgresql://user:pass@localhost:5432/tonbankcard

# Logging
LOG_LEVEL=info
```

---

## API Endpoints

### POST /v1/invoice/create

Create a new payment invoice.

**Authentication**: Required (Bearer token)

**Request**:

```json
{
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase"
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response** (201 Created):

```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a"
}
```

### GET /v1/invoice/:invoice_id

Retrieve invoice details (public endpoint).

**Authentication**: Not required

**Response** (200 OK):

```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase"
  },
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a",
  "settlement": null
}
```

### GET /v1/invoice/:invoice_id/status

Check settlement status.

**Authentication**: Required (Bearer token)

**Response** (200 OK):

```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "status": "settled",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "settlement": {
    "payer_nft": "EQDef456...",
    "merchant_nft": "EQAbc123...",
    "amount_tbc": "1000000000",
    "block_number": 12345678,
    "tx_hash": "0xabc123...",
    "timestamp": "2025-12-27T10:05:00Z",
    "payload_hash": "0x7f8a9b...",
    "on_chain_verified": true,
    "verification_url": "https://tonscan.org/tx/0xabc123..."
  }
}
```

---

## Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Test Files

1. **validation.test.ts**: Input validation tests
   - TON address validation
   - Amount validation
   - Metadata validation
   - Timestamp validation

2. **InvoiceService.test.ts**: Service layer tests
   - Invoice creation
   - Invoice retrieval
   - Status checking
   - Idempotency
   - Error handling

### Example Test

```typescript
import { InvoiceService } from '../src/services/InvoiceService';

describe('InvoiceService', () => {
  it('should create invoice successfully', async () => {
    const service = new InvoiceService();
    const invoice = await service.createInvoice(
      {
        merchant_nft: 'EQTest123...',
        amount_tbc: '1000000000',
        currency: 'TBC',
      },
      'test_api_key',
    );

    expect(invoice.invoice_id).toMatch(/^inv_[a-f0-9]{16}$/);
    expect(invoice.status).toBe('pending');
  });
});
```

---

## Deployment

### Production Deployment Checklist

- [ ] Environment variables configured
- [ ] `TRUST_PROXY` set to the exact number of proxy hops (or trusted CIDRs) in front of the API so `req.ip` and per-IP rate limiting see the real client — never blanket `true`
- [ ] HTTPS enabled (TLS 1.2+)
- [ ] Database connection established
- [ ] Blockchain indexer running
- [ ] API keys generated for merchants
- [ ] Rate limiting configured
- [ ] Logging and monitoring setup
- [ ] Backup and disaster recovery plan
- [ ] Security audit completed

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t tonbankcard-merchant-api .
docker run -p 3000:3000 --env-file .env tonbankcard-merchant-api
```

### Kubernetes Deployment

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: merchant-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: merchant-api
  template:
    metadata:
      labels:
        app: merchant-api
    spec:
      containers:
        - name: api
          image: tonbankcard/merchant-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: merchant-api-secrets
                  key: database-url
```

---

## Security

### Security Principles

1. **Non-Custodial**: API never holds private keys or funds
2. **Stateless**: No mutable server-side state
3. **Read-Only**: Blockchain access is read-only
4. **Verified**: Merchants independently verify settlements

### Security Features

- ✅ HTTPS enforcement (TLS 1.2+)
- ✅ API key authentication
- ✅ Rate limiting (100 req/min for invoice creation)
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS policy enforcement
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ Audit logging

### Best Practices

1. **Store API keys securely**

   ```typescript
   // ❌ Bad
   const apiKey = 'tbck_live_123...';

   // ✅ Good
   const apiKey = process.env.TONBANKCARD_API_KEY;
   ```

2. **Validate API responses**

   ```typescript
   const status = await merchantApi.getInvoiceStatus(invoiceId);

   // Don't trust API blindly - verify on-chain
   const verified = await verifySettlementOnChain(status.settlement);
   ```

3. **Handle errors gracefully**
   ```typescript
   try {
     const invoice = await merchantApi.createInvoice(params);
   } catch (error) {
     if (error.code === 'RATE_LIMIT_EXCEEDED') {
       // Retry with backoff
     } else {
       // Log and alert
     }
   }
   ```

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Report security issues privately to: security@tonbankcard.com

---

## Contributing

### Development Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start dev server: `npm run dev`

### Code Style

- Use TypeScript strict mode
- Follow existing patterns
- Write tests for new features
- Document public APIs

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Run `npm run lint` and `npm test`
4. Submit PR with description

---

## Documentation

- **API Specification**: [docs/merchant-api-spec.md](../docs/merchant-api-spec.md)
- **Security Considerations**: [docs/merchant-api-security.md](../docs/merchant-api-security.md)
- **Integration Guide**: [examples/merchant-integration.md](../examples/merchant-integration.md)
- **Issue #24**: https://github.com/xlabtg/tonbankcard-protocol/issues/24

---

## License

This is a reference implementation for the Tonbankcard protocol.
See [LICENSE](../LICENSE) for details.

---

## Support

- **GitHub Issues**: https://github.com/xlabtg/tonbankcard-protocol/issues
- **Documentation**: https://docs.tonbankcard.io
- **Email**: support@tonbankcard.io

---

**This is a reference implementation** demonstrating the Merchant API specification.

In production, you would need to add:

- Database integration (PostgreSQL, MongoDB, etc.)
- Blockchain indexer integration
- API key management system
- Rate limiting (Redis-based)
- Monitoring and alerting
- Load balancing
- CDN for static assets

**Remember**: The API is a **coordination layer**, not a payment processor. The blockchain is the source of truth.
