# B1 — Indexer Validation Plan

**Engagement:** [B1](./ENGAGEMENT.md)
**Status:** Plan frozen — run against the live testnet manifest
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

The Payment Status Indexer ([`backend/indexer/`](../../../backend/indexer/)) is a **read-only** observer of on-chain protocol events. This document defines the validation suite the indexer must pass after the testnet deployment, enforcing acceptance criterion #6 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1 ("Indexer correctly indexes testnet payment events").

The suite covers:

- §3: Event-coverage matrix — every on-chain event the indexer is supposed to surface.
- §4: Reorg handling against testnet (the testnet has a higher reorg rate than mainnet by design).
- §5: Idempotent re-sync from genesis (deletion of the DB must not lose data permanently).
- §6: API contract — the read-only REST surface returns the canonical schema for downstream consumers.
- §7: Resource budget — the indexer fits on the cheapest viable testnet VM.

Results are mirrored into [`STATUS.md`](./STATUS.md) §9.3.

---

## 2. Configuration under test

The indexer is configured to point at the live testnet manifest. The values below are loaded from env at run start — never hard-coded.

| Env var | Source | Notes |
|---------|--------|-------|
| `TON_NETWORK` | `testnet` | Locked. `mainnet` is rejected by the harness. |
| `TON_API_ENDPOINT` | `https://testnet.toncenter.com/api/v2` | Sandbox API; rate-limited. |
| `TON_API_KEY` | Operator's sandbox API key | Stored encrypted, rotated per [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) §3 |
| `PAYMENT_HUB_ADDRESS` | Manifest `contracts.PaymentHub.address` | Loaded from the phase 2 manifest produced by [`RUNBOOK.md`](./RUNBOOK.md) §6 |
| `MERCHANT_PAYMENT_HUB_ADDRESS` | Manifest `contracts.MerchantPaymentHub.address` | Same |
| `NFT_COLLECTION_7777_ADDRESS` | Testnet Series 7777 mock | Recorded in [`STATUS.md`](./STATUS.md) §3 |
| `NFT_COLLECTION_8888_ADDRESS` | Testnet Series 8888 mock | Same |
| `INDEXER_CONFIRMATION_BLOCKS` | `10` (default) | Lower values are allowed in §4 stress tests |
| `INDEXER_POLL_INTERVAL_MS` | `5000` | Tightened to `1000` in §4 reorg stress tests |
| `INDEXER_BATCH_SIZE` | `100` | Capped at sandbox rate-limit |

A configuration drift between the manifest and the env vars aborts the run with `INDEXER_MANIFEST_MISMATCH`.

---

## 3. Event coverage matrix

Each row is an automated test under `backend/indexer/tests/integration/testnet/`. Tests are parameterised on the manifest so a re-deployment does not require code changes.

