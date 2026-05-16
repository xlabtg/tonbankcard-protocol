# TONBANKCARD — External Security Audits

**Document Type:** Index — External Security Audits
**Issue References:**
- [#112 — A1 Formal Security Audit — Core Contracts](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
- [#113 — A2 Formal Security Audit — Phase 4 Contracts](https://github.com/xlabtg/tonbankcard-protocol/issues/113)
- [#115 — A4 Penetration Testing — Off-Chain Services](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
**Track:** A — Security & Audit ([DEVELOPMENT_ROADMAP.md](../../../TEMP/DEVELOPMENT_ROADMAP.md))
**Status:** Active
**Last Updated:** 2026-05-16

---

## 1. Purpose

This directory tracks every **external security engagement** performed on the TONBANKCARD protocol. It is the canonical location for:

- Audit engagement plans (RFP-style)
- Auditor selection records
- Frozen audit packages handed over to auditors
- Audit reports as delivered by external firms
- Remediation pull requests and re-audit attestations
- Public disclosure artifacts

Internal pre-audit reviews (such as [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md)) and the system-level audit ([`docs/audit/FULL_SYSTEM_AUDIT.md`](../../audit/FULL_SYSTEM_AUDIT.md)) live elsewhere — this directory is reserved for **third-party** engagements that gate mainnet deployment.

---

## 2. Directory Layout

```
docs/security/audits/
├── README.md                       — This index
├── REMEDIATION_WORKFLOW.md         — How findings are triaged, fixed, and verified
├── REPORT_TEMPLATE.md              — Canonical layout for incoming audit reports
├── A1-core-contracts/              — Issue #112 engagement
│   ├── ENGAGEMENT.md               — Scope, deliverables, candidate firms, evaluation matrix
│   └── STATUS.md                   — Live state of the engagement (firm, dates, findings)
├── A2-phase4-contracts/            — Issue #113 engagement (gated by A1 completion)
│   ├── ENGAGEMENT.md               — Phase 4 scope with dedicated cross-chain bridge review
│   └── STATUS.md                   — Live state, A1 upstream-gate tracker, threat-ID ledger
└── A4-offchain-services/           — Issue #115 engagement (off-chain pentest)
    ├── ENGAGEMENT.md               — api/ + backend/indexer/ + sdk/ pentest scope, OWASP-driven
    ├── STATUS.md                   — Live state, D4/D5 upstream-gate tracker, OWASP coverage
    ├── OWASP_CHECKLIST.md          — OWASP Top 10:2021 category-by-category required tests
    └── PENTEST_PLAN.md             — Detailed per-component test cases, PoC expectations
```

Future engagements (A5 bug bounty, etc.) are added as sibling folders named after the roadmap ID.

---

## 3. Engagement Index

| ID | Scope | Roadmap | Issue | Status | Firm | Report |
|----|-------|---------|-------|--------|------|--------|
| **A1** | Core contracts (PaymentHub, MerchantPaymentHub, account-locks, nft-resolver, collateral signal) | [A1](../../../TEMP/DEVELOPMENT_ROADMAP.md) | [#112](https://github.com/xlabtg/tonbankcard-protocol/issues/112) | Engagement preparation complete — awaiting firm selection | — | — |
| **A2** | Phase 4 contracts (CrossChainBridge, MultiSigCard, RecurringPayments, LendingProtocolCoordinator) | [A2](../../../TEMP/DEVELOPMENT_ROADMAP.md) | [#113](https://github.com/xlabtg/tonbankcard-protocol/issues/113) | Engagement preparation complete — awaiting A1 completion and firm selection | — | — |
| **A4** | Off-chain services (`api/`, `backend/indexer/`, `sdk/`) | [A4](../../../TEMP/DEVELOPMENT_ROADMAP.md) | [#115](https://github.com/xlabtg/tonbankcard-protocol/issues/115) | Engagement preparation complete — awaiting D4 hardening and firm selection | — | — |
| A5 | Bug bounty program | A5 | TBD | Not started | — | — |

When a new external engagement begins, copy `A1-core-contracts/` as a starting template, update its `ENGAGEMENT.md` for the new scope, and add a row to this table.

---

## 4. Gating Rules

The following rules are **non-negotiable** and apply to every engagement listed in §3:

1. **No mainnet deployment** of any in-scope contract before the corresponding audit report is published and remediation is verified by the auditor.
2. **Critical findings:** zero tolerance — every Critical must be remediated and re-verified before sign-off.
3. **High findings:** remediated, or formally accepted with rationale signed off by the maintainers in `STATUS.md`.
4. **Medium findings:** remediated or documented as accepted risk in `docs/audit-notes.md`.
5. **Audit report is public** — published in this directory and linked from `docs/security/AUDIT_READINESS.md`.
6. **Frozen scope** — once an engagement is signed, the contract set under audit is frozen at a specific commit (see [`audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md)).

---

## 5. Where Auditors Should Start

External auditors engaging with TONBANKCARD should read, in order:

1. [`docs/audit/external-audit-intro.md`](../../audit/external-audit-intro.md) — protocol intent and constraints
2. [`audit/SCOPE.md`](../../../audit/SCOPE.md) — contracts in scope, focus areas
3. [`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md) — formal invariants I1–I7
4. [`audit/THREAT_MODEL.md`](../../../audit/THREAT_MODEL.md) — attack vectors and mitigations
5. [`audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md) — frozen commit, compiler versions
6. [`audit/BUILD_INSTRUCTIONS.md`](../../../audit/BUILD_INSTRUCTIONS.md) — reproducible build
7. [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) — known findings from internal pre-audit
8. Engagement-specific `ENGAGEMENT.md` in the relevant subdirectory

The [`docs/security/AUDIT_READINESS.md`](../AUDIT_READINESS.md) document is the navigation hub for all of the above.

---

## 6. References

- [Audit Readiness](../AUDIT_READINESS.md)
- [Audit Scope](../../../audit/SCOPE.md)
- [Formal Invariants](../../../audit/INVARIANTS.md)
- [Threat Model](../../../audit/THREAT_MODEL.md)
- [Internal Per-Contract Audit](../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md)
- [Full System Audit](../../audit/FULL_SYSTEM_AUDIT.md)
- [Development Roadmap — Track A](../../../TEMP/DEVELOPMENT_ROADMAP.md)
