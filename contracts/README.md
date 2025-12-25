# Tonbankcard Smart Contracts

This directory contains the smart contract implementations for the Tonbankcard Protocol.

## Structure

```
contracts/
├── payments/           # Payment infrastructure contracts
│   └── payment-hub.fc  # Core payment routing and account binding
├── token/              # TBC jetton (external, deployed)
├── nft-cards/          # NFT card collections (external, deployed)
└── lending/            # Future: Lending and collateral contracts
```

## Implemented Contracts

### Payment Hub (`payments/payment-hub.fc`)

**Status**: Implementation draft (Issue #3)
**Language**: FunC
**Purpose**: Core banking logic for the Tonbankcard Protocol

**Features**:
- NFT-based account binding and validation
- Internal TBC transfers (zero fee)
- Merchant payment flows
- External payment entry/exit hooks
- Event emission for indexing
- Anti-fraud account flagging
- Emergency pause mechanism

**Documentation**: [docs/contracts/payment-hub.md](../docs/contracts/payment-hub.md)
**Tests**: [tests/payments/payment-hub.test.md](../tests/payments/payment-hub.test.md)

## External Contracts (Already Deployed)

### TBC Token (Jetton)
- **Address**: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`
- **Type**: TON Jetton (fungible token)
- **Status**: Deployed and immutable
- **Purpose**: Internal settlement token
- **Explorer**: [TONViewer](https://tonviewer.com/EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq)

### NFT Card Collections
- **Series 7777**: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- **Series 8888**: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`
- **Type**: TON NFT Standard
- **Status**: Deployed
- **Purpose**: Account abstraction (each NFT = unique account)

See [docs/existing-contracts.md](../docs/existing-contracts.md) for full details.

## Development Workflow

### Prerequisites

1. **TON Development Tools**:
   - FunC compiler
   - Fift interpreter
   - Blueprint framework (recommended)

2. **Node.js Environment**:
   ```bash
   npm install -g @ton-community/blueprint
   ```

### Compiling Contracts

```bash
# Using FunC compiler directly
func -o build/payment-hub.fif -SPA stdlib.fc contracts/payments/payment-hub.fc

# Compile to BOC
fift -s build/payment-hub.fif
```

Or using Blueprint:
```bash
npx blueprint build
```

### Testing

See individual test plans in `tests/` directory:
- [tests/payments/payment-hub.test.md](../tests/payments/payment-hub.test.md)

Actual test implementation would use TON Sandbox:
```bash
npx blueprint test
```

### Deployment

**⚠️ IMPORTANT**: Never deploy to mainnet without:
1. Complete test coverage
2. Security audit
3. Testnet verification
4. Architecture review approval

Deployment steps:
1. Compile contract
2. Prepare initial data
3. Deploy to testnet
4. Test all operations
5. Security audit
6. Mainnet deployment (after approval)

## Security Guidelines

All contracts **MUST** adhere to:

### Non-Custodial Principles
- ❌ No storage of user private keys
- ❌ No admin withdrawal of user funds
- ❌ No forced transfers
- ✅ User-signed transactions only
- ✅ NFT ownership as sole authority

### Smart Contract Security
- ✅ No upgradeable proxies for core logic
- ✅ Explicit error handling
- ✅ Input validation on all operations
- ✅ Reentrancy protection (TVM native)
- ✅ Overflow protection (TVM native)

### Access Control
- Admin roles for defensive operations only (pause, flag)
- No admin access to user funds
- Clear separation of user vs admin operations

## Code Style

### FunC Conventions

```func
;; Comments use double semicolon
;; Function names use snake_case
;; Constants use SCREAMING_SNAKE_CASE or namespace::name

;; Operation codes
const int op::operation_name = 0x12345678;

;; Error codes
const int error::error_name = 100;

;; Functions
() function_name(slice param1, int param2) impure {
    ;; Implementation
}

;; Get methods
int get_something() method_id {
    load_data();
    return value;
}
```

### Documentation Requirements

Each contract file must include:
1. Header comment explaining purpose
2. Operation code definitions
3. Error code definitions
4. Storage layout documentation
5. Function documentation
6. Security considerations

## Testing Requirements

### Minimum Test Coverage

All contracts must have:
- ✅ Unit tests for each function
- ✅ Integration tests for user flows
- ✅ Security tests for access control
- ✅ Edge case tests
- ✅ Error condition tests
- ✅ Event emission tests

### Test Organization

```
tests/
├── unit/           # Individual function tests
├── integration/    # Multi-contract flows
└── security/       # Access control, exploits
```

## Deployment Checklist

Before deploying any contract:

- [ ] All tests passing
- [ ] Code reviewed by team
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Testnet deployment successful
- [ ] Integration tests with existing contracts
- [ ] Gas optimization reviewed
- [ ] Emergency procedures documented
- [ ] Mainnet deployment approved

## Future Contracts

### Planned Implementations

**Phase 2**:
- [ ] Lending adapter contracts
- [ ] Merchant escrow contract
- [ ] Payment channel contracts

**Phase 3**:
- [ ] Multi-sig card contracts
- [ ] Recurring payment contracts
- [ ] Cross-chain bridge adapters

**Phase 4**:
- [ ] Advanced privacy contracts
- [ ] Governance contracts (DAO)
- [ ] Staking/rewards contracts

## References

- [TON Smart Contract Documentation](https://docs.ton.org/develop/smart-contracts/)
- [FunC Language Reference](https://docs.ton.org/develop/func/overview)
- [TON Jetton Standard](https://github.com/ton-blockchain/jetton-contract)
- [TON NFT Standard](https://github.com/ton-blockchain/nft-contract)
- [Blueprint Framework](https://github.com/ton-community/blueprint)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

**Key Points**:
- All contract changes require an Issue
- Follow non-custodial principles strictly
- Include comprehensive tests
- Update documentation with code
- Security review required

---

**Last Updated**: 2024
**Maintainer**: Tonbankcard Protocol Team
