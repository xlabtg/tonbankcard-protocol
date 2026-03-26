---
name: "[A3] Formal Verification of Protocol Invariants"
about: Machine-verified proofs or property-based tests for the 7 core protocol invariants
labels: type:security
track: A
priority: high
---

## 1. Goal

Create machine-verifiable proofs or property-based tests for the seven core protocol invariants (I1–I7) defined in `docs/invariants.md`. At minimum, produce property-based tests integrated into CI for the two highest-risk invariants: I4 (atomic transfers) and I7 (lock enforcement).

## 2. Context

The protocol defines seven correctness invariants in `docs/invariants.md`. These invariants are currently verified by manual code review and functional tests. Formal verification (TLA+, Lean 4) or machine-checked property tests would provide a higher assurance level and are required before the protocol can claim production-grade security.

This task can be pursued in parallel with Track B but should be completed before DAO governance activation (E1).

Related to: [DEVELOPMENT_ROADMAP.md — Track A, A3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

All seven protocol invariants from `docs/invariants.md`:

| ID | Invariant |
|----|-----------|
| I1 | **Non-Custodial**: Only the NFT owner can initiate transfers |
| I2 | **NFT Authority**: NFT ownership is the sole account authority |
| I3 | **No Admin Control**: The deployer cannot move user funds |
| I4 | **Atomic Transfers**: All fund operations are all-or-nothing |
| I5 | **Ledger Conservation**: No fees for internal TBC transfers |
| I6 | **State Integrity**: Account state transitions follow valid state machine rules |
| I7 | **Lock Enforcement**: Locked accounts cannot initiate sends |

**Minimum deliverable**: Property-based tests for I4 and I7 integrated into CI.
**Stretch goal**: TLA+ or Lean 4 formal proofs for I1, I3, I4, I7.

## 4. Out of Scope

- Formal verification of Phase 4 contract-specific logic (bridge replay, multi-sig quorum)
- Economic invariants (fee structure, DEX pricing)
- Off-chain service correctness

## 5. Functional Requirements

1. For each invariant, produce at minimum:
   - A clear, formal statement of the invariant (predicate form)
   - Property-based test cases that attempt to violate the invariant
   - CI integration so violations are caught automatically

2. For I4 (atomicity) and I7 (lock enforcement):
   - Adversarial test scenarios in `tests/adversarial/`
   - Tests cover: message reordering, partial execution, lock bypass attempts

3. For TLA+/Lean 4 formal proofs (stretch):
   - Model covers the state machine defined in `docs/invariants.md`
   - Proofs checked by TLC (TLA+) or Lean 4 type checker
   - Proof artifacts stored in `docs/formal-verification/`

## 6. Non-Functional Requirements

- Property tests must complete in < 60 seconds per invariant in CI
- Formal proofs must be reproducible in a clean environment
- All test tooling must be documented in `CONTRIBUTING.md`

## 7. Security Requirements

- Adversarial test cases must include: replay attacks, race conditions, double-spend attempts
- Property tests must use randomized inputs (not just happy-path values)
- False positives in property tests are unacceptable — each failure must represent a real violation

## 8. Acceptance Criteria

- [ ] Formal predicate statement written for each of I1–I7
- [ ] Property-based test suite created in `tests/invariants/` covering I1–I7
- [ ] Adversarial tests for I4 and I7 in `tests/adversarial/`
- [ ] All property tests passing in CI (`npm test` in root)
- [ ] (Stretch) TLA+ or Lean 4 proofs for I1, I3, I4, I7 stored in `docs/formal-verification/`
- [ ] Documentation updated in `docs/invariants.md` with proof status per invariant

## 9. References

- [Invariants](../docs/invariants.md)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- [Tests — Invariants](../tests/invariants/)
- [Tests — Adversarial](../tests/adversarial/)
- TLA+ tooling: https://lamport.azurewebsites.net/tla/tla.html
- @ton/blueprint property-based testing utilities
