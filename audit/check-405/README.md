# Check via Claude — Issue #405

Fourth-round full-codebase security & correctness audit, performed after the
issue #241 audit (findings #243–#302, all remediated), the issue #368 pre-check
(PC-01…PC-09 / #370–#378, all remediated), and the issue #393 third round
(CHECK393-* / #395–#399, all remediated). The goal of this round was to
independently re-examine the entire application logic and surface any **new**
bugs, errors, and vulnerabilities not already covered by the ~170 existing
issues — including **incomplete remediations** of prior work — and to file each
as a professional, labelled, stage-tagged GitHub issue.

Scope: smart contracts (Tact + FunC, frozen this round), merchant API (`api/`),
indexer (`backend/indexer`), SDKs (TS/Go/Python), dashboard / mobile /
mobile-app / wallet-ui, docs-site, faucet + deploy scripts, and CI workflows.

## New findings (this round)

Each finding has a dedicated spec file under [`findings/`](./findings/) and a
corresponding tracking issue with labels and a remediation stage so the team can
implement step by step.

| ID | Issue | Severity | Stage | Area | Title |
|----|-------|----------|-------|------|-------|
| [CHECK405-H1](./findings/CHECK405-H1-indexer-rate-limiter-fail-closed.md) | [#407](https://github.com/xlabtg/tonbankcard-protocol/issues/407) | High | 2-high | backend/indexer | Rate-limit middleware treats every store error as a 429, so a Redis outage self-DoSes the whole read API |
| [CHECK405-M1](./findings/CHECK405-M1-postgres-jsonb-double-parse.md) | [#408](https://github.com/xlabtg/tonbankcard-protocol/issues/408) | Medium | 3-medium | api | `PostgresInvoiceStorage` double-parses JSONB columns, so every read of an invoice with metadata/settlement throws |
| [CHECK405-M2](./findings/CHECK405-M2-sdk-canonical-json-key-ordering.md) | [#409](https://github.com/xlabtg/tonbankcard-protocol/issues/409) | Medium | 3-medium | sdk | TS SDK `canonicalJson` sorts keys by UTF-16 code unit, diverging from Go/Python code-point order for astral-plane keys |
| [CHECK405-M3](./findings/CHECK405-M3-wallet-ui-deeplink-injection.md) | [#410](https://github.com/xlabtg/tonbankcard-protocol/issues/410) | Medium | 3-medium | wallet-ui | `generateConnectLink` interpolates `paymentHubAddress` into a `ton://` deep link without validation or encoding |
| [CHECK405-M4](./findings/CHECK405-M4-faucet-ci-lockfile-depaudit-gaps.md) | [#411](https://github.com/xlabtg/tonbankcard-protocol/issues/411) | Medium | 3-medium | tooling | Faucet ships no lockfile and is absent from all CI; dependency-audit matrix omits faucet, docs-site, mobile-app |
| [CHECK405-L1](./findings/CHECK405-L1-api-hardening-backlog.md) | [#412](https://github.com/xlabtg/tonbankcard-protocol/issues/412) | Low | 4-low | api | API hardening backlog: unthrottled auth path, non-canonical amount strings, metadata `invoice_id` shadowing |
| [CHECK405-L2](./findings/CHECK405-L2-sdk-parity-backlog.md) | [#413](https://github.com/xlabtg/tonbankcard-protocol/issues/413) | Low | 4-low | sdk | TS SDK parity backlog: case-sensitive hex webhook compare, missing amount validation in invoice hashing |
| [CHECK405-L3](./findings/CHECK405-L3-contracts-backlog.md) | [#414](https://github.com/xlabtg/tonbankcard-protocol/issues/414) | Low | 4-low | contracts | Contracts backlog (file-only): `set_registry` binds only to deployer; `MerchantPaymentHub` has no balance-funding path |

Severity legend follows the existing audit taxonomy; stages map to the
`stage:1-critical` … `stage:4-low` labels.

## Fixed in this PR

All off-chain findings (H1, M1–M4, L1, L2) are fixed here with regression tests.
CHECK405-L3 is **file-only**: the contracts are frozen this round and its second
item is a protocol-economics decision that must be made by the contract team
(it must preserve the non-custodial guarantee), so no contract code is changed.

## Methodology

- Manual line-level reading of the affected files for every finding above.
- Executable reproductions under [`experiments/`](../../experiments/) where
  feasible (e.g. the indexer rate-limiter fail-closed behaviour and the SDK
  canonical-JSON key-ordering divergence).
- Each finding cross-checked against the existing #243–#302, #370–#378, and
  #395–#399 findings to avoid duplicating already-tracked work; dedup rationale
  recorded in each spec's Description / References.

## Notes

This is an authorized internal audit (issue #405). No secrets, keys, or
mnemonics were introduced; all reproductions used synthetic inputs. The
non-custodial guarantee (no admin fund controls, no private-key storage, no
forced transfers) is preserved — no protocol economics were changed.
