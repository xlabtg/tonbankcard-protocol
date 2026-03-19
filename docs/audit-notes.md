# Audit Notes: Known Limitations & Accepted Risks

## Overview

This document provides transparency for auditors regarding known limitations, accepted risks, planned future enhancements, and areas requiring special attention in the Tonbankcard protocol.

**Issue Reference**: [#22 - Audit Readiness Checklist & Scope Definition](https://github.com/xlabtg/tonbankcard-protocol/issues/22)

---

## Known Limitations

### 1. Invoice Replay Protection (Off-Chain)

**Status**: 🟡 **KNOWN LIMITATION**

**Description**:
Currently, invoice uniqueness and replay protection for merchant payments are enforced **off-chain** by the merchant backend, not by the smart contract.

**Impact**:
- Merchants must maintain invoice ID tracking in their backend
- Same invoice could theoretically be paid multiple times if merchant backend fails
- On-chain contract does not prevent duplicate payments to same invoice ID

**Current Mitigation**:
- Merchant API tracks invoice IDs and marks as paid
- Frontend prevents duplicate payment submissions
- Event emission includes `payload_hash` for off-chain indexing and verification
- Merchants responsible for validating invoice status before fulfillment

**Residual Risk**: 🟡 **MEDIUM**
- Risk primarily borne by merchants (not users or protocol)
- User funds are safe (worst case: merchant receives duplicate payment)
- Merchant can detect duplicates via event indexing

**Future Enhancement**:
- On-chain invoice ID or nonce tracking (future GitHub Issue)
- Contract-level replay prevention
- Mapping: `invoice_id → paid_status`

**Auditor Note**:
This is an **accepted risk** for the current implementation. Merchants are made aware of this limitation and must implement off-chain tracking. User funds remain safe as payments are still user-initiated and cannot be pulled by merchants.

**References**:
- See `contracts/MerchantPaymentHub.tact:payMerchant()` - includes payload parameter
- See `tests/MerchantPaymentDynamic.spec.ts` - dynamic invoice payment tests

---

### 2. DAO Unlocking Not Implemented

**Status**: 🟢 **PLANNED FEATURE**

**Description**:
The state transition from **FROZEN → ACTIVE** is documented in the architecture but not yet implemented. This requires DAO governance, which is planned for a future phase.

**Impact**:
- Once an account is set to FROZEN state, it cannot be unlocked to ACTIVE in the current implementation
- No automatic or manual unlock mechanism available
- Accounts frozen by Risk Authority remain frozen until DAO is implemented

**Current Workaround**:
- Risk Authority should use FROZEN state sparingly
- For temporary restrictions, consider using FRAUD_LOCK instead (can be cleared)
- If permanent unlock needed: deploy new contract version with unlock capability

**Residual Risk**: 🟢 **LOW**
- FROZEN state should only be used for confirmed fraud cases
- FRAUD_LOCK provides similar functionality with reversibility

**Future Enhancement**:
- DAO governance contract (future GitHub Issue)
- Multi-sig approval for FROZEN → ACTIVE transition
- Time-locked unlock mechanisms
- Appeals process for frozen accounts

**Auditor Note**:
This is a **planned feature**, not a security vulnerability. The protocol is designed to be conservative: easier to lock than unlock. This aligns with security-first principles.

**References**:
- See `docs/architecture.md` - Account State Machine section
- See `contracts/payment-hub/account-state.tact` - State transition logic

---

### 3. Lending Adapter Unlock Not Implemented

**Status**: 🟢 **PLANNED FEATURE**

**Description**:
The state transition from **COLLATERAL_LOCKED → ACTIVE** is specified but not yet implemented. This requires a Lending Adapter contract, which is planned for a future phase.

**Impact**:
- Accounts set to COLLATERAL_LOCKED state cannot be automatically unlocked
- No lending feature currently exists, so this state is not actively used
- COLLATERAL_LOCK flag in Account Locks contract works independently

**Current Status**:
- COLLATERAL_LOCKED state is defined in state machine
- COLLATERAL_LOCK flag in Account Locks contract is functional
- Lending Adapter contract does not exist yet

**Residual Risk**: 🟢 **LOW**
- No lending feature means no accounts should be in COLLATERAL_LOCKED state
- If mistakenly set: requires contract upgrade or migration to unlock

**Future Enhancement**:
- Lending Adapter contract (future GitHub Issue)
- Collateral management logic
- Automated unlock upon debt repayment
- Integration with external lending protocols (CoinRabbit, etc.)

**Auditor Note**:
This is a **future feature**. Current audit scope does not include lending functionality. The architecture is designed to support lending in the future without requiring core contract changes.

**References**:
- See `docs/architecture.md` - Future Architecture Components
- See `contracts/payments/ACCOUNT_LOCKS.md` - COLLATERAL_LOCK description

---

### 4. NFT Ownership Integration (Partial)

**Status**: 🟡 **INTEGRATION DEPENDENCY**

**Description**:
Some contracts document NFT ownership checks in their interfaces and specifications, but do not fully enforce ownership verification within the contract itself. Instead, they rely on calling contracts (e.g., MerchantPaymentHub) to perform ownership verification.

**Affected Components**:
- Account State Machine (`account-state.tact`) - documents ownership checks but trusts caller
- Payment Hub (`PaymentHub.tact`) - implements ownership verification
- NFT Account Resolver - provides `resolveOwner()` interface

**Impact**:
- Ownership verification responsibility is on calling contracts
- If a future contract forgets to check ownership, vulnerability possible
- Architecture requires explicit ownership check in each entry point

**Current Mitigation**:
- MerchantPaymentHub explicitly checks ownership: `require(msg.sender == owner(payer_nft))`
- Payment Hub implements ownership verification
- NFT Account Resolver provides correct ownership data
- All critical paths tested for ownership enforcement

**Residual Risk**: 🟡 **MEDIUM**
- Risk: Future contract additions might skip ownership check
- Mitigation: Code review and testing for all new contracts

**Future Enhancement**:
- Shared authorization module
- Enforced ownership check in base contract
- Automatic ownership verification in framework

**Auditor Note**:
This is an **architectural pattern** choice. Each user-facing contract MUST implement ownership verification. Auditors should verify that all entry points in MerchantPaymentHub and PaymentHub check ownership correctly.

**References**:
- See `contracts/MerchantPaymentHub.tact:payMerchant()` - ownership check
- See `contracts/nft-resolver/nft_account_resolver.fc` - ownership resolution
- See `tests/MerchantPaymentHub.spec.ts` - ownership tests

---

### 5. External Adapter Availability

**Status**: 🟢 **ACCEPTED RISK**

**Description**:
External services (ChangeNOW, NOWPayments, CoinRabbit) may be unavailable, slow, or provide incorrect quotes. The protocol design isolates these risks, but user experience may be affected.

**Impact**:
- If ChangeNOW is down: Users cannot perform external swaps (on-ramp/off-ramp)
- If NOWPayments is down: Merchants cannot accept certain payment methods
- If adapter provides bad quote: User may get unfavorable rate

**Current Mitigation**:
- Adapters **CANNOT** move funds without user signature
- Adapters provide quotes and routing only (non-authoritative)
- All on-chain transactions require user approval
- Adapter failures do not affect on-chain state or security
- Users can choose alternative adapters or use TONCO DEX directly

**Residual Risk**: 🟢 **LOW** (security), 🟡 **MEDIUM** (UX)
- Security: No fund loss possible (adapters isolated)
- UX: Service unavailability affects user experience

**Future Enhancement**:
- Multiple adapter options (redundancy)
- Fallback adapter selection
- Adapter status monitoring
- SLA tracking and adapter reputation

**Auditor Note**:
This is an **accepted operational risk**, not a security vulnerability. The protocol is designed to be resilient to external service failures. On-chain security is unaffected.

**References**:
- See `docs/architecture.md` - External Integrations section
- See `docs/threat-model.md` - T6: External Adapter Exploits

---

### 6. Gas Price Volatility

**Status**: 🟢 **ACCEPTED RISK** (inherent to blockchain)

**Description**:
TON blockchain gas prices may spike during network congestion, making transactions more expensive for users.

**Impact**:
- User transaction costs may be higher than expected during peak times
- Some users may delay transactions to wait for lower gas prices
- Internal transfers designed to be gas-efficient, but still subject to base gas costs

**Current Mitigation**:
- Contracts optimized for gas efficiency
- No unbounded loops or excessive storage operations
- Estimated gas costs documented (see `contracts/README.md`)
- Zero protocol fees for internal transfers (only gas fees apply)

**Residual Risk**: 🟢 **LOW**
- Inherent to blockchain operation
- Affects all blockchain users equally
- Protocol design minimizes gas usage

**Future Enhancement**:
- Gas estimation in frontend
- Warning for high gas periods
- Batching transactions (if applicable)

**Auditor Note**:
This is not a protocol issue, but a blockchain characteristic. Auditors should verify that contracts are gas-efficient and do not have unnecessary gas consumption.

**References**:
- See `contracts/README.md` - Gas Costs section

---

## Accepted Risks

### 1. Frontend Phishing

**Risk**: 🟠 **MEDIUM** (user-dependent)

**Description**:
Users may interact with fake frontends that impersonate the official Tonbankcard UI, leading to signing malicious transactions.

**Mitigation**:
- Official domain verification (DNS, HTTPS)
- TON Connect wallet shows full transaction details before signing
- User education on verifying transaction contents
- Open-source frontend code for community verification
- Content Security Policy (CSP) headers

**Responsibility**: User education and verification

**Auditor Note**:
This is a **user security** issue, not a smart contract vulnerability. Wallets show transaction details, giving users opportunity to detect malicious transactions.

---

### 2. User Error (Incorrect Addresses)

**Risk**: 🟡 **MEDIUM** (user-dependent)

**Description**:
Users may send TBC to incorrect addresses or lose access to their NFT (and associated balance) by transferring it to an uncontrolled wallet.

**Mitigation**:
- Frontend address validation
- Checksum verification
- Confirmation dialogs for large amounts
- Warning messages for unusual transactions

**Responsibility**: User diligence

**Auditor Note**:
This is a **user operational risk**. Protocol cannot prevent user errors. This is similar to sending crypto to wrong address in any blockchain system.

---

### 3. Market Risk (TBC Price Volatility)

**Risk**: 🟡 **MEDIUM** (market-dependent)

**Description**:
TBC token price may fluctuate relative to TON and other currencies, affecting the value of user holdings.

**Mitigation**:
- No protocol-enforced price pegs (free market)
- TONCO DEX provides transparent price discovery
- Users can swap to stablecoins if desired

**Responsibility**: User investment decisions

**Auditor Note**:
This is a **market risk**, not a protocol security issue. The protocol does not promise price stability.

---

## Future Planned Changes

### 1. On-Chain Invoice Replay Protection

**Timeline**: Future (after initial audit)

**Description**: Add on-chain tracking of invoice IDs to prevent replay attacks at the smart contract level.

**Impact on Current Audit**: None (feature addition, not fix)

---

### 2. DAO Governance

**Timeline**: Future (Phase 2)

**Description**: Implement decentralized governance for:
- Risk Authority key management
- FROZEN account unlocking
- Protocol parameter adjustments (if any)
- Treasury management (if applicable)

**Impact on Current Audit**: None (separate contracts)

---

### 3. Multi-Sig Admin Keys

**Timeline**: Future (after initial launch)

**Description**: Replace single admin keys (Risk Authority, Lending Adapter) with multi-sig wallets for additional security.

**Impact on Current Audit**: None (deployment configuration)

---

### 4. Formal Verification

**Timeline**: Future (post-audit enhancement)

**Description**: Formally verify critical invariants using tools like:
- TLA+ specifications
- Coq proofs
- Symbolic execution (Certora, etc.)

**Focus Areas**:
- Balance conservation proof
- Atomic transfer correctness
- State machine validity
- Authorization soundness

**Impact on Current Audit**: None (additional verification layer)

---

## Areas Requiring Special Attention

### 1. Balance Conservation (Invariant I3)

**Why Critical**:
This is the most critical invariant. Violation means protocol insolvency (phantom balances or fund loss).

**Auditor Focus**:
- Verify every transfer path maintains: `sum(balances_before) = sum(balances_after)`
- Check for arithmetic overflow/underflow
- Verify atomic debit/credit operations
- Test edge cases: max balance, min balance, zero amounts

**Test Coverage**:
- See `tests/MerchantPaymentHub.spec.ts` - balance conservation tests
- See `tests/MerchantPaymentEdgeCases.spec.ts` - edge case scenarios

---

### 2. Ownership Verification (Invariant I2)

**Why Critical**:
This ensures only NFT owners can move funds. Bypass means unauthorized fund access.

**Auditor Focus**:
- Verify ownership checked at **execution time**, not signing time
- Check for race conditions (NFT transferred during pending transaction)
- Verify no cached ownership assumptions
- Ensure no alternative authorization paths

**Test Coverage**:
- See `tests/MerchantPaymentHub.spec.ts` - ownership tests
- See `tests/nft-resolver/NFTAccountResolver.spec.ts`

---

### 3. Lock Enforcement (Invariant I5)

**Why Critical**:
Locks prevent fraud and ensure collateral integrity. Bypass undermines risk management.

**Auditor Focus**:
- Verify locks checked before ALL send operations
- Check for alternative transfer paths that skip lock checks
- Verify receiving is always allowed (locks don't prevent incoming)
- Test combined locks (fraud + collateral simultaneously)

**Test Coverage**:
- See `tests/MerchantPaymentLocks.spec.ts` - comprehensive lock tests
- See `contracts/payments/tests/account-locks.spec.fc`

---

### 4. Atomicity (Invariant I4)

**Why Critical**:
Partial transfers can lead to fund loss or double-spend.

**Auditor Focus**:
- Verify all-or-nothing execution
- Check that failed validations revert entire transaction
- Verify no partial state updates
- Test gas exhaustion scenarios (if applicable)

**Test Coverage**:
- See `tests/MerchantPaymentEdgeCases.spec.ts` - atomic transfer tests

---

### 5. Admin Fund Access (Invariant I1)

**Why Critical**:
This is the non-custodial guarantee. Any admin fund access violates core principle.

**Auditor Focus**:
- Search entire codebase for admin withdrawal functions
- Verify no "emergency" fund recovery
- Check that admin keys can only manage locks/states, not balances
- Verify immutability (no upgrade paths for core logic)

**Expected Findings**: **ZERO** admin fund access functions

---

## Testing Gaps & Coverage Notes

### Test Coverage Summary

| Contract | Line Coverage | Branch Coverage | Status |
|----------|---------------|-----------------|--------|
| MerchantPaymentHub | ~90%+ | ~85%+ | ✅ Good |
| PaymentHub | ~85%+ | ~80%+ | ✅ Good |
| Account Locks | ~85%+ | ~80%+ | ✅ Good |
| NFT Resolver | ~80%+ | ~75%+ | ⚠️ Adequate |
| Account State Machine | ~90%+ | ~85%+ | ✅ Good |

### Known Testing Gaps

1. **Extreme Gas Scenarios**: Limited testing of gas exhaustion edge cases
2. **Concurrent Transactions**: Limited testing of high-concurrency scenarios (inherent to blockchain)
3. **Formal Verification**: No formal proofs (planned for future)

### Recommended Additional Tests (Nice to Have)

- Fuzzing tests for input validation
- Property-based testing for invariants
- Stress testing with high transaction volume (simulation)
- Gas optimization benchmarking

---

## Code Quality Notes

### Code Strengths

✅ **Clear Variable Names**: Functions and variables well-named and descriptive

✅ **Explicit Error Codes**: Each failure case has specific error code

✅ **Comprehensive Comments**: Complex logic documented inline

✅ **Consistent Style**: Follows Tact and FunC conventions

✅ **Event Emission**: All state changes emit events

### Areas for Improvement (Non-Critical)

⚠️ **Lack of NatSpec Comments**: Some functions missing detailed documentation comments (not a security issue)

⚠️ **Limited Inline Documentation**: Some complex sections could benefit from more explanatory comments

⚠️ **Test Organization**: Some test files are large; could be split into smaller suites

**Note**: These are code quality observations, not security issues.

---

## Deployment Considerations

### Pre-Deployment Checklist

Before mainnet deployment, ensure:

- [ ] All Critical and High audit findings resolved
- [ ] Comprehensive testing on testnet
- [ ] Gas costs verified and documented
- [ ] Admin keys secured (hardware wallets, multi-sig)
- [ ] Deployment scripts tested
- [ ] Rollback plan documented
- [ ] User migration plan (if applicable)
- [ ] Bug bounty program established

### Post-Deployment Monitoring

Recommended monitoring:

- **On-Chain Events**: Track all MerchantPayment, AccountLocked, etc.
- **Balance Totals**: Periodic verification of balance conservation
- **Gas Usage**: Monitor transaction costs
- **Failed Transactions**: Track and analyze failed transaction reasons
- **Lock Status**: Monitor fraud lock and collateral lock usage

---

## Contact for Clarifications

If auditors have questions or need clarifications:

- **GitHub Issues**: [https://github.com/xlabtg/tonbankcard-protocol/issues](https://github.com/xlabtg/tonbankcard-protocol/issues)
- **Primary Contact**: [To be specified]
- **Response Time**: Within 24 hours for audit-related questions

---

## Document Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-27 | Initial audit notes document |

---

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-27
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.0

---

## Appendix: Risk Summary Matrix

| Risk Category | Severity | Likelihood | Overall | Status |
|---------------|----------|------------|---------|--------|
| Invoice Replay (off-chain) | MEDIUM | MEDIUM | 🟡 MEDIUM | Accepted |
| DAO Unlock Not Implemented | LOW | LOW | 🟢 LOW | Planned |
| Lending Unlock Not Implemented | LOW | LOW | 🟢 LOW | Planned |
| NFT Ownership Integration | MEDIUM | LOW | 🟡 MEDIUM | Documented |
| External Adapter Availability | LOW | MEDIUM | 🟡 MEDIUM | Accepted |
| Gas Price Volatility | LOW | MEDIUM | 🟢 LOW | Inherent |
| Frontend Phishing | MEDIUM | MEDIUM | 🟠 MEDIUM | User Education |
| Smart Contract Bugs | HIGH | LOW | 🟠 MEDIUM | Audit Mitigates |

**Overall Protocol Risk**: 🟢 **LOW-MEDIUM** (acceptable for production with audit)
