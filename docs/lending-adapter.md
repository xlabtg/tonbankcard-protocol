# Lending Adapter (CoinRabbit Integration)

## Overview

The Lending Adapter provides a **non-custodial coordination layer** between TONBANKCARD NFT-based accounts and external lending services like CoinRabbit.

## Critical Design Principles

### What the Lending Adapter IS

- A **coordination and signaling layer** only
- A **read-only** interface for collateral verification
- An **identity resolver** using NFT-based accounts
- A **metadata provider** for external lenders

### What the Lending Adapter IS NOT

The adapter is **intentionally weak by design**. It:

- **DOES NOT** issue loans
- **DOES NOT** custody collateral
- **DOES NOT** enforce repayments
- **DOES NOT** liquidate assets
- **DOES NOT** track debt
- **DOES NOT** grant lenders any protocol-level authority

> **CRITICAL**: Any proposal that embeds lending logic, introduces liquidation hooks, or grants lender privileges MUST be rejected at review stage.

## Trust Model

```
┌─────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARIES                      │
├─────────────────────────────────────────────────────────┤
│  Users trust ──────────────────► Their own wallet        │
│  Lenders trust ────────────────► Their own systems       │
│  Protocol trusts ──────────────► No one                  │
│  Enforcement happens ──────────► Externally (off-chain)  │
└─────────────────────────────────────────────────────────┘
```

> **Note:** For complete protocol guarantees and non-guarantees, see [External Integration Guarantees](./integrations/external-guarantees.md).

## Identity Model

### Borrower Identity

In TONBANKCARD, borrower identity is determined by **NFT ownership**, NOT wallet address.

```typescript
interface BorrowerIdentity {
  // PRIMARY identifier - this defines the borrower
  nftAccountId: string;  // e.g., '7777001', '8888042'

  // Collection address for on-chain validation
  collectionAddress: string;

  // Wallet address is informational only (may change)
  currentOwnerAddress?: string;

  // Whether the NFT account is valid
  isValid: boolean;
}
```

**Key Points:**
- NFT Account ID is the **only** identifier that matters
- Wallet address can change if NFT is transferred
- Identity is resolved via the NFT Account Resolver contract

### Loan Binding

Loans MAY be associated with:
- NFT Account ID
- Collateral Signal ID (from Issue 6.1)

The protocol does NOT track debt state. All loan tracking is the lender's responsibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERACTION FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User signals collateral via Issue 6.1 (on-chain)        │
│                          ↓                                   │
│  2. User initiates loan request via CoinRabbit UI/API        │
│                          ↓                                   │
│  3. CoinRabbit verifies collateral signal on-chain           │
│                          ↓                                   │
│  4. Loan is issued OFF-PROTOCOL (external to TONBANKCARD)    │
│                          ↓                                   │
│  5. Protocol remains PASSIVE OBSERVER                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### Creating the Adapter

```typescript
import { createCoinRabbitAdapter } from './backend/adapters';

const adapter = createCoinRabbitAdapter({
  affiliateId: 'your-affiliate-id',  // Optional: for referral tracking
  chainId: 1,                         // 1 = mainnet, 2 = testnet
});
```

### Resolving Borrower Identity

```typescript
// Resolve identity from NFT Account ID
const identity = await adapter.resolveBorrowerIdentity('7777001');

console.log(identity);
// {
//   nftAccountId: '7777001',
//   collectionAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
//   isValid: true,
//   resolvedAt: Date
// }
```

### Creating a Loan Intent

```typescript
// User-initiated loan intent
const intent = await adapter.createLoanIntent({
  nftAccountId: '7777001',
  collateralSignalId: 'signal_abc123',  // Optional: from Issue 6.1
  requestedAmount: '1000',               // Informational only
  requestedCurrency: 'USDT',             // Informational only
  targetLender: 'coinrabbit',
});

console.log(intent);
// {
//   intentId: 'intent_xxx_yyy',
//   borrowerIdentity: {...},
//   collateralInfo: {...},           // If signal provided
//   lenderUrl: 'https://coinrabbit.io/loans?...',
//   verificationData: {...},
//   createdAt: Date,
//   expiresAt: Date
// }
```

### Verifying Collateral Signal (Read-Only)

