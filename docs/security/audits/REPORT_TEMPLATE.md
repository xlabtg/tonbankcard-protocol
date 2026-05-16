# Audit Report — `<ENGAGEMENT-ID>` (Template)

> Auditors: this file is a **template**. Copy it into the engagement directory and rename to `report-v<N>.md` (or attach an equivalent PDF). Replace every `<…>` placeholder. Remove this callout when finalising.

**Engagement ID:** `<A1 / A2 / …>`
**Auditor:** `<firm name>`
**Lead auditor(s):** `<name(s)>`
**Engagement period:** `<YYYY-MM-DD>` → `<YYYY-MM-DD>`
**Audited commit:** `<git hash>`
**Audited tag:** `<git tag, if any>`
**Compiler versions:** Tact `<x.y.z>`, FunC `<x.y.z>`, blueprint `<x.y.z>`
**Report version:** `<N>`
**Report date:** `<YYYY-MM-DD>`
**SHA-256 of this report:** `<hash>`

---

## 1. Executive Summary

`<3–6 paragraphs: scope, methodology summary, overall risk verdict, gating decision (mainnet-ready / blocked).>`

### 1.1 Findings overview

| Severity | Count | Remediated | Accepted as risk | Open |
|----------|-------|------------|------------------|------|
| Critical | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 | 0 |
| Low | 0 | 0 | 0 | 0 |
| Informational | 0 | 0 | 0 | 0 |

### 1.2 Mainnet gating verdict

`<one of: READY / READY WITH ACCEPTED RISKS / BLOCKED>` — `<single-line rationale>`

---

## 2. Scope

### 2.1 In scope

| Contract / file | Lines | Reviewed | Notes |
|-----------------|-------|----------|-------|
| `contracts/payments/PaymentHub.tact` | 0 | yes / no | — |
| `contracts/MerchantPaymentHub.tact` | 0 | yes / no | — |
| `contracts/payments/account-locks.fc` | 0 | yes / no | — |
| `contracts/nft-resolver/nft_account_resolver.fc` | 0 | yes / no | — |
| `contracts/nft-resolver/nft_account_resolver.tact` | 0 | yes / no | — |
| `contracts/collateral-lookup/PublicCollateralLookup.tact` | 0 | yes / no | — |
| `contracts/CollateralSignal.tact` | 0 | yes / no | — |

### 2.2 Out of scope

`<list out-of-scope components and the engagement that covers them, e.g., A2 for Phase 4>`

### 2.3 Methodology

- `<static review tools used>`
- `<dynamic / fuzzing tools used>`
- `<manual review hours per contract>`
- `<which invariants were targeted: I1–I7>`

### 2.4 Reproducibility

Auditors confirm that builds and tests are reproducible per `audit/BUILD_INSTRUCTIONS.md` at the audited commit. Any deviations are listed below.

`<deviations or "none">`

---

## 3. Invariant Attestation

For each protocol invariant, the auditor records whether the audit confirms the invariant holds at the audited commit.

| Invariant | Statement | Holds? | Notes |
|-----------|-----------|--------|-------|
| **I1 — Non-Custodial Ownership** | Only NFT owner can initiate fund transfers | yes / no / partial | `<finding refs>` |
| **I2 — NFT = Account Authority** | NFT ownership is the single source of truth | yes / no / partial | `<finding refs>` |
| **I3 — No Admin Fund Control** | No privileged role can move user funds | yes / no / partial | `<finding refs>` |
| **I4 — Atomic Transfers** | All transfers are all-or-nothing | yes / no / partial | `<finding refs>` |
| **I5 — Ledger Conservation** | Sum of all balances is preserved | yes / no / partial | `<finding refs>` |
| **I6 — Lock ≠ Confiscation** | Locks restrict outgoing transfers; do not seize | yes / no / partial | `<finding refs>` |
| **I7 — External Adapter Isolation** | External providers cannot directly invoke protocol operations | yes / no / partial | `<finding refs>` |

Full invariant definitions: [`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md).

---

## 4. Findings

Each finding follows the canonical structure below. IDs use the form `<ENG-ID>-<severity>-<n>`, e.g., `A1-CRIT-1`.

### 4.x `<ENG-ID>-<severity>-<n>`: `<short title>`

- **Severity:** Critical / High / Medium / Low / Informational
- **Status (auditor's view):** Open / Acknowledged / Fixed / Re-verified
- **Contract / file:** `<path>:<lines>`
- **Invariant(s) at risk:** I1, I2, …
- **Threat-model vector:** `<T1–T8 from audit/THREAT_MODEL.md>`
- **Reproduction:**
  1. `<step>`
  2. `<step>`
- **Description:** `<root cause>`
- **Impact:** `<what an attacker gains>`
- **Recommendation:** `<suggested fix>`
- **References:** `<related findings, prior internal pre-audit IDs>`

---

## 5. Recommendations (Non-finding)

Improvements that are not security findings but raise the protocol's robustness.

| ID | Area | Recommendation |
|----|------|----------------|
| `R-1` | `<area>` | `<recommendation>` |

---

## 6. Auditor Statement

- The auditor confirms that the findings above reflect the audited commit `<git hash>`.
- The auditor has no undisclosed conflict of interest with the protocol team.
- This report may be published in `docs/security/audits/<ENG-ID>/` as written.

`<auditor signature / firm seal block>`

---

## 7. Re-verification (to be appended)

After remediation, the auditor appends a re-verification statement here referencing the remediation commit and confirming the disposition of each finding.

| Finding | Disposition at remediation | Verified commit | Notes |
|---------|----------------------------|------------------|-------|
| `<ID>` | Fixed / Accepted / Mitigated | `<git hash>` | — |

`<re-verification auditor signature block, date>`
