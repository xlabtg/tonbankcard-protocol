# TONBANKCARD Protocol — Regulatory Map

**Document Type:** Compliance Documentation
**Issue Reference:** [#74 — Improvements / Phase 12 — Compliance & Institutional Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_12_compliance.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Important Disclaimer

*This document is for informational purposes only and does not constitute legal advice. The regulatory landscape for blockchain-based financial protocols is rapidly evolving. Operators deploying TONBANKCARD infrastructure must obtain independent legal counsel for their specific jurisdiction and use case.*

---

## Table of Contents

1. [Protocol Classification Summary](#1-protocol-classification-summary)
2. [EU Regulatory Framework (MiCA, PSD2)](#2-eu-regulatory-framework-mica-psd2)
3. [US Regulatory Framework](#3-us-regulatory-framework)
4. [Asia-Pacific Regulatory Framework](#4-asia-pacific-regulatory-framework)
5. [Key Differentiators (Non-Custodial Design)](#5-key-differentiators-non-custodial-design)
6. [AML/KYC Considerations](#6-amlkyc-considerations)
7. [Operator Compliance Checklist](#7-operator-compliance-checklist)

---

## 1. Protocol Classification Summary

TONBANKCARD's regulatory classification is shaped by a single fundamental property: **the protocol is non-custodial**. The protocol software never holds user funds, never acts as a financial intermediary, and never takes custody of assets. This design places it in a different regulatory category than exchanges, custodial wallets, or payment processors.

### Key Classification Factors

| Property | TONBANKCARD | Custodial Exchange | Payment Processor |
|----------|-------------|-------------------|-------------------|
| Holds user funds | **No** | Yes | Temporarily |
| Controls private keys | **No** | Yes | No |
| Executes transactions on behalf of users | **No** (user must sign) | Yes | Yes |
| Settlement finality authority | **On-chain only** | Exchange decides | Provider decides |
| AML/KYC obligation (protocol layer) | **None (see note)** | High | High |

**Note:** Individual operators who build services using the TONBANKCARD protocol may have independent AML/KYC obligations depending on their jurisdiction and the nature of their service. The protocol layer itself does not collect user information.

---

## 2. EU Regulatory Framework (MiCA, PSD2)

### 2.1 Markets in Crypto-Assets Regulation (MiCA)

MiCA (effective 2024–2025) regulates crypto-asset service providers (CASPs) operating in the EU.

**Applicability to TONBANKCARD:**

| MiCA Category | Applies to TONBANKCARD? | Analysis |
|---------------|------------------------|---------|
| Crypto-asset issuance | Potentially (TBC token) | TBC is a utility token issued by the ecosystem; not an asset-referenced or e-money token. Issuer obligations apply to the token issuer, not the protocol. |
| CASP — Custody | **No** | Protocol is non-custodial; never holds user assets. |
| CASP — Exchange | **No** | Protocol does not operate an exchange; DEX is external (TONCO). |
| CASP — Execution of orders | **No** | Protocol facilitates user-initiated transactions; it does not execute orders on behalf of users. |
| CASP — Transfer services | **Potentially, if operating as a business** | Operators providing TBC transfer services commercially should assess CASP transfer service obligations. |

**Operator considerations:**
- Merchants using TONBANKCARD to receive payments should assess whether their activity constitutes a regulated payment service
- The protocol code itself is not a CASP — the protocol is infrastructure
- Operators deploying infrastructure commercially in the EU should seek legal opinion on their specific business model

### 2.2 Payment Services Directive 2 (PSD2)

PSD2 governs payment institutions and electronic money institutions in the EU.

**Applicability to TONBANKCARD:**

| PSD2 Requirement | Relevance | Analysis |
|-----------------|-----------|----------|
| Payment institution license | **None for protocol** | Non-custodial infrastructure is not a payment service provider under PSD2 |
| Strong Customer Authentication (SCA) | Informational | TON wallet signatures provide cryptographic authentication equivalent to or stronger than SCA |
| Transaction data protection | Informational | All transaction data is on public blockchain; privacy is not provided by the protocol |

### 2.3 GDPR (Data Protection)

**Applicability to TONBANKCARD:**

| GDPR Principle | Protocol Position |
|----------------|------------------|
| Personal data processing | The protocol collects no personal data; TON addresses are pseudonymous |
| Right to erasure | Not applicable — blockchain data is immutable by design |
| Data controller obligations | Operators running API/backend services that log user data have GDPR obligations; the protocol itself does not |

**Critical note for operators:** If you log user IP addresses, associate wallet addresses with personal data, or process any off-chain user information, GDPR obligations apply to your service.

---

## 3. US Regulatory Framework

### 3.1 Bank Secrecy Act (BSA) and FinCEN Rules

The Bank Secrecy Act and FinCEN regulations govern money services businesses (MSBs) in the US.

**Applicability to TONBANKCARD:**

| FinCEN Category | Applies? | Analysis |
|----------------|----------|---------|
| Money Transmitter | **Likely no (protocol layer)** | Non-custodial protocol software is not transmitting money; users transmit their own funds via signed transactions |
| Convertible Virtual Currency Exchange | **No** | Protocol does not exchange CVCs; DEX is external |
| Administrator of CVC | **No** | TBC token issuer is separate; protocol does not administer TBC |

**FinCEN 2019/2022 Guidance on Decentralized Applications (DApps):**
FinCEN has indicated that developers of decentralized, non-custodial infrastructure generally do not qualify as MSBs when:
1. The developer does not control funds
2. The developer does not facilitate transactions (user must initiate)
3. The software is open-source and permissionless

TONBANKCARD meets all three criteria at the protocol layer.

**Operator considerations:**
- Operators running custodial services (e.g., a hosted wallet on top of TONBANKCARD) would qualify as MSBs
- Merchants receiving payments must assess their own payment receipt classification
- This guidance applies to US persons and entities; foreign persons may have different rules

### 3.2 Securities Laws (SEC)

**Applicability to TONBANKCARD:**

| SEC Area | Relevance |
|----------|-----------|
| TBC Token | Not analyzed here (token issuer responsibility) |
| NFT Cards | NFTs representing account access may have securities law implications; analysis required per series |
| Protocol operations | Settlement infrastructure is not a security or investment contract |

**Operator guidance:** Any NFT launch, token sale, or investment-related offering should obtain independent securities counsel.

### 3.3 State Money Transmission Laws

US state laws vary significantly. Operators offering services to US residents should assess state-by-state money transmission licensing requirements. States with stricter rules include New York (BitLicense) and California.

---

## 4. Asia-Pacific Regulatory Framework

### 4.1 Singapore (MAS)

The Monetary Authority of Singapore (MAS) regulates digital payment token services under the Payment Services Act (PSA).

**Applicability to TONBANKCARD:**

| PSA Category | Applies? | Analysis |
|-------------|----------|---------|
| Digital Payment Token Service | Potentially for operators | Operators facilitating DPT exchange or transfer in Singapore may need a Major/Standard Payment Institution license |
| E-money issuance | **No** | TBC is not e-money (no fiat peg) |
| Non-custodial infrastructure | **Generally excluded** | The protocol code itself does not constitute a licensed activity; operator services do |

**MAS Travel Rule:** FATF Travel Rule requirements apply to digital payment token service providers in Singapore. Operators subject to PSA must implement Travel Rule compliance (sender/receiver identity information for transactions above SGD 1,500).

### 4.2 Hong Kong (HKMA/SFC)

Hong Kong's VASP (Virtual Asset Service Provider) licensing regime under the VAASPD applies to exchanges and certain service providers.

| Area | Relevance |
|------|-----------|
| VASP license | Applies to virtual asset exchanges; non-custodial protocol does not operate an exchange |
| SFC licensing | Investment-related activities require SFC licensing; settlement protocol does not |

### 4.3 Japan (FSA)

Japan's Payment Services Act requires registration for crypto asset exchange services.

**Analysis:** A non-custodial settlement protocol that does not exchange crypto assets does not require registration. Operators providing exchange-adjacent services to Japanese users should assess independently.

### 4.4 Other Jurisdictions

The following jurisdictions have notable DeFi/DApp regulations that operators should review:

| Jurisdiction | Key Regulation | Operator Action |
|-------------|----------------|----------------|
| UAE/ADGM | FSRA Virtual Asset framework | Review if operating in UAE |
| South Korea | Virtual Asset User Protection Act | Review VAUPA obligations |
| Australia | ASIC crypto guidance | Review if providing financial services |
| Switzerland | FINMA DLT guidance | Generally permissive for non-custodial |

---

## 5. Key Differentiators (Non-Custodial Design)

TONBANKCARD's non-custodial architecture creates significant regulatory advantages:

| Regulatory Burden | Custodial Service | TONBANKCARD Protocol |
|-------------------|-------------------|---------------------|
| AML/KYC on users | REQUIRED | **Not required at protocol layer** |
| Transaction monitoring | REQUIRED | Not required at protocol layer |
| Capital/reserve requirements | Often required | **Not applicable** |
| Incident/liability exposure | High (custodian of funds) | **Low (no custody)** |
| Data protection obligations | High (user data collected) | **Minimal (no user data)** |

**However:** This does not mean operators using TONBANKCARD are exempt from all obligations. An operator building a custodial layer, fiat ramp, or exchange service on top of the protocol inherits regulatory obligations for those layers.

---

## 6. AML/KYC Considerations

### 6.1 Protocol Layer

The TONBANKCARD protocol does not:
- Collect user identity information
- Monitor transactions for AML purposes
- Report to financial intelligence units
- Screen users against sanctions lists

This is by design (non-custodial, pseudonymous).

### 6.2 Operator Layer

Operators who provide regulated services using the protocol (e.g., fiat on-ramps, custodial wallets, financial services) are responsible for:
- KYC verification of their users
- AML transaction monitoring within their service layer
- OFAC/sanctions screening where required
- Suspicious activity reporting per local laws

### 6.3 External Adapter Obligations

The external adapters (ChangeNOW, NOWPayments, CoinRabbit) are independent businesses with their own compliance programs. Operators using these services must comply with those services' KYC/AML requirements.

---

## 7. Operator Compliance Checklist

The following checklist assists operators in assessing their compliance obligations. **This is not legal advice.**

### For All Operators

- [ ] Determine your jurisdiction(s) of operation
- [ ] Obtain independent legal opinion on your specific business model
- [ ] Assess whether your service is custodial (high obligations) or non-custodial (lower obligations)
- [ ] Review AML/KYC obligations for your jurisdiction
- [ ] Implement Travel Rule compliance if required by jurisdiction
- [ ] Review data protection obligations (GDPR, PDPA, etc.)
- [ ] Monitor regulatory developments in your jurisdiction

### For Merchant Operators

- [ ] Assess whether receiving TBC payments constitutes regulated activity in your jurisdiction
- [ ] Implement invoice deduplication to prevent replay issues
- [ ] Disclose accepted payment methods and token types to customers
- [ ] Consider VAT/GST obligations on transactions received in TBC
- [ ] Display merchant NFT address clearly for customer verification

### For Institutional Operators

- [ ] Engage compliance counsel specializing in crypto/digital assets
- [ ] Implement internal AML/CTF program if providing financial services
- [ ] Review MiCA CASP requirements (EU), MSB requirements (US), or equivalent
- [ ] Implement Transaction Monitoring for unusual patterns
- [ ] Establish escalation procedures for suspicious activity

---

## References

- **Legal Risk Model:** [`docs/compliance/LEGAL_RISK_MODEL.md`](LEGAL_RISK_MODEL.md)
- **Merchant Compliance Guide:** [`docs/compliance/MERCHANT_COMPLIANCE_GUIDE.md`](MERCHANT_COMPLIANCE_GUIDE.md)
- **Security Framework:** [`docs/security/SECURITY.md`](../security/SECURITY.md)
- **Full System Audit:** [`docs/audit/FULL_SYSTEM_AUDIT.md`](../audit/FULL_SYSTEM_AUDIT.md)
- **External:** [MiCA Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1114), [FinCEN Guidance on DApps](https://www.fincen.gov/)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
