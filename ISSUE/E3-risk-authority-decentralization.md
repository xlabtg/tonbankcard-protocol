---
name: "[E3] Risk Authority Decentralization"
about: Transition the FRAUD_LOCK Risk Authority from a single key to multi-sig or DAO control
labels: type:contract
track: E
priority: medium
---

## 1. Goal

Define the Risk Authority governance structure, transition the FRAUD_LOCK setting capability from a single Risk Authority key to a multi-sig or DAO-controlled mechanism, and establish a transparent fraud detection criteria and lock appeal process.

## 2. Context

The protocol's `FRAUD_LOCK` is currently set by a "Risk Authority" — an implementation detail that likely means a single key controlled by the protocol team. This is a centralization risk: if the Risk Authority key is compromised, an attacker could lock arbitrary user accounts. If the Risk Authority acts maliciously, there is no checks-and-balances mechanism.

Decentralizing the Risk Authority is a key step toward true non-custodial operation.

Related to: [DEVELOPMENT_ROADMAP.md — Track E, E3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Risk Authority Governance Structure
- Define who constitutes the Risk Authority (team multi-sig, DAO committee, etc.)
- Define the criteria for setting FRAUD_LOCK:
  - What on-chain evidence is required?
  - What due process exists before locking?
  - What is the maximum lock duration before appeal is required?

### Transition Plan
- Current: Single Risk Authority key
- Target: Multi-sig Risk Authority (minimum 3-of-5)
- Long-term (optional): DAO-elected Risk Committee with term limits

### Appeal Process
- Users must have a mechanism to appeal FRAUD_LOCK
- Appeal process documented in `docs/governance/FRAUD_LOCK_APPEAL.md`
- Appeal adjudicated by the DAO or a designated committee

### Transparency
- All FRAUD_LOCK events published via `TransparencyRegistry`
- Regular transparency report includes: number of locks, reasons, outcomes of appeals

## 4. Out of Scope

- Changing the technical mechanism of FRAUD_LOCK in the contract (only changing who can call it)
- Removing the FRAUD_LOCK feature (it exists for fraud protection)
- Collateral locks — these are set by the Lending Adapter, not the Risk Authority

## 5. Functional Requirements

1. Risk Authority multi-sig wallet set up (minimum 3-of-5)
2. `contracts/payments/account-locks.fc` updated to verify multi-sig authorization (if technically feasible)
3. `docs/governance/RISK_AUTHORITY.md` documents:
   - Fraud detection criteria
   - Lock procedure
   - Appeal process
   - Multi-sig signers (roles, not identities — e.g., "Protocol Team Lead", "Community Representative")

## 6. Non-Functional Requirements

- Multi-sig must require majority (3-of-5 minimum) to set FRAUD_LOCK
- Lock appeal decisions must be reachable within 7 business days
- All lock/unlock events must be auditable on-chain via TransparencyRegistry

## 7. Security Requirements

- Multi-sig hardware wallets required for all Risk Authority key holders
- Multi-sig key rotation procedure documented in `docs/security/KEY_MANAGEMENT.md`
- No single person can hold more than one signing key in the Risk Authority multi-sig

## 8. Acceptance Criteria

- [ ] E1 (DAO governance activation) complete (prerequisite)
- [ ] Risk Authority multi-sig wallet set up and tested
- [ ] FRAUD_LOCK access control updated to require multi-sig authorization
- [ ] `docs/governance/RISK_AUTHORITY.md` written with full governance structure
- [ ] Appeal process documented and accessible to users
- [ ] `TransparencyRegistry` used to log all FRAUD_LOCK events
- [ ] First transparency report published including lock activity

## 9. References

- [Account Locks](../contracts/payments/account-locks.fc)
- [Transparency Registry](../contracts/governance/TransparencyRegistry.tact)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- [Key Management](../docs/security/KEY_MANAGEMENT.md)
- Issue E1: [E1-dao-governance-activation.md](./E1-dao-governance-activation.md)
- Issue E4: [E4-onchain-transparency-reporting.md](./E4-onchain-transparency-reporting.md)
