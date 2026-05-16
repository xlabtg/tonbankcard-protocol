---
name: "[A5] Bug Bounty Program"
about: Set up a public bug bounty program (Immunefi or HackenProof) for the protocol
labels: type:security
track: A
priority: medium
---

## 1. Goal

Launch a public bug bounty program on Immunefi or HackenProof to enable the security research community to responsibly disclose vulnerabilities in the protocol. This provides continuous security coverage beyond point-in-time audits.

## 2. Context

The protocol already has a responsible disclosure framework in `SECURITY.md`. A formal bug bounty program extends this by providing financial incentives for researchers, a standardized submission process, and public transparency about the scope and rewards.

This should be launched **after** A1 and A2 audits are complete and known issues have been remediated — to avoid rewarding researchers for findings the team is already aware of.

Related to: [DEVELOPMENT_ROADMAP.md — Track A, A5](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Bounty Scope
**Highest Severity (smart contracts)**:
- `contracts/payments/PaymentHub.tact`
- `contracts/MerchantPaymentHub.tact`
- `contracts/payments/account-locks.fc`
- `contracts/nft-resolver/`
- `contracts/CrossChainBridge.tact` (after A2 audit)
- `contracts/MultiSigCard.tact` (after A2 audit)

**Medium Severity (off-chain services)**:
- `api/` (Merchant API)
- `backend/indexer/`
- `sdk/` (npm package, client-side widget)

**Lower Severity (frontend)**:
- `wallet-ui/`
- `dashboard/`

## 4. Out of Scope

- Theoretical vulnerabilities without a proof-of-concept
- Issues in third-party dependencies (ChangeNOW, NOWPayments, CoinRabbit) — report to those vendors
- Social engineering attacks against team members
- Physical security
- Denial of service via flooding (unless causing fund loss)

## 5. Functional Requirements

1. Select a bug bounty platform: Immunefi (preferred for DeFi) or HackenProof
2. Define reward tiers:

| Severity | Smart Contract | Off-Chain Service |
|----------|---------------|-------------------|
| Critical | $10,000+ | $5,000 |
| High | $5,000 | $2,500 |
| Medium | $1,000 | $500 |
| Low | $100 | $100 |

3. Program terms must include:
   - 90-day fix window for critical/high before public disclosure
   - Researcher is prohibited from exploiting vulnerabilities in production
   - Good faith testing on testnet only

4. Response SLA:
   - Initial triage: 3 business days
   - Severity classification: 7 business days
   - Payment: within 30 days of fix deployment

## 6. Non-Functional Requirements

- Program page must be publicly accessible and link from `SECURITY.md`
- All submissions handled via the bounty platform (not email) for transparency
- Public statistics: number of reports, resolved, paid — updated quarterly

## 7. Security Requirements

- Audits A1 and A2 must be complete before program launch to avoid paying for known issues
- Program must explicitly prohibit live mainnet exploitation (testnet testing only)
- Researcher submissions must not include private keys or wallet credentials

## 8. Acceptance Criteria

- [ ] A1 and A2 audits completed (prerequisite)
- [ ] Bug bounty platform account created and verified
- [ ] Program brief published on platform with full scope and reward tiers
- [ ] `SECURITY.md` updated with link to bug bounty program page
- [ ] First quarterly transparency report published (including bounty program statistics)
- [ ] At least one dry-run internal submission tested through the process

## 9. References

- [SECURITY.md](../SECURITY.md)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- Immunefi: https://immunefi.com
- HackenProof: https://hackenproof.com
- Issue A1: [A1-formal-security-audit-core-contracts.md](./A1-formal-security-audit-core-contracts.md)
- Issue A2: [A2-formal-security-audit-phase4-contracts.md](./A2-formal-security-audit-phase4-contracts.md)
