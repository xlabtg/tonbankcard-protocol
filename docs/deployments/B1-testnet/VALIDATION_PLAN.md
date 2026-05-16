# B1 — Testnet Validation Plan

**Engagement:** [B1](./ENGAGEMENT.md)
**Status:** Plan frozen — executed against the live testnet deployment
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document specifies the validation suite that runs against the live testnet deployment produced by [`RUNBOOK.md`](./RUNBOOK.md) §6. The suite is the source of truth for acceptance criteria #4 ("End-to-end integration test suite passes against testnet contracts") in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1.

The suite covers:

- §2: End-to-end payment scenarios on the deployed Phase 2 contracts.
- §3: Merchant API integration against the deployed `MerchantPaymentHub`.
- §4: SDK happy-path integration against the deployed contracts.
- §5: Phase 4 testnet-only smoke tests (gated on Phase 2 sign-off).
- §6: CI integration job that re-runs the suite continuously.

Scenario results are mirrored in [`STATUS.md`](./STATUS.md) §9. Each row in the live status doc carries an `⏳ / ✅ / ❌` marker and the tx hash for traceability.

---

## 2. End-to-end payment scenarios (Phase 2)

Each scenario is an automated test in `tests/integration/testnet/` (created against the live deployment). The tests are parameterised by the manifest at `deployments/testnet/<phase2>.json` so re-deployment to a new manifest does not require code changes.

### E2E-1 — NFT ownership resolution via `PaymentHub`

| Field | Value |
|-------|-------|
| Pre-state | Test wallet owns NFT card minted from the testnet Series 7777 mock |
| Action | Wallet calls `PaymentHub.resolveOwner(nftAddr)` |
| Expected | Resolver returns the wallet's address; mismatched callers return `null` |
| Invariant attested | I2 (NFT = account authority) |

### E2E-2 — Atomic internal transfer

| Field | Value |
|-------|-------|
| Pre-state | Two NFT accounts A, B; A holds 100 TBC, B holds 0 |
| Action | A initiates `transfer(B, 25)` |
| Expected | A = 75, B = 25, single transaction, no intermediate observable state |
| Invariant attested | I4 (atomicity), I5 (ledger conservation) |

### E2E-3 — Merchant invoice creation

| Field | Value |
|-------|-------|
| Pre-state | Merchant SDK initialised against testnet `MerchantPaymentHub` |
| Action | `merchant.createInvoice({ amount: 10 TBC, expiresIn: 600 })` |
| Expected | Invoice ID returned, status `pending`, expiry recorded |
| Notes | Merchant API documented in [`api/`](../../../api/) |

### E2E-4 — Merchant invoice settlement

| Field | Value |
|-------|-------|
| Pre-state | Invoice from E2E-3 + payer NFT account with sufficient TBC |
| Action | Payer wallet calls `MerchantPaymentHub.settle(invoiceId)` |
| Expected | Status flips to `settled`; on-chain event indexed by the indexer |
| Invariants attested | I1, I4, I7 |

### E2E-5 — Lock blocks outgoing transfer

| Field | Value |
|-------|-------|
| Pre-state | Account A with `FRAUD_LOCK` flag set by `risk_authority` |
| Action | A attempts `PaymentHub.transfer(B, 1)` |
| Expected | Transaction reverts; flag remains set; no balance change; observable `LockedOut` event |
| Invariant attested | I6 (Lock ≠ confiscation), I7 (Lock enforcement) |

### E2E-6 — Collateral signal round-trip

| Field | Value |
|-------|-------|
| Pre-state | Account A with NFT in good standing |
| Action | A emits a `CollateralSignal`; client reads via `PublicCollateralLookup` |
| Expected | Lookup returns the signal payload verbatim; no admin write path exists |
| Invariant attested | I3 (No admin fund control — verified by absence of admin write methods on the lookup) |

### E2E-7 — Governance proposal lifecycle

| Field | Value |
|-------|-------|
| Pre-state | `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` deployed |
| Action | Submit proposal → snapshot verify → record transparency entry |
| Expected | Lifecycle completes deterministically; no funds moved |
| Invariant attested | I3 |

The seven scenarios above are the **happy paths**. Adversarial scenarios (replays, malformed payloads, lock circumvention) are covered by the existing local test suites under `tests/` and are re-asserted against testnet using the same harness pointed at the testnet RPC.

---

## 3. Merchant API integration

