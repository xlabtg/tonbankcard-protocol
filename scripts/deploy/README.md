# TONBANKCARD Protocol — Deployment Scripts

**Issue Reference:** [#74 — Improvements / Phase 14 — Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)

This directory contains deterministic deployment and verification scripts for the TONBANKCARD protocol smart contracts.

---

## Overview

| Script | Purpose |
|--------|---------|
| `deploy.ts` | Deterministic contract deployment script |
| `verify.ts` | Post-deployment verification script |

All scripts are designed to be:
- **Deterministic** — same inputs produce same deployment manifests
- **Auditable** — every deployment is recorded in a manifest file
- **Verifiable** — deployed contracts can be verified against source code

---

## Prerequisites

```bash
# Node.js 18+
node --version  # >= 18.0.0

# Install dependencies
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your deployment configuration
```

---

## Deployment (deploy.ts)

### Usage

```bash
# Dry run (no actual deployment, validate configuration only)
npx ts-node scripts/deploy/deploy.ts --dry-run

# Deploy to testnet
npx ts-node scripts/deploy/deploy.ts --network testnet

# Deploy to mainnet (requires confirmation)
npx ts-node scripts/deploy/deploy.ts --network mainnet --confirm
```

### What It Does

1. Loads contract build artifacts
2. Validates configuration (admin key, risk authority, etc.)
3. Calculates expected contract addresses deterministically
4. Deploys contracts in correct dependency order
5. Writes deployment manifest to `deployments/{network}/{timestamp}.json`
6. Verifies deployed contracts match source code

### Deployment Order

Contracts must be deployed in this order (dependencies first):

```
1. AccountLocks     (no dependencies)
2. NFTAccountResolver (no dependencies)
3. AccountStateMachine (depends on AccountLocks)
4. PaymentHub        (depends on AccountLocks, NFTAccountResolver, AccountStateMachine)
5. MerchantPaymentHub (depends on AccountLocks + NFTAccountResolver — its init() takes the
   account-locks and resolver addresses; the resolver registers NFT accounts via
   ResolveNFTOwner, without which every payment fails. Issues #363, #397)
6. CollateralSignal  (depends on NFTAccountResolver — its init() takes the resolver address; Issue #364)
7. PublicCollateralLookup (depends on CollateralSignal)
```

---

## Verification (verify.ts)

### Usage

```bash
# Verify against a deployment manifest
npx ts-node scripts/deploy/verify.ts --manifest deployments/mainnet/2026-03-19T12-00-00Z.json

# Verify a specific contract address
npx ts-node scripts/deploy/verify.ts --address EQAjH... --contract PaymentHub
```

### What It Verifies

1. Contract code hash matches compiled source
2. Contract state is initialized correctly
3. Admin addresses match deployment configuration
4. Invariants I1–I7 are structurally satisfied (code inspection)

---

## Deployment Manifest Format

Each deployment creates a manifest in `deployments/{network}/{timestamp}.json`:

```json
{
  "version": "1.0.0",
  "network": "mainnet",
  "timestamp": "2026-03-19T12:00:00Z",
  "commit": "abc1234",
  "deployer": "EQA...",
  "contracts": {
    "PaymentHub": {
      "address": "EQA...",
      "codeHash": "abc123...",
      "deployTx": "tx_hash...",
      "deployBlock": 123456
    }
  },
  "configuration": {
    "adminAddress": "EQA...",
    "riskAuthority": "EQA...",
    "lendingAdapter": null
  }
}
```

---

## Security Checklist Before Deployment

- [ ] All pre-production fixes applied (see `docs/audit/FULL_SYSTEM_AUDIT.md` F-CRIT-1 to F-CRIT-5)
- [ ] Admin key stored in hardware wallet (Ledger/Trezor)
- [ ] risk_authority key stored in hardware wallet
- [ ] Deployment key is cold storage (air-gapped)
- [ ] Test deployment on testnet successful
- [ ] Verification script passes on testnet deployment
- [ ] Security audit completed
- [ ] Deployment manifest reviewed by second person

---

## References

- **Deployment Matrix:** [`docs/deployments/network-matrix.md`](../../docs/deployments/network-matrix.md)
- **Key Management:** [`docs/security/KEY_MANAGEMENT.md`](../../docs/security/KEY_MANAGEMENT.md)
- **Audit Freeze Metadata:** [`audit/FREEZE_METADATA.md`](../../audit/FREEZE_METADATA.md)
- **Full System Audit:** [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../docs/audit/FULL_SYSTEM_AUDIT.md)
