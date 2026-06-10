# On-Chain Transparency Reporting — Standardized Event Format, Indexer, API, Dashboard, Quarterly Reports

**Engagement:** [E4 — On-Chain Transparency Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/135)
**Companion documents:**
- [`TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) — quarterly transparency report template (AC-6)
- [`transparency-reports/Q1-FY2026.md`](./transparency-reports/Q1-FY2026.md) — first published quarterly report (AC-7 dry-run)
- [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7 — FRAUD_LOCK event mirroring (E3 ↔ E4 contract)
- [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 — mutable parameter inventory (the source list for `ParameterChangeRecorded`)
- [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md) — proposal template that produces `ParameterChangeRecorded` events
- [`SNAPSHOT.md`](./SNAPSHOT.md) — block-snapshot methodology that anchors every monthly aggregate
- [`governance-transparency.md`](../governance-transparency.md) — original Issue #40 transparency layer
- [`governance-transparency-privacy.md`](../governance-transparency-privacy.md) — privacy requirements (forbidden fields)
- [`governance-transparency-verification.md`](../governance-transparency-verification.md) — verification methodology

**Status:** Proposed — to be ratified by the first quarterly transparency report cycle (`E4-Q1-PUBLICATION`) and the indexer activation runbook.
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** Transparency is **observation, not control**. Every event format, indexer pipeline, API endpoint, dashboard panel and quarterly report defined in this document is **non-authoritative**. The blockchain is the **single source of truth**; everything described here mirrors on-chain reality and **MUST NOT** be used to gate any protocol behavior. This document inherits the privacy invariants of [`contracts/governance/TransparencyRegistry.tact`](../../contracts/governance/TransparencyRegistry.tact) (privacy guarantees lines 13–18; protocol invariants lines 20–24) and the off-chain disclaimer of [`contracts/governance/schemas/offchain-index.json`](../../contracts/governance/schemas/offchain-index.json) (`_disclaimer`).

---

## Table of Contents

1. [Purpose & scope](#1-purpose--scope)
2. [Standardized on-chain event format](#2-standardized-on-chain-event-format)
3. [Indexer integration](#3-indexer-integration)
4. [Public transparency API](#4-public-transparency-api)
5. [Public transparency dashboard](#5-public-transparency-dashboard)
6. [Quarterly transparency reports](#6-quarterly-transparency-reports)
7. [Privacy guarantees (forbidden data)](#7-privacy-guarantees-forbidden-data)
8. [Acceptance criteria mapping](#8-acceptance-criteria-mapping)
9. [References](#9-references)

---

## 1. Purpose & scope

E4 productionises the on-chain transparency layer that B2 deploys inert and E1 activates as a proposal mirror. After E4 the layer covers the **entire protocol surface** (not only governance proposals) and exposes its aggregates through:

- a small, deterministic **event vocabulary** mirrored from existing on-chain emissions plus three **additive** receive handlers on `TransparencyRegistry.tact` for aggregates that are not derivable from individual transactions (see §2.4),
- a **single read-only public API endpoint** on the existing indexer (`GET /v1/transparency/metrics`) that returns one JSON document with the current month's aggregates and the rolling 12-month series,
- a **public dashboard component** (`dashboard/src/components/TransparencyDashboard.ts`) that consumes the API and renders the canonical metric cards offline-friendly and without auth,
- a **quarterly transparency report cadence** anchored by `TRANSPARENCY_REPORT_TEMPLATE.md` and published within 30 days of mainnet (engagement Acceptance Criteria 7).

E4 explicitly does **not**:

- expose any individual user data (forbidden by §7),
- introduce any authority to mutate protocol state (the indexer and dashboard are read-only),
- change the existing FRAUD_LOCK / governance contract guards (E3 + E1 own those),
- promise a real-time dashboard — monthly snapshots are the supported cadence for v1 (engagement §4).

The `TransparencyRegistry` contract address remains the **only** on-chain anchor for the layer. The indexer and dashboard are off-chain conveniences whose drift from the chain is itself a CI-blocking defect (§3.3).

---

## 2. Standardized on-chain event format

This section freezes the **canonical event vocabulary** for the transparency layer. The vocabulary partitions cleanly into two families:

- **Existing events** already emitted by the contract surface (governance proposals, votes, snapshots, PaymentHub transfers, AccountLocks state changes) — these are mirrored by the indexer without contract changes.
- **Additive aggregate events** introduced by E4 on `TransparencyRegistry` so monthly aggregates are anchored on-chain rather than only in the indexer (§2.4).

All event names are stable strings in `snake_case_event_name` form to match the existing emission style. All numeric fields are unsigned integers unless explicitly marked.

### 2.1 Governance votes (Issue §3 row 4)

Already on-chain; mirrored without contract changes.

| Event name | Emitted by | Aggregated metric | Source line |
|------------|------------|-------------------|-------------|
| `ProposalRecorded` | `TransparencyRegistry.receive(RecordProposal)` | `proposals_submitted_total` | [`TransparencyRegistry.tact:242–247`](../../contracts/governance/TransparencyRegistry.tact) |
| `VotingResultRecorded` | `TransparencyRegistry.receive(RecordVotingResult)` | `proposals_passed_total`, `proposals_rejected_total`, `proposals_no_quorum_total` | [`TransparencyRegistry.tact:291–297`](../../contracts/governance/TransparencyRegistry.tact) |
| `SnapshotRecorded` | `TransparencyRegistry.receive(RecordSnapshot)` | governance asset snapshot anchor (every monthly report) | [`TransparencyRegistry.tact:305–309`](../../contracts/governance/TransparencyRegistry.tact) |

The indexer derives `proposals_submitted_30d`, `proposals_passed_30d`, `proposals_rejected_30d` and `proposals_no_quorum_30d` by rolling the above events over a 30-day window aligned to the snapshot-method block boundary in [`SNAPSHOT.md`](./SNAPSHOT.md) §3.

### 2.2 Protocol volume (Issue §3 rows 1–2)

Already on-chain; mirrored without contract changes.

| Event name | Emitted by | Aggregated metric |
|------------|------------|-------------------|
| `InternalTransferEvent` | `PaymentHub.tact` (Issue #6) | `tbc_volume_transferred_30d`, `internal_transfer_count_30d` |
| `MerchantPayment` | `MerchantPaymentHub.tact` (Issue #8) | `merchant_settlement_volume_30d`, `merchant_settlement_count_30d` |
| `AccountStateChangedEvent` | `PaymentHub.tact` (Issue #6) | `active_accounts_30d` (derived from `state_active` snapshot at month end) |
| `NFTOwnershipChange` | NFT collection contract | `active_accounts_30d` (denominator for the rolling window) |

`active_accounts_30d` is defined as the count of NFT addresses whose `account_snapshots.current_state = ACTIVE (0)` at the snapshot block AND that observed at least one `MerchantPayment` or `InternalTransferEvent` within the 30 days ending at the snapshot block. The denominator is the count of NFT addresses ever observed by the indexer. Both terms are aggregate-only.

### 2.3 Lock activity (Issue §3 row 3) — sourced from E3

Already on-chain; mirrored from [`AccountLocks`](../../contracts/payments/account-locks.fc) via the indexer alarms defined in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.

| Indexer event marker | Source opcode | Aggregated metric |
|----------------------|---------------|-------------------|
| `lock` (`0x4c6f636b`) | `op::set_fraud_lock = 0x1001` | `fraud_locks_set_30d` |
| `unlk` (`0x556e6c6b`) | `op::clear_fraud_lock = 0x1002` | `fraud_locks_cleared_30d`, `fraud_locks_active` |
| (off-chain, anchored) | Appeal outcome from [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §3 | `fraud_locks_appealed_30d`, `fraud_locks_overturned_30d`, `fraud_locks_upheld_30d` |

The appeal-outcome counters are inputs from the appeal pipeline rather than a single contract event, and the quarterly report is required to surface them (§6 row 4).

### 2.4 Aggregates anchored on `TransparencyRegistry` — additive

The metrics in §2.2 and §2.3 are derivable from primitive events. To prevent indexer drift from quietly mis-reporting (since the indexer is non-authoritative), E4 adds three append-only receive handlers on `TransparencyRegistry`. Each handler emits an event that the indexer cross-checks against its own derived value; mismatch is a CI-blocking alarm (§3.3 row `e4.aggregate-drift`).

| Receive handler | Inbound message | Outbound event | Aggregated metric |
|-----------------|-----------------|----------------|-------------------|
| `receive(RecordProtocolMetrics)` | `RecordProtocolMetrics { period_start, period_end, active_accounts, tbc_volume_transferred, transfer_count }` | `ProtocolMetricsRecorded` | Monthly aggregate snapshot of §2.2 metrics |
| `receive(RecordLockActivity)` | `RecordLockActivity { period_start, period_end, locks_set, locks_cleared, locks_active, appeals_filed, appeals_overturned, appeals_upheld }` | `LockActivityRecorded` | Monthly aggregate of §2.3 metrics |
| `receive(RecordParameterChange)` | `RecordParameterChange { parameter_id, proposal_id, old_value_hash, new_value_hash, effective_block }` | `ParameterChangeRecorded` | Audit trail for [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 changes |

These handlers preserve the contract's read-only philosophy: the only thing they mutate is the append-only event stream and a small set of cumulative counters (`total_lock_events`, `total_parameter_changes`, `latest_metrics_period_end`). They do **not** alter governance state, do **not** introduce admin authority over transparency data, and do **not** persist any address that is not already on-chain. The contract sender is recorded only as the multi-sig writer; individual user addresses are forbidden by §7. As of Issue #365 this writer restriction is enforced on-chain: each `Record*` handler requires `sender()` to match a deployer-configured writer address and is fail-closed before that address is configured. The deployer holds only a narrow writer-configuration role (set/rotate the `proposal_registry` / `snapshot_verifier` / `report_writer` addresses); it cannot itself write or modify transparency data.

Field-level schema is mirrored in [`offchain-index.json`](../../contracts/governance/schemas/offchain-index.json) under the new `IndexerEvent.event_type` values `ProtocolMetricsRecorded`, `LockActivityRecorded`, `ParameterChangeRecorded`. The off-chain indexer payload definitions live in [`backend/indexer/src/types/events.ts`](../../backend/indexer/src/types/events.ts).

### 2.5 Event versioning policy

Every transparency event carries an implicit version identified by the on-chain receive handler signature. Adding a new field to an existing handler **requires** a new handler with a `_v2` suffix and a 30-day deprecation window for the old form (mirrors the contract redeployment policy in [`PARAMETERS.md`](./PARAMETERS.md) §6). The indexer and dashboard must accept both forms during the window and surface the cutover date in the quarterly report.

---

## 3. Indexer integration

### 3.1 Where the new code lives

```
backend/indexer/
├── src/
│   ├── types/events.ts               # +TransparencyEvent union, +new event types
│   ├── parsers/event-parser.ts       # +OP_CODES.{PROTOCOL_METRICS_RECORDED,…}
│   ├── db/migrations/                # +002_transparency/ with up/down SQL
│   ├── db/database.ts                # +insert/get methods, +getTransparencyMetrics()
│   ├── services/indexer-service.ts   # +subscribe to TransparencyRegistry events
│   └── api/routes.ts                 # +GET /v1/transparency/metrics
└── tests/
    └── transparency-metrics.spec.ts  # endpoint contract tests
```

Existing tables (`internal_transfers`, `merchant_payments`, `account_state_changes`, `account_snapshots`) already supply §2.2 metrics; the §2.4 aggregate events are stored in three new tables added by migration `002_transparency` (`transparency_protocol_metrics`, `transparency_lock_activity`, `transparency_parameter_changes`).

### 3.2 Pipeline

```
TransparencyRegistry.tact emit(...)
        │
        ▼
EventParser.parseExternalOutMessage()  ←─ extends OP_CODES with the three §2.4 events
        │
        ▼
IndexerDatabase.insertTransparency{ProtocolMetrics,LockActivity,ParameterChange}()
        │
        ▼
GET /v1/transparency/metrics  ←  TransparencyMetricsResponse (§4.1)
        │
        ▼
dashboard/src/components/TransparencyDashboard.ts (§5)
```

The indexer maintains the §2.2 metrics by streaming the existing `MerchantPayment` / `InternalTransferEvent` / `AccountStateChangedEvent` events into the same `transparency_protocol_metrics` table when a month boundary is crossed. The on-chain `RecordProtocolMetrics` then plays the role of a checksum: if the indexer-derived value differs from the on-chain value the indexer raises `e4.aggregate-drift` (§3.3).

### 3.3 Indexer alarms (E4 additions)

The indexer emits the following alarms in addition to the E3 lock-pipeline alarms documented in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.3. All alarms surface on the public dashboard with a 24-hour delay (so attackers cannot use real-time alarm visibility) and in the quarterly report.

| Alarm | Trigger | Severity |
|-------|---------|----------|
| `e4.aggregate-drift` | On-chain `ProtocolMetricsRecorded` aggregate differs from indexer-derived aggregate by more than the §3.4 tolerance for the same period | HIGH — investigate before next monthly publication |
| `e4.lock-aggregate-drift` | On-chain `LockActivityRecorded` aggregate differs from the §3.4 tolerance over the indexer-derived FRAUD_LOCK counters | HIGH — fast-track quarterly report addendum |
| `e4.parameter-change-undisclosed` | A `ParameterChangeRecorded` event references a `proposal_id` not present in `ProposalRegistry`, or vice versa (a parameter change observed on-chain with no anchor) | CRITICAL — paged escalation; quarterly report must include incident |
| `e4.indexer-stale` | `last_indexed_block` lags chain tip by more than 100 blocks at month-end snapshot time | HIGH — block monthly publication until resolved |
| `e4.api-endpoint-unreachable` | `/v1/transparency/metrics` returns non-2xx for more than 5 minutes during a publication window | MEDIUM — auto-page on-call |

### 3.4 Aggregate tolerance

The indexer's derived aggregates and the on-chain `ProtocolMetricsRecorded` / `LockActivityRecorded` aggregates are compared with the following tolerances:

| Metric | Tolerance | Rationale |
|--------|-----------|-----------|
| `tbc_volume_transferred_30d` | ±0 nanocoins | Sum of exact coin amounts; no rounding allowed |
| `transfer_count_30d` / `merchant_settlement_count_30d` | ±0 events | Exact count |
| `active_accounts_30d` | ±2 accounts | NFT ownership changes within the snapshot window can race the indexer's account-snapshot table |
| `fraud_locks_set_30d` / `fraud_locks_cleared_30d` | ±0 events | Exact count |
| `fraud_locks_active` | ±1 account | Race window for a `set` followed by a `clear` within the same block batch |

Any drift above tolerance triggers `e4.aggregate-drift` (or `e4.lock-aggregate-drift`) regardless of direction.

---

## 4. Public transparency API

### 4.1 Endpoint contract

```
GET /v1/transparency/metrics
Authentication: none (public)
Cache-Control: public, max-age=60
Content-Type: application/json
```

Response body (canonical example, abridged):

```json
{
  "metadata": {
    "version": "1.0.0",
    "generated_at": "2026-06-01T00:00:00Z",
    "snapshot_block": 18234567,
    "snapshot_hash": "0x…",
    "disclaimer": "This data is non-authoritative. Verify all data on-chain. Governance outcomes are advisory only."
  },
  "current_period": {
    "period_start": "2026-05-01T00:00:00Z",
    "period_end": "2026-05-31T23:59:59Z",
    "active_accounts": 1287,
    "tbc_volume_transferred": "542193847000000",
    "transfer_count": 41023,
    "merchant_settlement_volume": "298100450000000",
    "merchant_settlement_count": 9842,
    "fraud_locks_set": 4,
    "fraud_locks_cleared": 3,
    "fraud_locks_active": 2,
    "fraud_locks_appeals_filed": 1,
    "fraud_locks_appeals_overturned": 0,
    "fraud_locks_appeals_upheld": 1,
    "proposals_submitted": 5,
    "proposals_passed": 3,
    "proposals_rejected": 1,
    "proposals_no_quorum": 1,
    "parameter_changes": 0
  },
  "rolling_12_months": [ /* up to 12 monthly aggregates */ ],
  "governance": {
    "total_proposals": 47,
    "proposals_accepted": 31,
    "proposals_rejected": 9,
    "proposals_no_quorum": 5,
    "proposals_pending": 2,
    "quorum_threshold": 22,
    "governance_asset_total_supply": 222,
    "latest_snapshot_block": 18234567,
    "latest_snapshot_hash": "0x…"
  },
  "alarms": [ /* indexer alarms within last 24h with 24h delay redaction */ ]
}
```

All numeric coin fields are returned as decimal strings to preserve precision. All addresses are forbidden by §7 and **must not** appear in the response. Every period boundary is anchored to the snapshot block in [`SNAPSHOT.md`](./SNAPSHOT.md) §3.

### 4.2 Determinism & cacheability

For any given `snapshot_block` the response is byte-identical regardless of caller. This property is what makes the endpoint suitable as a quarterly-report data source (§6 step 2). The endpoint sets `Cache-Control: public, max-age=60` to allow CDN fan-out; the dashboard polls at most once per minute.

### 4.3 Failure modes

| Status | Meaning | Recovery |
|--------|---------|----------|
| `200` | Fresh aggregate | None |
| `200` + `alarms[].id = e4.indexer-stale` | Aggregate served but indexer is lagging | Dashboard surfaces yellow banner; report defers publication until stale alarm clears |
| `503` | Indexer is offline or the database is unavailable | Dashboard surfaces red banner; report cannot be published |

The endpoint never returns `401` / `403` — authentication is forbidden by Acceptance Criterion "dashboard must be readable without login".

---

## 5. Public transparency dashboard

### 5.1 Component contract

`dashboard/src/components/TransparencyDashboard.ts` is a read-only, login-less component that consumes `GET /v1/transparency/metrics` and renders the canonical metric grid. The dashboard is delivered under the existing `dashboard/` package (alongside the merchant dashboard) so that the same build pipeline, the same lint rules and the same tests apply. Deployment to `transparency.tonbankcard.com` (or the chosen equivalent) is an operational step recorded in [`docs/deployments/network-matrix.md`](../deployments/network-matrix.md).

The component:

- requires no authentication and no merchant NFT,
- accepts a single `apiEndpoint` parameter (defaults to the public indexer),
- renders four metric cards (Volume, Active Accounts, Lock Activity, Governance) plus a 12-month sparkline area and an alarms list,
- clearly labels every value with its source: `on-chain verified` (mirrors a `RecordProtocolMetrics` / `LockActivityRecorded` / `ParameterChangeRecorded` event) or `indexer-derived` (computed from primitive events),
- is unit-tested in `dashboard/tests/transparency-dashboard.spec.ts`.

### 5.2 Data-labelling discipline

Every numeric value on the dashboard MUST be tagged either `on-chain` or `indexer-derived`. This satisfies §7 Security Requirements "Dashboard must clearly label data as on-chain verified vs. indexer-derived". The labelling is enforced by the component contract (`MetricSource` type) and verified by the dashboard unit test `labels every metric with a source tag`.

### 5.3 Read-only guarantees

The dashboard:

- has no signing surface,
- has no admin actions,
- has no input that influences any backend write (the only HTTP call it issues is `GET`),
- is statically compiled into the existing `dashboard/` build (no server-side rendering),
- runs entirely client-side in the browser; its only dependency on the indexer is the read API of §4.

---

## 6. Quarterly transparency reports

### 6.1 Cadence

The first transparency report is published within **30 days** of mainnet deployment (Acceptance Criterion 7). Subsequent reports are published quarterly, one per calendar quarter, by the 15th of the month following quarter-end. The publication channel is `docs/governance/transparency-reports/Q<n>-<year>.md`, signed by the report author per [`TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) §10.

