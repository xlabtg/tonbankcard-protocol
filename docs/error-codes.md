# Error Codes Registry

This document is the canonical registry of error codes raised across the
TONBANKCARD Protocol stack. It covers:

1. **Smart contract exit codes** — every `require()` / `throw()` in the Tact
   contracts, with the user-facing message, the asserted condition and the
   contract that raises it.
2. **Merchant API error codes** — the machine-readable strings returned in the
   standardized JSON error response.
3. **Indexer error codes** — the `errorCode` field attached to `pino` `error`
   level log entries.

Goals (see [Issue #129 (D3)](https://github.com/xlabtg/tonbankcard-protocol/issues/129)):

- Predictable, documented behaviour for **merchant integrators**.
- A single reference for **auditors** reviewing contract behaviour.
- Consistent log fields for **operators** building alerting / dashboards (B3).

> **Note on contract exit codes.** Tact emits a default exit code (`6`,
> `Compute phase out of gas`, etc.) for unhandled conditions. The codes below
> only document the *explicit* `require()` / `throw()` assertions written into
> the contracts. The Tact compiler additionally assigns a deterministic
> numeric exit code to each unique `require()` string at compile time;
> consumers must map by **message** rather than by numeric code, because the
> compiler is free to renumber assertions between releases.

---

## 1. Smart Contract Exit Codes

### `MerchantPaymentHub.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Sender must be authorized admin | `Unauthorized: only admin` | `MerchantPaymentHub.tact` |
| Account balance must cover the requested amount | `Insufficient balance` | `MerchantPaymentHub.tact` |
| `SetAccountBalance` may only seed a zero balance | `SetAccountBalance: initial-only (existing balance must be zero)` | `MerchantPaymentHub.tact` |
| Admin transfer must already be proposed before execute | `No pending admin transfer` | `MerchantPaymentHub.tact` |
| Only the proposed admin can execute the transfer | `Unauthorized: only proposed admin` | `MerchantPaymentHub.tact` |
| Timelock must have elapsed before admin transfer is executable | `Timelock not expired: wait 7 days` | `MerchantPaymentHub.tact` |

### `payments/PaymentHub.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Reentrancy guard (invariant I4) | `Reentrancy detected` | `payments/PaymentHub.tact` |
| Transfer amount must be positive | `Transfer amount must be positive` | `payments/PaymentHub.tact` |
| `from_nft` must be a valid NFT account | `Invalid from_nft address` | `payments/PaymentHub.tact` |
| `to_nft` must be a valid NFT account | `Invalid to_nft address` | `payments/PaymentHub.tact` |
| Sender must own the source NFT (invariants I1, I2) | `Unauthorized: sender is not NFT owner` | `payments/PaymentHub.tact` |
| Source account must be ACTIVE | `From account is not ACTIVE` | `payments/PaymentHub.tact` |
| Destination account must not be CLOSED | `Cannot send to CLOSED account` | `payments/PaymentHub.tact` |
| Source account must have sufficient balance | `Insufficient balance` | `payments/PaymentHub.tact` |
| Only admin can whitelist a collection | `Unauthorized: only admin` | `payments/PaymentHub.tact` |
| Only admin can propose an admin transfer | `Unauthorized: only admin` | `payments/PaymentHub.tact` |
| Admin transfer must already be proposed before execute | `No pending admin transfer` | `payments/PaymentHub.tact` |
| Only the proposed admin can execute the transfer | `Unauthorized: only proposed admin` | `payments/PaymentHub.tact` |
| Timelock must have elapsed before admin transfer is executable | `Timelock not expired: wait 7 days` | `payments/PaymentHub.tact` |
| Only admin can cancel an admin transfer | `Unauthorized: only admin` | `payments/PaymentHub.tact` |

### `payment-hub/account-state.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Owner / deployer only (test-only seeding) | `Unauthorized: only deployer (test-only)` | `payment-hub/account-state.tact` |
| Deposit amount must be positive | `Amount must be positive` | `payment-hub/account-state.tact` |
| Withdraw amount must be positive | `Amount must be positive` | `payment-hub/account-state.tact` |
| Account state must allow withdrawal | `Account state does not allow withdrawal` | `payment-hub/account-state.tact` |
| Withdraw must not exceed balance | `Insufficient balance` | `payment-hub/account-state.tact` |
| Internal transfer amount must be positive | `Amount must be positive` | `payment-hub/account-state.tact` |
| Internal transfer cannot self-loop | `Cannot transfer to same account` | `payment-hub/account-state.tact` |
| Source account must be ACTIVE for internal transfer | `Source account must be ACTIVE` | `payment-hub/account-state.tact` |
| Source must have sufficient balance for internal transfer | `Insufficient balance` | `payment-hub/account-state.tact` |
| State transition target must be a valid state | `Invalid state` | `payment-hub/account-state.tact` |
| FROZEN state requires DAO / risk authorization | `FROZEN state requires DAO/risk authorization` | `payment-hub/account-state.tact` |
| COLLATERAL_LOCKED state requires lending adapter authorization | `COLLATERAL_LOCKED state requires lending adapter authorization` | `payment-hub/account-state.tact` |
| CLOSED accounts cannot change state | `CLOSED accounts cannot change state` | `payment-hub/account-state.tact` |

### `collateral-lookup/PublicCollateralLookup.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Only owner can set the account-locks contract during deployment | `Unauthorized` | `collateral-lookup/PublicCollateralLookup.tact` |

### `nft-resolver/nft_account_resolver.fc`

| Condition | User-facing message | Source |
|---|---|---|
| Hard-failed access denied | exit code `0xffff` | `nft-resolver/nft_account_resolver.fc` |

### `governance/ProposalRegistry.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Category must be within allowed range | `Invalid category` | `governance/ProposalRegistry.tact` |
| Author NFT ID must be 1–222 (valid Diamond) | `Invalid Diamond NFT ID` | `governance/ProposalRegistry.tact` |
| Quorum threshold must be positive | `Quorum must be positive` | `governance/ProposalRegistry.tact` |
| Quorum cannot exceed total Diamond supply | `Quorum exceeds total supply` | `governance/ProposalRegistry.tact` |
| Proposal must exist | `Proposal not found` | `governance/ProposalRegistry.tact` |
| Proposal must still be active for voting | `Proposal already finalized` | `governance/ProposalRegistry.tact` |
| Vote must be inside the voting window | `Voting not started` / `Voting ended` | `governance/ProposalRegistry.tact` |
| Voter NFT ID must be 1–222 (valid Diamond) | `Invalid Diamond NFT ID` | `governance/ProposalRegistry.tact` |
| Vote type must be FOR / AGAINST / ABSTAIN | `Invalid vote type` | `governance/ProposalRegistry.tact` |
| Voter may not vote twice on the same proposal | `Already voted` | `governance/ProposalRegistry.tact` |
| Finalize requires the voting window to have ended | `Voting not ended` | `governance/ProposalRegistry.tact` |

### `governance/SnapshotVerifier.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Registry can only be set once | `Registry already set` | `governance/SnapshotVerifier.tact` |
| Proposal ID must be positive | `Invalid proposal ID` | `governance/SnapshotVerifier.tact` |
| Snapshot must not already exist | `Snapshot already exists` | `governance/SnapshotVerifier.tact` |

### `governance/TransparencyRegistry.tact`

| Condition | User-facing message | Source |
|---|---|---|
| Category must be valid | `Invalid category` | `governance/TransparencyRegistry.tact` |
| Proposal must be registered | `Proposal not found` | `governance/TransparencyRegistry.tact` |
| Outcome must be valid | `Invalid outcome` | `governance/TransparencyRegistry.tact` |

### `CrossChainBridge.tact` — response error codes

Bridge entry points (`InitiateOutboundIntent`, `CompleteOutboundIntent`,
`ProcessInboundIntent`) do **not** abort the transaction on validation failure;
instead they emit a structured `BridgeResponse` carrying a numeric
`error_code`. This keeps replay-protection auditing deterministic and lets the
off-chain relayer surface the precise failure reason to the originator
(F3 / Issue #138). Codes are stable; consumers MUST map by numeric value.

| Code | Symbol | Meaning |
|---:|---|---|
| `0` | `ERROR_BR_NONE` | Operation accepted (success path). |
| `1` | `ERROR_BR_NOT_OWNER` | Sender does not own the source NFT (invariants I1, I2). |
| `2` | `ERROR_BR_INVALID_AMOUNT` | Amount is zero or otherwise out of range. |
| `3` | `ERROR_BR_INVALID_CHAIN` | Target chain ID is not in the supported set (`docs/bridge/SUPPORTED_CHAINS.md`). |
| `4` | `ERROR_BR_INTENT_NOT_FOUND` | Intent ID is unknown (anti-replay state lookup miss). |
| `5` | `ERROR_BR_INTENT_NOT_PENDING` | Intent is not in `PENDING` (already `COMPLETED` / `REFUNDED` / `EXPIRED`) — see replay-protection state machine in `docs/bridge/REPLAY_PROTECTION.md`. |
| `6` | `ERROR_BR_NFT_NOT_REGISTERED` | Source NFT has not been seeded into the resolver. |
| `7` | `ERROR_BR_NOT_AUTHORIZED` | Caller is neither the NFT owner nor the configured relayer / validator. |

See `docs/bridge/REPLAY_PROTECTION.md` for the canonical-hash construction
referenced by these checks and `docs/bridge/CIRCUIT_BREAKERS.md` for the
auto-pause reason codes (`RC-*`) that may suppress acceptance even when the
above codes would otherwise return `ERROR_BR_NONE`.

### `RecurringPayments.tact` — response error codes

Subscription entry points (`CreateMandate`, `ExecuteRecurringPayment`,
`CancelMandate`) follow the same response-rather-than-abort discipline as the
bridge: every validation failure emits a structured
`RecurringPaymentResponse` carrying a numeric `error_code`. This keeps the
mandate state machine (`SPECIFICATION.md` §5) auditable and lets the wallet
surface the precise failure to the user
(F4 / Issue #139). Codes are stable; consumers MUST map by numeric value.

| Code | Symbol | Meaning |
|---:|---|---|
| `0` | `ERROR_RP_NONE` | Operation accepted (success path). |
| `1` | `ERROR_RP_NOT_OWNER` | `CreateMandate` / `CancelMandate` sender does not own the target NFT card (invariants I1, I2). |
| `2` | `ERROR_RP_INVALID_AMOUNT` | `CreateMandate` with `amount_per_period == 0`. |
| `3` | `ERROR_RP_INVALID_PERIOD` | `CreateMandate` with `period_seconds < MIN_PERIOD_SECONDS` (3600 s). |
| `4` | `ERROR_RP_MANDATE_NOT_FOUND` | `ExecuteRecurringPayment` / `CancelMandate` references an unknown mandate. |
| `5` | `ERROR_RP_MANDATE_NOT_ACTIVE` | Operation against a mandate already in `MANDATE_CANCELLED` or `MANDATE_COMPLETED`. |
| `6` | `ERROR_RP_TOO_EARLY` | `ExecuteRecurringPayment` before `last_executed_at + period_seconds` (`SPECIFICATION.md` §5.2). |
| `7` | `ERROR_RP_MAX_REACHED` | `ExecuteRecurringPayment` after `execution_count == max_executions` (`SPECIFICATION.md` §5.3). |
| `8` | `ERROR_RP_NFT_NOT_REGISTERED` | `CreateMandate` for an NFT that the protocol has not yet seeded into `nft_owners`. |
| `9` | `ERROR_RP_NOT_AUTHORIZED` | `ExecuteRecurringPayment` sender is neither the NFT owner nor the stored `merchant_address` (`SPECIFICATION.md` §5.1). |

See `docs/recurring-payments/SPECIFICATION.md` §7 for the response envelope
shape and §7.4 for the registry mirror, and
`docs/recurring-payments/CONTRACT_HARDENING.md` for the A2-gated RP-CH-3
backlog item that will introduce `ERROR_RP_PAUSED = 10` once
pause/resume lands.

### Test-only seeding (deployer guards)

Several contracts expose `Register*` receivers behind a `sender() == self.deployer`
guard. These are explicit `test-only` paths used by deterministic invariant /
adversarial tests and never reachable from real users:

| Contract | Condition | User-facing message |
|---|---|---|
| `CollateralSignal.tact` | Only deployer can seed NFT ownership | `Unauthorized: only deployer (test-only)` |
| `CrossChainBridge.tact` | Only deployer can register NFT ownership / relayer | `Unauthorized: only deployer (test-only)` |
| `CrossChainBridge.tact` | NFT owner is write-once | `NFT owner already registered` |
| `LendingProtocolCoordinator.tact` | Only deployer can seed NFT ownership | `Unauthorized: only deployer (test-only)` |
| `LendingProtocolCoordinator.tact` | NFT owner is write-once | `NFT owner already registered` |
| `MultiSigCard.tact` | Only deployer can seed NFT ownership | `Unauthorized: only deployer (test-only)` |
| `MultiSigCard.tact` | NFT owner is write-once | `NFT owner already registered` |
| `RecurringPayments.tact` | Only deployer can seed NFT ownership | `Unauthorized: only deployer (test-only)` |
| `RecurringPayments.tact` | NFT owner is write-once | `NFT owner already registered` |

These messages are intentionally identical across contracts: the auditor
should be able to grep for `Unauthorized: only deployer (test-only)` and find
every test-only seeding gate in the codebase.

### Adding a new exit code

When you add a new `require()` / `throw()` to a contract:

1. Use a short, **user-facing English message** that names the violated
   condition (`Insufficient balance`, not `bal < amt`).
2. **Re-use an existing message** when the semantic condition is identical
   across contracts (`Unauthorized: only admin`, `Insufficient balance`,
   `Amount must be positive`).
3. Append a row to the relevant table above in the same PR.

---

## 2. Merchant API Error Codes

All `api/` endpoints respond with the standardized envelope on failure:

```json
{
  "error": {
    "code": "INVOICE_NOT_FOUND",
    "message": "The requested invoice does not exist",
    "details": {}
  }
}
```

- `code` — exhaustive TypeScript enum, defined in
  [`api/src/types/errors.ts`](../api/src/types/errors.ts).
- `message` — short, user-facing English. **Must not** leak stack traces,
  file paths, SQL queries or other internal implementation details.
- `details` — optional, context-specific structured payload (never includes
  raw `Error.stack` or framework internals).

| Code | HTTP | Meaning |
|---|---:|---|
| `INVALID_API_KEY` | 401 | API key is missing, malformed, unknown, deactivated or expired. |
| `UNAUTHORIZED_MERCHANT` | 403 | API key is valid but lacks the required permission, or the caller is not authorized for this merchant resource. |
| `INVALID_NFT_ADDRESS` | 400 | NFT address fails format validation (`E[Qq]…`, 48 chars). |
| `NFT_NOT_WHITELISTED` | 403 | NFT collection is not in the merchant whitelist. |
| `INVALID_AMOUNT` | 400 | `amount_tbc` is missing, non-numeric, ≤ 0 or above `2^120 − 1`. |
| `INVALID_METADATA` | 400 | Metadata object exceeds limits or contains invalid types / keys. |
| `INVOICE_NOT_FOUND` | 404 | Invoice does not exist (or the caller is not authorized to see it — see §7). |
| `INVOICE_EXPIRED` | 410 | Invoice exists but is past its `expires_at`. |
| `RATE_LIMIT_EXCEEDED` | 429 | Per-key sliding window rate limit hit; `Retry-After` header is set. |
| `INTERNAL_ERROR` | 500 | Unhandled server error; client should retry with backoff. |
| `BLOCKCHAIN_UNAVAILABLE` | 503 | TON RPC / indexer dependency is unreachable; client should retry with backoff. |

### Security rules

These rules are enforced by the response envelope:

- **No stack traces / file paths in production.** Outside of `NODE_ENV=development`
  the `details` field never contains a raw `Error.message` or `Error.stack`.
- **No information leakage via 404 vs 403.** When a caller is unauthenticated
  or unauthenticated-for-the-resource, the API returns `INVOICE_NOT_FOUND`
  (404) rather than `UNAUTHORIZED_MERCHANT` (403), so that an attacker cannot
  enumerate existing invoice IDs by polling.
- **`details` is bounded.** All `ValidationError.details` values are
  primitive JSON (string / number / boolean / array of primitives).

---

## 3. Indexer Structured Logging

The indexer (`backend/indexer/`) emits all logs through a single `pino` logger
configured in `backend/indexer/src/index.ts`. Every log entry includes:

| Field | Required when | Description |
|---|---|---|
| `requestId` | always, on the API server | Per-request UUID; propagated to all child logs. |
| `eventId` | always, on the indexer worker | `${blockNumber}:${txHash}:${logIndex}` or `${blockNumber}` when no tx is in scope. |
| `contractAddress` | blockchain event logs | TON address of the contract whose transaction is being processed. |
| `errorCode` | `error` level entries | Machine-readable code from §3.1, e.g. `INDEXER_DB_WRITE_FAILED`. |

### 3.1 Indexer error codes

| Code | Where | Meaning |
|---|---|---|
| `INDEXER_LATEST_BLOCK_UNAVAILABLE` | `indexer-service.ts` | Could not fetch the latest masterchain block. |
| `INDEXER_BLOCK_FETCH_FAILED` | `indexer-service.ts` | Lookup or header fetch failed for a specific block. |
| `INDEXER_BLOCK_PROCESSING_FAILED` | `indexer-service.ts` | Exception while processing a fetched block. |
| `INDEXER_TX_FETCH_FAILED` | `indexer-service.ts` | Per-contract `getTransactions` HTTP call failed. |
| `INDEXER_REORG_DETECTED` | `indexer-service.ts` | Stored block hash diverges from chain hash. |
| `INDEXER_EVENT_STORE_FAILED` | `indexer-service.ts` | Persisting an event into SQLite/Postgres failed. |
| `INDEXER_SYNC_FAILED` | `indexer-service.ts` | Top-level `syncBlocks` exception. |
| `API_REQUEST_FAILED` | `api/routes.ts`, `api/server.ts` | Unhandled exception during HTTP request handling. |
| `API_NOT_FOUND` | `api/server.ts` | Route 404. |
| `API_INVALID_PARAMETER` | `api/routes.ts` | Client-side input failed validation. |
| `API_RATE_LIMIT_EXCEEDED` | `api/server.ts` | Distributed rate limiter rejected the request. |

### 3.2 Log level policy

The indexer follows a strict log-level policy so that operators can reason
about what each level means without reading source:

| Level | Used for | Examples |
|---|---|---|
| `trace` | High-frequency per-poll noise that is only useful when actively debugging. | "No new confirmed blocks to sync" |
| `debug` | Normal-traffic developer signal (per-block, per-request). | Incoming HTTP request, processed block summary. |
| `info` | Lifecycle events: startup, shutdown, configuration loaded, block ranges synced, reorg recovery completed. | "Indexer service started", "Syncing block range". |
| `warn` | Recoverable degradations that **do not** lose data. | Redis disconnect (rate limiter still works in-memory), reorg detected, fetch retry. |
| `error` | Unexpected failure that may lose data or break an SLO. Always includes `errorCode`. | Block processing failed, DB write failed, fatal startup error. |
| `fatal` | Process is about to exit. | (currently unused — `error` + `process.exit(1)`). |

### 3.3 Non-functional constraints

- Logging changes introduced by this work **must not** increase log volume by
  more than 20 %. Higher-volume signals (per-poll "no new blocks", per-block
  "block processed") have been moved to `trace` / `debug` so that the default
  `info` level remains operationally quiet.
- Each `error` entry carries enough structured context (`errorCode`,
  `eventId` or `requestId`, `contractAddress`) to diagnose the issue without
  reading source code.

---

## 4. References

- Issue: [#129 — D3 Error Handling Standardization](https://github.com/xlabtg/tonbankcard-protocol/issues/129)
- Source code:
  - [Smart contracts](../contracts/)
  - [Merchant API](../api/)
  - [Indexer](../backend/indexer/)
- Specs:
  - [Merchant API specification](./merchant-api-spec.md)
- External docs:
  - [pino — Logger API](https://getpino.io)
