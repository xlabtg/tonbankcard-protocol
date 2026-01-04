# TONBANKCARD Protocol — External Integration Guarantees

**Document Type:** Integration Specification
**Status:** Formal Specification
**Issue Reference:** [#46 — External Integration Guarantees (Backward Compatibility & Trust Boundaries)](https://github.com/xlabtg/tonbankcard-protocol/issues/46)
**Last Updated:** 2025-12-30

---

## Purpose

This document formally defines the **guarantees and non-guarantees** that TONBANKCARD provides to all **external integrators**.

This specification establishes:
- Clear trust boundaries
- Compatibility expectations
- Upgrade guarantees
- Explicit disclaimers

This document protects both:
- Protocol users
- External partners

from ambiguous assumptions.

---

## Scope

This document applies to **all read-only and non-custodial integrations**, including but not limited to:

- Merchant API / SDK users
- Payment processors (ChangeNOW, NOWPayments)
- Lending adapters (CoinRabbit)
- Indexers and explorers
- Analytics and monitoring tools

**No executable code is introduced by this specification.**

---

## Guarantees

### What TONBANKCARD Guarantees

The following guarantees are **formally committed** by the TONBANKCARD protocol:

---

### 1. Non-Custodial Integrity

TONBANKCARD guarantees:

- The protocol **never** custodies user funds
- No external party can move user funds
- No admin or governance override exists for fund movement

**Formal Statement:**
```
∀ transaction T, ∀ user U:
  IF T transfers funds from U's account
  THEN T MUST be signed by U (the NFT owner)
  AND T MUST be initiated by U
  AND no protocol admin/operator can initiate T on behalf of U
```

**Implementation Reference:** See [Formal Invariants (I1)](../invariants.md#i1--non-custodial-ownership)

---

### 2. Protocol Immutability

TONBANKCARD guarantees:

- Core contracts are **immutable** once frozen
- No upgradeable proxies are used for core contracts
- No hidden upgrade paths exist

**Implications:**
- Integrators can rely on deployed contract addresses indefinitely
- Contract behavior will not change without new deployment
- Security audits remain valid for deployed versions

**Implementation Reference:** See [Formal Invariants (I3)](../invariants.md#i3--no-admin-fund-control)

---

### 3. Backward Compatibility

TONBANKCARD guarantees:

- Existing contract interfaces remain stable
- Previously deployed addresses remain valid
- New versions **never** invalidate old ones

**Compatibility Policy:**
| Change Type | Backward Compatible | Migration Required |
|-------------|--------------------|--------------------|
| New contract version | Yes | No |
| New API endpoints | Yes | No |
| Deprecated features | Yes (informational) | No |
| Contract interface changes | N/A (immutable) | New deployment |

**Key Principle:** Deprecation is **informational only**, never enforced. Old integrations continue to function.

---

### 4. Deterministic Behavior

TONBANKCARD guarantees:

- Contract logic is deterministic
- State transitions follow documented invariants
- No off-chain authority affects outcomes

**What This Means:**
- Given the same inputs, contracts produce the same outputs
- No randomness or external oracles affect core protocol logic
- All state transitions are reproducible and auditable

**Implementation Reference:** See [Formal Invariants (I4, I5)](../invariants.md#i4--atomic-transfers)

---

## Non-Guarantees

### What TONBANKCARD Does NOT Guarantee

The following are **explicitly not guaranteed** by the protocol:

| Non-Guarantee | Explanation |
|---------------|-------------|
| Uptime of off-chain services | API endpoints may be unavailable |
| Availability of indexers | Indexer services may lag or fail |
| Price stability of TBC | Market determines TBC price |
| Liquidity depth | No protocol-owned liquidity |
| Merchant solvency | Merchants are independent entities |
| Lending approval decisions | External lenders make their own decisions |
| Governance outcomes | No binding governance authority exists |

### Integration Assumptions That Are NOT Safe

External integrations **MUST NOT** assume:

- **Availability SLAs**: No uptime guarantees for off-chain services
- **Profitability**: Protocol does not guarantee economic outcomes
- **Liquidity support**: No protocol intervention in markets
- **Execution guarantees**: Network conditions may affect transactions
- **Price stability**: TBC is not pegged or stabilized

---

## Trust Boundaries

### Trust Level Definitions

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| **On-chain contracts** | Trustless | Cryptographically verified, immutable |
| **User wallet** | User-trusted | User controls their own keys |
| **Indexers** | Low-trust | Read-only cache, may lag |
| **Merchant servers** | Untrusted | External to protocol |
| **Payment providers** | Untrusted | External services |
| **Lending partners** | Untrusted | External services |
| **Governance** | Non-authoritative | Advisory only |

### Trust Hierarchy Diagram

```
HIGH TRUST (On-Chain)
├── NFT Ownership
├── TBC Balances
├── Smart Contract Logic
└── Settlement Events

MEDIUM TRUST (Protocol Off-Chain)
├── Indexer (read-only)
├── Merchant API (orchestration)
└── SDK (convenience wrapper)

LOW TRUST (External)
├── Third-party merchants
├── Payment processors
├── Lending partners
└── Analytics services

NO TRUST (User Responsibility)
├── Wallet security
├── Private key management
└── Transaction verification
```

### Security Implications

**For Integrators:**
- Always verify on-chain data for authoritative state
- Treat all off-chain data as informational only
- Do not rely on indexer data for fund release decisions
- Implement independent on-chain verification

**For Users:**
- Your wallet is the only trusted interface
- Verify all transaction details before signing
- Protocol cannot recover lost funds or keys

---

## Upgrade & Change Policy

### Core Principles

1. **No breaking changes are introduced retroactively**
2. **New features require new contracts or versions**
3. **Old integrations remain functional**
4. **Deprecation is informational only, never enforced**

### Change Categories

| Category | Impact | Example |
|----------|--------|---------|
| **Additive** | None | New getter functions |
| **Enhancement** | Optional | Additional event emissions |
| **Deprecation** | Informational | Outdated API endpoints |
| **New Version** | Migration available | New contract deployment |

### Version Policy

- **Protocol versions** follow semantic versioning
- **Contract versions** are immutable per deployment
- **API versions** are backward compatible within major version
- **SDK versions** follow [compatibility matrix](../../sdk/README.md#sdk--api-compatibility)

### Migration Support

When new contract versions are deployed:
- Old versions continue to operate
- Migration is opt-in for users
- Documentation includes migration guides
- No forced migration timeline

---

## Integration Expectations

### What Integrators MUST Do

External integrators **MUST**:

1. **Verify on-chain state independently**
   - Do not trust SDK/API responses as authoritative
   - Query blockchain directly for critical decisions

2. **Handle indexer downtime gracefully**
   - Implement fallback to direct blockchain queries
   - Do not block user operations on indexer availability

3. **Treat all off-chain data as non-authoritative**
   - API responses are informational only
   - Settlement verification requires on-chain proof

4. **Rely on Network Deployment Matrix for addresses**
   - Use official contract addresses from documentation
   - Verify addresses before integration

### Integration Best Practices

```typescript
// CORRECT: Verify settlement on-chain
const verification = await sdk.verifySettlement(txHash);
if (verification.isValid && verification.confirmations >= 5) {
  // Safe to proceed
}

// INCORRECT: Trust API response alone
const status = await api.getInvoiceStatus(invoiceId);
if (status === 'paid') {
  // DANGEROUS: Not verified on-chain
}
```

### Failure Attribution

| Failure Scenario | Responsibility |
|------------------|----------------|
| Contract bugs | Protocol team |
| Off-chain service downtime | Protocol team (best effort) |
| Integration misuse | Integrator |
| On-chain verification skipped | Integrator |
| User key compromise | User |
| Market/price movements | No one (market risk) |

---

## Explicit Non-Goals

This specification **MUST NOT**:

- Create SLAs or uptime commitments
- Promise performance or throughput guarantees
- Imply custody of user funds
- Imply protocol responsibility for third-party behavior
- Introduce governance authority over user funds

---

## Security & Legal Notes

### Security Purpose

This document is intended to:
- Reduce integration risk through clear boundaries
- Prevent misrepresentation of protocol capabilities
- Support audit and legal review processes
- Protect protocol neutrality

### Disclaimer

TONBANKCARD provides **infrastructure, not guarantees of outcomes**.

All integrations operate under:

> **"Verify, do not trust."**

The protocol:
- Makes no warranties, express or implied
- Does not guarantee fitness for any particular purpose
- Is not responsible for external service behavior
- Cannot reverse or modify blockchain transactions

### Regulatory Note

Integrators are responsible for:
- Compliance with local regulations
- KYC/AML requirements in their jurisdiction
- Tax reporting obligations
- Consumer protection compliance

---

## References

- **Formal Invariants**: [docs/invariants.md](../invariants.md)
- **Architecture**: [docs/architecture.md](../architecture.md)
- **Merchant API**: [docs/merchant-api-spec.md](../merchant-api-spec.md)
- **Merchant SDK**: [sdk/README.md](../../sdk/README.md)
- **Lending Adapter**: [docs/lending-adapter.md](../lending-adapter.md)
- **Governance**: [docs/governance.md](../governance.md)

---

## Document Maintenance

**Responsibility:** Protocol Integration Team
**Review Frequency:** Before each major release
**Update Triggers:**
- New integration patterns
- Protocol architecture changes
- Security audit findings
- Community feedback

**Version History:**
- v1.0 (2025-12-30): Initial formal specification (Issue #46)

---

**Built on TON. Secured by Design. Verified by Users.**
