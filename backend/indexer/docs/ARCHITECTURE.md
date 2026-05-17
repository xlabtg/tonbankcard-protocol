# Payment Status Indexer Architecture

## Overview

The Payment Status Indexer is a read-only service that observes on-chain events from Tonbankcard smart contracts and provides fast query access to payment status information.

## Design Principles

### 1. Read-Only by Design

The indexer **MUST NEVER**:
- Initiate blockchain transactions
- Sign messages
- Store private keys
- Modify protocol state
- Act as a source of truth

The indexer **MAY ONLY**:
- Read blockchain state
- Parse events from transactions
- Store derived data in local database
- Serve query endpoints

### 2. Advisory Nature

All indexer responses are **advisory** and **not authoritative**.

Merchants and integrators MUST:
- Verify payment status on-chain for critical operations
- Not rely solely on indexer data for finality
- Treat indexer as a convenience layer only

### 3. Replaceability

The indexer MUST be designed such that:
- Anyone can re-implement it independently
- No special access or privileges required
- All data sources are public blockchain data
- Implementation details are documented

### 4. Zero Trust

The indexer operates with **zero trust assumptions**:
- Blockchain is the only source of truth
- Indexer can be compromised without affecting protocol security
- Users verify critical data on-chain

## Architecture Components

```
┌─────────────────────────────────────────────────────────┐
│                    TON Blockchain                        │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PaymentHub   │  │ MerchantHub  │  │ NFT Contracts│  │
│  │ Contract     │  │ Contract     │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │ Events          │ Events          │ Events    │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                ┌───────────▼──────────┐
                │  Blockchain Client   │
                │  (TonClient)         │
                └───────────┬──────────┘
                            │
                ┌───────────▼──────────┐
                │  Indexer Service     │
                │  - Block Polling     │
                │  - Event Parsing     │
                │  - Reorg Handling    │
                └───────────┬──────────┘
                            │
                ┌───────────▼──────────┐
                │  Database Layer      │
                │  (SQLite)            │
                │  - Events            │
                │  - Blocks            │
                │  - Snapshots         │
                └───────────┬──────────┘
                            │
                ┌───────────▼──────────┐
                │  API Server          │
                │  (Express)           │
                │  - REST Endpoints    │
                │  - Rate Limiting     │
                └──────────────────────┘
```

## Component Details

### 1. Blockchain Client

**Responsibility**: Connect to TON blockchain and fetch data

**Implementation**: `@ton/ton` TonClient

**Operations**:
- Fetch latest block
- Fetch block by number
- Fetch transaction details
- Monitor new blocks

**Configuration**:
- API endpoint (testnet/mainnet)
- API key (optional)
- Request timeout
- Retry strategy

### 2. Indexer Service

**Responsibility**: Observe blockchain and index events

**File**: `src/services/indexer-service.ts`

**Operations**:
- Poll blockchain for new blocks
- Parse transactions for events
- Store events in database
- Handle chain reorganizations
- Maintain sync status

**Configuration**:
- Start block number
- Poll interval (ms)
- Batch size
- Confirmation blocks

**Reorg Handling**:
1. For each block, compare hash with stored hash
2. If mismatch, identify divergence point
3. Delete blocks from divergence onwards (CASCADE deletes events)
4. Resume syncing from rollback point

### 3. Event Parser

**Responsibility**: Parse on-chain events into typed structures

**File**: `src/parsers/event-parser.ts`

**Supported Events**:

| Event | Source Contract | Structure |
|-------|----------------|-----------|
| InternalTransferEvent | PaymentHub | from_nft, to_nft, amount, payload_hash |
| AccountStateChangedEvent | PaymentHub | nft_address, old_state, new_state |
| MerchantPayment | MerchantPaymentHub | payer_nft, merchant_nft, amount, payload_hash |
| NFT Transfer | NFT Collections | nft_address, old_owner, new_owner |

**Parsing Strategy**:
1. Identify event type by message structure
2. Extract event fields from Cell data
3. Validate field types
4. Return typed event object

### 4. Database Layer

**Responsibility**: Store and query indexed data

**File**: `src/db/database.ts`

**Technology**: SQLite with WAL mode

**Schema**: See `src/db/migrations/` (versioned migrations) and `docs/database-schema.md` (table reference)

**Key Tables**:

- `blocks` - Block metadata for reorg detection
- `internal_transfers` - Transfer events
- `merchant_payments` - Payment events
- `account_state_changes` - State change events
- `nft_ownership_changes` - Ownership events
- `account_snapshots` - Materialized view for fast queries

**Indexes**:
- By NFT address
- By timestamp
- By transaction hash
- By payload hash

**Reorg Safety**:
- Foreign key from events to blocks
- CASCADE delete on block deletion
- Atomic transactions for consistency

### 5. API Server

**Responsibility**: Serve read-only query endpoints

**File**: `src/api/server.ts`

**Technology**: Express.js

