---
title: "[INDEXER-H4] Tangled transaction parsing/routing: synthesized destination, wrong block, two timestamps"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

Transaction routing is circular and effectively unverified: `fetchContractTransactions` synthesizes `tx.destination` to be the queried contract, and `processTransaction` then routes on that same value. The parser reads a `block_number` that is never set and a transaction timestamp that can disagree with the block timestamp passed alongside it.

## Severity & Category

- Severity: High
- Category: Logic correctness / data integrity (security-relevant)

The blockchain is the single source of truth; message-level routing must reflect actual on-chain message sources/destinations.

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:386-393` (`fetchContractTransactions` sets `tx.destination`)
- `backend/indexer/src/services/indexer-service.ts:428-431` (`processTransaction` routing)
- `backend/indexer/src/parsers/event-parser.ts:93-96` (`parseTransaction` reads block/utime)
- `backend/indexer/src/parsers/event-parser.ts:155-158` (out_msgs handling)

## Description

`fetchContractTransactions` overwrites the transaction destination with the address it queried:

```ts
// backend/indexer/src/services/indexer-service.ts:386-393
tx.destination = address; // the queried contract
```

`processTransaction` then routes on `getTransactionDestination(transaction)`, which is that same contract, i.e. circular routing:

```ts
// backend/indexer/src/services/indexer-service.ts:428-431
// route based on getTransactionDestination(transaction) === queried contract
```

The parser reads fields that are not populated as expected:

```ts
// backend/indexer/src/parsers/event-parser.ts:93-96 / 155-158
// reads transaction.block_number (never set -> events carry blockNumber = 0, later overridden by the service)
// reads transaction.utime, which can disagree with the block timestamp arg
```

As a result, message-level routing (which contract sent/received which message) is not genuinely verified, the parsed `block_number` is meaningless, and there are two competing timestamp sources.

## Impact

- Events may be routed/typed incorrectly because routing keys off a synthesized value.
- Parsed block numbers are unreliable (compounds H2).
- Timestamp ambiguity yields inconsistent event timestamps.

## Suggested Fix

- Pass through the real toncenter transaction structure instead of synthesizing `destination`.
- Route per-message on `msg.destination` / `msg.source` rather than the queried contract address.
- Reconcile the two timestamp sources to a single, well-defined value (prefer the on-chain block/utime consistently).

## Acceptance Criteria

- [ ] Routing decisions use actual message `source`/`destination`, not a synthesized field.
- [ ] The parser no longer relies on an unset `block_number`; block attribution is explicit and correct.
- [ ] Event timestamps use one reconciled source.
- [ ] A regression test feeds a realistic toncenter transaction (with out_msgs) and asserts correct per-message routing, block attribution, and timestamp.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#257](https://github.com/xlabtg/tonbankcard-protocol/issues/257)
