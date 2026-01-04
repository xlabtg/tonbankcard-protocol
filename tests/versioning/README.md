# TONBANKCARD Protocol — Versioning & Immutability Tests

**Issue Reference:** [#42 - Protocol Versioning & Deployment Policy (Immutable-First)](https://github.com/xlabtg/tonbankcard-protocol/issues/42)

---

## Overview

This directory contains tests that verify the TONBANKCARD protocol adheres to its versioning and immutability policies. These tests ensure that:

1. **No upgrade mechanisms exist** in deployed contracts
2. **Deployments are reproducible** from source code
3. **Deployment manifests** contain all required information
4. **Version metadata** is read-only and informational

---

## Test Files

### `immutability-verification.spec.ts`

Verifies that contracts do not contain upgrade or admin control patterns.

**What it checks:**
- No upgrade functions (`upgrade()`, `setImplementation()`, etc.)
- No proxy patterns (delegatecall, implementation addresses)
- No admin fund control functions
- No self-destruct capabilities
- No pause/kill switches

**Example violations detected:**
```tact
// VIOLATION: Upgrade receiver
receive(msg: UpgradeRequest) { ... }

// VIOLATION: Admin withdrawal
fun adminWithdraw() { ... }

// VIOLATION: Proxy pattern
implementation: Address;
```

### `deployment-reproducibility.spec.ts`

Verifies that deployments can be reproduced from source.

**What it checks:**
- Deployment manifest schema is valid
- Example manifest follows schema
- Source files are deterministically hashable
- Version metadata interface is read-only
- Documentation includes build verification steps

---

## Running Tests

```bash
# Run all versioning tests
npm test -- tests/versioning/

# Run immutability verification only
npm test -- tests/versioning/immutability-verification.spec.ts

# Run reproducibility checks only
npm test -- tests/versioning/deployment-reproducibility.spec.ts

# Run with verbose output
npm test -- tests/versioning/ --verbose
```

---

## Test Categories

### 1. Immutability Verification

| Test Category | Description | Severity |
|--------------|-------------|----------|
| Upgrade Keywords | Scans for `upgrade`, `setImplementation`, etc. | Critical |
| Admin Control | Scans for `adminWithdraw`, `onlyAdmin`, etc. | Critical |
| Proxy Patterns | Scans for `delegatecall`, implementation addresses | Critical |
| Self-Destruct | Scans for `selfdestruct`, `suicide` | Critical |
| Pause Patterns | Scans for `pause()`, `emergencyStop` | High |

### 2. Deployment Reproducibility

| Test Category | Description | Severity |
|--------------|-------------|----------|
| Schema Validation | Verifies deployment manifest schema | High |
| Example Validation | Verifies example manifest is valid | Medium |
| Source Hashing | Verifies files are deterministically hashable | High |
| Documentation | Verifies build steps are documented | Medium |

### 3. Version Metadata

| Test Category | Description | Severity |
|--------------|-------------|----------|
| Interface Exists | Verifies IVersionMetadata.tact exists | High |
| Read-Only | Verifies all functions are getters | Critical |
| Required Getters | Verifies essential version info exposed | High |

---

## Relationship to Invariant Tests

These tests complement the formal invariant tests (I1-I7) in `tests/invariants/`:

| This Test Suite | Related Invariant |
|----------------|-------------------|
| No upgrade patterns | I3 (No Admin Fund Control) |
| No admin withdrawal | I3 (No Admin Fund Control) |
| No proxy patterns | I3 (No Admin Fund Control) |
| Read-only version info | I7 (Adapter Isolation) |

---

## Adding New Tests

When adding new contract files, ensure:

1. **Static analysis coverage**: New files are automatically scanned by `immutability-verification.spec.ts`

2. **Manifest updates**: If deploying new contracts, update example manifest in `schemas/example-deployment-manifest.json`

3. **Version metadata**: If contract exposes version info, implement `IVersionMetadata` trait

---

## Allowed Patterns

Some patterns that might trigger false positives are explicitly allowed:

```tact
// ALLOWED: Version metadata (read-only)
get fun getProtocolVersion(): String;

// ALLOWED: Comments documenting prohibited patterns
// No upgrade mechanisms are allowed

// ALLOWED: Test-only functions marked for removal
// WARNING: MUST be removed before production
receive("setup_account") { ... }
```

---

## Failure Response

If any test fails:

1. **Do not deploy** until the issue is resolved
2. **Investigate** the flagged code
3. **Remove or refactor** any upgrade/admin patterns
4. **Document** if the pattern is a false positive
5. **Add to allowed patterns** if genuinely safe

---

## References

- [Versioning Policy](../../docs/versioning-policy.md)
- [Invariants](../../docs/invariants.md)
- [Deployment Manifest Schema](../../schemas/deployment-manifest-v1.json)
- [Contributing Guidelines](../../CONTRIBUTING.md)

---

**Immutability is verified through code, not promises.**
