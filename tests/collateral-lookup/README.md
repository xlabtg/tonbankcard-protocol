# Public Collateral Status Lookup Tests

**Issue Reference:** [#34 - Issue 6.3 Public Collateral Status Lookup (Privacy-Preserving)](https://github.com/xlabtg/tonbankcard-protocol/issues/34)

---

## Overview

This directory contains tests for the Public Collateral Status Lookup feature, which provides a privacy-preserving mechanism to check if an NFT account has active collateral commitments.

### Core Design Principle

> **Reveal existence, not details.**

---

## Test Categories

### 1. Correct Boolean Signaling

Tests that verify the lookup returns correct true/false values:

| Test | Expected Result |
|------|-----------------|
| Account with collateral lock | `true` |
| Account without any locks | `false` |
| Account with only fraud lock | `false` |
| Account with both locks | `true` |
| Non-existent NFT address | `false` |
| Repeated queries same NFT | Consistent results |

### 2. Zero Leakage Guarantees

Tests that verify no sensitive information is exposed:

| Property | Verification |
|----------|-------------|
| Return type | Boolean only |
| Collateral amount | Not exposed |
| Lender identity | Not exposed |
| Timing information | Not exposed |
| Execution time | Consistent (no timing attacks) |

### 3. Adversarial Probing Attempts

Tests that verify security against malicious queries:

| Attack | Mitigation |
|--------|-----------|
| State modification via query | Read-only, no changes |
| Rapid repeated queries | No side effects |
| Invalid address handling | Safe default (false) |
| Lock count inference | Boolean prevents this |
| Correlation attacks | Independent results |

### 4. Privacy Invariant Verification

Tests that verify privacy requirements:

| Invariant | Verification |
|-----------|-------------|
| Minimal output | Single boolean field |
| No prohibited methods | Design verification |
| No side effects | State unchanged |

### 5. Acceptance Criteria Verification

Tests mapped to Issue #34 acceptance criteria:

| Criteria | Test Coverage |
|----------|--------------|
| AC1: Boolean only | Type verification |
| AC2: No details exposed | Interface verification |
| AC3: No restrictions | Informational only |
| AC4: No behavior change | State verification |
| AC5: Privacy intact | Comprehensive check |

---

## Running Tests

```bash
# Run all collateral lookup tests
npx blueprint test tests/collateral-lookup/

# Run with coverage
npx blueprint test --coverage tests/collateral-lookup/

# Run specific test file
npx blueprint test tests/collateral-lookup/PublicCollateralLookup.spec.ts
```

---

## Test Structure

```
tests/collateral-lookup/
├── README.md                           # This file
└── PublicCollateralLookup.spec.ts      # Main test suite
```

---

## Privacy Test Methodology

### What We Test

1. **Output Minimality**: Only boolean returned
2. **State Isolation**: Queries don't modify state
3. **Timing Consistency**: No side-channel attacks
4. **Type Safety**: No metadata leakage
5. **Error Handling**: Graceful failure

### What We DON'T Test (By Design)

The following are **intentionally not testable** because they don't exist:

- Collateral amount retrieval
- Lender address retrieval
- Loan terms retrieval
- Transaction history retrieval
- Access logging
- Query events

---

## Expected Results

All tests should **PASS** when:

1. Lookup returns only `true` or `false`
2. No additional data is returned
3. State is never modified
4. Execution time is consistent
5. Non-existent NFTs return `false`

---

## Related Documentation

- [docs/public-collateral-lookup.md](../../docs/public-collateral-lookup.md)
- [contracts/collateral-lookup/README.md](../../contracts/collateral-lookup/README.md)
- [Issue #34](https://github.com/xlabtg/tonbankcard-protocol/issues/34)
