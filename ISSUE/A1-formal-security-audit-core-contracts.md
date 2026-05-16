---
name: "[A1] Formal Security Audit — Core Contracts"
about: Security audit for Phase 2 core smart contracts before mainnet deployment
labels: type:security
track: A
priority: critical
---

## 1. Goal

Engage a TON-specialist audit firm to perform a formal security audit of the Phase 2 core smart contracts. All critical and high-severity findings must be remediated before any mainnet deployment.

## 2. Context

The protocol is feature-complete at the implementation level (all four development phases done). However, **no mainnet deployment should occur before the core contracts pass a professional security audit**. The core contracts handle all user fund routing, NFT ownership verification, and account lock logic.

Related to: [DEVELOPMENT_ROADMAP.md — Track A, A1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

- `contracts/payments/PaymentHub.tact` — Core payment routing and NFT account abstraction
- `contracts/MerchantPaymentHub.tact` — Merchant-facing payment processing
- `contracts/payments/account-locks.fc` — FRAUD_LOCK and COLLATERAL_LOCK flag logic
- `contracts/nft-resolver/` — On-chain NFT ownership resolver (Tact + FunC)
- `contracts/collateral-lookup/PublicCollateralLookup.tact` — Collateral signal read interface
- `contracts/CollateralSignal.tact` — Collateral signal emission

## 4. Out of Scope

- Phase 4 contracts (`CrossChainBridge.tact`, `MultiSigCard.tact`, `RecurringPayments.tact`, `LendingProtocolCoordinator.tact`) — covered by A2
- Off-chain services (`api/`, `backend/`, `sdk/`) — covered by A4
- Governance contracts — covered in Track E

## 5. Threat Model

Key attack vectors to evaluate:

1. **Re-entrancy / message ordering** — TON async message model; out-of-order message delivery
2. **NFT ownership spoofing** — Bypassing NFT verification in `PaymentHub.tact`
3. **Lock bypass** — Circumventing FRAUD_LOCK or COLLATERAL_LOCK to initiate unauthorized transfers
4. **Admin key abuse** — Verify deployer/admin cannot move user funds (invariant I3)
5. **Atomicity failure** — Incomplete fund operations leaving inconsistent state (invariant I4)
6. **Integer overflow/underflow** — Balance and amount calculations in Tact/FunC
7. **Replay attacks** — Duplicate message processing
8. **Gas griefing** — Depleting contracts of TON for gas via cheap messages

## 6. Mitigations Already in Place

- Immutable contracts: no `set_code()` calls, no upgrade proxy pattern
- No admin withdrawal rights (protocol invariant I3)
- All fund operations require user signature via TON Connect
- Protocol invariants documented in `docs/invariants.md`
- Audit readiness documentation at `docs/security/AUDIT_READINESS.md`

## 7. Acceptance Criteria

- [ ] Audit firm engaged and audit scope agreed upon
- [ ] Audit package prepared: contracts + documentation + `docs/security/AUDIT_READINESS.md`
- [ ] All **Critical** findings remediated (zero tolerance)
- [ ] All **High** findings remediated or formally accepted with rationale
- [ ] All **Medium** findings addressed (remediated or formally documented as accepted risk)
- [ ] Audit report published publicly in `docs/security/audits/`
- [ ] Remediation PR merged and re-verified by auditor
- [ ] `docs/security/AUDIT_READINESS.md` updated with audit completion status

## 8. References

- [Invariants](../docs/invariants.md)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- [Key Management](../docs/security/KEY_MANAGEMENT.md)
- [Audit Readiness](../docs/security/AUDIT_READINESS.md)
- [Architecture](../docs/architecture.md)
- Recommended firms: Trail of Bits, CertiK, or TON-ecosystem-specific auditors
