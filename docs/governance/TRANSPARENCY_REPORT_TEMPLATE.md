# Quarterly Transparency Report — Template

**Engagement:** [E4 — On-Chain Transparency Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/135)
**Companion specification:** [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) (the canonical event vocabulary, indexer pipeline, and API contract that this template consumes)
**Cadence:** quarterly, published by the 15th of the month following quarter-end (§6.1 of the spec). The first report ships within 30 days of mainnet deployment.
**File naming:** `docs/governance/transparency-reports/Q<n>-<fiscal-year>.md` (e.g. `Q1-FY2026.md`).

---

> **How to use this template.**
> 1. Copy this file to `docs/governance/transparency-reports/Q<n>-<fiscal-year>.md`.
> 2. Fill the placeholders marked `<…>`. Do **not** rename, remove, or reorder the numbered sections — diffability across reports is an Acceptance Criterion of E4 (`scripts/governance/check-transparency-reporting.ts` enforces section order).
> 3. Source every number from the JSON returned by `GET /v1/transparency/metrics` at the snapshot block of §2. Paste the raw JSON verbatim into Appendix A.
> 4. Have the author and counter-signer sign §8. Without two signatures the report is a draft.
> 5. Open a PR titled `docs(E4): publish transparency report Q<n>-<fiscal-year>` and link this issue ([#135](https://github.com/xlabtg/tonbankcard-protocol/issues/135)).

---

> **Reminder — non-authoritative.** Transparency is **observation, not control**. The data in this report mirrors the on-chain state of [`contracts/governance/TransparencyRegistry.tact`](../../contracts/governance/TransparencyRegistry.tact) at the snapshot block recorded in §2. The blockchain is the **single source of truth**; every number below is reproducible from `GET /v1/transparency/metrics` (§4 of the spec) and verifiable on-chain. This report does **not** alter protocol state, does **not** introduce protocol authority, and does **not** expose individual user data (§7 of the spec).

---

## 1. Reporting period

| Field | Value |
|-------|-------|
| Quarter | `Q<n> FY<year>` |
| Period start (UTC) | `<YYYY-MM-DDT00:00:00Z>` |
| Period end (UTC) | `<YYYY-MM-DDT23:59:59Z>` |
| Months covered | `<YYYY-MM>`, `<YYYY-MM>`, `<YYYY-MM>` |
| Report author | `<github-handle>` |
| Counter-signer | `<github-handle>` (Risk Authority member or Protocol Team Lead per [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3) |
| Report published at (UTC) | `<YYYY-MM-DDTHH:MM:SSZ>` |

---

## 2. Source data anchor

Every number in §§3–6 is anchored to a single snapshot block. The author MUST quote the block height and snapshot hash returned by `GET /v1/transparency/metrics` in the `metadata` block, so the report is bit-for-bit reproducible.

| Field | Value |
|-------|-------|
| `snapshot_block` | `<integer block height>` |
| `snapshot_hash` | `0x<hex>` |
| Snapshot method | [`SNAPSHOT.md`](./SNAPSHOT.md) §3 |
| API endpoint queried | `<https://…/v1/transparency/metrics>` |
| API response version | `<metadata.version>` (must be `1.0.0` for this template revision) |
| API response captured at (UTC) | `<YYYY-MM-DDTHH:MM:SSZ>` |
| Raw API response | Appendix A (verbatim) |

---

## 3. Protocol health metrics

Source: `current_period.*` and `rolling_12_months[*]` of the API response. All values are 30-day aggregates aligned to the snapshot block (see [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §2.2). Coin amounts are reported as decimal nanocoins to preserve precision.

### 3.1 Headline metrics (snapshot month)

| Metric | Value | Source label |
|--------|-------|--------------|
| Active accounts (30d) | `<integer>` | `on-chain` (`ProtocolMetricsRecorded`) |
| TBC volume transferred (30d, nanocoins) | `<integer-as-string>` | `on-chain` (`ProtocolMetricsRecorded`) |
| Internal transfer count (30d) | `<integer>` | `on-chain` (`ProtocolMetricsRecorded`) |
| Merchant settlement volume (30d, nanocoins) | `<integer-as-string>` | `indexer-derived` (sum of `MerchantPayment`) |
| Merchant settlement count (30d) | `<integer>` | `indexer-derived` (count of `MerchantPayment`) |

### 3.2 Quarterly trend (three months)

| Metric | `<YYYY-MM>` | `<YYYY-MM>` | `<YYYY-MM>` | QoQ Δ |
|--------|-------------|-------------|-------------|-------|
| Active accounts | `<n>` | `<n>` | `<n>` | `<±n / ±%>` |
| TBC volume transferred (nanocoins) | `<n>` | `<n>` | `<n>` | `<±n / ±%>` |
| Internal transfer count | `<n>` | `<n>` | `<n>` | `<±n / ±%>` |
| Merchant settlement volume (nanocoins) | `<n>` | `<n>` | `<n>` | `<±n / ±%>` |
| Merchant settlement count | `<n>` | `<n>` | `<n>` | `<±n / ±%>` |

If any cohort falls below 10 accounts, render the cell as `<10 — masked` per the privacy rule in [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §7.

---

## 4. Lock activity

Source: `current_period.fraud_locks_*` of the API response, mirrored from E3 per [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7. Appeal counters are inputs from [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §3 (off-chain anchored — see [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §2.3).

| Metric | `<YYYY-MM>` | `<YYYY-MM>` | `<YYYY-MM>` | Quarter total |
|--------|-------------|-------------|-------------|---------------|
| `fraud_locks_set` (count) | `<n>` | `<n>` | `<n>` | `<n>` |
| `fraud_locks_cleared` (count) | `<n>` | `<n>` | `<n>` | `<n>` |
| `fraud_locks_active` at snapshot block | — | — | `<n>` | (snapshot only) |
| `fraud_locks_appeals_filed` | `<n>` | `<n>` | `<n>` | `<n>` |
| `fraud_locks_appeals_overturned` | `<n>` | `<n>` | `<n>` | `<n>` |
| `fraud_locks_appeals_upheld` | `<n>` | `<n>` | `<n>` | `<n>` |

Overturn rate (quarter) — `appeals_overturned / appeals_filed`, rounded to one decimal: `<%>`.

If the indexer-derived counters and the on-chain `LockActivityRecorded` counters diverge beyond the tolerance in [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §3.4, this section MUST flag the divergence and cross-link the `e4.lock-aggregate-drift` alarm in §7.

---

## 5. Governance activity

Source: `governance.*` and `current_period.proposals_*` of the API response, mirrored from §2.1 of the spec. No voter identities or individual votes — only aggregates, per privacy rule §7.

### 5.1 Proposal flow (quarter)

| Metric | Value |
|--------|-------|
| Proposals submitted | `<n>` |
| Proposals accepted | `<n>` |
| Proposals rejected | `<n>` |
| Proposals failing quorum | `<n>` |
| Proposals pending at snapshot | `<n>` |
| Acceptance rate | `<accepted / decided>` = `<%>` |
| Quorum threshold (snapshot) | `<n>` (per `governance.quorum_threshold`) |

### 5.2 Governance asset snapshot

| Field | Value |
|-------|-------|
| `governance_asset_total_supply` | `222` (fixed by protocol design) |
| `latest_snapshot_block` | `<integer>` (matches §2 `snapshot_block`) |
| `latest_snapshot_hash` | `0x<hex>` (matches §2 `snapshot_hash`) |

### 5.3 Category breakdown (optional)

If the API response includes `governance.categories[]`, mirror the per-category counts here using the category IDs from [`contracts/governance/types/TransparencyTypes.tact`](../../contracts/governance/types/TransparencyTypes.tact) (`CATEGORY_*` constants).

---

## 6. Parameter changes

Source: `ParameterChangeRecorded` events per [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §2.4. The inventory of mutable parameters lives in [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11; the proposal template lives in [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md).

| Effective block | `parameter_id` | Linked proposal | `old_value_hash` | `new_value_hash` | Author multi-sig |
|-----------------|----------------|-----------------|------------------|------------------|------------------|
| `<n>` | `<string>` | `<proposal_id>` | `0x<hex>` | `0x<hex>` | `<sig set ref>` |
| `<n>` | `<string>` | `<proposal_id>` | `0x<hex>` | `0x<hex>` | `<sig set ref>` |

If **no** parameters changed during the quarter, write the literal sentence:

> No parameter changes were recorded this quarter (`ParameterChangeRecorded` event count = 0).

Any `e4.parameter-change-undisclosed` alarm during the quarter MUST be cross-linked in §7 and resolved before publication.

---

## 7. Indexer alarms

Source: `alarms[]` of the API response, plus the indexer's alarm log for the full quarter (the API window is 24h delayed per [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §3.3). List every alarm raised during the reporting period and its resolution.

| Alarm id | First raised (UTC) | Severity | Trigger | Resolution | Cleared at (UTC) |
|----------|--------------------|----------|---------|------------|------------------|
| `e4.<id>` | `<ts>` | `<HIGH/CRITICAL/MEDIUM>` | `<one-line>` | `<one-line>` | `<ts or "open">` |

If **no** alarms were raised, write the literal sentence:

> No indexer alarms were raised during the reporting period.

If any alarm remained **open** at the snapshot block, the report MUST disclose the open alarm here and cannot be promoted from draft until the counter-signer (§8) explicitly accepts publication despite the open alarm. The acceptance line MUST quote the alarm id verbatim.

---

## 8. Independence attestation

The author and counter-signer attest, by signing below, that:

1. Every number in §§3–6 was produced by `GET /v1/transparency/metrics` against the snapshot block recorded in §2, with no manual adjustment.
2. No individual user data forbidden by [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §7 appears in this report.
3. Every divergence between indexer-derived and on-chain values exceeds neither the tolerance table in spec §3.4 nor — if it does — has been disclosed in §7 of this report.
4. The signers are independent of any party that benefits from a particular metric outcome, in the sense of [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §6 conflict-of-interest rule.

| Role | Name / handle | Signature (PGP key fingerprint or commit signature) | Date (UTC) |
|------|---------------|-----------------------------------------------------|------------|
| Author | `<handle>` | `<fingerprint>` | `<YYYY-MM-DD>` |
| Counter-signer | `<handle>` | `<fingerprint>` | `<YYYY-MM-DD>` |

The Risk Authority quarterly attestation required by [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.4 is **delivered inside this section** when the counter-signer is a Risk Authority member, avoiding two parallel publication tracks ([`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §6.4).

---

## 9. Disclaimer

> Transparency is **observation, not control**. The data in this report mirrors the on-chain state of [`contracts/governance/TransparencyRegistry.tact`](../../contracts/governance/TransparencyRegistry.tact) at the snapshot block recorded in §2. The blockchain is the **single source of truth**; every number above is reproducible from `GET /v1/transparency/metrics` and verifiable on-chain. This report does **not** alter protocol state, does **not** introduce protocol authority, and does **not** expose individual user data. Governance outcomes referenced here are advisory only — the protocol contracts execute autonomously without admin override (invariants I1–I7).

The disclaimer is reproduced verbatim from the §1 reminder of [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md). Editing this block is forbidden — the CI validator (`scripts/governance/check-transparency-reporting.ts`) refuses to publish a report whose §9 text differs from the canonical disclaimer.

---

## Appendix A — Raw API response

The full JSON response of `GET /v1/transparency/metrics` captured at the snapshot block of §2. Paste verbatim, do **not** reformat — re-running the report on the same `snapshot_block` MUST yield the same numbers (spec §6.3).

```json
{
  "metadata": { },
  "current_period": { },
  "rolling_12_months": [ ],
  "governance": { },
  "alarms": [ ]
}
```

> If the JSON exceeds 200 lines, attach it as `transparency-reports/Q<n>-<fiscal-year>.metrics.json` in the same directory and link it here.

---

## Appendix B — Methodology cross-references

| Subject | Document |
|---------|----------|
| Event vocabulary | [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §2 |
| Indexer pipeline & alarms | [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §3 |
| Public API contract | [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §4 |
| Public dashboard contract | [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §5 |
| Privacy & forbidden fields | [`TRANSPARENCY_REPORTING.md`](./TRANSPARENCY_REPORTING.md) §7 |
| Snapshot methodology | [`SNAPSHOT.md`](./SNAPSHOT.md) |
| FRAUD_LOCK / appeals | [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) + [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) |
| Parameter inventory | [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 |
| Parameter-change proposal template | [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md) |