**Endpoints**:

```
GET /api/v1/health
GET /api/v1/payments/:invoice_id
GET /api/v1/payments/:invoice_id/events
GET /api/v1/accounts/:nft_id/history
GET /api/v1/blocks/:block_number
```

**Security**:
- Read-only (GET only)
- CORS enabled (public API)
- Rate limiting
- Input validation
- Error handling

## Data Flow

### Indexing Flow

```
1. Poll Blockchain
   ↓
2. Fetch New Blocks
   ↓
3. Check for Reorg
   ↓ (if reorg)
4. Rollback Database
   ↓ (continue)
5. Parse Transactions
   ↓
6. Extract Events
   ↓
7. Store in Database
   ↓
8. Update Sync Status
```

### Query Flow

```
1. API Request
   ↓
2. Validate Parameters
   ↓
3. Query Database
   ↓
4. Format Response
   ↓
5. Include Block Number & TX Hash
   ↓
6. Return (with advisory notice)
```

## Reorg Handling

### Problem

Blockchain can reorganize (reorg) when:
- Network partition heals
- Competing chains emerge
- Validators disagree on block order

### Solution

1. **Detection**:
   - Store block hash for each indexed block
   - Before processing block N, verify block N-1 hash matches chain
   - If mismatch, reorg detected

2. **Rollback**:
   - Identify divergence point
   - Delete blocks from divergence point onwards
   - Events deleted automatically (CASCADE)

3. **Recovery**:
   - Resume syncing from rollback point
   - Re-index new canonical chain
   - Update account snapshots

### Configuration

```env
INDEXER_CONFIRMATION_BLOCKS=10
```

- Blocks are marked "unconfirmed" until N confirmations
- Critical operations should wait for confirmed blocks
- Reorgs beyond confirmation depth are extremely rare

## Scaling Considerations

### Database

- SQLite is sufficient for moderate traffic
- For high traffic, migrate to PostgreSQL
- Read replicas for query scaling
- Indexes for common query patterns

### API

- Horizontal scaling via load balancer
- Cache frequent queries (with TTL)
- Rate limiting per client
- CDN for static responses

### Indexer

- Single indexer instance (avoid duplicate indexing)
- Vertical scaling for faster sync
- Batch processing for efficiency
- Parallel event parsing

## Security Considerations

### Read-Only Nature

The indexer has **no** ability to:
- Affect protocol operation
- Modify user balances
- Initiate payments
- Change account states

### Attack Vectors & Mitigations

| Attack | Impact | Mitigation |
|--------|--------|------------|
| Indexer compromise | Incorrect data served | Users verify on-chain |
| Database manipulation | False payment status | Block hash verification |
| API DDoS | Service unavailable | Rate limiting, caching |
| Chain reorg | Temporary inconsistency | Confirmation blocks |

### Security Properties

✅ **Non-custodial**: No funds at risk
✅ **Replaceable**: Compromise doesn't affect protocol
✅ **Verifiable**: All data has block number + TX hash
✅ **Transparent**: Open source, re-implementable

## Operational Requirements

### Monitoring

Monitor these metrics:

- Latest block indexed
- Blocks behind chain tip
- Reorg frequency
- API response times
- Error rates
- Database size

### Alerts

Alert on:

- Indexer stopped syncing (> 5 minutes behind)
- Reorg depth > 20 blocks
- API error rate > 5%
- Database errors
- Disk space < 10%

### Backups

- Database backups every 24 hours
- Retain 7 days of backups
- Test restore procedure monthly
- Document recovery time objective (RTO)

### Maintenance

- Update TON client library
- Optimize database indexes
- Archive old data (optional)
- Monitor dependency vulnerabilities

## Testing Strategy

### Unit Tests

- Event parser correctness
- Database operations
- API response formatting
- Reorg handling logic

### Integration Tests

- End-to-end indexing flow
- API endpoint responses
- Database consistency
- Error handling

### Validation Tests

- Compare indexed data with on-chain data
- Verify block hash continuity
- Check account snapshot accuracy
- Validate event completeness

## Future Enhancements

### Possible Improvements

- [ ] WebSocket API for real-time updates
- [ ] GraphQL endpoint
- [ ] Event subscriptions
- [ ] Analytics endpoints
- [ ] Multi-chain support
- [ ] Horizontal scaling

### Out of Scope

The following are **intentionally** out of scope:

- ❌ Transaction signing
- ❌ Payment authorization
- ❌ Webhook delivery
- ❌ Private merchant analytics
- ❌ Custody or escrow

## References

- [Issue #28](https://github.com/xlabtg/tonbankcard-protocol/issues/28)
- [TON Documentation](https://docs.ton.org/)
- [PaymentHub Contract](../../../contracts/payments/PaymentHub.tact)
- [MerchantPaymentHub Contract](../../../contracts/MerchantPaymentHub.tact)

---

**Last Updated**: 2025-12-27
**Version**: 1.0.0