The first published report ships in this engagement as a dry-run example at [`transparency-reports/Q1-FY2026.md`](./transparency-reports/Q1-FY2026.md). It uses synthetic but well-formed numbers because no mainnet data exists at engagement time; the file becomes authoritative the first time it is regenerated from real `GET /v1/transparency/metrics` output, after which the dry-run banner at the top of the file is removed.

### 6.2 Template structure

[`TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) freezes the section order so that consecutive reports are diffable. The required sections are:

1. Reporting period (UTC).
2. Source data anchor — the `snapshot_block` and `snapshot_hash` quoted by `GET /v1/transparency/metrics`.
3. Protocol health metrics (§2.2 monthly aggregates).
4. Lock activity (§2.3 + appeal outcomes).
5. Governance activity (§2.1).
6. Parameter changes (§2.4 `ParameterChangeRecorded` audit trail).
7. Indexer alarms raised during the quarter and their resolution.
8. Independence attestation — author signature and counter-signer (Risk Authority or Protocol Team Lead).
9. Disclaimer block (the §1 reminder verbatim).
10. Appendix A — raw API response captured at the snapshot block (so the report is reproducible).

### 6.3 Reproducibility requirement

Every quarterly report MUST include the URL or attached file of the `GET /v1/transparency/metrics` response from which it was produced. Re-running the report on the same snapshot block MUST yield the same numbers (§4.2). Drift between report numbers and API output is itself a CI-blocking defect and is detected by `scripts/governance/check-transparency-reporting.ts`.

### 6.4 Distribution

The report is published under `docs/governance/transparency-reports/`, cross-linked from `README.md`, and announced on the protocol's communication channels. The Risk Authority quarterly attestation required by [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.4 is delivered **inside** the E4 quarterly report under §8 of the template (independence attestation), avoiding two parallel publication tracks.

---

## 7. Privacy guarantees (forbidden data)

The transparency layer **MUST NOT** expose any of the following. These prohibitions are inherited verbatim from [`contracts/governance/schemas/offchain-index.json`](../../contracts/governance/schemas/offchain-index.json) `_privacy_notice.forbidden_fields` and [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md):

- wallet addresses (sender or receiver),
- NFT holder identities,
- individual votes (who voted, how they voted),
- vote timestamps (only voting window endpoints),
- delegation graphs,
- per-account TBC balances,
- per-account lock state (only aggregates),
- per-account merchant settlement history (only the aggregate volume).

Aggregations are permitted only when the aggregated set contains ≥ **10** distinct accounts at the snapshot block. Smaller aggregates round to "<10" in the response and the dashboard renders them as `low cohort — masked` to prevent re-identification by elimination.

Adding any new transparency metric requires updating this list and the schema's `_privacy_notice`. The CI validator (`scripts/governance/check-transparency-reporting.ts`) refuses to pass if §7 is shorter than the schema's forbidden list.

---

## 8. Acceptance criteria mapping

The table below maps each acceptance criterion of [#135](https://github.com/xlabtg/tonbankcard-protocol/issues/135) to the artifact in this PR that satisfies it.

| # | Acceptance criterion | Artifact |
|---|----------------------|----------|
| AC-1 | E1 and E3 complete (prerequisites) | Tracked via [`E1-activation/ENGAGEMENT.md`](./E1-activation/ENGAGEMENT.md) and [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md); E4 is staged behind both |
| AC-2 | TransparencyRegistry used to log all required event types | § 2 (governance + protocol + lock + parameter-change event vocabulary), with the three §2.4 additive handlers in `contracts/governance/TransparencyRegistry.tact` |
| AC-3 | Indexer extended to read and store transparency events | § 3.1 (where the code lives), backend additions: `backend/indexer/src/types/events.ts`, `backend/indexer/src/db/migrations/002_transparency/`, `backend/indexer/src/db/database.ts`, `backend/indexer/src/api/routes.ts` |
| AC-4 | Public transparency API endpoint implemented | § 4 + `GET /v1/transparency/metrics` route in `backend/indexer/src/api/routes.ts` + tests in `backend/indexer/tests/transparency-metrics.spec.ts` |
| AC-5 | Transparency dashboard deployed and accessible | § 5 + `dashboard/src/components/TransparencyDashboard.ts` + tests in `dashboard/tests/transparency-dashboard.spec.ts`; mainnet deployment recorded in [`docs/deployments/network-matrix.md`](../deployments/network-matrix.md) at go-live time |
| AC-6 | `docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md` created | [`TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) |
| AC-7 | First quarterly transparency report published | [`transparency-reports/Q1-FY2026.md`](./transparency-reports/Q1-FY2026.md) (dry-run shipped now; reproduces from `/v1/transparency/metrics` once mainnet data exists, then the dry-run banner is removed) |

