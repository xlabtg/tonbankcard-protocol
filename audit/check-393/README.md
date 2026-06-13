# Check via Claude — Issue #393

Third-round full-codebase security & correctness audit, performed after the
issue #241 audit (findings #243–#302, all remediated) and the issue #368
pre-check (findings PC-01…PC-09 / #370–#378, all remediated). The goal of this
round was to independently re-examine the entire application logic and surface
any **new** bugs, errors, and vulnerabilities not already covered — including
**incomplete remediations** of prior issues — and to file each as a professional,
labelled, stage-tagged GitHub issue.

Scope: smart contracts (Tact + FunC, frozen at `4027b9d`), merchant API
(`api/`), indexer (`backend/indexer`), SDKs (TS/Go/Python), dashboard / mobile /
mobile-app / wallet-ui, docs-site, deploy scripts, and CI workflows.

## New findings (this round)

Each finding has a dedicated spec file under [`findings/`](./findings/) and a
corresponding tracking issue with labels and a remediation stage so the team can
implement step by step.

| ID | Issue | Severity | Stage | Area | Title |
|----|-------|----------|-------|------|-------|
| [CHECK393-H1](./findings/CHECK393-H1-invoice-status-idor.md) | [#395](https://github.com/xlabtg/tonbankcard-protocol/issues/395) | High | 2-high | api | `GET /v1/invoice/:id/status` authenticates the key but never binds it to the invoice owner (cross-merchant IDOR) |
| [CHECK393-H2](./findings/CHECK393-H2-indexer-state-change-owner-wipe.md) | [#396](https://github.com/xlabtg/tonbankcard-protocol/issues/396) | High | 2-high | backend/indexer | `insertAccountStateChange` 4-column `INSERT OR REPLACE` wipes `current_owner`/`last_transfer_block` to NULL on every state-change |
| [CHECK393-M1](./findings/CHECK393-M1-merchant-hub-missing-account-registration.md) | [#397](https://github.com/xlabtg/tonbankcard-protocol/issues/397) | Medium | 3-medium | contracts | Deployable `MerchantPaymentHub` has no account-registration handler → every payment fails (incomplete #363) |
| [CHECK393-L1](./findings/CHECK393-L1-update-lending-intent-missing-state-guard.md) | [#398](https://github.com/xlabtg/tonbankcard-protocol/issues/398) | Low | 4-low | contracts | `UpdateLendingIntent` has no state guard → resurrects a CANCELLED intent to ACTIVE |
| [CHECK393-L2](./findings/CHECK393-L2-offchain-tooling-backlog.md) | [#399](https://github.com/xlabtg/tonbankcard-protocol/issues/399) | Low | 4-low | tooling | Off-chain/tooling backlog: manifest HTTPS parsing, docs-site `npm install` drift |

Severity legend follows the existing audit taxonomy; stages map to the
`stage:1-critical` … `stage:4-low` labels.

## Also fixed in this PR

- **esbuild transitive advisory (GHSA-67mh-4wv8-2f99)** surfaced by the
  `dependency-audit` CI checks for `sdk`, `dashboard`, `mobile`, and `wallet-ui`.
  Resolved with the repo's established `overrides` pattern (`"esbuild": "^0.28.1"`
  added to each package's existing overrides block; lockfiles regenerated).
  `npm audit` reports 0 vulnerabilities in all four packages.

## Methodology

- Manual line-level reading of the affected files for every finding above.
- Executable reproduction for the indexer data-corruption finding
  (`experiments/repro-snapshot-owner-wipe.mjs`, better-sqlite3 in-memory).
- Each finding cross-checked against the existing #243–#302 and #370–#378
  findings to avoid duplicating already-tracked work; dedup rationale recorded in
  each spec's References / Description.

## Notes

This is an authorized internal audit (issue #393). No secrets, keys, or
mnemonics were introduced; all reproductions used synthetic inputs.
