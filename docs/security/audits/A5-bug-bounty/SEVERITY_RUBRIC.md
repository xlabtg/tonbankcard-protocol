# A5 Bug Bounty — Severity Rubric

**Document Type:** Severity Classification Rubric
**Engagement:** [A5](./ENGAGEMENT.md) · [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Status:** Active (applies on program launch)
**Last Updated:** 2026-05-16

---

## 1. Purpose

This rubric tells researchers (and the triage team) how a submission is classified into one of `Critical / High / Medium / Low / Informational` for reward purposes. It bridges:

- the protocol-internal severity scale already used by audit findings ([`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §2),
- the protocol's seven formal invariants `I1`–`I7` ([`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md)),
- the Immunefi Vulnerability Severity Classification System v2.3 (https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/).

A researcher's proposed severity is taken as input. Final classification is made by the triage owner recorded in [`STATUS.md`](./STATUS.md) §1.

---

## 2. Rubric

### 2.1 🔴 Critical

A vulnerability that **directly** violates one of `I1` (Non-Custodial), `I2` (NFT = Account Authority), `I3` (No Admin Fund Control), `I4` (Atomic Transfers), `I5` (Ledger Conservation), or causes catastrophic loss of merchant funds at scale.

Hallmarks:

- Direct theft of user funds without prior interaction or social engineering.
- Permanent freezing of user funds in `PaymentHub` / `MerchantPaymentHub` accounts (cannot be unlocked by NFT owner).
- Mint / burn of unbacked balance state in the on-chain ledger (`I5` Ledger Conservation break).
- Any admin / operator / external-adapter path that moves user funds without the on-chain NFT owner's signature (`I3` break).
- Full compromise of the npm package supply chain that ships executable code to widget consumers.
- Compromise of the indexer that allows fabricating confirmed-payment status for unsettled invoices at scale.

Reward bands (per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §2.1):

- **Smart contract:** $10,000+ (open-ended; uplift requires sign-off per [`STATUS.md`](./STATUS.md) §10)
- **Off-chain:** $5,000
- **Frontend:** escalated to off-chain or smart-contract per impact

Worked examples (illustrative; not exhaustive):

- A `MerchantPaymentHub` message handler accepts a payer that is not the current NFT owner and routes funds to attacker-controlled address → `I1` + `I2` break, Critical.
- An `account-locks.fc` path mutates balance during lock change → `I6` (Lock ≠ Confiscation) + `I5` (Ledger Conservation) break, Critical.
- A bridge or lending adapter (post-A2) invokes `executeTransfer` directly without going through the protocol's authorisation path → `I7` (External Adapter Isolation) break, Critical.
- An npm post-install script in a transitive `sdk/` dependency overrides the published widget bundle → supply-chain Critical.

### 2.2 🟠 High

A vulnerability that violates `I6` (Lock ≠ Confiscation), `I7` (External Adapter Isolation), enables privilege escalation, or makes a Critical-class break feasible under realistic preconditions.

Hallmarks:

- Cross-merchant IDOR on `api/` invoice endpoints that exposes settlement data without authorisation.
- Webhook replay that allows double-credit of a payment in a merchant's bookkeeping (post-D4, replay must be infeasible — any working replay PoC against the post-D4 surface is High at minimum).
- Bypass of `risk_authority` scoping — e.g., an attacker can set `FRAUD_LOCK` without authority key but cannot drain (so not Critical) yet can deny service.
- API-key derivation that lets an attacker mint valid keys for arbitrary merchants.
- Auth bypass on indexer admin endpoints (if any are added in the future).

Reward bands:

- **Smart contract:** $5,000
- **Off-chain:** $2,500
- **Frontend:** escalated to off-chain per impact

Worked examples:

- `account-locks.fc` allows `lending_adapter` to clear `FRAUD_LOCK` set by `risk_authority` → privilege escalation, High.
- Idempotency-key prediction in `api/src/utils/helpers.ts` lets a researcher overwrite another merchant's pending invoice → High.
- Widget DOM renders `description` field with `innerHTML` allowing reflected XSS on the merchant-controlled domain → High.

### 2.3 🟡 Medium

A bug or deviation that produces incorrect behaviour without direct fund loss or invariant violation.

Hallmarks:

- Indexer mis-categorises a payment as `pending` indefinitely under a specific edge case.
- Rate-limit bypass that exhausts a single merchant's quota but does not affect others.
- Information leak that exposes non-sensitive operational data (e.g., internal queue lengths).
- Frontend wallet UI rendering bug that hides a balance under specific theme + locale combinations.

Reward bands:

- **Smart contract:** $1,000
- **Off-chain:** $500
- **Frontend:** $500

Worked examples:

- `backend/indexer/` keyset pagination cursor encoding leaks an internal row identifier (no cross-account leak) → Medium.
- Merchant API returns 500 on a malformed but parseable input that should be 400 (denial of service of a single endpoint, recoverable) → Medium.
- Dashboard misrenders a settled payment as pending under a particular locale → Medium.

### 2.4 🟢 Low

Style, hardening, or low-impact defensive issue. Pays a flat tier per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §2.1.

Hallmarks:

- Missing security header on a non-credentialed endpoint.
- Dependency-pinning suggestion not amounting to an exploitable supply-chain risk.
- Wallet-UI accessibility issue with a security read (e.g., focus state hidden in dark theme).

Reward bands:

- **Smart contract:** $100
- **Off-chain:** $100
- **Frontend:** $100

### 2.5 ℹ️ Informational

Notes, suggestions, or design observations without security impact. Not eligible for reward but credited in the quarterly transparency report.

---

## 3. Decision Process

For every submission:

1. **Identify affected invariants.** Map the vulnerability to `I1`–`I7` using [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md). A direct break of `I1`, `I2`, `I3`, `I4`, or `I5` floors the severity at **Critical**.
2. **Map to threat class.** Use the protocol threat model [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md) (T1–T8) to anchor the attacker model.
3. **Identify the attacker capability and preconditions.** A vulnerability that requires the attacker to control a privileged role is typically downgraded one band; a vulnerability that requires only an unprivileged researcher is at its full band.
4. **Apply the Immunefi rubric.** Cross-check the candidate severity against the Immunefi v2.3 scale; pick the higher of the two assessments.
5. **Record the decision in [`STATUS.md`](./STATUS.md) §6** with the finding ID, the invariant(s) referenced, the threat class(es), and the rationale.

When the team and the researcher disagree on severity, the team's decision is final but is **always** accompanied by a written rationale recorded in the finding row.

### 3.1 Floors and Ceilings

| Condition | Floor |
|-----------|-------|
| Direct break of `I1` Non-Custodial or `I3` No Admin Fund Control | Critical |
| Direct break of `I4` Atomic Transfers or `I5` Ledger Conservation | Critical |
| Break of `I6` Lock ≠ Confiscation or `I7` External Adapter Isolation | High |
| Cross-merchant IDOR with PII or settlement-state leak | High |
| Webhook replay against post-D4 HMAC-SHA256 surface | High |

| Condition | Ceiling |
|-----------|---------|
| Theoretical issue with no working PoC | Out of scope (no reward) — per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3.4 |
| Self-XSS or attack requiring full prior browser control | Low (only if a defensive note remains useful) |
| Volumetric DoS without invariant violation | Out of scope |
| Vulnerability in third-party service (ChangeNOW, NOWPayments, CoinRabbit, TONCO, TON HTTP API) | Out of scope |

---

## 4. Worked Examples — Per-Component

This section is illustrative. The actual severity of any submission is decided per §3.

### 4.1 `contracts/payments/PaymentHub.tact`

| Hypothetical PoC | Affected invariant | Severity |
|------------------|---------------------|----------|
| Replay of `executeTransfer` message credits the receiver twice without re-debiting the sender | `I4`, `I5` | 🔴 Critical |
| Reentrancy through `receive(PaymentMessage)` bypasses the reentrancy guard at lines 149–150 | `I4` | 🔴 Critical |
| Gas griefing of `executeTransfer` makes legitimate transfers fail on a tunable subset of inputs | T8 | 🟡 Medium (or 🟠 High if it locks user funds in practice) |

### 4.2 `contracts/MerchantPaymentHub.tact`

| Hypothetical PoC | Affected invariant | Severity |
|------------------|---------------------|----------|
| `checkOwnership()` accepts an off-chain attestation instead of the current on-chain NFT owner | `I1`, `I2` | 🔴 Critical |
| Deployer back-door re-introduces a `setup_account` path that flips ownership | `I3` | 🔴 Critical |
| Settlement path emits the wrong amount field by 1 wei (no loss) | T5 | 🟢 Low |

### 4.3 `contracts/payments/account-locks.fc`

| Hypothetical PoC | Affected invariant | Severity |
|------------------|---------------------|----------|
| `set_lock` mutates `balance` field while toggling lock flags | `I6`, `I5` | 🔴 Critical |
| `risk_authority` can be impersonated to lock arbitrary accounts | T4 | 🟠 High |
| `can_receive()` returns 0 for a locked account, blocking receiving funds (should always be 1) | `I6` | 🟠 High |

### 4.4 `api/`

| Hypothetical PoC | Threat | Severity |
|------------------|--------|----------|
| Cross-merchant IDOR exposes other merchants' invoice data | API-2 | 🟠 High |
| Webhook replay against post-D4 HMAC-SHA256 surface succeeds within the documented window | API-3 | 🟠 High |
| CORS allow-list accepts `null` origin with credentials | API-4 | 🟡 Medium |
| Missing `Strict-Transport-Security` header on non-credentialed health endpoint | API-10 | 🟢 Low |

### 4.5 `backend/indexer/`

| Hypothetical PoC | Threat | Severity |
|------------------|--------|----------|
| Indexer accepts a forged TON HTTP API response and persists it as a confirmed payment | IDX-4, T1 (data integrity) | 🔴 Critical |
| Indexer leaks TON API key in error response | IDX-6 | 🟠 High |
| Pagination cursor allows skipping events for an account | IDX-8 | 🟡 Medium |

### 4.6 `sdk/`

| Hypothetical PoC | Threat | Severity |
|------------------|--------|----------|
| Transitive dependency post-install script overwrites the published widget bundle | SDK-1 | 🔴 Critical |
| Widget DOM renders `description` via `innerHTML` allowing reflected XSS | SDK-3 | 🟠 High |
| Mock helper accidentally shipped in the production bundle | SDK-7 | 🟡 Medium |
| Outdated `peerDependency` range warning without exploit impact | SDK-2 | 🟢 Low |

### 4.7 `wallet-ui/`, `dashboard/`

| Hypothetical PoC | Severity |
|------------------|----------|
| Reflected XSS in dashboard merchant-name display | 🟠 High (escalated from frontend to off-chain band per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §2.1) |
| Wallet UI shows a stale balance under a specific theme + locale | 🟡 Medium |
| Focus indicator hidden in dark theme | 🟢 Low |

---

## 5. References

- [Engagement plan](./ENGAGEMENT.md)
- [Program brief](./PROGRAM_BRIEF.md)
- [Engagement status](./STATUS.md)
- [Dry-run plan](./DRY_RUN.md)
- [Quarterly report template](./QUARTERLY_REPORT_TEMPLATE.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Formal invariants `I1`–`I7`](../../../../audit/INVARIANTS.md)
- [Threat model](../../../../audit/THREAT_MODEL.md)
- [Audit notes (known limitations)](../../../audit-notes.md)
- Immunefi Vulnerability Severity Classification System v2.3 — https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/
