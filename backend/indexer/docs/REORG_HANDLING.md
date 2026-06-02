# Blockchain Reorganization Handling

## Overview

This document describes how the Payment Status Indexer handles blockchain reorganizations (reorgs) to maintain data consistency and correctness.

## What is a Reorg?

A blockchain reorganization occurs when the canonical chain changes, causing previously confirmed blocks to become invalid. This can happen due to:

- Network partitions healing
- Competing validator forks
- Chain consensus disagreements
- Temporary network splits

## Detection Strategy

### 1. Block Hash Verification

For each block we index, we store:
- Block number
- Block hash
- Parent block hash
- Timestamp

Before processing block N, we verify that block N-1's hash matches what we previously stored.

```typescript
const storedBlock = db.getBlock(blockNumber - 1);
const chainBlock = await fetchBlock(blockNumber - 1);

if (storedBlock.hash !== chainBlock.hash) {
  // REORG DETECTED!
  handleReorg(blockNumber - 1);
}
```

### 1a. Trailing Re-validation of the Indexed Range

The forward sync cursor only ever moves forward, so the check above only sees
blocks the indexer is about to index for the *first* time. A reorg that rewrites
a block **already stored** would never be revisited and would silently persist
(audit finding INDEXER-C2).

To close this gap, every poll re-validates the trailing window of already-indexed
blocks against the chain *before* advancing the cursor:

```typescript
// In syncBlocks(), before computing startBlock:
const reorgFrom = await revalidateIndexedRange(latestIndexed);
// revalidateIndexedRange walks the last `confirmationBlocks` stored heights
// from oldest to newest, comparing each stored hash against the chain. On the
// first mismatch it calls handleReorg(height) and returns that height.
```

- The window size is `INDEXER_CONFIRMATION_BLOCKS` (the depth beyond which
  reorgs are considered extremely rare), satisfying `K >= confirmationBlocks`.
- On the first divergent height, `handleReorg` rolls back from there and the
  forward sync re-indexes the canonical replacement blocks in the same poll.
- The cursor is only advanced after the trailing window is confirmed consistent.

### 2. Hash Continuity

We maintain hash continuity across blocks:
- Each block references its parent's hash
- Broken chain indicates reorg

### 3. Confirmation Depth

Blocks are marked "unconfirmed" until they have N confirmations:

```env
INDEXER_CONFIRMATION_BLOCKS=10
```

- Default: 10 blocks (~30 seconds on TON)
- Critical operations should wait for confirmed blocks
- Reorgs beyond this depth are extremely rare

## Rollback Process

### Step 1: Identify Divergence Point

When a reorg is detected:

1. Start from the block where hash mismatch occurred
2. This is the divergence point
3. All blocks from this point onwards are invalid

### Step 2: Delete Invalid Blocks

```typescript
db.handleReorg(divergenceBlock);
```

This deletes:
- All blocks >= divergenceBlock
- All events in those blocks (CASCADE)
- Updates indexer state to divergenceBlock - 1

### Step 3: Update State

```sql
UPDATE indexer_state
SET latest_block_indexed = :divergenceBlock - 1
WHERE id = 1;
```

### Step 4: Resume Syncing

After rollback, the indexer automatically:
1. Resumes from last valid block
2. Fetches new canonical chain
3. Re-indexes events
4. Updates account snapshots

## Database CASCADE

Foreign key constraints ensure data consistency:

```sql
CREATE TABLE internal_transfers (
  ...
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);
```

When a block is deleted, all events in that block are automatically deleted.

> **Block-scoped attribution is a prerequisite (INDEXER-H2).** The CASCADE deletes
> events *by `block_number`*, so a reorg rollback is only correct when each event
> carries the block that actually confirmed it. Transactions are therefore fetched
> per block via `/shards` → `/getBlockTransactions` → `/getTransactions`
> (`fetchBlockTransactions`), with `incomplete`/`after_lt` pagination so none are
> dropped during fast sync. The earlier implementation pulled a fixed "last 50
> transactions per address" window and re-attributed it to whatever block the loop
> was on, which made `block_number` meaningless and caused the rollback to delete
> the wrong events.