The Merchant API ([`api/`](../../../api/)) is re-tested against the live testnet contracts. The test command:

```bash
npm run test:integration:testnet --workspace api
```

Coverage:

| # | Test | Expected |
|---|------|----------|
| API-1 | Invoice creation endpoint (`POST /invoices`) writes the invoice to the in-memory store and emits the on-chain side effect via `MerchantPaymentHub` | 200 OK; invoice ID; on-chain tx hash returned |
| API-2 | Idempotency key reuse for invoice creation | 409 with the original invoice ID |
| API-3 | Settlement webhook signature verification | 401 on signature mismatch; 200 on valid |
| API-4 | Read-only invoice status endpoint surfaces indexer state, not API state | Status reflects on-chain truth |

All Merchant API integration tests reuse the existing fixtures under `api/tests/` and switch the RPC endpoint via the `TON_NETWORK=testnet` env var.

---

## 4. SDK integration

The Merchant SDK ([`sdk/`](../../../sdk/)) provides the canonical merchant-facing surface. The test command:

```bash
npm run test:integration:testnet --workspace sdk
```

Coverage:

| # | Test | Expected |
|---|------|----------|
| SDK-1 | `MerchantClient.createInvoice` round-trip against testnet `MerchantPaymentHub` | Invoice created and settled deterministically |
| SDK-2 | `MerchantClient.verifySettlement` reads on-chain state via indexer | Settlement observed within indexer SLA (see [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md)) |
| SDK-3 | SDK error surfaces for invalid invoice IDs | Typed error matches `SDK_ERR_INVOICE_NOT_FOUND` |
| SDK-4 | SDK error surfaces for locked payer accounts | Typed error matches `SDK_ERR_ACCOUNT_LOCKED` |

---

## 5. Phase 4 testnet-only smoke tests

Phase 4 contracts are tested against the same harness with the `testnet-only` manifest. Tests for Phase 4 mark themselves as `non-blocking-for-mainnet` — they validate behaviour on testnet, not readiness for mainnet (mainnet readiness for Phase 4 requires A2).

| # | Contract | Smoke test | Expected |
|---|----------|------------|----------|
| P4-1 | `CrossChainBridge` | Issue a bridge message; validator signs; recipient receives placeholder receipt | Lifecycle completes; replay rejected |
| P4-2 | `MultiSigCard` | M-of-N approval flow | Threshold honoured; cancel path works |
| P4-3 | `RecurringPayments` | Schedule + execute one cycle | Payment debited; subsequent cycle obeys cadence |
| P4-4 | `LendingProtocolCoordinator` | Adapter handshake against CoinRabbit testnet | Round-trip OK; no fund custody by coordinator |

Failures here block Phase 4 sign-off but do **not** block Phase 2 sign-off (Phase 2 has its own gating from §2–§4 of this document).

---

## 6. CI integration

A single workflow runs the suite against the latest manifest:

```bash
npm run test:integration:testnet
```

The command:

1. Reads `deployments/testnet/<latest>.json`.
2. Bootstraps test wallets from a sandbox faucet (sandbox-only, never mainnet keys).
3. Executes §2 (E2E-1 … E2E-7), §3 (API-1 … API-4), §4 (SDK-1 … SDK-4), §5 (P4-1 … P4-4 — conditional on Phase 4 manifest present).
4. Writes a summary report to `deployments/testnet/<manifest>.integration.json`.

A green run is the **necessary** signal for sign-off. The CI job is owned by roadmap B3 (Production Monitoring & Alerting) — until B3 wires the workflow, the operator runs the command manually and attaches the integration report to [`STATUS.md`](./STATUS.md) §10.

---

## 7. Failure handling

A failure in §2 / §3 / §4 / §5 raises an entry in [`STATUS.md`](./STATUS.md) §13 and follows the workflow at [`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md) §3. Critical/High failures pause B1 and block Phase 4 deployment (if not yet performed) and `READY-FOR-B2` (if already deployed).

---

## 8. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Runbook](./RUNBOOK.md)
- [Gateway validation matrix](./GATEWAY_VALIDATION.md)
- [Indexer validation plan](./INDEXER_VALIDATION.md)
- [Formal invariants](../../../audit/INVARIANTS.md)
- [Test coverage report](../../../audit/TEST_COVERAGE_REPORT.md)
- [Merchant API](../../../api/)
- [Merchant SDK](../../../sdk/)
- [Indexer](../../../backend/indexer/)
