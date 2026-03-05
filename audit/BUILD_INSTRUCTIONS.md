# TONBANKCARD Protocol — Build Instructions

**Document Type:** Audit Package
**Issue Reference:** [#55 — Issue 10.2 Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
**Version:** 1.0
**Status:** FROZEN — Pre-Audit Package
**Last Updated:** 2026-03-05

---

## Purpose

This document enables any independent party to:
1. Reproduce the build from source
2. Verify compiled bytecode against freeze commit
3. Run the complete test suite
4. Deploy to testnet for validation

Reproducible builds are a core audit readiness requirement.

---

## Prerequisites

### System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Operating System** | Linux/macOS | Windows supported via WSL2 |
| **Node.js** | 18+ LTS | Required for tests and build scripts |
| **npm** | Bundled with Node.js | Used for dependency management |
| **Git** | Any recent version | Required for checkout |

### TON Toolchain

The TON development toolchain is required for FunC contract compilation:

```bash
# Install TON toolchain (Ubuntu/Debian)
apt-get install -y ton-dev

# Or via npm (Blueprint framework installs it)
npx blueprint --help

# Verify installation
func --version
fift --version
```

### Tact Compiler

```bash
# Tact is installed as a dev dependency via Blueprint
npm install

# Verify Tact is available
npx tact --version
```

---

## Step 1: Checkout Freeze Commit

```bash
# Clone the repository
git clone https://github.com/xlabtg/tonbankcard-protocol.git
cd tonbankcard-protocol

# Checkout the exact freeze commit
git checkout eb5dd593248a33a5a7517ae59b840827c140906a

# Verify you are at the correct commit
git log --oneline -1
# Expected: eb5dd59 Initial commit with task details

# Verify no uncommitted changes
git status
# Expected: nothing to commit, working tree clean
```

---

## Step 2: Verify File Hashes

Before building, verify the source files match the freeze metadata:

```bash
# Verify all in-scope contract hashes
sha256sum \
  contracts/payments/PaymentHub.tact \
  contracts/MerchantPaymentHub.tact \
  contracts/nft-resolver/nft_account_resolver.fc \
  contracts/nft-resolver/nft_account_resolver.tact \
  contracts/payment-hub/account-state.tact \
  contracts/payments/account-locks.fc
```

**Expected output (compare with FREEZE_METADATA.md):**
```
ad4ea4206def8de968381bd836105c442203eeb113bacd0f75e2025da66306c3  contracts/payments/PaymentHub.tact
07509b3444925c571a3ab437ef0f332ca26189e6183e4c556f7af51a4fd697be  contracts/MerchantPaymentHub.tact
0af57a0c8ffe24042e976bc4be4398229e2f88f8ab0efebda73d7cde61456ccc  contracts/nft-resolver/nft_account_resolver.fc
a27e8bcd95083064b54ce5113da0bdaaeb7142971f1a33a7c9cdb966b75f0550  contracts/nft-resolver/nft_account_resolver.tact
7d13c8089ea290ce7ca48414ef956920cdd9586f03293509b4ec5c19eef3a02b  contracts/payment-hub/account-state.tact
4182160d89d78411c73d0f9f5daa8c27c2c66be22f25218c9dbc109c3d6322f0  contracts/payments/account-locks.fc
```

If any hash does not match, do not proceed. Report the discrepancy to the protocol team.

---

## Step 3: Install Dependencies

```bash
# Install exact dependency versions from lockfile
npm ci

# For the SDK (optional, for SDK testing)
cd sdk
npm ci
cd ..

# For the backend/indexer (optional)
cd backend/indexer
npm ci
cd ../..
```

**Note:** Use `npm ci` (not `npm install`) to install exact versions from the lockfile.

---

## Step 4: Build Contracts

```bash
# Build all contracts using Blueprint
npx blueprint build

# Build specific contracts
npx blueprint build PaymentHub
npx blueprint build MerchantPaymentHub

# The build output will be in the 'build/' directory
ls build/
```

### What Gets Compiled

| Source File | Language | Output |
|-------------|---------|--------|
| `contracts/payments/PaymentHub.tact` | Tact → FunC → BoC | `build/PaymentHub.cell` |
| `contracts/MerchantPaymentHub.tact` | Tact → FunC → BoC | `build/MerchantPaymentHub.cell` |
| `contracts/nft-resolver/nft_account_resolver.fc` | FunC → BoC | `build/nft_account_resolver.cell` |
| `contracts/payment-hub/account-state.tact` | Tact → FunC → BoC | `build/account-state.cell` |
| `contracts/payments/account-locks.fc` | FunC → BoC | `build/account-locks.cell` |

---

## Step 5: Verify Bytecode

After building, compute the bytecode hashes to verify reproducible builds:

```bash
# Compute hash of compiled bytecodes
sha256sum build/*.cell
```

The bytecode hashes should match across clean builds on different machines (given the same compiler versions). Record these hashes for audit evidence.

---

## Step 6: Run the Test Suite

### Full Test Suite

```bash
# Run all tests
npx blueprint test

# Run with coverage reporting
npx blueprint test --coverage

# Save test output to file
npx blueprint test 2>&1 | tee test-output.log
```

### Contract-Specific Tests

```bash
# MerchantPaymentHub tests
npx blueprint test MerchantPaymentHub.spec.ts
npx blueprint test MerchantPaymentDynamic.spec.ts
npx blueprint test MerchantPaymentEdgeCases.spec.ts

# PaymentHub tests
npx blueprint test PaymentHub.spec.ts

# NFT Resolver tests
npx blueprint test NFTAccountResolver.spec.ts

# Invariant tests
npx blueprint test tests/invariants/

# Account locks (FunC tests)
npx blueprint test account-locks.spec.fc
```

### Governance Tests

```bash
npx blueprint test tests/governance/
```

### Versioning Tests

```bash
npx blueprint test tests/versioning/
```

---

## Step 7: Static Analysis

### Tact Compiler Checks

The Tact compiler performs static analysis during compilation. Check for warnings:

```bash
# Build and examine compiler output for warnings
npx blueprint build 2>&1 | grep -E "warning|error|WARNING|ERROR"
```

### FunC Static Analysis

```bash
# FunC compiler warnings
func -W contracts/payments/account-locks.fc 2>&1

# Check dead code
func -Wno-dead-code contracts/payments/payment-hub.fc
```

### Linting

```bash
# TypeScript/test linting
npx eslint tests/ --ext .ts

# SDK linting
cd sdk && npm run lint && cd ..
```

---

## Step 8: Fuzz Testing (Recommended)

While automated fuzz testing infrastructure is not bundled in this repository, auditors should apply fuzzing to:

1. **Payment flow inputs** — Amount boundaries, address formats
2. **Account state transitions** — Invalid state transition attempts
3. **Lock/unlock logic** — Concurrent lock operations
4. **Adapter callback parsing** — Malformed external data

Recommended fuzzing framework for TON:
- Blueprint's built-in property testing
- Custom fuzzing via TON TVM simulation

---

## Testnet Deployment (Optional)

To deploy contracts to TON Testnet for live validation:

### Prerequisites
- TON Testnet wallet with test TON for gas
- TON Connect or tonkeeper wallet

### Deploy Steps

```bash
# Deploy to testnet using Blueprint
npx blueprint run --testnet

# Or deploy specific contract
npx blueprint run deploy-payment-hub --testnet
```

### Testnet Verification

After deployment, verify on testnet explorer:
```
https://testnet.tonviewer.com/<contract-address>
```

Compare on-chain bytecode with locally compiled bytecode to confirm reproducible build.

---

## Build Environment Snapshot

For audit documentation, capture your build environment:

```bash
# Create build environment snapshot
echo "=== Build Environment ===" > build-env.txt
echo "Date: $(date)" >> build-env.txt
echo "OS: $(uname -a)" >> build-env.txt
echo "Node: $(node --version)" >> build-env.txt
echo "npm: $(npm --version)" >> build-env.txt
echo "Git commit: $(git rev-parse HEAD)" >> build-env.txt
echo "" >> build-env.txt
echo "=== Compiler Versions ===" >> build-env.txt
npx tact --version 2>&1 >> build-env.txt || true
func --version 2>&1 >> build-env.txt || true

cat build-env.txt
```

---

## Troubleshooting

### Issue: npm ci fails with lockfile mismatch

```bash
# If lockfile is missing or mismatched, regenerate
npm install --package-lock-only
npm ci
```

### Issue: FunC compiler not found

```bash
# Install TON toolchain via npm
npm install -g @ton-community/func-js

# Or use Blueprint's bundled version
npx blueprint build
```

### Issue: Tests fail due to missing TON sandbox

```bash
# Blueprint includes a TON sandbox; ensure it's installed
npm ci
npx blueprint test --help
```

### Issue: Build output differs across machines

This indicates a non-deterministic build. Possible causes:
- Different compiler versions (pin with exact versions)
- Timestamp-dependent compilation (not expected in Tact/FunC)
- Different dependency versions (use `npm ci`)

Report to protocol team if build output is non-deterministic.

---

## Expected Test Results

All tests should pass. Any test failure is a potential finding.

| Test Suite | Expected | Notes |
|------------|---------|-------|
| MerchantPaymentHub | PASS | Core payment tests |
| MerchantPaymentDynamic | PASS | Dynamic invoice tests |
| MerchantPaymentEdgeCases | PASS | Edge case coverage |
| PaymentHub | PASS | Internal transfer tests |
| NFTAccountResolver | PASS | Ownership resolution tests |
| Invariants (I1–I6) | PASS | All invariant assertions |
| account-locks.spec.fc | PASS | Lock logic unit tests |
| Governance | PASS | Governance contract tests |

---

## References

- **Freeze Metadata**: [audit/FREEZE_METADATA.md](./FREEZE_METADATA.md)
- **Test Coverage Report**: [audit/TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md)
- **Audit Scope**: [audit/SCOPE.md](./SCOPE.md)
- **Blueprint Documentation**: https://docs.ton.org/develop/smart-contracts/sdk/javascript
- **Tact Documentation**: https://docs.tact-lang.org
- **FunC Documentation**: https://docs.ton.org/develop/func/overview
- **Issue #55**: [Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
