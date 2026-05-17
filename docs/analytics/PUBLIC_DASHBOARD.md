# Public Dashboard — `stats.tonbankcard.com`

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17

This document specifies the public dashboard hosted at
`stats.tonbankcard.com` — its layout, refresh cadence, CDN posture,
and the data contract it consumes. The dashboard implementation
in `dashboard/public/` (lands post-B3 verdict `READY`) MUST honour
the contract frozen here.

Spec-anchor: [`SPECIFICATION.md`](SPECIFICATION.md) §4.

---

## 1. Acceptance criterion

Issue #142 §8 — _"Public dashboard at stats.tonbankcard.com"_
(**AC-5**) and _"Public dashboard shows accurate protocol stats"_
(reinforced by AC-5). The dashboard also relies on **AC-3** (public
endpoint) for its data and on **AC-6** (indexer provenance) for its
trust posture.

---

## 2. Hosting and CDN posture

| Property | Value |
|---|---|
| Hostname | `stats.tonbankcard.com` |
| Origin | Static SPA bundle served from object storage |
| CDN | Same edge tier as `app.tonbankcard.com` |
| TLS | Managed certificate, HSTS preload enrolled |
| Cache-Control on HTML | `public, max-age=60, stale-while-revalidate=300` |
| Cache-Control on JS / CSS hashes | `public, max-age=31536000, immutable` |
| Authentication | None — public read-only |

The HTML shell is short-cached so layout fixes propagate quickly;
versioned JS/CSS assets are long-cached because their filenames
change on every release.

---

## 3. Data contract

The dashboard fetches **only** `GET /v1/analytics/protocol` (see
[`PROTOCOL_ANALYTICS.md`](PROTOCOL_ANALYTICS.md) §2). It MUST NOT
call any other API surface, RPC endpoint, or indexer table directly
(AC-6 closure).

- Default range: `30d`.
- A range selector toggles between `7d`, `30d`, `all-time` and
  triggers a fresh fetch with the appropriate query parameter.
- ETag is honoured: a `304 Not Modified` keeps the previous render.

---

## 4. Refresh cadence

The dashboard refreshes on the cadence anchored in
[`SPECIFICATION.md`](SPECIFICATION.md) §6:

| Trigger | Cadence | Source |
|---|---|---|
| Background poll | every `ANALYTICS_REFRESH_INTERVAL_SECONDS = 600 s` | Browser `setInterval` |
| Range toggle | immediate | User interaction |
| Tab focus | on `visibilitychange` if last fetch ≥ 60 s ago | Browser `visibilityState` |
| Manual reload | immediate | Browser refresh button |

The dashboard surfaces `nextRefreshAt` from the endpoint envelope
verbatim — the freshness banner reads "Last updated {hh:mm UTC} ·
next refresh at {hh:mm UTC}".

When `nextRefreshAt < now - INDEXER_DISCONNECT_GRACE_SECONDS = 180 s`,
the freshness banner switches to its **degraded** state ("Data may be
stale — indexer disconnected"). The degraded banner is described in
[`MONITORING.md`](MONITORING.md) §3 (alert `AN-M04`).

---

## 5. Layout

The page renders six panels, each derived 1:1 from `ProtocolAnalytics`:

| Panel | Fields rendered |
|---|---|
| **Total Value Transferred** | `totalValueTransferred` (TBC), range pill |
| **Active Accounts** | `activeAccounts`, range pill, "min 5 accounts to display" footnote |
| **Lock Events** | `fraudLockEvents`, `collateralLockEvents`, severity badge |
| **Invoices** | `invoicesCreated`, `invoicesSettled`, conversion ratio |
| **DEX Volume** | `dexSwapVolume` (TBC), sourced from F6 `SwapExecuted` events |
| **Freshness Banner** | `computedAt`, `nextRefreshAt`, degraded state when stale |

Each panel renders a `null` field as "—" with a tooltip reading
"Below privacy threshold (K = 5)". The "—" placeholder NEVER renders
as `0`, because zero is also a valid aggregate value with a different
meaning (see [`PRIVACY.md`](PRIVACY.md) §2).

---

## 6. Performance budget

Aligned with [`SPECIFICATION.md`](SPECIFICATION.md) §5:

| Metric | Budget |
|---|---:|
| Dashboard initial load (P95) | `DASHBOARD_LOAD_BUDGET_MS = 2000 ms` |
| Time-to-interactive (P95) | 2500 ms |
| Render after refresh (P95) | 200 ms (after fetch resolves) |

The dashboard MUST NOT block first paint on the analytics fetch — the
shell renders skeleton placeholders, then swaps in real data when the
fetch resolves. Load drift above the budget fires `AN-M07`.

---

## 7. Error handling

| Endpoint response | Dashboard behaviour |
|---|---|
| 200 with `null` fields | Render "—" placeholders + privacy footnote |
| 200 stale (`nextRefreshAt < now - 180 s`) | Degraded freshness banner, stale data kept on screen |
| 400 `ERROR_AN_INVALID_RANGE` | Roll back to last valid range, surface toast |
| 429 `ERROR_AN_RATE_LIMITED` | Back-off banner, retry after `Retry-After` header |
| 503 (any) | Degraded freshness banner, "service temporarily unavailable" toast |
| Network error | Same as 503 |

The dashboard NEVER renders a partial error in place of the data —
the last successful render is retained until a new successful fetch
replaces it. The freshness banner is the single source of truth for
"how old is the data on screen".

---

## 8. Accessibility & i18n

- Colour-blind safe palette; all panels meet WCAG AA contrast (4.5:1).
- Number formatting uses the user's locale via `Intl.NumberFormat`.
- Timestamps render in UTC by default with a tooltip for local time.
- `aria-live="polite"` on the freshness banner so screen readers
  announce refresh events without interrupting.

---

## 9. Cross-references

- [`SPECIFICATION.md`](SPECIFICATION.md) §4 — routing and caching plane
- [`PROTOCOL_ANALYTICS.md`](PROTOCOL_ANALYTICS.md) §2 — data contract
- [`PRIVACY.md`](PRIVACY.md) §2 — k-anonymity floor and "—" placeholder rationale
- [`MONITORING.md`](MONITORING.md) §3 — AN-M04 (degraded banner), AN-M07 (load drift)
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 — AN-AH-6 (cache key)
- [`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) §5.5 — dashboard load drill
