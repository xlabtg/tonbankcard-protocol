# Protocol Invariant Tests

This directory contains comprehensive test suites that verify the core protocol invariants defined in `docs/invariants.md`.

## Overview

These tests are **critical security tests** that verify the non-negotiable rules of the TONBANKCARD protocol. Any failure in these tests indicates a potential security vulnerability.

## Test Files

### I1-non-custodial-ownership.spec.ts
**Invariant**: Only NFT owners can initiate fund transfers.

Tests:
- ✅ NFT owner can transfer funds
- ❌ Non-owner cannot transfer funds
- ❌ Admin cannot move user funds
- ❌ Attacker cannot bypass ownership checks
- ✅ Ownership is verified on every transfer

**Critical**: This test ensures no custody of user funds.

### I3-no-admin-fund-control.spec.ts
**Invariant**: No admin role can withdraw or move user funds.

Tests:
- ❌ Deployer cannot withdraw funds
- ❌ Admin cannot drain accounts
- ✅ Admin roles limited to non-financial operations
- ⚠️ Test-only functions documented for removal

**Critical**: Verifies no admin fund control paths exist.

### I4-atomic-transfers.spec.ts
**Invariant**: All transfers are atomic (complete fully or revert entirely).

Tests:
- ✅ Successful transfers update both balances atomically
- ❌ Failed transfers revert completely
- ✅ No intermediate states exist
- ✅ Reentrancy protection works
- ✅ Self-transfers are atomic no-ops

**Critical**: Ensures no partial balance updates.

### I5-ledger-conservation.spec.ts
**Invariant**: Sum of balances is conserved (no funds created/destroyed).

Tests:
- ✅ Total balance unchanged after transfers
- ✅ Zero fees on internal transfers
- ✅ Conservation across multiple transfers
- ✅ No rounding errors
- ✅ Circular transfers preserve totals

**Critical**: Verifies conservation of funds.

### I6-lock-not-confiscation.spec.ts
**Invariant**: Locks restrict actions, not ownership.

Tests:
- ❌ Locked accounts cannot send
- ✅ Locked accounts CAN receive
- ✅ Locks do NOT modify balances
- ✅ Locks do NOT change ownership
- ✅ Locks are reversible

**Critical**: Ensures locks don't confiscate funds.

## Running Tests

### Run All Invariant Tests
```bash
npm test tests/invariants/
```

### Run Individual Invariant Test
```bash
npm test tests/invariants/I1-non-custodial-ownership.spec.ts
npm test tests/invariants/I3-no-admin-fund-control.spec.ts
npm test tests/invariants/I4-atomic-transfers.spec.ts
npm test tests/invariants/I5-ledger-conservation.spec.ts
npm test tests/invariants/I6-lock-not-confiscation.spec.ts
```

### Run in Watch Mode
```bash
npm test -- --watch tests/invariants/
```

## Test Framework

These tests use:
- **@ton/sandbox**: Blockchain simulation for contract testing
- **@ton/test-utils**: Assertion helpers for TON contracts
- **Blueprint**: TON smart contract development framework

## Continuous Integration

These tests MUST:
1. Run on every pull request
2. Run before every deployment
3. Pass with 100% success rate
4. Block merge if any test fails

## Test Coverage Requirements

Each invariant test file must include:
- ✅ **Positive tests**: Verify invariant holds in normal conditions
- ❌ **Negative tests**: Verify violations are prevented
- 🔍 **Edge cases**: Test boundary conditions
- ✅ **Comprehensive verification**: End-to-end invariant checks

## Interpreting Test Results

### All Tests Pass ✅
- Protocol invariants are maintained
- Safe to proceed with deployment

### Any Test Fails ❌
- **CRITICAL SECURITY ISSUE**
- DO NOT deploy
- Investigate root cause immediately
- Follow incident response protocol
- Fix and re-verify all tests

## Adding New Invariant Tests

When adding a new invariant:

1. **Document** the invariant in `docs/invariants.md`
2. **Add NatSpec comments** to affected contracts
3. **Create test file**: `tests/invariants/IX-invariant-name.spec.ts`
4. **Include**:
   - Positive verification tests
   - Negative violation tests
   - Edge case coverage
   - Comprehensive end-to-end test
5. **Update this README** with test description
6. **Update CI configuration** to run new test

## Test Maintenance

These tests should be:
- **Reviewed** before each major release
- **Updated** when contracts change
- **Expanded** when new attack vectors discovered
- **Never removed** (only deprecated with replacement)

## Security Audit Checklist

For auditors reviewing the protocol:

- [ ] All invariant tests pass
- [ ] Negative tests comprehensively cover attack vectors
- [ ] Test-only admin functions documented for removal
- [ ] No test gaps for critical security properties
- [ ] Edge cases adequately covered
- [ ] Test suite matches documentation

## References

- **Invariant Documentation**: [docs/invariants.md](../../docs/invariants.md)
- **Contract Documentation**: [contracts/payments/README.md](../../contracts/payments/README.md)
- **Contributing Guidelines**: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **Issue #18**: [Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)

---

**These tests protect user funds. Treat them as critical security infrastructure.**
