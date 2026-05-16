---
name: "[D6] Acton Toolchain Evaluation"
about: Evaluate Acton/Tolk tooling for TON contract testing, profiling, deployment, verification, and possible migration
labels: type:tooling, track:D, priority:medium
track: D
priority: medium
---

## 1. Goal

Evaluate whether Acton should be adopted alongside or in place of the current Tact/FunC + TypeScript tooling for TON smart contract development, and produce an explicit adoption or non-adoption decision before broad contract hardening work depends on it.

## 2. Context

Acton is an all-in-one TON smart contract toolchain built around Tolk. It provides native contract tests, fuzz testing, mutation testing, coverage reports, gas snapshots, debugging, deployment, source verification, and CI integration.

The current Tonbankcard Protocol codebase is primarily Tact and FunC with TypeScript-based tests and deployment scripts. Acton may improve future contract work, especially for testing, gas profiling, and deployment workflows, but it is not a drop-in replacement for existing Tact contracts. Adoption must therefore be evaluated as an explicit tooling decision, not introduced implicitly in unrelated implementation issues.

This task should inform D1, D2, A3, B1, and B2 before large-scale contract testing, profiling, deployment, or verification work is standardized.

Related to: [DEVELOPMENT_ROADMAP.md — Track D](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Current Tooling Inventory
- Document the current contract stack:
  - Tact contracts (`contracts/**/*.tact`)
  - FunC helpers (`contracts/**/*.fc`)
  - TypeScript/Jest tests
  - `@ton/sandbox` usage
  - deployment scripts in `scripts/deploy/`
  - CI contract test job

### Acton Capability Review
- Evaluate Acton for:
  - native Tolk tests
  - fuzz testing
  - mutation testing
  - coverage reports
  - gas profiling with snapshots
  - deployment scripting
  - source verification
  - CI integration
  - AI-agent workflow support

### Compatibility Prototype
- Install Acton using a pinned release version or the published Docker image.
- Run `acton init` only in an isolated experiment branch or `experiments/acton/` sandbox.
- Prototype one low-risk path:
  - migrate or model a small FunC helper in Tolk, or
  - create a minimal Tolk harness that models one existing contract invariant.
- Compare resulting developer workflow against the existing Tact/FunC + TypeScript approach.

### Adoption Decision
- Produce a written decision with one of:
  - no adoption for the current roadmap
  - optional tooling for experiments only
  - Tolk/Acton for new contracts only
  - phased migration for selected FunC helpers
  - broader migration proposal requiring a dedicated architecture issue

## 4. Out of Scope

- Full migration of all Tact contracts to Tolk
- Rewriting production contract semantics to fit a toolchain
- Changing protocol economics, trust boundaries, or admin controls
- Replacing existing CI contract checks before the evaluation is approved
- Mainnet deployment through Acton before A1, B1, and B2 acceptance criteria are satisfied

## 5. Functional Requirements

1. Create `docs/tooling/ACTON_EVALUATION.md` with:
   - current tooling inventory
   - Acton feature matrix
   - compatibility findings for Tact, FunC, TypeScript tests, and deployment scripts
   - recommended adoption mode
   - migration cost and risk estimate

2. If Acton is viable for any part of the workflow:
   - add a minimal prototype under `experiments/acton/`
   - pin the Acton version used by the prototype
   - document exact local commands
   - document exact CI commands if adoption is recommended

3. If Acton is not viable for the current roadmap:
   - document the blocker clearly
   - list the existing tooling that remains authoritative
   - identify what would need to change before reconsideration

4. Update D1, D2, A3, B1, or B2 implementation plans only after this evaluation is accepted.

## 6. Non-Functional Requirements

- Evaluation must be reproducible in a clean environment.
- Prototype must not require production secrets, wallets, or live mainnet access.
- Any proposed CI addition must have a bounded runtime target and pinned tool version.
- The evaluation must preserve the current repository's Tact/FunC build path unless an explicit migration decision is approved.

## 7. Security Requirements

- Do not commit mnemonic phrases, wallet files, API keys, or `.env` files.
- Any migration recommendation must preserve protocol invariants I1-I7.
- Generated wrappers, build artifacts, and verifier inputs must be reviewed for supply-chain and reproducibility risks.
- Deployment or verification experiments must use testnet or dry-run modes only.

## 8. Acceptance Criteria

- [ ] `docs/tooling/ACTON_EVALUATION.md` created with an explicit adoption decision
- [ ] Current Tact/FunC/TypeScript tooling inventory completed
- [ ] Acton feature matrix completed for testing, fuzzing, mutation, coverage, gas, deployment, verification, and CI
- [ ] Minimal `experiments/acton/` prototype added if any adoption path is viable
- [ ] Migration risks and estimated implementation effort documented
- [ ] Recommended updates to D1, D2, A3, B1, and B2 documented
- [ ] No existing contract semantics or CI checks changed without an approved follow-up issue

## 9. References

- Acton documentation: https://ton-blockchain.github.io/acton/
- Acton GitHub repository: https://github.com/ton-blockchain/acton
- [D1 — Test Coverage Improvements](./D1-test-coverage-improvements.md)
- [D2 — Contract Gas Optimization](./D2-contract-gas-optimization.md)
- [A3 — Formal Verification of Protocol Invariants](./A3-formal-verification-protocol-invariants.md)
- [B1 — Testnet Deployment & Validation](./B1-testnet-deployment-and-validation.md)
- [B2 — Mainnet Deployment Plan](./B2-mainnet-deployment-plan.md)
