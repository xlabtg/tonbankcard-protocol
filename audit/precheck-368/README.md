# Pre-check via Claude Fable — Issue #368

Second-round security & correctness pre-check of the full codebase, performed
after the issue #241 audit (findings #243–#302, remediated in #303–#362). The
goal of this round was to independently re-examine the code and surface any
**new** bugs, errors, and vulnerabilities not already covered by the first
audit, and to verify the recently-reported findings #363–#367.

Scope: smart contracts (Tact + FunC), backend & API, SDKs (TS/Go/Python),
frontend / mobile apps, infrastructure (Docker/compose), and scripts.

## New findings (this round)

Each finding has a dedicated spec file under
[`findings/`](./findings/) and a corresponding tracking issue with labels and a
remediation stage so the team can implement step by step.

| ID | Issue | Severity | Stage | Area | Title |
|----|-------|----------|-------|------|-------|
| [PC-01](./findings/PC-01-snapshotverifier-unauthenticated-snapshot.md) | #370 | High | 1-critical | contracts/governance | SnapshotVerifier accepts unauthenticated `RegisterSnapshot` (forge eligibility roll) |
| [PC-02](./findings/PC-02-paymenthub-initializeaccount-overwrite.md) | #371 | High | 1-critical | contracts/payments | `PaymentHub.InitializeAccount` overwrites owner/balance → fund drain |
| [PC-03](./findings/PC-03-nowpayments-hmac-placeholder.md) | #372 | High | 1-critical | backend/adapters | NOWPayments adapter verifies callbacks with a placeholder HMAC (forgeable IPN) |
| [PC-04](./findings/PC-04-idempotency-key-nested-metadata-collision.md) | #373 | Medium | 3-medium | api | `generateIdempotencyKey` ignores nested `metadata` → key collisions |
| [PC-05](./findings/PC-05-paymentwidget-query-injection.md) | #374 | Medium | 3-medium | sdk | `PaymentWidget` deep link built from raw, unencoded inputs (query injection) |
| [PC-06](./findings/PC-06-canonical-json-cross-sdk-divergence.md) | #375 | Medium | 3-medium | sdk | Cross-SDK canonical JSON diverges on U+2028/U+2029 & float formatting |
| [PC-07](./findings/PC-07-redis-exposed-without-auth.md) | #376 | Medium | 3-medium | devops | Redis published on all interfaces without auth (prod & sandbox compose) |
| [PC-08](./findings/PC-08-dockerfile-npm-install-ignores-lockfile.md) | #377 | Medium | 3-medium | devops | API & indexer Dockerfiles `npm install` ignore the committed lockfile |
| [PC-09](./findings/PC-09-mobile-client-hardening.md) | #378 | Low | 4-low | frontend/mobile | Mobile client hardening (URL encoding, HTTPS check, Android `autoVerify`) |

Severity legend follows the existing audit taxonomy; stages map to the
`stage:1-critical` … `stage:4-low` labels.

## Review of prior open findings #363–#367

Each of #363–#367 was independently re-verified against the live code at
file:line precision; review comments were posted directly on the issues. One
description inaccuracy was identified and documented (see #366 review comment):
the integration-fee callback **does** check `sender()`, contrary to the issue
text — the residual concern is narrower than originally stated.

## Methodology

- Manual line-level reading of the affected files for every finding above.
- Executable reproductions for the data-correctness findings (PC-04 idempotency
  collision; PC-06 cross-SDK byte/hash divergence) using Node/Python/Go.
- Cross-checking each finding against the existing #243–#302 findings to avoid
  duplicating already-tracked work.

## Notes

This is an authorized internal audit. No secrets, keys, or mnemonics were
introduced; all reproductions used synthetic inputs.