## Example Scenario

### Initial State

```
Block 100: hash_100a [STORED]
Block 101: hash_101a [STORED]
Block 102: hash_102a [STORED]
```

### Reorg Occurs

Chain reorganizes, blocks 101-102 change:

```
Block 100: hash_100a [UNCHANGED]
Block 101: hash_101b [DIFFERENT!]
Block 102: hash_102b [DIFFERENT!]
```

### Detection

When indexer tries to process block 103:

```typescript
// Check block 102
const stored = db.getBlock(102);
const chain = await fetchBlock(102);

if (stored.hash !== chain.hash) {
  // REORG!
  logger.warn('Reorg detected at block 102');
  db.handleReorg(101); // Rollback from 101
}
```

### Rollback

Database state after rollback:

```
Block 100: hash_100a [KEPT]
Block 101: [DELETED]
Block 102: [DELETED]
Block 103: [NOT INDEXED YET]

All events in blocks 101-102: [DELETED]
```

### Recovery

Indexer resumes:

```
Block 100: hash_100a [EXISTS]
Block 101: hash_101b [FETCH & INDEX]
Block 102: hash_102b [FETCH & INDEX]
Block 103: hash_103b [FETCH & INDEX]
```

## Account Snapshot Handling

Account snapshots are materialized views updated as events are processed.
Unlike the event tables, `account_snapshots` is keyed only by `nft_address` and
has **no** foreign key to `blocks`, so the CASCADE that removes reverted events
does not touch it. `handleReorg` therefore reconciles snapshots explicitly.

### During Reorg

`handleReorg` runs the following inside a single transaction:

1. Collect every `nft_address` referenced by the events about to be removed
   (both sides of transfers/payments, plus state and ownership changes).
2. Delete the reverted blocks — their events cascade away.
3. Recompute each affected snapshot from the **surviving** canonical events.
4. Clear any snapshot whose NFT has no surviving events.

This guarantees the snapshot never serves reverted (non-canonical) state, even
if no new event ever arrives for that NFT.

### Snapshot Rebuild Logic

```typescript
// In handleReorg, after blocks (and their events) are deleted:
for (const nftAddress of affectedNftAddresses) {
  db.rebuildAccountSnapshot(nftAddress); // recompute from surviving events
}

// rebuildAccountSnapshot recomputes each field independently:
//   current_owner            <- latest surviving nft_ownership_changes
//   current_state            <- latest surviving account_state_changes
//   last_state_change_block  <- block of that latest state change
//   last_transfer_block      <- MAX(block) across surviving transfers/payments
// A snapshot with no surviving events is deleted.
```

### Consistency Guarantee

Snapshots are reconciled synchronously during rollback:
- Reverted events never linger in the snapshot
- Fields are recomputed from canonical history, not patched forward
- Snapshots with no surviving events are cleared, not left stale

## API Responses During Reorg

### Unconfirmed Data

Responses include confirmation count:

```json
{
  "blockNumber": 12345,
  "confirmationBlocks": 5,
  "status": "pending"
}
```

If `confirmationBlocks < INDEXER_CONFIRMATION_BLOCKS`, data may change.

### Confirmed Data

```json
{
  "blockNumber": 12300,
  "confirmationBlocks": 50,
  "status": "confirmed"
}
```

Data with sufficient confirmations is very unlikely to change.

### Advisory Notice

All responses include:

```json
{
  "advisory": "Always verify on-chain for critical operations"
}
```

## Configuration

### Confirmation Blocks

```env
INDEXER_CONFIRMATION_BLOCKS=10
```

**Trade-offs**:

| Value | Pros | Cons |
|-------|------|------|
| 1 | Fast confirmation | High reorg risk |
| 10 | Balanced | ~30s delay |
| 20 | Very safe | ~60s delay |
| 100 | Extremely safe | ~5min delay |

