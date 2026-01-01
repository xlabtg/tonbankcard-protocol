# Tonbankcard Payment Status Indexer

**Read-only on-chain event indexer for the Tonbankcard Protocol**

## Overview

The Payment Status Indexer is a **read-only** service that observes on-chain events from the Tonbankcard protocol and provides payment status information for merchants and integrators.

### Key Principles

✅ **Read-Only**: Never initiates transactions or modifies protocol state
✅ **Advisory**: Responses are informational - always verify on-chain
✅ **Replaceable**: Anyone can re-implement this indexer independently
✅ **Zero Trust**: No trust assumptions - all data is from blockchain
✅ **Non-Custodial**: Never holds or controls user funds

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            TON Blockchain                            │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ PaymentHub   │  │ MerchantHub  │                │
│  │ (Events)     │  │ (Events)     │                │
│  └──────────────┘  └──────────────┘                │
│          │                  │                        │
└──────────┼──────────────────┼────────────────────────┘
           │                  │
           └────────┬─────────┘
                    │
           ┌────────▼─────────┐
           │  Indexer Service │
           │  (Observes)      │
           └────────┬─────────┘
                    │
           ┌────────▼─────────┐
           │  SQLite Database │
           │  (Read-Only DB)  │
           └────────┬─────────┘
                    │
           ┌────────▼─────────┐
           │   REST API       │
           │   (Advisory)     │
           └──────────────────┘
```

## Features

### Event Indexing

The indexer observes and indexes:

- ✅ **Invoice Creation Events** - Merchant payment events
- ✅ **Internal Transfer Events** - TBC transfers between NFT accounts
- ✅ **Merchant Settlement Events** - Payment completion
- ✅ **Account Lock State Changes** - Account status updates
- ✅ **NFT Ownership Changes** - Account ownership transfers

### Reorg Handling

- Detects blockchain reorganizations by comparing block hashes
- Automatically rolls back divergent blocks
- Maintains data consistency during chain reorgs
- Configurable confirmation blocks (default: 10)

### API Endpoints

All endpoints are **read-only** and **advisory**:

- `GET /api/v1/payments/:invoice_id` - Payment status
- `GET /api/v1/payments/:invoice_id/events` - Payment event history
- `GET /api/v1/accounts/:nft_id/history` - Account transaction history
- `GET /api/v1/blocks/:block_number` - Block information (transparency)
- `GET /api/v1/health` - Health check

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Navigate to indexer directory
cd backend/indexer

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit `.env` file:

```env
# TON Network
TON_NETWORK=testnet
TON_API_ENDPOINT=https://testnet.toncenter.com/api/v2
TON_API_KEY=your_api_key_here

# Contract Addresses (update with actual addresses)
PAYMENT_HUB_ADDRESS=EQ...
MERCHANT_PAYMENT_HUB_ADDRESS=EQ...
NFT_COLLECTION_7777_ADDRESS=EQ...
NFT_COLLECTION_8888_ADDRESS=EQ...

# Database
DB_PATH=./data/indexer.db

# Indexer Settings
INDEXER_START_BLOCK=0
INDEXER_POLL_INTERVAL_MS=5000
INDEXER_BATCH_SIZE=100
INDEXER_CONFIRMATION_BLOCKS=10

# API Server
PORT=3000
HOST=0.0.0.0
```

## Usage

### Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run in production mode
npm start
```

### API Examples

#### Check Payment Status

```bash
curl http://localhost:3000/api/v1/payments/invoice_123
```

Response:
```json
{
  "invoiceId": "invoice_123",
  "status": "confirmed",
  "payerNft": "EQA...",
  "merchantNft": "EQB...",
  "amountTbc": "1000000000",
  "createdAt": 1703001234,
  "confirmedAt": 1703001234,
  "blockNumber": 12345678,
  "transactionHash": "abc123...",
  "confirmationBlocks": 15,
  "metadata": {
    "payloadHash": "0x..."
  }
}
```

#### Get Account History

```bash
curl http://localhost:3000/api/v1/accounts/EQA.../history?limit=10
```

#### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

## Data Sources

The indexer consumes **only** on-chain data:

