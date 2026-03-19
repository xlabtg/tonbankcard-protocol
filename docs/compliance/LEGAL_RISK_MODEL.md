# TONBANKCARD Protocol — Legal Risk Model

**Document Type:** Compliance Documentation
**Issue Reference:** [#74 — Improvements / Phase 12 — Compliance & Institutional Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_12_compliance.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Important Disclaimer

*This document is for informational purposes only and does not constitute legal advice. Consult independent legal counsel for your specific jurisdiction and circumstances.*

---

## Table of Contents

1. [Objective](#1-objective)
2. [Legal Exposure Boundaries](#2-legal-exposure-boundaries)
3. [Protocol-Level Risks](#3-protocol-level-risks)
4. [Operator-Level Risks](#4-operator-level-risks)
5. [Risk Classification Matrix](#5-risk-classification-matrix)
6. [Liability Boundaries](#6-liability-boundaries)
7. [Mitigation Strategies](#7-mitigation-strategies)

---

## 1. Objective

This document defines the legal exposure boundaries for the TONBANKCARD protocol. It separates protocol-layer risks from operator-layer risks and defines what the protocol can and cannot be held responsible for.

---

## 2. Legal Exposure Boundaries

The non-custodial, immutable design of TONBANKCARD creates clear boundaries between:

1. **Protocol Layer:** The smart contract code and its defined behavior
2. **Operator Layer:** Businesses and services built using the protocol
3. **User Layer:** Individual users interacting with the protocol

Legal exposure is concentrated at the operator and user layers, not at the protocol layer.

### Boundary Diagram

```
┌─────────────────────────────────────────────────────────┐
│ PROTOCOL LAYER                                          │
│ (smart contracts, open source code)                     │
│ • No user data collected                                │
│ • No custody of funds                                   │
│ • No control over user transactions                     │
│ Legal exposure: Minimal (code publication risk only)    │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ OPERATOR LAYER                                          │
│ (merchants, service providers, infrastructure operators)│
│ • May hold user funds (if custodial service built)      │
│ • May collect user data                                 │
│ • May provide regulated financial services              │
│ Legal exposure: HIGH (jurisdiction-dependent)           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ USER LAYER                                              │
│ • Controls own private keys                             │
│ • Initiates all transactions                            │
│ • Responsible for own regulatory compliance             │
│ Legal exposure: SELF-SOVEREIGN                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Protocol-Level Risks

### 3.1 Open Source Code Publication

**Risk:** Publication of smart contract source code and SDK could be subject to export control regulations or code publication restrictions.

**Assessment:** LOW — Standard open-source software publication. No weapons-grade cryptography. TON SDK libraries are publicly distributed. Protocol code implements standard financial protocol patterns.

**Mitigation:** No specific action required for protocol-layer code publication.

### 3.2 Protocol Bugs and User Losses

**Risk:** A bug in the protocol smart contracts could result in user fund losses.

**Assessment:** MEDIUM — Smart contracts are immutable; bugs cannot be patched in deployed contracts. New contracts can be deployed; migration is voluntary.

**Mitigation:** Formal audit, comprehensive testing, conservative deployment schedule. Pre-production gap remediation (see `docs/audit/FULL_SYSTEM_AUDIT.md`).

**Liability boundary:** The protocol is provided as-is, without warranty. Users deploying or using the protocol accept the inherent risks of immutable smart contract software.

### 3.3 Regulatory Classification Changes

**Risk:** Regulators in key jurisdictions could reclassify non-custodial protocols as regulated activities.

**Assessment:** MEDIUM — Regulatory landscape is evolving. DeFi regulation is an active area globally.

**Mitigation:** Monitor regulatory developments. The protocol's non-custodial design positions it favorably under most current frameworks.

---

## 4. Operator-Level Risks

### 4.1 Money Services Business Classification

**Risk:** Operating TBC transfer services commercially may qualify as a money services business (MSB) or equivalent in some jurisdictions.

**Applicable jurisdictions:** US (FinCEN), EU (MiCA), Singapore (PSA), and others.

**Assessment:** MEDIUM for commercial operators — depends heavily on specific service model and jurisdiction.

**Action for operators:** Obtain legal opinion for your specific business model and jurisdiction before offering services commercially.

### 4.2 Securities Law Risk

**Risk:** NFT Cards or TBC token could be classified as securities in some jurisdictions (e.g., if marketed as investments).

**Assessment:** MEDIUM — Depends on how NFTs and tokens are marketed and what rights they convey.

**Action for operators:** Avoid marketing NFT Cards or TBC as investments. Emphasize utility (account access, settlement medium). Obtain securities law advice for any offering.

### 4.3 AML/CTF Compliance

**Risk:** Operators providing financial services using the protocol may have AML/CTF obligations they fail to meet.

**Assessment:** HIGH for commercial operators providing fiat ramps, custodial wallets, or exchange services.

**Action for operators:** Implement AML/KYC programs appropriate to your service. See `docs/compliance/MERCHANT_COMPLIANCE_GUIDE.md`.

### 4.4 Consumer Protection Law

**Risk:** Users may have claims under consumer protection laws if services built on the protocol fail to deliver.

**Assessment:** LOW for protocol layer (no consumer relationship). MEDIUM for service operators.

**Action for operators:** Clearly disclose service terms, limitations, and non-custodial nature. Do not make guarantees of availability or price stability.

### 4.5 Tax Obligations

**Risk:** Transactions using TBC may be taxable events in various jurisdictions.

**Assessment:** HIGH for users and operators in many jurisdictions (crypto-to-crypto exchange is taxable in many countries).

**Operator responsibility:** Provide transaction records to users for tax reporting purposes. Do not provide tax advice.

---

## 5. Risk Classification Matrix

| Risk ID | Risk | Likelihood | Severity | Layer | Priority |
|---------|------|-----------|----------|-------|----------|
| LR-1 | Code publication liability | LOW | LOW | Protocol | Monitor |
| LR-2 | Protocol bug user losses | MEDIUM | HIGH | Protocol | Mitigate (audits) |
| LR-3 | Regulatory reclassification | MEDIUM | HIGH | Protocol | Monitor |
| LR-4 | MSB classification | MEDIUM | HIGH | Operator | Operator action |
| LR-5 | Securities classification | MEDIUM | CRITICAL | Operator/Token | Legal counsel |
| LR-6 | AML/CTF non-compliance | MEDIUM | CRITICAL | Operator | Operator action |
| LR-7 | Consumer protection claims | LOW | MEDIUM | Operator | Disclose properly |
| LR-8 | Tax non-compliance | HIGH | MEDIUM | User/Operator | Record-keeping |

---

## 6. Liability Boundaries

### What the Protocol Is Not Liable For

The protocol (and its developers) explicitly disclaim liability for:

1. **External adapter failures** — ChangeNOW, NOWPayments, CoinRabbit are independent businesses
2. **Market price fluctuations** — TBC token price is determined by market supply/demand
3. **User private key loss** — non-custodial design means key management is user's responsibility
4. **Merchant disputes** — the protocol is neutral on delivery of goods/services
5. **Regulatory violations by operators** — operators are responsible for their own compliance
6. **Smart contract bugs** — provided as-is; formal audit reduces but does not eliminate risk
7. **TON blockchain failures** — the protocol depends on TON consensus

### What Operators Are Responsible For

Operators must independently ensure:

1. **Regulatory compliance** in their jurisdiction for their specific service
2. **AML/KYC obligations** if providing regulated financial services
3. **User fund protection** if operating custodial layers
4. **Consumer protection** compliance for their service
5. **Tax reporting** support for their users
6. **Data protection** compliance for user data they collect

---

## 7. Mitigation Strategies

### For Protocol Developers

1. Maintain comprehensive documentation of non-custodial properties
2. Publish formal security audits publicly
3. Clearly disclaim warranties and provide terms-of-use for any infrastructure operated
4. Monitor regulatory developments and update documentation accordingly
5. Engage compliance counsel when launching products commercially

### For Operators

1. Conduct legal analysis before commercial launch in each target jurisdiction
2. Implement AML/KYC appropriate to your service
3. Clearly disclose the non-custodial nature of the underlying protocol
4. Do not use language suggesting the protocol provides guarantees of value, security, or availability
5. Maintain transaction logs for compliance and tax reporting purposes
6. Implement Terms of Service appropriate to your business

### Recommended Disclosures

All operator-facing products should include disclosures substantially similar to:

> *This service uses the TONBANKCARD non-custodial protocol. Transactions are executed by you via your own cryptographic keys. Neither the protocol nor this service holds custody of your assets. All on-chain transactions are final and irreversible. Virtual asset regulation varies by jurisdiction; you are responsible for compliance with applicable laws in your location.*

---

## References

- **Regulatory Map:** [`docs/compliance/REGULATORY_MAP.md`](REGULATORY_MAP.md)
- **Merchant Compliance Guide:** [`docs/compliance/MERCHANT_COMPLIANCE_GUIDE.md`](MERCHANT_COMPLIANCE_GUIDE.md)
- **Security Framework:** [`docs/security/SECURITY.md`](../security/SECURITY.md)
- **Architecture:** [`docs/architecture.md`](../architecture.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