**Recommendation**: 10 blocks for most use cases

### Polling Interval

```env
INDEXER_POLL_INTERVAL_MS=5000
```

- Faster polling = quicker reorg detection
- Slower polling = less API load
- TON block time ~3-5 seconds

### Batch Size

```env
INDEXER_BATCH_SIZE=100
```

- Larger batches = faster initial sync
- Smaller batches = better reorg recovery
- During reorg, processes 1 block at a time

## Monitoring Reorgs

### Metrics to Track

1. **Reorg Frequency**
   - Count reorgs per day
   - Alert if > 5 per day

2. **Reorg Depth**
   - How many blocks rolled back
   - Alert if > 20 blocks

3. **Recovery Time**
   - Time to detect and recover
   - Should be < 1 minute

### Logging

```typescript
logger.warn({
  blockNumber,
  storedHash,
  chainHash,
  depth: latestBlock - blockNumber
}, 'Reorg detected');
```

### Alerts

Set up alerts for:
- Reorg depth > 20 blocks
- Reorg frequency > 5/day
- Recovery time > 5 minutes

## Best Practices

### For Merchants

1. **Wait for Confirmations**
   ```typescript
   if (payment.confirmationBlocks < 10) {
     // Still pending, show as unconfirmed
   }
   ```

2. **Verify Critical Payments On-Chain**
   ```typescript
   const onChainStatus = await contract.getPaymentStatus(invoiceId);
   ```

3. **Handle Reorg Gracefully**
   ```typescript
   // Payment was confirmed, then disappeared (reorg)
   if (wasConfirmed && nowPending) {
     showMessage("Payment confirmation delayed due to network reorganization");
   }
   ```

### For Integrators

1. **Use Webhooks with Confirmations**
   ```json
   {
     "event": "payment.confirmed",
     "confirmations": 10
   }
   ```

2. **Implement Idempotency**
   - Same invoice_id = same payment
   - Handle duplicate notifications

3. **Monitor Indexer Health**
   - Check `/health` endpoint
   - Verify `blocksBehind < 100`

### For Operators

1. **Database Backups**
   - Before major reorgs
   - Automated daily backups
   - Test restore procedure

2. **Monitor Chain Health**
   - Watch for validator issues
   - Monitor network partitions
   - Track consensus disagreements

3. **Logging**
   - Log all reorgs with details
   - Track reorg patterns
   - Analyze root causes

## Testing Reorg Handling

### Unit Tests

```typescript
it('should handle reorg correctly', () => {
  // Insert blocks 1-5
  for (let i = 1; i <= 5; i++) {
    db.insertBlock(i, `hash${i}`, `hash${i-1}`, i*1000, 1);
  }

  // Simulate reorg at block 3
  db.handleReorg(3);

  // Verify blocks 3-5 deleted
  expect(db.getBlock(3)).toBeNull();
  expect(db.getBlock(1)).toBeDefined();
});
```

### Integration Tests

1. Start indexer
2. Inject reorg event
3. Verify recovery
4. Check data consistency

### Manual Testing

1. Run testnet indexer
2. Trigger reorg (if possible)
3. Observe logs
4. Verify data correction

## Limitations

### Deep Reorgs

If reorg depth > 1000 blocks:
- May take time to re-index
- Historical queries may fail temporarily
- Consider full resync

### Multiple Simultaneous Reorgs

Rare but possible:
- Indexer handles one at a time
- May temporarily lag behind chain
- Will eventually catch up

### No Reorg Prediction

Cannot predict reorgs:
- Only detect after occurrence
- Recent blocks always at risk
- Use confirmations for safety

## References

- [TON Consensus Documentation](https://docs.ton.org/)
- [Blockchain Reorgs Explained](https://en.bitcoin.it/wiki/Chain_Reorganization)
- [SQLite Foreign Keys](https://www.sqlite.org/foreignkeys.html)

---

**Last Updated**: 2025-12-27
**Version**: 1.0.0