| Data Source | Event Type | Contract |
|-------------|------------|----------|
| PaymentHub | InternalTransferEvent | PaymentHub.tact |
| PaymentHub | AccountStateChangedEvent | PaymentHub.tact |
| MerchantPaymentHub | MerchantPayment | MerchantPaymentHub.tact |
| NFT Collections | Transfer Events | TON NFT Standard |

## Security Guarantees

### What the Indexer DOES

✅ Observes on-chain events
✅ Provides read-only query interface
✅ Exposes block numbers and transaction hashes
✅ Handles chain reorgs correctly

### What the Indexer DOES NOT

❌ Initiate transactions
❌ Sign messages
❌ Hold private keys
❌ Custody funds
❌ Act as source of truth
❌ Provide payment authorization

### Trust Model

- Merchants trust **on-chain data**
- Indexer responses are **advisory only**
- Final verification **always** happens on-chain
- Anyone can re-implement this indexer

## Reorg Handling Strategy

### Detection

1. For each new block, compare stored block hash with chain
2. If mismatch detected, identify divergence point
3. Roll back database to last valid block

### Recovery

1. Delete all blocks from divergence point onwards
2. Delete all events in those blocks (CASCADE)
3. Resume syncing from rollback point
4. Update account snapshots

### Configuration

- `INDEXER_CONFIRMATION_BLOCKS`: Wait N blocks before considering block final
- Default: 10 blocks (~30 seconds on TON)

## Database Schema

### Core Tables

- `blocks` - Blockchain blocks with hashes (for reorg detection)
- `internal_transfers` - Internal transfer events
- `merchant_payments` - Merchant payment events
- `account_state_changes` - Account state changes
- `nft_ownership_changes` - NFT ownership transfers
- `account_snapshots` - Current account state (materialized view)

### Indexes

All tables have appropriate indexes for fast queries:

- By NFT address
- By timestamp
- By transaction hash
- By payload hash (for invoice lookups)

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Validation

Cross-check indexer data against on-chain state:

```bash
# Run validation script
npm run validate
```

This script:
1. Samples random indexed events
2. Fetches corresponding on-chain data
3. Verifies data consistency
4. Reports any discrepancies

## Monitoring

### Health Check

Monitor `/api/v1/health` for:

- Indexer sync status
- Blocks behind chain
- Database connectivity
- Event count

### Metrics

Key metrics to monitor:

- Latest block indexed
- Blocks behind chain
- Events indexed per second
- API response times
- Reorg frequency

## Deployment

### Production Checklist

- [ ] Configure production TON API endpoint
- [ ] Set actual contract addresses
- [ ] Configure appropriate confirmation blocks
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Set up monitoring and alerts
- [ ] Enable rate limiting
- [ ] Configure CORS appropriately
- [ ] Set up reverse proxy (nginx/caddy)
- [ ] Enable HTTPS

### Systemd Service

Example `indexer.service`:

```ini
[Unit]
Description=Tonbankcard Payment Indexer
After=network.target

[Service]
Type=simple
User=indexer
WorkingDirectory=/opt/tonbankcard/indexer
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Limitations

### Not a Source of Truth

The indexer is **advisory only**. Always verify:

- Payment status on-chain
- Account balances via contract getters
- NFT ownership via NFT contract

### Chain Reorgs

- During reorgs, recent events may be temporarily incorrect
- Wait for `INDEXER_CONFIRMATION_BLOCKS` confirmations
- For critical operations, verify on-chain

### API Rate Limits

- Default: 100 requests per minute per IP
- For high-volume usage, run your own indexer

## Independent Reproduction

Anyone can replicate this indexer:

1. Clone repository
2. Configure environment variables
3. Point to TON blockchain
4. Run indexer

The indexer has **zero** privileged access or special knowledge.

## License

MIT License

## References

- [Issue #28 - Payment Status Indexer](https://github.com/xlabtg/tonbankcard-protocol/issues/28)
- [Tonbankcard Architecture](../../docs/architecture.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [TON Documentation](https://docs.ton.org/)

---

**⚠️ ADVISORY NOTICE**

All API responses are **advisory** and **not authoritative**.
Always verify payment status and account state on-chain.
The blockchain is the single source of truth.