```typescript
// Lenders can verify collateral signals on-chain
const verification = await adapter.verifyCollateralSignal({
  signalId: 'signal_abc123',
  nftAccountId: '7777001',
});

console.log(verification);
// {
//   isValid: true,
//   ownershipVerified: true,
//   signalInfo: {...},
//   verifiedAt: Date,
//   disclaimer: '...'  // ALWAYS includes disclaimer
// }
```

### Getting Lender Metadata

```typescript
// Provides read-only metadata for lender verification
const metadata = await adapter.getLenderMetadata(
  '7777001',
  'signal_abc123'  // Optional
);

console.log(metadata);
// {
//   nftAccountId: '7777001',
//   collectionAddress: '...',
//   nftIndex: 1,
//   collateralSignalId: 'signal_abc123',
//   chainId: 1,
//   protocolVersion: '1.0.0',
//   disclaimer: 'TONBANKCARD protocol makes NO guarantees...'
// }
```

## Security Considerations

### User-Initiated Interactions Only

All adapter operations must be **user-initiated**. The adapter:
- Does NOT accept lender-initiated calls into core contracts
- Does NOT provide callbacks with authority
- Is designed to be **replaceable** without affecting core protocol

### No Protocol Guarantees

The adapter includes explicit disclaimers on all lender-facing data:

```
TONBANKCARD protocol makes NO guarantees about collateral, balances,
or repayment. Lenders MUST verify all data on-chain independently.
The protocol is non-custodial and does not enforce loan terms.
```

### Whitelisted Collections

Only NFTs from whitelisted collections are recognized:
- Series 7777: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- Series 8888: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`

## Risk Disclaimers

### For Users

1. **External Lending**: Loans are issued by CoinRabbit, NOT by TONBANKCARD
2. **Collateral Risk**: You are responsible for understanding loan terms
3. **No Protocol Protection**: TONBANKCARD cannot reverse or modify loans
4. **Identity Binding**: Your NFT Account ID is linked to loan requests

### For Lenders

1. **No Guarantees**: Protocol makes no guarantees about collateral or repayment
2. **On-Chain Verification Required**: All data must be verified on-chain independently
3. **No Enforcement**: Protocol does not enforce loan terms
4. **External Risk**: You are responsible for your own due diligence

## Integration with Issue 6.1 (Collateral Signal Contract)

The Lending Adapter is designed to work with the Collateral Signal Contract from Issue 6.1:

1. User creates collateral signal on-chain (Issue 6.1)
2. Signal ID is passed to loan intent
3. Lender verifies signal on-chain
4. Loan is issued externally

The adapter only **reads** collateral signals. It cannot create, modify, or lock collateral.

## Acceptance Criteria Compliance

| Criteria | Status | Notes |
|----------|--------|-------|
| Adapter introduces no custody paths | ✅ | No fund custody at any point |
| Protocol does not track debt | ✅ | All tracking is informational only |
| Only NFT ownership defines borrower identity | ✅ | NFT Account ID is primary identifier |
| Lender has zero protocol-level authority | ✅ | No lender callbacks or controls |
| All security invariants remain intact | ✅ | Read-only, user-initiated only |

## Out of Scope

The following are explicitly **NOT** part of this adapter:

- Interest rates
- Liquidation logic
- Credit scoring
- Borrower monitoring
- Debt tracking
- Repayment enforcement

## CoinRabbit Integration Notes

### Partner Integration

CoinRabbit offers partner API integration. Contact CoinRabbit directly for:
- API access
- Custom rates and terms
- White-label solutions
- Technical integration support

### Supported Features

CoinRabbit supports:
- 300+ crypto assets
- No KYC or credit checks
- Instant loan processing (10-15 minutes)
- Flexible collateral options

### Deep-Link Format

The adapter generates deep-links in the following format:

```
https://coinrabbit.io/loans?source=tonbankcard&nft_account={id}&chain=ton
```

Optional parameters:
- `collateral_signal`: Collateral signal ID
- `amount`: Requested loan amount
- `currency`: Requested currency
- `ref`: Affiliate/partner ID

## References

- [Issue 6.1 — Collateral Signal Contract](../contracts/README.md)
- [NFT Account Resolver](./contracts/nft-account-resolver.md)
- [Protocol Architecture](./architecture.md)
- [External Integration Guarantees](./integrations/external-guarantees.md)
- [CoinRabbit Website](https://coinrabbit.io/)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Document Status**: Initial Implementation (Issue 6.2)
**Last Updated**: 2025-12-28
**Protocol Version**: 1.0.0
