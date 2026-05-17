# Privacy Posture — Analytics Aggregation

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17

This document is the single source of truth for the **privacy
posture** of every aggregate the analytics layer publishes. It binds
the k-anonymity floor, address-truncation rules, and opt-out
behaviour into one place so that the auditor (B3) and bug-bounty
researchers (A5) can verify privacy invariants without chasing
constants across modules.

Spec-anchor: [`SPECIFICATION.md`](SPECIFICATION.md) §7.5.

---

## 1. Acceptance criterion

Issue #142 §7 — _"Public analytics MUST NOT re-identify individual
users"_ and Issue #142 §8 — _"Public dashboard shows accurate protocol
stats"_ (AC-5, reinforced by the privacy invariant that aggregates
remain protocol-wide).

---

## 2. K-anonymity floor

The protocol-wide privacy floor is anchored in
[`SPECIFICATION.md`](SPECIFICATION.md) §7.5:

`K_ANONYMITY_FLOOR = 5`.

That is, an aggregate is **publishable** only when at least five
distinct underlying entities contribute. Below the floor:

- the corresponding field is emitted as `null` (NOT `0`),
- alert `AN-M08` fires (informational, not paging),
- the dashboard renders "—" with a tooltip explaining the floor.

The distinction between `null` and `0` is **load-bearing**: zero is a
legitimate aggregate (e.g. zero `fraudLockEvents` in a quiet week),
whereas `null` means "we have data but it falls below the privacy
floor". Conflating the two would either leak information ("zero locks
this week" implies "at most four accounts had locks") or hide
legitimate zero outcomes.

### 2.1 Why K = 5

K = 5 mirrors the F3 cross-chain bridge document
([`docs/bridge/PRIVACY.md`](../bridge/PRIVACY.md) §2) and is the
floor recommended by the protocol's earlier off-chain reviews. It
balances three constraints:

1. **Audit precedent.** The on-chain audit suite (A1, A2, A4) already
   reasons about K = 5 for any aggregate exposed through the indexer.
2. **Dashboard usefulness.** A higher floor (e.g. K = 10) would null
   out many panels in the 7-day range during low-activity periods,
   degrading the dashboard's usefulness without a meaningful privacy
   delta.
3. **Bounty surface.** A re-identification attack at K = 5 is
   bounty-eligible under [A5](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md);
   a relaxation below K = 5 would force a new bounty category.

### 2.2 Floor enforcement points

The floor is enforced at **three** points, defense-in-depth:

| Layer | Check | Failure mode |
|---|---|---|
| Aggregator (`protocolAggregator.ts`) | Reject the underlying `SELECT` if `COUNT(DISTINCT nft_address) < 5` and emit `null` | Returns `null`, emits `AN-M08` |
| Endpoint (`/v1/analytics/protocol`) | Re-validate `null` substitution before serialisation | Returns `null` (defense-in-depth) |
| CI guardrail | `R-AN-AH-2` (see [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §5) asserts `K_ANONYMITY_FLOOR` is referenced from both layers | Blocks PR |

The triple-enforcement closes T-AN-2 from
[`SPECIFICATION.md`](SPECIFICATION.md) §7.1 (re-identification through
low-k aggregates).

---

## 3. Address truncation (merchant endpoint)

The merchant endpoint
([`MERCHANT_ANALYTICS.md`](MERCHANT_ANALYTICS.md) §2) returns
`topCustomers[]` — at most ten customer entries per merchant. Each
entry exposes only:

```ts
{ truncatedHash: string, paymentCount: number, paymentVolumeTbc: bigint }
```

where `truncatedHash` is derived from the customer's NFT address as
follows:

1. `digest = sha256(nft_address)` (hex, lowercase, 64 chars).
2. `truncatedHash = digest[0..4] + '…' + digest[60..64]` (first four
   hex chars, ellipsis, last four hex chars — total 9 visible
   characters).

The raw NFT address NEVER leaves the database; the truncated hash is
the only customer identifier that crosses the API boundary. The
hash is intentionally one-way and not reversible.

If `topCustomers.length < K_ANONYMITY_FLOOR = 5`, the array is
returned **empty** rather than partially populated — surfacing four
customers would re-identify them by elimination across consecutive
queries.

---

## 4. Opt-out

The protocol does not collect PII at the user layer (no e-mail,
no phone, no name), so there is no per-user "opt out of analytics"
toggle to expose. However, **merchants** can request that their
domain be excluded from the public protocol aggregate via the same
intake the bridge program uses:

1. Open a `analytics-optout` issue on the protocol repository.
2. Include the merchant DID and the signed opt-out attestation
   (matching the F4 attestation primitive).
3. After verification, the aggregator's `MERCHANT_OPTOUT_SET` is
   updated; the merchant's payments no longer contribute to
   `totalValueTransferred`, `invoicesCreated`, or `invoicesSettled`
   in the public aggregate.

The merchant's own authenticated endpoint
(`/v1/analytics/merchant`) continues to surface their data —
opt-out scopes the **public** aggregate only, not the merchant's
own dashboard.

The opt-out list is **NOT** publicly enumerable — exposing the list
would itself be a privacy leak (signalling which merchants opted out
re-identifies the smallest opted-out set).

---

## 5. Retention

Aggregates are retained for `ANALYTICS_RETENTION_YEARS = 3` years
([`SPECIFICATION.md`](SPECIFICATION.md) §4.5). After three years:

- Raw indexer rows that fed the aggregate are unchanged (governed by
  the indexer's own retention policy).
- Pre-computed aggregate snapshots older than three years are
  truncated to **range = `all-time` only** — finer-grained ranges
  (7d / 30d / 90d / 365d) are dropped.
- The CI guardrail `R-AN-AH-3` asserts the retention truncation runs
  daily.

---

## 6. Logging and metrics

- `analytics.merchant.access { sub, range, hashedSub }` — emitted on
  every merchant endpoint hit. `hashedSub = sha256(sub)` first 8 / last
  8 chars; the raw `sub` is **not** persisted to the access log.
- `analytics.protocol.access { range, ipHash }` — emitted on every
  public endpoint hit. `ipHash = sha256(ip + dailySalt)`; salt rotates
  every UTC day so the same IP across days hashes differently.
- Aggregator query logs MUST NOT include raw `nft_address` or `sub`
  values — only their truncated hashes. The CI guardrail
  `R-AN-AH-4` greps the materialised log schema for raw fields.

---

## 7. Cross-references

- [`SPECIFICATION.md`](SPECIFICATION.md) §7.5 — PII posture
- [`PROTOCOL_ANALYTICS.md`](PROTOCOL_ANALYTICS.md) §4 — null-substitution rule
- [`MERCHANT_ANALYTICS.md`](MERCHANT_ANALYTICS.md) §4 — top-customers truncation
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 — AN-AH-2, AN-AH-5
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §5 — R-AN-AH-2, R-AN-AH-3, R-AN-AH-4
- [`MONITORING.md`](MONITORING.md) §3 — AN-M08 (privacy-floor trigger)
- [`docs/bridge/PRIVACY.md`](../bridge/PRIVACY.md) §2 — precedent for K = 5
