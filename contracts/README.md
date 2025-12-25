# Tonbankcard Protocol - Smart Contracts

This directory contains all smart contract implementations for the Tonbankcard protocol.

## Overview

Tonbankcard smart contracts are written in **Tact** language and deployed on the TON blockchain. All contracts follow strict non-custodial principles with no admin controls over user funds.

## Directory Structure

```
contracts/
├── payments/           # Payment Hub and internal transfers
│   ├── PaymentHub.tact         # Internal TBC transfers (Issue #6)
│   ├── PaymentHub.spec.ts      # Comprehensive test suite
│   └── README.md               # Payment Hub documentation
│
├── nft-cards/         # NFT card collections (deployed, reference only)
│   └── README.md      # Documentation for existing NFT contracts
│
├── token/             # TBC jetton (deployed, reference only)
│   └── README.md      # Documentation for TBC token contract
│
└── README.md          # This file
```

## Implemented Contracts

### Payment Hub (Issue #6)
**Status**: ✅ Implemented
**File**: `payments/PaymentHub.tact`
**Purpose**: Internal TBC transfers between NFT accounts

Features:
- Zero-fee internal transfers
- Account state management (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- Ownership verification
- Atomic balance updates
- Comprehensive validation and security

See [payments/README.md](./payments/README.md) for detailed documentation.

## Existing Deployed Contracts

### TBC Token
**Address**: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`
**Type**: TON Jetton (Fungible Token)
**Status**: Deployed, immutable
**Purpose**: Internal settlement token for Tonbankcard ecosystem

### NFT Card Collections

#### Series 7777
**Address**: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
**Status**: Deployed
**Purpose**: NFT-based account abstraction

#### Series 8888
**Address**: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`
**Status**: Deployed
**Purpose**: NFT-based account abstraction

See [docs/existing-contracts.md](../docs/existing-contracts.md) for full details.

## Development

### Prerequisites

```bash
# Install Node.js and npm
# Install Blueprint
npm install -g @ton/blueprint

# Install project dependencies
npm install
```

### Project Setup

Initialize a new contract:

```bash
npm create ton@latest
```

### Testing

All contracts use Blueprint testing framework with TON Sandbox:

```bash
# Run all tests
npx blueprint test

# Run specific test file
npx blueprint test PaymentHub.spec.ts

# Run with coverage
npx blueprint test --coverage
```

### Deployment

```bash
# Deploy contract
npx blueprint run

# Verify deployment
npx blueprint verify
```

## Architecture Principles

### Non-Custodial Design

All smart contracts MUST adhere to:

1. **No Admin Fund Control**: No admin functions that can withdraw or transfer user funds
2. **Ownership Verification**: NFT ownership is the sole authority for account actions
3. **Immutable Logic**: No upgradeable proxies or admin-controlled logic changes
4. **Transparent Operations**: All state changes emitted as events for indexing

### Security Requirements

- **No Reentrancy**: All contracts implement reentrancy guards
- **Overflow Safety**: Use TON's native overflow-safe integer types
- **Explicit Errors**: Clear error codes and revert reasons
- **Atomic Operations**: All multi-step operations are atomic (all-or-nothing)
- **Minimal Permissions**: Principle of least privilege

### Integration Patterns

#### NFT Account Resolver (Issue #4)
Pattern for validating NFT accounts:
- Verify NFT belongs to whitelisted collection
- Verify NFT is not burned
- Verify NFT ownership

#### Account State Machine (Issue #5)
Pattern for managing account states:
- Track balance and state per NFT account
- Enforce state transition rules
- Control permissions based on state

## Contract Dependencies

### Dependency Graph

```
PaymentHub (Issue #6)
  ├── Depends on: NFT Account Resolver (Issue #4)
  └── Depends on: Account State Machine (Issue #5)

Future Contracts:
  ├── Account Locks (Issue 3.4) → depends on PaymentHub
  ├── Merchant Payments (Issue 3.5) → depends on PaymentHub
  └── Lending Adapters → depends on Account State Machine
```

## Gas Optimization

### Best Practices

1. **Minimize Storage**: Use maps efficiently, avoid duplicate storage
2. **Batch Operations**: Group multiple operations when possible
3. **Early Returns**: Fail fast on validation errors
4. **Efficient Types**: Use appropriate integer sizes (uint8, uint32, etc.)

### Gas Costs (Estimated)

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Internal Transfer | ~0.01 TON | Includes validation and state updates |
| Account State Query | ~0.005 TON | Read-only getter |
| Account Initialization | ~0.01 TON | One-time setup |

## Testing Requirements

All smart contracts MUST include:

1. **Unit Tests**: Test individual functions and methods
2. **Integration Tests**: Test contract interactions
3. **Edge Case Tests**: Cover all edge cases from requirements
4. **Security Tests**: Test for common vulnerabilities

### Minimum Test Coverage

- ✅ Normal flow: Happy path scenarios
- ✅ Validation failures: All validation rules
- ✅ State enforcement: All state transitions
- ✅ Edge cases: Self-transfers, zero balances, etc.
- ✅ Security: Reentrancy, overflow, unauthorized access

## Code Style

### Tact Guidelines

```tact
// Use clear, descriptive names
const ERROR_INSUFFICIENT_BALANCE: Int = 101;

// Document complex logic
// Atomic balance update - debit source, credit destination
from_account.balance = from_account.balance - amount;
to_account.balance = to_account.balance + amount;

// Use require for validation
require(amount > 0, "Amount must be positive");

// Emit events for all state changes
emit(InternalTransferEvent{...}.toCell());
```

### TypeScript Test Guidelines

```typescript
// Descriptive test names
it('should reject transfer with insufficient balance', async () => {
    // Arrange: Set up test state
    const excessiveAmount = toNano('2000');

    // Act: Perform action
    const result = await contract.send(...);

    // Assert: Verify results
    expect(result.transactions).toHaveTransaction({
        success: false,
        exitCode: 101,
    });
});
```

## Security Audits

Before mainnet deployment, all contracts MUST undergo:

1. Internal security review
2. External security audit
3. Community review period
4. Testnet deployment and verification

## Contributing

### Smart Contract Contribution Workflow

1. **Create Issue**: Describe contract requirements
2. **Specification**: Write detailed spec with all requirements
3. **Implementation**: Write contract in Tact
4. **Tests**: Write comprehensive test suite
5. **Documentation**: Update README and docs
6. **Pull Request**: Submit for review
7. **Audit**: Security review before merge

See [CONTRIBUTING.md](../CONTRIBUTING.md) for full guidelines.

## Future Roadmap

### Planned Contracts

- **Account Locks** (Issue 3.4): Temporary account freezing
- **Merchant Payments** (Issue 3.5): Payment escrow and routing
- **Lending Adapters**: Integration with collateral systems
- **Multi-Sig Cards**: Shared account NFTs
- **Recurring Payments**: Subscription layer

### Research Areas

- Layer-2 payment channels
- Cross-chain bridges
- Privacy-preserving transfers
- DAO governance integration

## References

### TON Development

- [TON Documentation](https://docs.ton.org/)
- [Tact Language](https://docs.tact-lang.org/)
- [Blueprint Framework](https://github.com/ton-org/blueprint)
- [TON Sandbox](https://github.com/ton-org/sandbox)

### Tonbankcard Protocol

- [Architecture Documentation](../docs/architecture.md)
- [Existing Contracts](../docs/existing-contracts.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

### Security Resources

- [TON Security Best Practices](https://docs.ton.org/v3/documentation/smart-contracts/security/things-to-focus)
- [Tact Security Guide](https://docs.tact-lang.org/book/security)
- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)

## License

MIT License - See LICENSE file for details

---

**Last Updated**: 2025-12-25
**Maintained By**: Tonbankcard Protocol Team
