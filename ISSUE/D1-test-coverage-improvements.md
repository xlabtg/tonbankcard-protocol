---
name: "[D1] Test Coverage Improvements"
about: Achieve target coverage thresholds, add adversarial tests, and add fuzz testing for critical contract functions
labels: type:contract
track: D
priority: high
---

## 1. Goal

Bring all packages to their coverage targets (80% for contracts, 70% for indexer), identify and fill critical coverage gaps, add adversarial test cases for replay/race/double-spend scenarios, and add fuzz testing for key contract entry points.

## 2. Context

Coverage thresholds are set in configuration (70% for indexer, 80% for contract tests) but the actual current coverage is unknown. The `tests/adversarial/` directory exists but may have incomplete scenarios. No fuzz testing is currently in place for contracts.

Low coverage in high-risk areas (payment processing, lock logic) is a security risk. Inadequate adversarial tests mean exploitable edge cases may go undetected.

Related to: [DEVELOPMENT_ROADMAP.md — Track D, D1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Coverage Measurement
- Run full coverage report for all packages and publish results
- Identify files/functions below threshold
- Priority targets for improvement:
  - `sdk/src/sdk.ts` — main SDK entry point
  - `api/src/services/InvoiceService.ts` — core business logic
  - `backend/indexer/src/` — event parsing and storage

### Adversarial Test Cases (`tests/adversarial/`)
- Replay attack: same payment message processed twice
- Race condition: concurrent lock set/unset operations
- Double-spend attempt: same balance spent via two simultaneous invoices
- Lock bypass: attempt to send from a FRAUD_LOCK'd account
- NFT spoofing: attempt payment with NFT not in the whitelist

### Contract Fuzz Testing
- Fuzz entry points: `PaymentHub.tact` — `transfer()`, `lockAccount()`, `unlockAccount()`
- Tool: `@ton/sandbox` property-based test utilities or `tact-fuzz` if available
- Fuzz targets: amount boundaries, address edge cases, state machine transitions
- Acton fuzz, mutation, or coverage tooling may be used only after the D6 tooling evaluation confirms a compatible Tolk/Acton path for the relevant contract module

## 4. Out of Scope

- Formal verification (covered by A3)
- Performance/load testing (covered by B3 monitoring)
- New functional features

## 5. Functional Requirements

1. Coverage reports generated and stored in CI artifacts for each PR
2. All packages at or above their coverage thresholds:
   - Contract tests: ≥ 80%
   - Indexer: ≥ 70%
   - SDK: ≥ 75%
   - Merchant API: ≥ 75%
3. `tests/adversarial/` contains at minimum the 5 scenarios listed above
4. Fuzz tests run as part of the `test-contracts` CI job

## 6. Non-Functional Requirements

- Coverage report generation must not increase CI time by > 2 minutes
- All new tests must pass in < 60 seconds each
- Fuzz tests must have a bounded run time (e.g., 30 seconds of fuzzing per target in CI)
- Adversarial tests must have descriptive names explaining the attack scenario

## 7. Security Requirements

- Adversarial tests must not use mocked blockchain — they must use `@ton/sandbox` with real contract execution
- Fuzz inputs must include: zero values, `MAX_UINT` values, empty strings, maximum-length strings
- All adversarial test failures must be treated as security-relevant findings

## 8. Acceptance Criteria

- [ ] Coverage report generated for all packages and committed to `docs/coverage-report.md`
- [ ] All packages at or above target coverage thresholds
- [ ] 5+ adversarial test scenarios added to `tests/adversarial/`
- [ ] Fuzz tests added for `PaymentHub.tact` entry points
- [ ] All new tests passing in CI
- [ ] CI configured to fail if coverage drops below threshold

## 9. References

- [Tests](../tests/)
- [Tests — Adversarial](../tests/adversarial/)
- [Invariants](../docs/invariants.md)
- [Contracts](../contracts/)
- @ton/sandbox documentation
- Acton/Tolk tooling evaluation: [D6](./D6-acton-toolchain-evaluation.md)