The functional and non-functional requirements of the engagement are addressed as follows:

| Requirement | Section |
|-------------|---------|
| FR-1 — `TransparencyRegistry.tact` used to log protocol events (extend if necessary) | § 2 + §2.4 (three additive handlers) |
| FR-2 — Indexer reads and stores transparency events from the registry | § 3 + new SQLite migration `002_transparency` |
| FR-3 — Public API endpoint `GET /v1/transparency/metrics` | § 4 |
| FR-4 — Dashboard deployed and readable without auth | § 5 |
| FR-5 — Quarterly report template at `docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md` | § 6.2 |
| FR-6 — First report within 30 days of mainnet | § 6.1 + [`transparency-reports/Q1-FY2026.md`](./transparency-reports/Q1-FY2026.md) |
| NFR-1 — Aggregate-only data | § 7 (10-account cohort minimum) |
| NFR-2 — Permanent on-chain storage | § 2.4 (events are append-only, not deletable — inherited from `TransparencyRegistry.tact` design) |
| NFR-3 — Dashboard readable without login | § 5 + § 4.3 (no auth headers ever) |
| NFR-4 — Report template usable by any team member | § 6.2 + the template is plain markdown with explicit placeholders |
| SR-1 — Only multi-sig parties can write to the registry | **Enforced on-chain (Issue #365):** every `Record*` handler in [`TransparencyRegistry.tact`](../../contracts/governance/TransparencyRegistry.tact) runs a fail-closed guard requiring `sender()` to equal a deployer-configured writer (`proposal_registry` / `snapshot_verifier` / `report_writer`); unconfigured or unauthorized senders are rejected. For the §2.4 additive handlers the configured `report_writer` is the E3 Risk Authority multi-sig or the parameter-change proposer multi-sig per [`PARAMETERS.md`](./PARAMETERS.md) §10 (previously this was only inherited from E3 multi-sig discipline, with no on-chain enforcement) |
| SR-2 — Transparency data must be accurate | § 3.3 drift alarms + § 6.3 reproducibility requirement |
| SR-3 — Dashboard labels data as on-chain vs indexer-derived | § 5.2 |

---

## 9. References

- [`TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) — quarterly report template
- [`transparency-reports/Q1-FY2026.md`](./transparency-reports/Q1-FY2026.md) — first transparency report dry-run
- [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7 — E3 ↔ E4 contract (FRAUD_LOCK event mirroring)
- [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 — mutable parameter inventory
- [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md) — parameter-change proposal template
- [`SNAPSHOT.md`](./SNAPSHOT.md) — block-snapshot methodology
- [`governance-transparency.md`](../governance-transparency.md) — original transparency layer
- [`governance-transparency-privacy.md`](../governance-transparency-privacy.md) — privacy requirements
- [`governance-transparency-verification.md`](../governance-transparency-verification.md) — verification methodology
- [`contracts/governance/TransparencyRegistry.tact`](../../contracts/governance/TransparencyRegistry.tact) — on-chain anchor
- [`contracts/governance/types/TransparencyTypes.tact`](../../contracts/governance/types/TransparencyTypes.tact) — typed messages and structs
- [`contracts/governance/interfaces/ITransparencyRegistry.tact`](../../contracts/governance/interfaces/ITransparencyRegistry.tact) — trait getters
- [`contracts/governance/schemas/offchain-index.json`](../../contracts/governance/schemas/offchain-index.json) — JSON schema for the indexer payload
- [`backend/indexer/src/types/events.ts`](../../backend/indexer/src/types/events.ts) — indexer event type definitions
- [`backend/indexer/src/api/routes.ts`](../../backend/indexer/src/api/routes.ts) — `GET /v1/transparency/metrics`
- [`dashboard/src/components/TransparencyDashboard.ts`](../../dashboard/src/components/TransparencyDashboard.ts) — public dashboard
- [`scripts/governance/check-transparency-reporting.ts`](../../scripts/governance/check-transparency-reporting.ts) — CI validator
- [`tests/governance/TransparencyReportingValidator.spec.ts`](../../tests/governance/TransparencyReportingValidator.spec.ts) — Jest spec
- Issue [#135](https://github.com/xlabtg/tonbankcard-protocol/issues/135) — E4 engagement
- Issue [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) — E3 engagement (prerequisite)
- Issue [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132) — E1 engagement (prerequisite)
- Issue [#40](https://github.com/xlabtg/tonbankcard-protocol/issues/40) — original governance transparency layer
