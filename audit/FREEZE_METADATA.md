# TONBANKCARD Protocol — Code Freeze Metadata

**Document Type:** Audit Package
**Issue Reference:** [#55 — Issue 10.2 Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
**Version:** 1.0
**Status:** FROZEN
**Last Updated:** 2026-03-05

---

## Freeze Declaration

The TONBANKCARD protocol smart contracts are hereby frozen for external security audit. No logic changes to in-scope contracts are permitted during the audit period. Any post-freeze change to an in-scope contract requires a new audit cycle.

---

## Freeze Commit

| Property | Value |
|----------|-------|
| **Repository** | https://github.com/xlabtg/tonbankcard-protocol |
| **Branch** | `main` |
| **Freeze Commit Hash** | `eb5dd593248a33a5a7517ae59b840827c140906a` |
| **Freeze Date** | 2026-03-05 |
| **Prior Freeze (Issue #22)** | `4027b9d` (2025-12-29) |
| **Immutable Tag** | `v1.0.0-audit` (to be created at audit start) |
| **Force Push Prohibited** | Yes — branch protection enforced |
| **Rebase Prohibited** | Yes — commit history is immutable |

### Verifying the Freeze Commit

```bash
# Clone repository at freeze commit
git clone https://github.com/xlabtg/tonbankcard-protocol
cd tonbankcard-protocol
git checkout eb5dd593248a33a5a7517ae59b840827c140906a

# Verify no uncommitted changes to contracts
git status contracts/

# Verify commit hash
git rev-parse HEAD
# Expected: eb5dd593248a33a5a7517ae59b840827c140906a
```

---

## Compiler & Toolchain Versions

| Tool | Version | Purpose |
|------|---------|---------|
| **Tact Compiler** | Latest stable | Compile `.tact` contracts |
| **FunC Compiler** | TON Labs release (part of TON toolchain) | Compile `.fc` contracts |
| **Fift** | Bundled with TON toolchain | Bytecode assembly |
| **Node.js** | 18+ LTS | Test execution and build scripts |
| **TypeScript** | 5.x | Test compilation |
| **npm** | Bundled with Node.js 18+ | Dependency management |
| **Blueprint (TON)** | Latest stable | Contract compilation and testing framework |

**Note:** Exact compiler version numbers should be captured at build time by running `tact --version` and `func --version` in the build environment. Pin these versions for reproducible builds.

### Verify Toolchain

```bash
node --version     # Should be 18+
npm --version
npx blueprint --version  # Blueprint version
```

---

## Dependency Lockfiles

| Package Manager | Lockfile | Location |
|-----------------|---------|----------|
| npm | `package-lock.json` | `sdk/package-lock.json` |
| npm | `package-lock.json` | `backend/indexer/package-lock.json` (if present) |

All dependencies must be installed from the exact lockfile versions to ensure reproducible builds:

```bash
# Install exact dependency versions
npm ci
```

---

## In-Scope Contract File Hashes

The following SHA-256 hashes were computed from the frozen source files. Auditors should verify these hashes match their local checkout.

### Critical Priority Contracts

| Contract | File Path | SHA-256 Hash |
|----------|-----------|-------------|
| **PaymentHub** | `contracts/payments/PaymentHub.tact` | `ad4ea4206def8de968381bd836105c442203eeb113bacd0f75e2025da66306c3` |
| **MerchantPaymentHub** | `contracts/MerchantPaymentHub.tact` | `07509b3444925c571a3ab437ef0f332ca26189e6183e4c556f7af51a4fd697be` |
| **NFT Resolver (FunC)** | `contracts/nft-resolver/nft_account_resolver.fc` | `0af57a0c8ffe24042e976bc4be4398229e2f88f8ab0efebda73d7cde61456ccc` |
| **NFT Resolver (Tact)** | `contracts/nft-resolver/nft_account_resolver.tact` | `a27e8bcd95083064b54ce5113da0bdaaeb7142971f1a33a7c9cdb966b75f0550` |
| **Account State Machine** | `contracts/payment-hub/account-state.tact` | `7d13c8089ea290ce7ca48414ef956920cdd9586f03293509b4ec5c19eef3a02b` |

### High Priority Contracts

| Contract | File Path | SHA-256 Hash |
|----------|-----------|-------------|
| **Account Locks** | `contracts/payments/account-locks.fc` | `4182160d89d78411c73d0f9f5daa8c27c2c66be22f25218c9dbc109c3d6322f0` |

### Medium Priority (Types & Interfaces)

| File | SHA-256 Hash |
|------|-------------|
| `contracts/types/AccountState.tact` | `a25a3ea64fe75243be6455fb4c36ad1cc1090f5f3df0776585c23f8edbaf0739` |
| `contracts/types/LockState.tact` | `e6371298a2e6ce5a0726314ade0962605a41ed063a68241f0b8cc0a96e04532b` |
| `contracts/interfaces/IAccountLocks.tact` | `3e4c9942d5afed40e854fdd768a892ffc3344df389fd1438a067b4ad4f904f3e` |
| `contracts/interfaces/IAccountStateMachine.tact` | `d46a6a5967decda47f244c99aa0aa85e64e99da3cf9d80cadad359666df7c423` |
| `contracts/interfaces/INFTResolver.tact` | `cd81755f67eabafe3a7482c327ff85f62d20b1e368e80b7bbb2f2d62dd4b35a5` |
| `contracts/interfaces/IVersionMetadata.tact` | `8c98426ddaef09f223ee3ac701c964e31dbd19d17a8a70f8cc2b7c50f279c336` |
| `contracts/interfaces/ICollateralSignal.tact` | `b8bc8cabe2bb1c538bbf7562769ff974708bab58832d9ad47477cc9345f2345a` |
| `contracts/interfaces/IPublicCollateralLookup.tact` | `a6ac2e8c2d50a847a98ccdb4566b3b8189d4a6ccbdad369f51df1d0c2e48dc8b` |

### Verifying File Hashes

```bash
# Verify all critical contract hashes at once
sha256sum \
  contracts/payments/PaymentHub.tact \
  contracts/MerchantPaymentHub.tact \
  contracts/nft-resolver/nft_account_resolver.fc \
  contracts/nft-resolver/nft_account_resolver.tact \
  contracts/payment-hub/account-state.tact \
  contracts/payments/account-locks.fc

# Compare with expected values above
```

---

## Freeze Rules

### Prohibited During Audit Period

- ❌ Any changes to in-scope contract logic
- ❌ Adding or removing functions from in-scope contracts
- ❌ Changing state variables or storage layout
- ❌ Modifying error codes or message structures
- ❌ "Quick fixes" for audit findings (wait for re-audit)
- ❌ Force pushes to main branch
- ❌ Rebases that modify frozen commit history

### Permitted During Audit Period

- ✅ Documentation updates (non-code)
- ✅ Test additions (test files only, no contract changes)
- ✅ README and comment updates (no logic changes)
- ✅ CI/CD configuration changes
- ✅ Audit package updates (this directory)

**Policy:** Any change to in-scope contract logic during audit invalidates findings and requires re-audit from scratch.

---

## Deployed External Contracts (Not Under Audit — Already Frozen On-Chain)

| Contract | Address | Network | Status |
|----------|---------|---------|--------|
| TBC Token (Jetton) | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | TON Mainnet | FROZEN |
| NFT Collection 7777 | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | TON Mainnet | FROZEN |
| NFT Collection 8888 | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | TON Mainnet | FROZEN |
| TBC Diamonds (Governance) | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` | TON Mainnet | FROZEN |

---

## Protocol Contracts (Not Yet Deployed — Awaiting Audit)

| Contract | Source File | Status |
|----------|-------------|--------|
| PaymentHub | `contracts/payments/PaymentHub.tact` | Pre-audit (NOT deployed) |
| MerchantPaymentHub | `contracts/MerchantPaymentHub.tact` | Pre-audit (NOT deployed) |
| NFT Account Resolver | `contracts/nft-resolver/nft_account_resolver.fc` | Pre-audit (NOT deployed) |
| Account State Machine | `contracts/payment-hub/account-state.tact` | Pre-audit (NOT deployed) |
| Account Locks | `contracts/payments/account-locks.fc` | Pre-audit (NOT deployed) |

All protocol contracts await successful audit completion before testnet deployment, and then mainnet deployment.

---

## Deployment Target

| Property | Value |
|----------|-------|
| **Primary Target Network** | TON Mainnet (Chain ID: -239) |
| **Testing Network** | TON Testnet (Chain ID: -3) |
| **Block Explorer** | https://tonviewer.com |
| **Testnet Explorer** | https://testnet.tonviewer.com |
| **Deployment Status** | NOT YET DEPLOYED (audit first) |

---

## Post-Audit Unfreeze Procedure

After audit completion:

1. Create new branch for remediation of findings
2. Apply fixes for Critical and High severity findings
3. Submit fixed contracts for re-audit
4. Receive final signed audit report
5. Update freeze commit to final audited version
6. Create `v1.0.0-release` tag
7. Deploy to testnet for integration verification
8. Deploy to TON Mainnet

---

## References

- **Build Instructions**: [audit/BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md)
- **Audit Scope**: [audit/SCOPE.md](./SCOPE.md)
- **Versioning Policy**: [docs/versioning-policy.md](../docs/versioning-policy.md)
- **Deployment Matrix**: [docs/deployments/network-matrix.md](../docs/deployments/network-matrix.md)
- **Issue #55**: [Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
- **Issue #42**: [Protocol Versioning Policy](https://github.com/xlabtg/tonbankcard-protocol/issues/42)
