# TONBANKCARD Protocol — Threat Model

**Document Type:** Audit Package
**Issue Reference:** [#55 — Issue 10.2 Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
**Derived From:** [docs/threat-model.md](../docs/threat-model.md)
**Version:** 1.0
**Status:** FROZEN — Pre-Audit Package
**Last Updated:** 2026-03-05

---

## Purpose

This document provides the auditor-facing threat model for the TONBANKCARD protocol. It identifies all realistic attack vectors, maps them to contracts and code locations, documents mitigations, and calls out known residual risks.

Full detailed analysis with monitoring pseudocode is in [docs/threat-model.md](../docs/threat-model.md). This document provides a structured summary optimized for audit use.

---

## Threat Model Assumptions

### Attacker Capabilities

Attackers CAN:
- Observe all on-chain state and transactions
- Front-run transactions (MEV)
- Interact with contracts arbitrarily
- Transfer NFTs freely on open markets
- Deploy malicious contracts
- Attempt reentrancy via callbacks
- Send crafted messages to contracts
- Analyze contract bytecode

Attackers CANNOT:
- Break cryptographic primitives (ECDSA, SHA-256)
- Forge digital signatures
- Bypass TON consensus
- Modify immutable contract code
- Access user private keys (unless compromised externally)

### System Assumptions

We ASSUME:
- TON blockchain consensus is secure and Byzantine-fault tolerant
- TON Virtual Machine (TVM) executes code deterministically
- NFT contracts correctly implement ownership semantics
- TBC jetton contract correctly implements TEP-74

We DO NOT ASSUME:
- Off-chain components are always available
- External price oracles are truthful
- External adapters act honestly

---

## Trust Boundaries

| Level | Component | Trust | Description |
|-------|-----------|-------|-------------|
| 1 | TON Blockchain Consensus | ABSOLUTE | Foundation of all security guarantees |
| 2 | Protocol Smart Contracts | HIGH | Immutable, auditable, deterministic |
| 3 | Off-Chain Components (API, Indexer) | MEDIUM | Read-only, cannot move funds |
| 4 | External Services (ChangeNOW, NOWPayments, CoinRabbit) | LOW | Adversarial — informational only |

**Critical Rule:** Off-chain components and external services CANNOT change on-chain state. All fund movements require user-signed on-chain transactions.

---

## Threat Classes

### T1 — NFT Transfer Race Conditions

**Description:** NFT ownership can change during pending transactions, creating potential authorization gaps.

**Attack Scenario:**
```
1. Alice owns NFT #7777001 with 1000 TBC
2. Alice initiates transfer
3. Before execution, Alice transfers NFT to Bob
4. Transaction executes — who authorized it?
```

**Affected Contract Functions:**
- `PaymentHub.tact` — `receive(TransferInternalRequest)` line 164 (ownership check)
- `MerchantPaymentHub.tact` — `checkOwnership()` lines 90–96
- `nft_account_resolver.fc` — `resolve_owner()` lines 61–69

**Current Mitigation:** Ownership verified at execution time via on-chain query (not at signing time). Each message handled atomically.

**Residual Risk:** LOW — Attacker must legitimately purchase NFT to exploit. New owner gaining access is intended behavior (NFT = authority).

**Invariants Affected:** I1, I2

---

### T2 — Reentrancy & Callback Abuse

**Description:** Malicious contracts attempt reentrancy via callbacks during fund transfers.

**Attack Scenario:**
```
1. Attacker deploys malicious NFT contract
2. Malicious contract's recv_internal() triggers callback to Payment Hub
3. During execution, callback attempts to re-enter transfer function
```

**Affected Components:**
- All message handlers in PaymentHub.tact
- Account Locks handlers

**Current Mitigation:**
- TON uses message-passing actor model — no synchronous external calls during execution
- Reentrancy guard implemented: `transferLock: Bool` (PaymentHub.tact lines 149–150)
- All state changes complete before any messages sent

**Residual Risk:** LOW — TON's actor model provides inherent protection. Reentrancy guard adds defense-in-depth.

**Invariants Affected:** I4

---

### T3 — Ledger Desynchronization

**Description:** Internal ledger diverges from actual TBC token balances, creating phantom balances.

**Attack Scenario:**
```
1. Internal ledger: Account A has 1000 TBC
2. Actual jetton wallet: Account A has 500 TBC
3. Account A transfers 750 TBC — ledger passes, jetton fails → desync
```

**Affected Components:**
- PaymentHub.tact — balance tracking (lines 196–202)
- TBC Jetton Wallets (external immutable contract)
- Off-chain Indexer (informational only)

**Current Mitigation:**
- Single source of truth: TBC Jetton Contract (immutable, existing)
- Payment Hub does NOT maintain internal balance ledger independently
- Jetton contract enforces: `Σ(all wallet balances) = total_supply`
- Off-chain indexer is informational only; blockchain is authoritative

**Residual Risk:** LOW — TBC jetton (immutable) enforces conservation. Off-chain indexer staleness affects UI only, not funds.

**Invariants Affected:** I5

---

### T4 — Lock Bypass Attempts

**Description:** Attackers attempt to move funds from locked accounts.

**Attack Scenario:**
```
1. Account locked with COLLATERAL_LOCK
2. Attacker attempts:
   a) Direct jetton transfer (bypass Payment Hub)
   b) NFT transfer to new owner who initiates transfer
   c) Alternate transfer paths
```

**Affected Contract Functions:**
- `account-locks.fc` — `can_send()` lines 83–92
- `PaymentHub.tact` — lock check before transfers
- `MerchantPaymentHub.tact` — `checkLockState()` lines 116–119

**Current Mitigation:**
- Lock state enforced at Payment Hub level before all sends
- `can_receive()` always returns 1 — locks never block incoming funds (no confiscation)
- Locks are reversible by appropriate authority

**Known Limitation — Direct Jetton Bypass:**
- The TBC jetton contract is immutable and does NOT know about Account Locks
- Users CAN bypass locks by transferring TBC jetton directly (bypassing Payment Hub)
- **Locks are enforced for protocol operations; advisory for direct jetton transfers**
- This architectural limitation is documented and accepted (see `docs/audit-notes.md`)
- Mitigation: Off-chain monitoring, marketplace integration, social consensus

**Residual Risk:** HIGH (architectural) — Direct jetton transfers bypass protocol locks. This is a documented design constraint of using an immutable external jetton contract.

**Invariants Affected:** I6

---

### T5 — Merchant Payment Abuse

**Description:** Merchants attempt unauthorized withdrawals, invoice replay, or payment manipulation.

**Attack Scenarios:**

**Scenario A — Invoice Replay:**
```
1. Customer pays invoice #12345 for 100 TBC
2. Merchant resubmits same invoice
3. Without replay protection, customer charged twice
```

**Scenario B — Unauthorized Settlement:**
```
1. Merchant calls payMerchant without user signature
2. Protocol must reject (user must sign)
```

**Affected Contract Functions:**
- `MerchantPaymentHub.tact` — `payMerchant()` lines 64–86
- `MerchantPaymentHub.tact` — `checkOwnership()` lines 90–96

**Current Mitigation:**
- All merchant payments require payer to sign the transaction
- User must be the current NFT owner at execution time
- No merchant pull payments possible

**Known Limitation — No On-Chain Invoice Uniqueness:**
- Contract does NOT enforce unique invoice IDs
- Same invoice can be paid multiple times if user signs twice
- Replay protection is off-chain only (merchant backend responsibility)
- Risk is borne by merchants, not users (user authorizes each payment)

**Residual Risk:** MEDIUM — Invoice replay requires user to sign twice. Risk to merchants, not users.

**Invariants Affected:** I1, I3

---

### T6 — External Adapter Exploits

**Description:** External providers (ChangeNOW, NOWPayments, CoinRabbit) misbehavior:
- False transaction confirmations
- API response manipulation
- Man-in-the-middle attacks

**Attack Scenario:**
```
1. ChangeNOW API returns "Transaction confirmed, 50000 TBC sent"
2. User's TBC wallet shows no deposit (false confirmation)
3. Protocol must not credit balance based on API alone
```

**Affected Components:**
- Off-chain adapters: `backend/adapters/changenow.ts`, `backend/adapters/nowpayments.ts`
- Merchant API webhook handling
- PaymentHub.tact — `handle_payment_received()` (on-chain receipt validation)

**Current Mitigation:**
- External API responses are INFORMATIONAL ONLY
- No adapter can trigger on-chain state change directly
- All fund movements require on-chain confirmation (actual jetton transfer)
- Merchant API must verify on-chain before fulfillment

**Residual Risk:** MEDIUM — External services can cause UX issues but cannot steal funds. On-chain truth always prevails.

**Invariants Affected:** I7

---

### T7 — Oracle / Price Manipulation (Future Risk)

**Description:** Manipulation of external price data for collateral valuation, enabling under-collateralized lending.

**Status:** NOT CURRENTLY APPLICABLE — Lending protocol not yet implemented.

**Planned Mitigations (future):**
- Price signals are advisory only
- Conservative collateralization ratios
- Time-weighted average pricing (TWAP)
- Decentralized oracle networks

**Residual Risk:** HIGH (future) — Not applicable to current audit scope.

---

### T8 — Admin Key Compromise

**Description:** Compromise of privileged keys (admin, risk_authority, lending_adapter).

**Attack Scenarios:**
```
Scenario A: Admin Key → Pause contract (DoS)
Scenario B: risk_authority Key → Set FRAUD_LOCK on all accounts
Scenario C: Combined → Mass account censorship
```

**Affected Contract Functions:**
- `PaymentHub.tact` — `handle_set_paused()` (pause only, no fund access)
- `PaymentHub.tact` — `handle_flag_account()` (block only, no fund seizure)
- `account-locks.fc` — `set_fraud_lock()` lines 160–172 (risk_authority)
- `account-locks.fc` — `set_collateral_lock()` lines 190–202 (lending_adapter)

**Critical Invariant:** Admin functions CANNOT move user funds. There are NO admin withdrawal functions anywhere in the codebase.

**Current Mitigation:**
- No admin fund paths exist in any contract
- Admin can pause and flag/lock accounts only
- Immutable contracts — admin cannot change logic

**Current Vulnerability — Single Admin Key:**
- Payment Hub admin is a single address (no multi-sig yet)
- risk_authority is a single address
- No key rotation mechanism

**Planned Enhancement (post-audit):**
- Multi-sig admin (3-of-5)
- Time-locked governance
- DAO migration

**Residual Risk:** CRITICAL (if key compromised) — Admin can DoS via pause, and censor via locks, but CANNOT steal funds. I3 (No Admin Fund Control) is structurally enforced.

**Invariants Affected:** I3

---

## Threat-to-Contract Mapping

### PaymentHub.tact

| Threat | Functions | Lines | Severity | Mitigated? |
|--------|-----------|-------|----------|------------|
| T1 — NFT Race | `receive(TransferInternalRequest)` | 121–155 | HIGH | Yes |
| T2 — Reentrancy | All handlers | 121–202 | MEDIUM | Yes (guard + actor model) |
| T3 — Ledger Desync | `executeTransfer()` | 196–202 | CRITICAL | Yes (jetton is source of truth) |
| T4 — Lock Bypass | Transfer handler | 135 | HIGH | Partial (advisory for direct jetton) |
| T8 — Admin Compromise | `handle_set_paused()` | 233–239 | HIGH | Partial (single key) |

### MerchantPaymentHub.tact

| Threat | Functions | Lines | Severity | Mitigated? |
|--------|-----------|-------|----------|------------|
| T1 — NFT Race | `checkOwnership()` | 90–96 | HIGH | Yes |
| T4 — Lock Bypass | `checkLockState()` | 116–119 | HIGH | Yes |
| T5 — Merchant Abuse | `payMerchant()` | 64–86 | MEDIUM | Yes (user-initiated only) |

### account-locks.fc

| Threat | Functions | Lines | Severity | Mitigated? |
|--------|-----------|-------|----------|------------|
| T4 — Lock Bypass | `can_send()` | 83–92 | HIGH | Yes (enforced in protocol path) |
| T8 — Admin Compromise | `set_fraud_lock()` | 160–172 | CRITICAL | Partial (single risk_authority key) |

### nft_account_resolver.fc

| Threat | Functions | Lines | Severity | Mitigated? |
|--------|-----------|-------|----------|------------|
| T1 — NFT Race | `resolve_owner()` | 61–69 | LOW | Yes (read-only, informational) |
| T2 — Reentrancy | `recv_internal()` | 124–142 | N/A | Yes (rejects all messages) |

---

## Threat-to-Invariant Mapping

| Threat | I1 | I2 | I3 | I4 | I5 | I6 | I7 | Status |
|--------|----|----|----|----|----|----|----|----|
| T1 — NFT Race | Risk | Risk | — | — | — | — | — | Mitigated |
| T2 — Reentrancy | — | — | — | Risk | Risk | — | — | Mitigated |
| T3 — Ledger Desync | — | — | — | — | **CRITICAL** | — | — | Mitigated |
| T4 — Lock Bypass | — | — | — | — | — | Risk | — | Partial |
| T5 — Merchant Abuse | Risk | — | Risk | — | — | — | — | Partial |
| T6 — External Adapter | — | — | — | — | — | — | Risk | Mitigated |
| T7 — Oracle | — | — | — | — | — | — | — | N/A (future) |
| T8 — Admin Key | Risk | — | **CRITICAL** | — | — | — | — | Partial |

---

## Residual Risks for Auditors

### Critical Risks (Immediate Review Required)

| Risk ID | Description | Impact | Priority |
|---------|-------------|--------|----------|
| R-CRIT-1 | Direct TBC jetton transfer bypasses Account Locks | FRAUD_LOCK/COLLATERAL_LOCK advisory for direct transfers | HIGH |
| R-CRIT-2 | Single admin key (payment hub, account locks) | Admin key compromise enables DoS and mass censorship | HIGH |

### High Risks

| Risk ID | Description | Impact | Priority |
|---------|-------------|--------|----------|
| R-HIGH-1 | No on-chain invoice replay protection | Accidental double-payment by user | MEDIUM |
| R-HIGH-2 | No admin action time-locks | Malicious admin can pause protocol instantly | MEDIUM |
| R-HIGH-3 | Unlimited account flagging by admin | Mass censorship attack | MEDIUM |

### Medium Risks (Document and Accept)

| Risk ID | Description | Impact |
|---------|-------------|--------|
| R-MED-1 | Off-chain indexer staleness | Temporary UI inconsistency |
| R-MED-2 | External adapter downtime | Service degradation (no fund risk) |
| R-MED-3 | Webhook spoofing (Merchant API) | Merchant ships before on-chain confirmation |

---

## Economic & Game-Theory Considerations

### Fee Model
- Internal TBC transfers: **zero protocol fees** (only TON gas)
- Invariant I5 enforces: Σ(balances_before) = Σ(balances_after)
- No hidden fees possible (jetton contract enforces conservation)

### Incentive Alignment
- Protocol incentives: users want secure, non-custodial transfers
- Merchant incentives: want reliable settlement
- Admin incentives: risk_authority exists to prevent fraud (not profit)

### Merchant Fraud Vectors
- Merchants cannot pull funds (user must sign)
- Merchants CAN claim false delivery (off-chain business dispute)
- Protocol is neutral on delivery confirmation (not in scope)

### Collateral Misrepresentation
- Collateral signals are advisory (CollateralSignal.tact)
- No on-chain enforcement of collateral value claims
- Lending adapters (future) will need oracle price feeds

---

## Governance Security

### Current State

| Property | Status |
|----------|--------|
| No hidden execution powers | ✅ Verified — no admin fund functions exist |
| NFT supply fixed at 222 | ✅ TBC Diamonds: fixed supply, no mint |
| No mint backdoor | ✅ No minting in protocol contracts |
| Proposal registry read-only | ✅ ProposalRegistry.tact is read-only |
| Governance cannot mutate protocol without version bump | ✅ Contracts are immutable; new deployment = new version |

### Key Governance Risk

`risk_authority` is a single privileged key that can set FRAUD_LOCK on any account. This is intentional for fraud prevention but creates centralization risk if the key is compromised. DAO governance is planned to replace this in Phase 2.

---

## Non-Goals

This audit does NOT guarantee:
- Vulnerability-free code
- Economic stability or TBC price maintenance
- Production-readiness certification
- Off-chain component security
- Insurance against future attacks

---

## References

- **Detailed Threat Model**: [docs/threat-model.md](../docs/threat-model.md)
- **Protocol Invariants**: [docs/invariants.md](../docs/invariants.md) and [audit/INVARIANTS.md](./INVARIANTS.md)
- **Audit Scope**: [audit/SCOPE.md](./SCOPE.md)
- **Known Limitations**: [docs/audit-notes.md](../docs/audit-notes.md)
- **Issue #55**: [Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
- **Issue #20**: [Original Threat Model](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
