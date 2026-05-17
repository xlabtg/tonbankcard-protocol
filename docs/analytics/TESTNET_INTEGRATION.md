# Analytics — Staging / Testnet Integration & End-to-End Verification

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Engagement Prerequisite:** [B3 Production Monitoring & Alerting](../production/MONITORING.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **staging rollout blocked until B3 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the **staging
integration plan**, the **end-to-end analytics flow** that exercises
the deployed aggregator bundle against the indexer read-replica, and
the **test bar** required by Issue #142 §8 acceptance criteria
**AC-2**, **AC-3**, **AC-4**, **AC-5**, and **AC-7**.

It binds the previously-documented surfaces ([`SPECIFICATION.md`](./SPECIFICATION.md),
[`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md),
[`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md),
[`PUBLIC_DASHBOARD.md`](./PUBLIC_DASHBOARD.md),
[`PRIVACY.md`](./PRIVACY.md),
[`MONITORING.md`](./MONITORING.md),
[`ENDPOINT_HARDENING.md`](./ENDPOINT_HARDENING.md)) to a single
rollout sequence so that the staging milestone is a verifiable,
reproducible artefact the auditor and the operator can both replay.

The mainnet rollout is **not** in scope for this document. Mainnet
gates on B3 `READY` + the post-B3 hardening bundle in
[`ENDPOINT_HARDENING.md`](./ENDPOINT_HARDENING.md) and a separate
deployment runbook will be written under that follow-up issue.

Unlike F5 (Multi-Sig Card), F7 has **no on-chain contract** — the
analytics layer is an off-chain aggregator bundle
(`backend/analytics/{merchantAggregator,protocolAggregator}.ts`)
running against the indexer read-replica that the protocol owns. The
"deployment manifest" therefore captures the **aggregator bundle hash
+ read-replica endpoint + indexer schema migration** rather than a
contract address; the staging ceremony is an **integration exercise**,
not an on-chain deployment.

---

## 2. Acceptance criteria this artifact satisfies

| AC  | Requirement | Where in this document |
|-----|-------------|------------------------|
| AC-2 | Merchant analytics endpoint implemented | §3 deployment manifest, §4 deployment steps, §5.2 merchant happy-path |
| AC-3 | Protocol analytics endpoint implemented | §3 deployment manifest, §4 deployment steps, §5.1 protocol happy-path |
| AC-4 | Merchant analytics section added to `dashboard/` | §5.6 dashboard integration drill |
| AC-5 | Public dashboard at `stats.tonbankcard.com` | §5.5 dashboard load drill |
| AC-7 | IDOR protection tested | §5.3 IDOR drill (6 distinct cases) |

AC-1 (specification) is satisfied by [`SPECIFICATION.md`](./SPECIFICATION.md)
itself; AC-6 (indexer provenance) is exercised end-to-end in §5
but documented as a primary deliverable in
[`PROTOCOL_ANALYTICS.md` §3](./PROTOCOL_ANALYTICS.md).

---

## 3. Deployment manifest

### 3.1 Gating preconditions

| Precondition | Source | State required |
|--------------|--------|----------------|
| B3 verdict | [`docs/production/MONITORING.md`](../production/MONITORING.md) → `STATUS.md` | `verdict: READY`, zero critical/high open on `backend/analytics/*` |
| Aggregator bundle | `backend/analytics/{merchantAggregator,protocolAggregator}.ts` | Compiled bundle hash matches the value the auditor signed off on (`docs/deployments/analytics-staging/bundle.txt`) |
| Dashboard build | `dashboard/` (merchant) + `dashboard/public/` (public) | Both consume `MerchantAnalytics` / `ProtocolAnalytics` envelopes per [`MERCHANT_ANALYTICS.md` §7](./MERCHANT_ANALYTICS.md), [`PUBLIC_DASHBOARD.md` §5](./PUBLIC_DASHBOARD.md) |
| Monitoring | [`MONITORING.md` §3](./MONITORING.md) | AN-M01..AN-M12 dashboards stood up; alert rules registered with B3 |
| Indexer schema | Read-replica | `MerchantPayment`, `InvoiceCreated`, `InvoiceSettled`, `AccountLocked`, `SwapExecuted`, `InternalTransferEvent` materialised |
| Read-replica isolation | `backend/analytics/replica-pool.ts` | Separate role with `pg_read_all_data` only; ingress firewall pinned (AN-AH-4) |
| Operator credentials | `docs/deployments/analytics-staging/operator.txt` | Synthetic merchant JWT signing key + 3 synthetic merchant principals committed |
| CI green | `scripts/analytics/check-analytics-readiness.ts` | `OK` on the integration commit |

If any precondition is red, the staging integration is **postponed**;
the runbook does not allow waiver-by-comment.

### 3.2 Deployment artefacts

The integration produces the following artefacts, each committed to
the repository under `docs/deployments/analytics-staging/`:

| Artefact | Contents |
|----------|----------|
| `manifest.json` | Aggregator bundle hash, replica endpoint, indexer schema version, integration commit SHA, deployment timestamp. |
| `bundle.txt` | SHA-256 of the compiled aggregator bundle (output of `pnpm --filter backend build && sha256sum dist/analytics.js`). |
| `dashboard-build.txt` | SHA-256 of the merchant `dashboard/` bundle and the public `dashboard/public/` bundle. |
| `protocol-flow.log` | End-to-end log of the §5.1 public protocol happy-path. |
| `merchant-flow.log` | End-to-end log of the §5.2 merchant happy-path. |
| `idor-drill.log` | End-to-end log of the §5.3 IDOR drill (six cases). |
| `privacy-drill.log` | End-to-end log of the §5.4 privacy-floor drill. |
| `dashboard-drill.log` | End-to-end log of the §5.5 dashboard load drill. |
| `monitoring-drill.log` | End-to-end log of the §5.7 DR-1..DR-6 alert exercises ([`MONITORING.md` §5](./MONITORING.md)). |

### 3.3 Network selection

Staging is **the protocol's existing staging environment** — the same
one B3 uses for monitoring drills. The aggregator reads from the
staging indexer read-replica; the merchant endpoint sits behind the
existing API gateway under `api.staging.tonbankcard.com`; the
public dashboard sits behind the existing CDN under
`stats.staging.tonbankcard.com`.

No new infrastructure is provisioned for staging — every component
reuses the existing staging tier so the ceremony is reproducible.

---

## 4. Deployment steps

The integration runs **once** per B3-approved aggregator bundle hash.
A subsequent re-deploy (after AN-AH-N hardening) is a separate
ceremony documented in its own runbook.

1. **Bundle.** Build `backend/analytics/*` and record SHA-256 in
   `bundle.txt`. Verify the hash matches the B3 sign-off.
2. **Schema.** Apply any indexer schema migration on staging; re-run
   the readiness validator to confirm no drift.
3. **Pool.** Deploy `replica-pool.ts` with the analytics-only Postgres
   role; verify ingress firewall isolation (AN-AH-4).
4. **API.** Roll the API gateway to serve `/v1/analytics/merchant`
   and `/v1/analytics/protocol`; verify Cache-Control + Vary headers.
5. **Dashboard.** Deploy `dashboard/` (merchant) and
   `dashboard/public/` (public) to staging origins; verify CDN caches
   the public bundle.
6. **Monitoring.** Confirm AN-M01..AN-M12 alert rules are registered
   with B3 and routed per [`MONITORING.md` §3.5](./MONITORING.md).
7. **Drills.** Run §5.1–§5.7 end-to-end and capture each log in §3.2.
8. **Attestation.** The integration is **green** only when every log
   in §3.2 is committed and the readiness validator stays `OK`.

---

## 5. Test bar (end-to-end drills)

### 5.1 Public protocol happy-path

1. Hit `GET /v1/analytics/protocol?range=30d` from an unauthenticated
   client.
2. Validate response envelope shape matches
   [`PROTOCOL_ANALYTICS.md` §2](./PROTOCOL_ANALYTICS.md).
3. Validate the response carries `Cache-Control: public, max-age=600,
   stale-while-revalidate=120` and `Vary: Accept-Encoding`.
4. Re-hit within 60 s — verify `ETag` 304 response.
5. Record the trace in `protocol-flow.log`.

### 5.2 Merchant happy-path

1. Mint a synthetic merchant JWT for principal `M1` (one of the three
   synthetic principals from §3.1).
2. Hit `GET /v1/analytics/merchant?range=30d` with `Authorization:
   Bearer <jwt>`.
3. Validate response envelope shape matches
   [`MERCHANT_ANALYTICS.md` §2](./MERCHANT_ANALYTICS.md); validate
   `merchantId` equals the JWT `sub`.
4. Validate `topCustomers` entries are truncated hashes; no raw
   `nft_address` appears anywhere.
5. Record the trace in `merchant-flow.log`.

### 5.3 IDOR drill (six distinct cases)

Each case below MUST return `403 ERROR_AN_FORBIDDEN_SCOPE` and emit
`AN-M03`. The drill MUST run all six before declaring AC-7 satisfied.

| Case | Request |
|---|---|
| 1 | `GET /v1/analytics/merchant?merchantId=<self>` (matches principal — defense-in-depth) |
| 2 | `GET /v1/analytics/merchant?merchantId=<other>` (foreign principal) |
| 3 | `GET /v1/analytics/merchant/<other>` (path-style attempt) |
| 4 | `GET /v1/analytics/merchant` with body `{"merchantId":"<other>"}` (body attempt) |
| 5 | `GET /v1/analytics/merchant` with a tampered JWT `sub` claim (signature mismatch → `401 ERROR_AN_UNAUTHORIZED`) |
| 6 | `GET /v1/analytics/merchant` with no Authorization header → `401 ERROR_AN_UNAUTHORIZED` |

Record the six request/response pairs (with redacted JWTs) in
`idor-drill.log`.

### 5.4 Privacy-floor drill

1. Seed staging with a 7-day window where only 4 distinct
   `nft_address` values participated.
2. Hit `GET /v1/analytics/protocol?range=7d`.
3. Assert `activeAccounts: null`, `invoicesCreated: null`,
   `invoicesSettled: null`, `totalValueTransferred: null`,
   `dexSwapVolume: null`.
4. Assert `fraudLockEvents` and `collateralLockEvents` are populated
   (exempt from the floor per [`PROTOCOL_ANALYTICS.md` §4](./PROTOCOL_ANALYTICS.md)).
5. Assert `AN-M08` fired exactly once.
6. Record the trace in `privacy-drill.log`.

### 5.5 Dashboard load drill

1. Open `stats.staging.tonbankcard.com` from a cold cache.
2. Validate first paint within `DASHBOARD_LOAD_BUDGET_MS = 2000 ms`
   (P95 across 20 cold loads).
3. Validate the freshness banner renders `computedAt` and
   `nextRefreshAt`.
4. Cut the staging replica for 200 s — validate the banner switches
   to its degraded state within `INDEXER_DISCONNECT_GRACE_SECONDS =
   180 s`.
5. Record traces in `dashboard-drill.log`.

### 5.6 Merchant dashboard integration

1. Sign in to `staging.tonbankcard.com/dashboard` as merchant `M1`.
2. Navigate to the analytics tab.
3. Validate the six widgets render per
   [`MERCHANT_ANALYTICS.md` §7](./MERCHANT_ANALYTICS.md): volume
   card, conversion card, chargeback card, top-customers list, revenue
   trend chart, freshness banner.
4. Sign in as merchant `M2` — validate the analytics tab shows `M2`'s
   data, not `M1`'s (IDOR sanity check at the UI layer).
5. Record traces alongside `idor-drill.log`.

### 5.7 Monitoring drills

Run the DR-1..DR-6 scenarios from [`MONITORING.md` §5](./MONITORING.md)
and capture the alert traces in `monitoring-drill.log`.

---

## 6. Performance budget verification

| Surface | Target | Method |
|---|---:|---|
| Protocol endpoint P95 | ≤ 500 ms | 200 synthetic hits at 5 RPS, P95 from access log |
| Merchant endpoint P95 | ≤ 1000 ms | 200 synthetic hits at 5 RPS, P95 from access log |
| Dashboard load P95 | ≤ `DASHBOARD_LOAD_BUDGET_MS = 2000 ms` | 20 cold loads, P95 from real-user monitoring |
| Cache hit ratio | ≥ 80 % | CDN access log over 60 minutes |
| Indexer overhead | ≤ 10 % CPU added to indexer host | Indexer host metrics before/during the drill |

Budget breaches block AC-2/AC-3/AC-5; the staging integration MUST be
re-run after the regression is fixed.

---

## 7. Rollback

If any drill in §5 fails:

1. Revert the aggregator deploy via the existing staging revert lever
   (no analytics-specific revert path is introduced).
2. Re-pin the API gateway to the previous revision.
3. File an incident in the analytics tracker referencing the failed
   drill artefact.
4. Re-attempt only after the readiness validator and the failed drill
   both report `OK` on the next branch.

Rollback during the public dashboard drill (§5.5) is a no-op — the
public dashboard reads from the protocol endpoint, so reverting the
endpoint reverts the dashboard.

---

## 8. Cross-references

- [`SPECIFICATION.md`](./SPECIFICATION.md) §3, §4 — adapter and routing contract
- [`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md) §2, §3 — merchant envelope + IDOR posture
- [`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md) §2, §4 — protocol envelope + privacy floor
- [`PUBLIC_DASHBOARD.md`](./PUBLIC_DASHBOARD.md) §3, §6 — dashboard data contract + budget
- [`PRIVACY.md`](./PRIVACY.md) §2 — k-anonymity rationale
- [`MONITORING.md`](./MONITORING.md) §3, §5 — alert catalogue + DR drills
- [`ENDPOINT_HARDENING.md`](./ENDPOINT_HARDENING.md) §3 — AN-AH-N items exercised by these drills
- [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) §3 — staging integration entitles bounty submissions