| # | Event | Source contract | Test action | Expected indexer behaviour | Severity if failing |
|---|-------|-----------------|-------------|----------------------------|---------------------|
| IDX-1 | `InvoiceCreated` | `MerchantPaymentHub` | Create invoice via Merchant API ([`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §3 API-1) | Row appears in `invoices` table with `status='pending'`, `expiresAt`, `merchantNftAccountId`, `amount` within 2× `INDEXER_POLL_INTERVAL_MS` of the on-chain tx | Blocker |
| IDX-2 | `InternalTransfer` | `PaymentHub` | E2E-2 in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §2 | Row appears in `internal_transfers` with `from`, `to`, `amount`, `txHash` matching the chain | Blocker |
| IDX-3 | `InvoiceSettled` | `MerchantPaymentHub` | E2E-4 in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §2 | `invoices` row transitions to `status='settled'`; `settledAt`, `settlerNftAccountId`, `payerTxHash` populated | Blocker |
| IDX-4 | `AccountLockSet` | `AccountLocks` | E2E-5 (`FRAUD_LOCK` set) | `account_locks` row appears with `flag='FRAUD_LOCK'`, `setBy=riskAuthority`, `setAt`, `clearedAt=null` | Blocker |
| IDX-5 | `AccountLockCleared` | `AccountLocks` | Operator clears the lock from E2E-5 | Same row updates `clearedAt`; history retained, no row deletion | Blocker |
| IDX-6 | `LockedOut` | `PaymentHub` | A locked account attempts a transfer (E2E-5) | `attempted_transfers_blocked` row records the attempt; balances unchanged | High |
| IDX-7 | `NFTOwnershipChanged` | `NFTAccountResolver` | Transfer a testnet NFT card between two wallets | `nft_ownership_history` row appears; `accounts.owner` updated; previous owner kept in history | High |
| IDX-8 | `CollateralSignal` | `CollateralSignal` / `PublicCollateralLookup` | E2E-6 | `collateral_signals` row appears with verbatim payload; reads via REST return the same blob | High |
| IDX-9 | Governance lifecycle events | `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` | E2E-7 | `proposals`, `proposal_snapshots`, `transparency_entries` tables populated; cross-references valid | Medium |
| IDX-10 | Out-of-scope events do **not** appear | Random unrelated jetton transfer on testnet | Indexer ignores it | No new row; no error log | Critical (false positive would taint advisory output) |

Acceptance is "every Blocker row green AND no Critical row failing". Medium / High rows may carry a deferral in [`STATUS.md`](./STATUS.md) §13 with explicit mainnet impact.

---

## 4. Reorg handling

The TON testnet reorgs more aggressively than mainnet, so reorg correctness must be proven on testnet rather than discovered on mainnet.

| # | Test | Action | Expected | Severity if failing |
|---|------|--------|----------|---------------------|
| RG-1 | Single-block reorg | Force the indexer to ingest a block that the chain later orphans (e.g. by lowering `INDEXER_CONFIRMATION_BLOCKS` to `1` and waiting for a natural testnet reorg) | Indexer rolls the orphaned block back; affected rows are reverted; new canonical chain is ingested; final state matches the canonical chain | Critical |
| RG-2 | Deeper reorg | Same as RG-1 but at `INDEXER_CONFIRMATION_BLOCKS=0` (rolling 3+ blocks) | Same outcome; no data loss in `events` table for non-reorged blocks | Critical |
| RG-3 | Reorg during invoice settlement | Force RG-1 mid-settlement (invoice ingested before reorg) | `invoices.status` reverts to `pending`; on re-ingest the settlement re-applies; final status is `settled` exactly once | Critical |
| RG-4 | Reorg telemetry | After RG-1 / RG-2 / RG-3 | Indexer emits a structured log line with `reorg_depth`, `rolled_back_block`, `new_head_block` | High |
| RG-5 | Reorg recovery from cold start | Restart the indexer mid-reorg (kill -9) | On restart the indexer detects the inconsistency and self-heals using the canonical chain — no manual intervention | Critical |

Tests are conducted with the default confirmation depth (`10`) restored before subsequent rows execute.

---

## 5. Idempotent re-sync from genesis

The deployment-script idempotency requirement (NFR-1 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §8) implies the same for the read-side: erasing the indexer DB and re-syncing from genesis must produce the same state as a continuous run.

| # | Test | Action | Expected | Severity |
|---|------|--------|----------|----------|
| RS-1 | Cold re-sync | Stop the indexer, delete `data/indexer.db`, set `INDEXER_START_BLOCK=0`, restart | Indexer re-ingests all events; final state byte-identical to a fingerprint taken before deletion (modulo timestamps) | Blocker |
| RS-2 | Resume from saved checkpoint | Stop the indexer, restart with the same `data/indexer.db` | Indexer resumes from `last_indexed_block`; no duplicate rows | Blocker |
| RS-3 | Mid-sync crash | `kill -9` mid-batch | On restart the indexer rolls forward; no row is partially committed (transactions are atomic) | High |
| RS-4 | DB corruption guard | Truncate the SQLite file mid-row | Indexer refuses to start with `INDEXER_DB_CORRUPTED`; operator runs `npm run repair-db` | High |

The "fingerprint" for RS-1 is the SHA-256 of the concatenated row hashes from `invoices`, `internal_transfers`, `account_locks`, `nft_ownership_history`, `collateral_signals` ordered by `(block, txHash, eventIndex)`. The validation harness produces it deterministically.

---

## 6. REST API contract

Downstream consumers (Merchant API, SDK, partners) rely on the read-only REST surface. Every endpoint MUST be tested against the live testnet deployment to prove the schema is stable.

| # | Endpoint | Test | Expected |
|---|----------|------|----------|
| API-IDX-1 | `GET /api/v1/payments/:invoice_id` | Query a `pending` invoice from IDX-1 | 200 OK with `{ invoiceId, status: 'pending', expiresAt, amount, merchantNftAccountId, createdAt }` — schema validated against `backend/indexer/docs/openapi.yaml` |
| API-IDX-2 | `GET /api/v1/payments/:invoice_id` | Query a `settled` invoice from IDX-3 | 200 OK with `status: 'settled'`, `settledAt`, `settlementTx` populated |
| API-IDX-3 | `GET /api/v1/payments/:invoice_id/events` | Same invoice | Returns the chronological event list; events have `block`, `txHash`, `eventIndex`, `payload` |
| API-IDX-4 | `GET /api/v1/accounts/:nft_id/history` | NFT account that performed E2E-2 | Returns transfer history (sent + received); pagination via `?cursor=...` |
| API-IDX-5 | `GET /api/v1/blocks/:block_number` | A block known to contain protocol events | Returns the indexed block with `events` array |
| API-IDX-6 | `GET /api/v1/health` | Healthy indexer | 200 OK with `{ status: 'ok', lastIndexedBlock, lagFromHeadSeconds }` |
| API-IDX-7 | Unknown invoice | `GET /api/v1/payments/unknown` | 404 with `{ error: 'INVOICE_NOT_FOUND' }`; no leakage of internal state |
| API-IDX-8 | Advisory disclaimer header | Any 200 response | Response carries `X-Tonbankcard-Advisory: true` to remind consumers the indexer is advisory only (mirrors `backend/indexer/README.md` §"Key Principles") |

All endpoints are tested with the `Accept: application/json` header. The schema is exported and compared row-by-row against the OpenAPI document committed under `backend/indexer/docs/`.

---

## 7. Resource budget

The indexer is expected to run within a modest VM allocation. Resource budgets are enforced during the longest test (RS-1 full re-sync).

| Resource | Target | Measurement | Severity if exceeded |
|----------|--------|-------------|----------------------|
| RAM (RSS) | ≤ 512 MiB | `ps -o rss=` sampled every 30s | High |
| CPU (avg) | ≤ 30% of 1 vCPU | `pidstat -p <pid> 30` over the run | Medium |
| Disk IO (writes) | ≤ 50 MB/min | `iotop -P -k -o` summary | Medium |
| DB size after full re-sync | ≤ 250 MB at month 1 | `du -sh data/indexer.db` | Medium |
| API p95 latency | ≤ 200 ms (cold cache) | k6 / autocannon run with concurrency 50 | High |

Targets blowing past the budget land in [`STATUS.md`](./STATUS.md) §13 with an explicit mainnet-impact statement. Exceeding RAM or p95 latency is a blocker for `READY-FOR-B2` because the same indexer is destined to support B2 (mainnet) under heavier load.

---

## 8. Execution & reporting

```bash
# All indexer validation
npm run test:integration:testnet --workspace backend/indexer

# Single section
npm run test:integration:testnet --workspace backend/indexer -- --grep "RG-"
```

Output:

```
deployments/testnet/<phase2-manifest-stem>.indexer.json
```

Schema (informally):

```json
{
  "ranAt": "ISO-8601 UTC timestamp",
  "manifest": "deployments/testnet/<phase2>.json",
  "rows": [
    { "id": "IDX-1", "passed": true, "evidence": ["logs/idx-1-<runId>.log"] }
  ],
  "reorg": { "depthsObserved": [2, 5], "selfHealed": true },
  "resync": { "fingerprintBefore": "abc…", "fingerprintAfter": "abc…", "match": true },
  "api": { "openapiSchemaVersion": "1.0.0", "drift": [] },
  "budget": {
    "rssMax": "412 MiB",
    "cpuAvg": "22%",
    "p95LatencyMs": 178,
    "dbSizeMB": 87
  }
}
```

The summary is copied into [`STATUS.md`](./STATUS.md) §9.3. Findings follow [`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md) §3.

---

## 9. Acceptance

Indexer sign-off requires:

1. Every Blocker / Critical row in §3 / §4 / §5 / §6 passing.
2. Resource budgets in §7 either met or explicitly deferred with a mainnet-impact statement.
3. The report from §8 attached as a manifest sibling, with its SHA-256 recorded in [`STATUS.md`](./STATUS.md) §10.

Failure modes are mirrored to the Phase 2 sign-off (§9.3 rows) and block `READY-FOR-B2`.

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Runbook](./RUNBOOK.md)
- [Validation plan](./VALIDATION_PLAN.md)
- [Gateway validation matrix](./GATEWAY_VALIDATION.md)
- [Payment indexer](../../../backend/indexer/)
- [Payment indexer README](../../../backend/indexer/README.md)
- [Remediation workflow](../../security/audits/REMEDIATION_WORKFLOW.md)
- [Formal invariants](../../../audit/INVARIANTS.md)
