# TONBANKCARD Protocol — Versioning & Deployment Policy

**Document Type:** Protocol Governance
**Status:** Formal Specification
**Issue Reference:** [#42 - Issue 8.1 Protocol Versioning & Deployment Policy (Immutable-First)](https://github.com/xlabtg/tonbankcard-protocol/issues/42)
**Last Updated:** 2025-12-29

---

## Purpose

This document defines the **versioning, deployment, and immutability policy** of the TONBANKCARD protocol, ensuring that:

- Deployed contracts are immutable
- No upgrade authority exists
- Protocol behavior cannot be altered post-deployment
- Future protocol changes require explicit new deployments

This policy exists to eliminate **upgrade risk** — the possibility that protocol operators or attackers could modify contract behavior after users have deposited funds.

---

## Core Principle

> **Immutability over convenience.**

Once deployed, a TONBANKCARD contract **must never change**.

**Rationale:**
- Eliminates rug pull vectors
- Enables trustless operation
- Simplifies security audits
- Aligns with non-custodial philosophy (see [docs/governance.md](./governance.md))

---

## Protocol Versioning Model

### Semantic Versioning

TONBANKCARD uses semantic versioning: `MAJOR.MINOR.PATCH`

| Component | When to Increment | Example |
|-----------|------------------|---------|
| **MAJOR** | Breaking changes, new security model, fundamental architecture changes | `1.x.x` → `2.0.0` |
| **MINOR** | New features, additional contracts, non-breaking extensions | `1.0.x` → `1.1.0` |
| **PATCH** | Documentation updates, tooling improvements, non-contract changes | `1.0.0` → `1.0.1` |

### Protocol Version Scope

A protocol version applies to:

- **Contract set**: All smart contracts in the release
- **Invariants**: Security guarantees (see [docs/invariants.md](./invariants.md))
- **Security assumptions**: Trust boundaries and threat model
- **Interfaces**: Public API contracts between components

### Version Identification

The protocol version is **informational, not executable**. It serves as:

- A human-readable reference for documentation
- A tag for deployment manifests
- A coordination point for ecosystem integrations

**The protocol version is NOT stored on-chain** because:
1. On-chain storage costs gas
2. Version alone doesn't provide security guarantees
3. Immutability is enforced by design, not by version checks

---

## Contract Versioning

### Immutability Rules

Each contract deployment is **final**:

| Prohibited Pattern | Reason |
|-------------------|--------|
| Upgradeable proxies | Allows logic replacement |
| Delegatecall patterns | Allows external code execution |
| Mutable logic | Violates immutability |
| Self-destruct | Allows contract destruction |
| Admin upgrade keys | Creates single point of failure |

### Contract Identity

A contract's identity is defined by:

```
Contract Identity = (network, address)
```

- Same source code deployed to different addresses = different contracts
- Each deployment creates a new, independent contract instance
- Old deployments remain functional and untouched

### Version Metadata Interface

Contracts MAY expose read-only version metadata:

```tact
// IVersionMetadata trait for version information
trait IVersionMetadata {
    // Protocol version this contract belongs to
    get fun getProtocolVersion(): String;

    // Human-readable contract name
    get fun getContractName(): String;

    // Source code commit hash
    get fun getSourceCommit(): String;
}
```

**Important:** Version metadata is purely informational. It provides no security guarantees and cannot be used to modify contract behavior.

---

## Deployment Policy

### Deployment Events

Each deployment MUST:

1. **Reference a protocol version** — The semantic version being deployed
2. **Include commit hash** — Exact source code reference
3. **Specify compiler versions** — Tact/FunC compiler and toolchain versions
4. **Target a specific network** — Mainnet, testnet, or development network
5. **Generate a deployment manifest** — Machine-readable deployment record

### Deployment Manifest Schema

Every deployment MUST publish a manifest following this schema:

```json
{
  "$schema": "https://tonbankcard.org/schemas/deployment-manifest-v1.json",
  "protocolVersion": "1.0.0",
  "deployment": {
    "network": "mainnet",
    "networkId": -239,
    "timestamp": "2025-01-15T12:00:00Z",
    "deployer": "EQC...xxx"
  },
  "source": {
    "repository": "https://github.com/xlabtg/tonbankcard-protocol",
    "commit": "abc123def456...",
    "branch": "main",
    "tag": "v1.0.0"
  },
  "compiler": {
    "tact": "1.0.0",
    "func": "0.4.4",
    "fift": "0.4.4"
  },
  "contracts": [
    {
      "name": "PaymentHub",
      "address": "EQA...xxx",
      "codeHash": "sha256:abc123...",
      "initDataHash": "sha256:def456..."
    },
    {
      "name": "MerchantPaymentHub",
      "address": "EQB...yyy",
      "codeHash": "sha256:789xyz...",
      "initDataHash": "sha256:uvw012..."
    }
  ],
  "verification": {
    "bytecodeVerified": true,
    "sourceAvailable": true,
    "auditReports": [
      "https://example.com/audit-report-v1.pdf"
    ]
  }
}
```

### Deployment Checklist

Before any mainnet deployment:

- [ ] All invariant tests pass (see [docs/invariants.md](./invariants.md))
- [ ] Security audit completed (if applicable)
- [ ] Deployment manifest generated
- [ ] Source code tagged and pushed
- [ ] Code hash computed and verified
- [ ] Multi-signature deployment (if applicable)
- [ ] Documentation updated
- [ ] Community notification (if public release)

---

## Upgrade Prohibition

### Forbidden Patterns

The protocol MUST NOT:

| Forbidden | Description |
|-----------|-------------|
| Include upgrade hooks | No `upgrade()`, `setImplementation()`, or similar |
| Expose admin functions | No functions that modify contract logic |
| Allow logic replacement | No proxy patterns or delegatecall |
| Allow storage migration | No arbitrary state modifications |
| Include kill switches | No `pause()`, `emergency_stop()`, or `selfdestruct()` |

### Enforcement

Any attempt to introduce upgradeability MUST be rejected:

1. **Code Review**: All PRs reviewed for upgrade patterns
2. **Static Analysis**: Automated checks for forbidden patterns
3. **Invariant Tests**: I3 (No Admin Fund Control) explicitly prohibits upgrades
4. **Governance**: Architecture changes require explicit approval

### Rationale

Upgradeability introduces:

| Risk | Impact |
|------|--------|
| **Rug pull vector** | Admin can drain funds |
| **Single point of failure** | Compromised key = compromised protocol |
| **Complexity** | More attack surface |
| **Trust assumptions** | Users must trust admin |

TONBANKCARD chooses **predictability over agility**.

---

## Future Protocol Changes

### New Versions

Future changes are permitted ONLY via:

1. **New protocol versions** — Increment MAJOR/MINOR/PATCH appropriately
2. **New contract deployments** — Fresh addresses, clean state
3. **Explicit migration paths** — Users choose whether to adopt

### Migration Model

```
┌─────────────────┐      ┌─────────────────┐
│  Protocol v1.0  │      │  Protocol v2.0  │
│                 │      │                 │
│  ┌───────────┐  │      │  ┌───────────┐  │
│  │ Contract A│  │      │  │ Contract A'│ │
│  │ (address1)│  │      │  │ (address2)│  │
│  └───────────┘  │      │  └───────────┘  │
│                 │      │                 │
│  User funds     │  →   │  User migrates  │
│  remain here    │ opt  │  if desired     │
│                 │ -in  │                 │
└─────────────────┘      └─────────────────┘
     ↑                        ↑
     │                        │
     └── Both remain ─────────┘
         fully functional
```

### Backward Compatibility

| Guarantee | Description |
|-----------|-------------|
| No forced migrations | Users choose when/if to migrate |
| Old versions functional | Previous deployments never disabled |
| No protocol-initiated changes | Only user actions move funds |
| Ecosystem support | Documentation maintained for all versions |

---

## Deployment Reproducibility

### Build Verification

Anyone can verify a deployment by:

1. **Checkout source** — Use commit hash from manifest
2. **Install toolchain** — Use exact compiler versions
3. **Compile contracts** — Generate bytecode
4. **Compare hashes** — Verify against on-chain code

### Reproducibility Checklist

```bash
# 1. Clone repository at deployment commit
git clone https://github.com/xlabtg/tonbankcard-protocol
git checkout <commit-hash>

# 2. Install exact compiler versions
# (versions from deployment manifest)

# 3. Build contracts
npm run build:contracts

# 4. Compute code hash
sha256sum build/PaymentHub.cell

# 5. Compare with on-chain code hash
# (use TON explorer or API)
```

### Deterministic Builds

To ensure reproducibility:

- Use pinned dependency versions
- Document all build parameters
- Provide build scripts in repository
- Test builds on clean environments

---

## Immutability Enforcement

### Design Patterns

The following patterns enforce immutability:

```tact
// GOOD: No admin functions
contract PaymentHub {
    // All functions are user-initiated
    receive(msg: TransferRequest) {
        // User must sign, no admin override
    }
}

// BAD: Admin upgrade function (FORBIDDEN)
contract BadPaymentHub {
    admin: Address;

    // THIS IS FORBIDDEN
    receive(msg: UpgradeRequest) {
        require(sender() == self.admin, "Not admin");
        // ... upgrade logic ...
    }
}
```

### Verification Tests

Immutability is verified through:

1. **Static analysis** — Scan for forbidden patterns
2. **Invariant tests** — I3 (No Admin Fund Control)
3. **Code review** — Manual inspection of all changes
4. **Negative tests** — Attempt violations, verify rejection

---

## Exception: Peripheral Contracts

### Scope

The immutability policy applies to **core protocol contracts**:

- Payment Hub
- Account State Machine
- Account Locks
- NFT Resolver

### Peripheral Contracts

Peripheral contracts (e.g., merchant API adapters) MAY have limited upgradeability IF:

| Requirement | Rationale |
|-------------|-----------|
| No fund custody | Cannot hold user funds |
| Multi-sig control | No single point of failure |
| Time-locked upgrades | Users can exit before changes |
| Transparent changes | All upgrades publicly announced |

**Even peripheral contracts should prefer immutability where possible.**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-29 | Initial formal specification (Issue #42) |

---

## References

- **Invariants**: [docs/invariants.md](./invariants.md)
- **Architecture**: [docs/architecture.md](./architecture.md)
- **Governance**: [docs/governance.md](./governance.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Issue #42**: [Protocol Versioning & Deployment Policy](https://github.com/xlabtg/tonbankcard-protocol/issues/42)

---

## Document Maintenance

**Responsibility**: Protocol Governance Team
**Review Frequency**: Before each protocol version release
**Update Triggers**:
- New deployment procedures
- Security audit findings
- Governance decisions
- Toolchain changes

---

**Immutability is a security feature, not a limitation.**

**TONBANKCARD: Predictable. Auditable. Trustless.**
