---
name: "[A2] Formal Security Audit — Phase 4 Contracts"
about: Security audit for Phase 4 advanced smart contracts (cross-chain, multi-sig, lending, recurring payments)
labels: type:security
track: A
priority: critical
---

## 1. Goal

Conduct a separate, dedicated formal security audit of the four Phase 4 advanced smart contracts. These contracts introduce higher-risk patterns (cross-chain message passing, multi-party signing, time-based scheduling) and must be audited independently from the core contracts.

## 2. Context

Phase 4 contracts exist in the repository as implementation baselines but are **not yet audited or deployed** to mainnet. The cross-chain bridge in particular represents the highest-risk component due to potential bridge validator compromise scenarios and cross-chain message replay.

This audit should only begin **after** A1 (core contract audit) is complete and the audit firm has full context of the protocol invariants.

Related to: [DEVELOPMENT_ROADMAP.md — Track A, A2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

- `contracts/CrossChainBridge.tact` — Cross-chain asset transfers between TON and EVM chains
- `contracts/MultiSigCard.tact` — Multi-party account control (M-of-N signing)
- `contracts/RecurringPayments.tact` — Subscription and time-based recurring payment flows
- `contracts/LendingProtocolCoordinator.tact` — External lending protocol coordination

## 4. Out of Scope

- Core Phase 2 contracts — covered by A1
- Off-chain services — covered by A4
- Bridge validator infrastructure (external to this repository)

## 5. Threat Model

### CrossChainBridge.tact
1. **Cross-chain message replay** — Identical message replayed on source or destination chain
2. **Bridge validator compromise** — Malicious or colluding validator set approving invalid transfers
3. **Double-spend on bridge** — Asset credited on destination before confirmed burned on source
4. **TVL drain via oracle manipulation** — Incorrect price/amount conversion
5. **Chain reorganization handling** — Source-chain reorg invalidating a bridged transfer

### MultiSigCard.tact
1. **Signature replay** — Reusing valid signatures from prior M-of-N approvals
2. **Quorum manipulation** — Signer set modification without full quorum consent
3. **Partial execution** — Partially completing a multi-sig operation leaving locked funds

### RecurringPayments.tact
1. **Time manipulation** — Exploiting block timestamp for early/repeated payment triggers
2. **Subscription cancellation race** — Payment executed during cancellation window
3. **Balance exhaustion griefing** — Forcing repeated failed payments to drain gas

### LendingProtocolCoordinator.tact
1. **Collateral lock bypass** — Releasing COLLATERAL_LOCK while loan is active
2. **Oracle price manipulation** — Exploiting stale collateral price signals
3. **Flash loan attack** — Rapidly opening/closing collateral positions

## 6. Mitigations Already in Place

- Contracts inherit the protocol's non-custodial guarantee (invariant I1–I7)
- Account lock system (`COLLATERAL_LOCK`) guards lending positions
- Documentation in `docs/` covers intended behavior

## 7. Acceptance Criteria

- [ ] A1 audit completed and core contracts cleared before this audit begins
- [ ] Separate audit engagement from core contract audit
- [ ] Cross-chain bridge receives **dedicated review** with replay and validator scenarios
- [ ] All **Critical** findings remediated
- [ ] All **High** findings remediated or formally accepted with rationale
- [ ] Audit report published in `docs/security/audits/`
- [ ] Remediation PRs merged and re-verified by auditor

## 8. References

- [CrossChainBridge.tact](../contracts/CrossChainBridge.tact)
- [MultiSigCard.tact](../contracts/MultiSigCard.tact)
- [RecurringPayments.tact](../contracts/RecurringPayments.tact)
- [LendingProtocolCoordinator.tact](../contracts/LendingProtocolCoordinator.tact)
- [Invariants](../docs/invariants.md)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- Issue A1: [A1-formal-security-audit-core-contracts.md](./A1-formal-security-audit-core-contracts.md)
