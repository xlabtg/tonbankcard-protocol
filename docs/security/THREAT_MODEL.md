# TONBANKCARD Protocol — Security Architecture & Threat Model

**Document Type:** Formal Security Architecture
**Issue Reference:** [#54 — Issue 10.1 Security Architecture & Threat Model (Protocol-Level, Formalized)](https://github.com/xlabtg/tonbankcard-protocol/issues/54)
**Dependencies:** [#18 — Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18), [#20 — Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
**Status:** Formal Specification
**Last Updated:** 2026-02-27

---

## Table of Contents

1. [Security Philosophy](#1-security-philosophy)
2. [System Components in Scope](#2-system-components-in-scope)
3. [Adversary Model](#3-adversary-model)
4. [Attack Surface Classification](#4-attack-surface-classification)
5. [Trust Boundaries](#5-trust-boundaries)
6. [Mitigation Mapping](#6-mitigation-mapping)
7. [Finality & Reorg Model](#7-finality--reorg-model)
8. [Key Compromise Scenarios](#8-key-compromise-scenarios)
9. [Explicit Non-Goals](#9-explicit-non-goals)
10. [Appendix A: Contract Inventory](#appendix-a-contract-inventory)
11. [Appendix B: Invariant Cross-Reference](#appendix-b-invariant-cross-reference)
12. [Appendix C: Audit Checklist](#appendix-c-audit-checklist)

---

## 1. Security Philosophy

TONBANKCARD adheres to five foundational security principles. Each principle is enforced structurally — through smart contract design and deployment constraints — not through policy alone.

### 1.1 Non-Custodial Architecture

The protocol never takes custody of user funds. All balances are stored in TBC jetton wallets owned by the users themselves. The Payment Hub routes transfer requests but does not hold balances.

**Structural enforcement:**
- No `admin_withdraw()`, `emergency_drain()`, or `privileged_transfer()` functions exist in any contract.
- All transfer functions verify `msg.sender == NFT_owner` before execution.
- Backend services (indexer, Merchant API, SDK) are read-only with respect to funds.

**Code evidence:** `payment-hub.fc` contains exactly two admin functions: `handle_set_paused()` (line 233) and `handle_flag_account()` (line 242). Neither function moves funds. No other admin functions exist.

### 1.2 Immutable-First Design

All protocol smart contracts are deployed without upgrade proxies. Once deployed, contract code cannot be modified. This eliminates an entire class of governance attacks (malicious upgrades, proxy swaps, implementation replacements).

**Structural enforcement:**
- No `UPGRADEABLE_PROXY` patterns in any contract.
- No `set_code()` or `migrate()` functions.
- Contract addresses are published in `docs/protocol-registry.json` for independent verification.

**Trade-off acknowledged:** Bugs in deployed contracts cannot be patched. The only remediation path is deploying new contracts and migrating users. This is an accepted cost of immutability.

### 1.3 Explicit Trust Boundaries

Every component has a declared trust level. No implicit trust exists between components. The blockchain is the single source of truth; all other layers are convenience or orchestration.

**See:** [Section 5 — Trust Boundaries](#5-trust-boundaries)

### 1.4 Minimal Admin Power

Admin roles exist only for operational safety (emergency pause, fraud flagging). Admin roles cannot move funds, override ownership, or modify contract logic.

**Structural enforcement:**
- Admin can set `paused` flag (halts all operations) — `payment-hub.fc:233-239`
- Admin can set `blocked_accounts` flag (blocks specific accounts) — `payment-hub.fc:242-263`
- Risk authority can set/clear fraud locks — `account-locks.fc:160-172, 175-188`
- Lending adapter can set/clear collateral locks — `account-locks.fc:190-202, 205-217`
- None of these roles can transfer, withdraw, or modify balances.

### 1.5 Deterministic Settlement

All transfers are deterministic: given the same inputs and blockchain state, the same output is produced. No randomness, no oracle-dependent execution, no off-chain inputs influence on-chain settlement.

**Structural enforcement:**
- Transfer validation uses only on-chain state: NFT ownership, account state, lock flags, balance.
- No external oracle calls during transfer execution.
- Event emission occurs after state mutation, never before.

### 1.6 Security Assumption Requirements

Every security assumption in this document is:
- **Explicit** — stated in plain language with code references.
- **Falsifiable** — can be disproven by a concrete attack scenario.
- **Auditable** — can be verified by reading contract source code.

No assumption in this document relies on "trust" alone.

---

## 2. System Components in Scope

### 2.1 On-Chain Components

#### 2.1.1 Payment Hub (FunC) — `contracts/payments/payment-hub.fc`

**Purpose:** Core payment routing for TBC transfers between NFT accounts.
**Lines:** 372
**Status:** Implemented, not yet deployed to mainnet

**Entry points:**
| Op Code | Name | Handler | Lines | Access |
|---------|------|---------|-------|--------|
| `0x73774302` | `internal_transfer` | `handle_internal_transfer()` | 127–163 | NFT owner only |
| `0x73774303` | `merchant_payment` | `handle_merchant_payment()` | 166–197 | NFT owner only |
| `0x73774304` | `payment_received` | `handle_payment_received()` | 200–230 | On-chain sources only |
| `0x73774306` | `set_paused` | `handle_set_paused()` | 233–239 | `admin_address` only |
| `0x73774305` | `account_flagged` | `handle_flag_account()` | 242–263 | `admin_address` only |

**State variables:** `admin_address`, `paused` flag, `nft_collection_addresses` dictionary, `blocked_accounts` dictionary, `tbc_jetton_master` address.

**Access control:** `verify_nft_account()` (lines 96–112) validates collection whitelist membership, blocked status, and NFT ownership via `get_nft_owner()`. Admin functions check `equal_slices(sender_address, admin_address)`.

#### 2.1.2 Payment Hub (Tact) — `contracts/payments/PaymentHub.tact`

**Purpose:** Tact implementation of Payment Hub with explicit reentrancy guard.
**Lines:** 355
**Status:** Implemented, not yet deployed to mainnet

**Key difference from FunC version:** Includes explicit reentrancy guard (`self.locked` flag, lines 121, 149–150). Self-transfers handled as no-op with event emission.

#### 2.1.3 Merchant Payment Hub (Tact) — `contracts/MerchantPaymentHub.tact`

**Purpose:** On-chain merchant payment settlement in TBC.
**Lines:** 288
**Status:** Implemented, not yet deployed to mainnet

**Validation sequence for `MerchantPaymentRequest`:**
1. Payer NFT owner matches sender (I1/I2)
2. Merchant exists in registry
3. Amount > 0
4. Payer state is `ACTIVE` (canSend)
5. Payer locks checked (I6) — `canSendWithLocks(payer_locks)`
6. Merchant state is not `CLOSED` (canReceive)
7. Sufficient balance
8. Atomic debit/credit (I4/I5)
9. Emit `MerchantPayment` event

**Pre-production hardening (Issue #363 — RESOLVED):** the former test-only
`SetAccountState`, `SetAccountBalance`, and `SetAccountLock` messages have been
**removed from the deployable production contract**:
- `SetAccountState` / `SetAccountBalance` (admin-mint / admin-register backdoors,
  audit C-MPH-C1 / C-MPH-H1) now exist ONLY in the non-deployable test harness
  `contracts/merchant-hub/test/MerchantPaymentHubHarness.tact`. In production,
  account registration is performed by the NFT Account Resolver and balances are
  funded by the on-chain TBC ledger/settlement flow.
- `SetAccountLock` is replaced by `ApplyAccountLock`, which is accepted ONLY from
  the dedicated Account Locks contract (`account_locks_contract`, immutable, set at
  `init`). The admin cannot apply locks (invariant I3).
- Collection whitelisting moved behind a two-phase admin + 7-day timelock
  (`ProposeWhitelistCollection` → wait → `ExecuteWhitelistCollection`, with
  `CancelWhitelistCollection`).
A CI regression guard (`contracts/payment-hub/non-production-stubs.spec.ts`) fails
the build if any of the removed handlers reappears in the production source.

#### 2.1.4 Account Locks (FunC) — `contracts/payments/account-locks.fc`

**Purpose:** Lock flags for fraud prevention and collateral management.
**Lines:** 270
**Status:** Implemented, not yet deployed to mainnet

**Op codes:**
| Op Code | Name | Authorized Caller |
|---------|------|--------------------|
| `0x1001` | `set_fraud_lock` | `risk_authority` only |
| `0x1002` | `clear_fraud_lock` | `risk_authority` only |
| `0x1003` | `set_collateral_lock` | `lending_adapter` only |
| `0x1004` | `clear_collateral_lock` | `lending_adapter` only |
| `0x2001` | `check_can_send` | Public |

**Key invariant enforcement:**
- `can_send()` (lines 91–100): Returns `0` if ANY lock is active.
- `can_receive()` (lines 104–106): ALWAYS returns `1` — locked accounts can always receive funds. This enforces invariant I6 (Lock is not Confiscation).
- `set_lock()` (lines 110–119): Only sets boolean flags. Never modifies balances.

#### 2.1.5 Account State Machine (Tact) — `contracts/payment-hub/account-state.tact`

**Purpose:** Account states and balance tracking.
**Lines:** 285
**Status:** Implemented, not yet deployed to mainnet

**States:**
| State | Value | Can Send | Can Receive |
|-------|-------|----------|-------------|
| `ACTIVE` | 1 | Yes | Yes |
| `FROZEN` | 2 | No | Yes |
| `COLLATERAL_LOCKED` | 3 | No | Yes |
| `CLOSED` | 4 | No | No |

**State transition rules:**
- `ACTIVE` -> `FROZEN`, `COLLATERAL_LOCKED`, or `CLOSED` — allowed.
- `FROZEN` -> any state — blocked (requires DAO/risk authorization, not yet implemented).
- `COLLATERAL_LOCKED` -> any state — blocked (requires lending adapter, not yet implemented).
- `CLOSED` -> any state — blocked permanently.

**Known pre-production issue:** Lines 131–133 contain comment: "In production, should verify msg.sender == NFT owner." Ownership verification is not yet implemented in this contract. The Payment Hub contracts perform this check upstream.

#### 2.1.6 NFT Account Resolver (FunC) — `contracts/nft-resolver/nft_account_resolver.fc`

**Purpose:** Read-only NFT ownership resolution.
**Lines:** 150
**Status:** Implemented, not yet deployed to mainnet

**Key property:** `recv_internal()` rejects ALL messages (line 141: `throw(0xffff)`). This contract is completely read-only. It cannot be attacked via message-based vectors.

**Hardcoded whitelists:** NFT collections for Series 7777 and 8888 are hardcoded (lines 22–40). These match the deployed mainnet addresses in `docs/protocol-registry.json`.

#### 2.1.7 NFT Account Resolver (Tact) — `contracts/nft-resolver/nft_account_resolver.tact`

**Purpose:** Tact version of the resolver.
**Lines:** 121
**Status:** Implemented, not yet deployed to mainnet

**Known pre-production issue:** `resolveOwner()` returns placeholder (nft_address itself). Production implementation requires cross-contract `run_method` call to NFT contract. `set_payment_hub` receiver has TODO for access control.

#### 2.1.8 Collateral Signal Contract (Tact) — `contracts/CollateralSignal.tact`

**Purpose:** Non-custodial collateral signaling layer.
**Lines:** 370
**Status:** Implemented, not yet deployed to mainnet

**Messages:** `SignalCollateralRequest`, `UpdateCollateralSignalRequest`, `ReleaseCollateralSignalRequest`; `ResolveNFTOwner` (resolver-only ownership registration, Issue #364).

**Signal states:** `NONE(0)`, `ACTIVE(1)`, `WARNING(2)`, `RELEASED(3)`.

**Design principle:** Pure signaling. This contract never custodies, locks, seizes, or liquidates any assets. It records signals that external lending protocols can query.

**Pre-production hardening (Issue #364 — RESOLVED):** the former test-only
`RegisterNFTOwner` message — gated only by the deployer recorded at `init()`
(audit X-1 / cross-cutting test backdoor) — has been **removed from the deployable
production contract**. NFT ownership is now bound exclusively by the trusted
on-chain NFT Account Resolver:
- The contract stores an immutable `nft_resolver` address, set once at
  `init(nft_resolver)` and never mutated.
- Ownership is registered only via `receive(msg: ResolveNFTOwner)`, which requires
  `sender() == self.nft_resolver` (`"Unauthorized: only NFT resolver"`). The
  deployer can no longer unilaterally register ownership (invariant I3 — No Admin
  Control).
- The binding stays write-once (CONTRACTS-M1 / #279):
  `require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered")`.
- A CI regression guard (`contracts/payment-hub/non-production-stubs.spec.ts`,
  Issue #364) plus on-chain Sandbox tests (`contracts/collateral-signal/`) block
  reintroduction of any deployer-gated ownership path.

#### 2.1.9 Public Collateral Lookup — `contracts/collateral-lookup/`

**Purpose:** Privacy-preserving collateral lookup returning ONLY a boolean.
**Available in:** Both Tact (`PublicCollateralLookup.tact`, 180 lines) and FunC (`public-collateral-lookup.fc`, 178 lines).
**Status:** Implemented, not yet deployed to mainnet

**Key property:** `hasActiveCollateral()` returns only `true` or `false`. It does not expose collateral amounts, lender addresses, loan terms, collateral history, or any other data. This is a deliberate privacy design.

**Prohibited functions (documented in code):** `getCollateralAmount`, `getLenderAddress`, `getLoanTerms`, `getCollateralHistory`.

**Known pre-production issue:** `hasActiveCollateral()` currently hardcoded to return `false` (placeholder).

#### 2.1.10 Governance — Proposal Registry (Tact) — `contracts/governance/ProposalRegistry.tact`

**Purpose:** Non-executable governance proposal system for TBC Diamonds (222 NFTs).
**Lines:** 414
**Status:** Implemented, not yet deployed to mainnet

**Messages:** `SubmitProposal`, `CastVote`, `FinalizeProposal`; ownership-resolution protocol (`ResolveOwnership` / `OwnershipResolved`, `EligibilityCheckRequest` / `EligibilityCheckResponse`); governance multi-sig configuration (`ConfigureGovernance`, `ProposeConfigChange`, `ApproveConfigChange`, `ExecuteConfigChange`, `CancelConfigChange`).

**Categories:** `ROADMAP_SIGNAL(0)` through `ECOSYSTEM_GRANT_SIGNAL(5)`.

**Voting mechanism:** 1 Diamond NFT = 1 vote. Default quorum: 23/222 (ceil 10%). 7-day voting window.

**Double-vote prevention:** Composite key `proposal_id * 1000 + nft_id`.

**Critical design property:** Governance proposals are non-executable. They record community sentiment but do not trigger on-chain actions. This limits the blast radius of governance attacks.

**NFT ownership verification (Issue #248 — RESOLVED ✅):** Neither `SubmitProposal` nor `CastVote` trusts a caller-supplied NFT ID. The registry asks a trusted on-chain resolver "who owns Diamond NFT N?" and only materialises the vote/proposal in the `OwnershipResolved` callback, and only when the resolved owner equals the original sender. Until the resolver is configured, voting and proposal submission **fail closed**.

**Resolver/verifier configuration security (Issue #366 — RESOLVED ✅):** Because the resolver is the sole source of truth for ownership, whoever controls it controls who can vote. The resolver and snapshot-verifier addresses can therefore no longer be set by a single key. After a one-time deployer bootstrap (`ConfigureGovernance`) installs an M-of-N signer set (threshold ≥ 2, signers ≥ 2 — no single point of failure), every change to either address requires (a) M independent signer approvals, (b) a 7-day two-phase timelock, and (c) code-hash verification — the executor must supply the target's `StateInit{code, data}` such that `contractAddress(StateInit) == target` **and** `code.hash() == approved_hash`, so a malicious resolver with different code can never be installed. A misconfigured resolver is recoverable through the same multi-sig + timelock path. Covered by `contracts/governance/ProposalRegistry.spec.ts` (multi-sig requirement, non-signer rejection, timelock enforcement, code-hash + address verification, fail-closed-until-configured, malicious-resolver rejection, recovery path).

#### 2.1.11 Governance — Snapshot Verifier (Tact) — `contracts/governance/SnapshotVerifier.tact`

**Purpose:** Verifies NFT ownership at snapshot time for governance voting.
**Lines:** 207
**Status:** Implemented, not yet deployed to mainnet

**Fallback behavior:** If no snapshot exists for a given block, ALL NFTs 1–222 are eligible (permissive default). This is a deliberate design choice to avoid blocking governance when snapshots fail.

#### 2.1.12 Governance — Transparency Registry (Tact) — `contracts/governance/TransparencyRegistry.tact`

**Purpose:** Read-only transparency layer for governance data.
**Lines:** 365
**Status:** Implemented, not yet deployed to mainnet

**Sender authentication (Issue #365 — RESOLVED ✅):** All six data-ingestion handlers (`RecordProposal`, `RecordVotingResult`, `RecordSnapshot`, `RecordProtocolMetrics`, `RecordLockActivity`, `RecordParameterChange`) verify `sender()` against a dedicated authorized-writer address stored in contract state and **fail closed** until the deployer (governance multi-sig) configures the trusted writer for that data domain. Fake governance records can no longer be injected. See §4.1.5 and §4.5.4; regression coverage in `contracts/governance/TransparencyRegistry.spec.ts`.

#### 2.1.13 Governance — Diamond Resolver (FunC) — `contracts/governance/diamond_resolver.fc`

**Purpose:** Read-only governance helper for TBC Diamonds.
**Lines:** 262
**Status:** Implemented, not yet deployed to mainnet

**Key property:** Rejects all internal messages (read-only). All functionality via get methods. `calculate_vote_outcome()` checks quorum + simple majority.

#### 2.1.14 External Immutable Contracts (Already Deployed)

These contracts are deployed, immutable, and outside protocol control:

| Contract | Address | Status |
|----------|---------|--------|
| TBC Jetton Master | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | Deployed, immutable |
| NFT Series 7777 | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | Deployed |
| NFT Series 8888 | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | Deployed |
| TBC Diamonds (Governance) | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` | Deployed, 222 NFTs, fixed supply |
| TBC/TON Pool (TONCO DEX) | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` | Active |

### 2.2 Off-Chain Components

#### 2.2.1 Payment Status Indexer — `backend/indexer/`

**Purpose:** Blockchain event indexer with reorg detection.
**Status:** Implemented (reference implementation)

**Key properties:**
- Read-only with respect to blockchain state.
- Block syncing with configurable confirmation depth.
- Reorg detection: compares block hashes and rolls back local database if mismatch detected.
- SQLite database stores: blocks, internal_transfers, merchant_payments, account_state_changes, nft_ownership_changes, account_snapshots, invoice_mappings.

**Cannot:** Submit transactions, modify on-chain state, authorize transfers.

#### 2.2.2 Merchant API — `api/src/`

**Purpose:** Invoice management and payment orchestration for merchants.
**Status:** Implemented (reference implementation)

**Key properties:**
- In-memory storage (reference implementation; production requires persistent database).
- Idempotency support for invoice creation.
- Auth middleware and rate limiting.
- Permission-scoped API keys.

**Cannot:** Move funds, sign transactions on behalf of users, bypass NFT ownership checks.

#### 2.2.3 Merchant SDK — `sdk/src/`

**Purpose:** TypeScript SDK for merchant integration.
**Status:** Implemented

**Functions and their trust implications:**
| Function | Authority | Trust Level |
|----------|-----------|-------------|
| `createInvoice()` | None — pure informational, no on-chain state created | Informational |
| `getInvoice()` | None — queries optional API endpoint | Informational |
| `getInvoiceStatus()` | Reads on-chain settlement status | Read-only |
| `generateWalletLink()` | Generates TON Connect deep link; user must approve in wallet | Informational |
| `verifySettlement()` | Queries blockchain directly for authoritative settlement proof | Read-only, authoritative |
| `getAccountInfo()` | Queries Payment Hub get methods | Read-only |

**Cannot:** Store private keys, sign transactions, custody funds, override user consent.

#### 2.2.4 External Payment Providers

**ChangeNOW** (`backend/adapters/changenow.ts`, 384 lines):
- Crypto swap API client. Creates swap orders, checks status.
- Non-custodial orchestrator: user sends funds to ChangeNOW deposit address directly.
- Protocol does not receive or hold funds during swap.

**NOWPayments** (`backend/adapters/nowpayments.ts`, 397 lines):
- Payment processing API client.
- Includes HMAC webhook verification interface (implementation is stubbed — `verifyWebhookSignature` method exists but is not fully implemented).

**CoinRabbit** (`backend/adapters/coinrabbit.ts`, 577 lines):
- Lending adapter. Identity resolution, collateral signal verification (read-only), loan intent creation.
- All operations are user-initiated and informational.
- No authority over protocol contracts.

#### 2.2.5 Governance Layer

The governance layer consists of:
- **On-chain:** ProposalRegistry, SnapshotVerifier, TransparencyRegistry, DiamondResolver (described in Section 2.1).
- **Off-chain:** No governance backend exists. Governance is purely on-chain and non-executable.

**Design property:** Governance proposals are advisory. They cannot trigger on-chain actions such as parameter changes, fund movements, or contract upgrades.

---

## 3. Adversary Model

This section defines the adversary classes the protocol must defend against. Each class is characterized by its capabilities, motivations, and expected attack vectors.

### 3.1 External Attacker

**Capabilities:**
- No privileged access to any protocol component.
- Can submit arbitrary transactions to any protocol contract.
- Can observe all on-chain state (accounts, balances, lock flags, governance proposals).
- Can observe TON mempool for pending transactions.
- Can front-run transactions by submitting higher-priority messages.
- Can deploy malicious contracts that interact with protocol contracts.
- Can analyze contract bytecode (all contracts are public).

**Motivations:** Theft of funds, exploitation of protocol bugs, front-running for profit.

**Expected attack vectors:**
- Submitting crafted messages to bypass validation (4.1.5).
- Deploying proxy contracts that attempt reentrancy (4.1.1).
- Front-running NFT transfers to capture account balances (4.1.4).
- Exploiting missing access control on test-only functions (4.1.5).

### 3.2 Malicious Merchant

**Capabilities:**
- Has a registered merchant NFT account.
- Can generate invoices and payment links.
- Can operate Merchant API with valid API key.
- Can submit merchant payment requests on-chain.

**Motivations:** Double settlement, replay attacks, settlement fraud, unauthorized fund extraction.

**Expected attack vectors:**
- Submitting duplicate merchant payment requests with same invoice data (4.4.2).
- Claiming payment received without actual on-chain settlement (4.4.1).
- Manipulating payment details payload after user authorization (4.4.3).
- Attempting to pull funds from customer accounts without customer signature — this is structurally impossible because `handle_merchant_payment()` requires `msg.sender == payer_NFT_owner` (payment-hub.fc:174).

### 3.3 Compromised NFT Holder

**Capabilities:**
- Attacker has gained access to a user's private key (wallet compromise, phishing, malware).
- Can sign transactions as the user.
- Can transfer NFT to attacker-controlled address.
- Can drain account balance via Payment Hub transfers.

**Motivations:** Draining account balance, transferring NFT to capture account.

**Expected attack vectors:**
- Transferring all TBC balance to attacker's account via `internal_transfer` (4.3.1).
- Transferring NFT to attacker's address (simultaneously transfers account control) (4.3.2).
- Using compromised key to authorize merchant payments to attacker-controlled merchant (4.3.3).

### 3.4 Compromised External Provider

**Capabilities:**
- Controls one or more external API endpoints (ChangeNOW, NOWPayments, CoinRabbit).
- Can return false data: incorrect swap confirmations, fake payment statuses, manipulated price feeds.
- Can replay webhook callbacks.
- Can refuse service (denial of service at API level).

**Motivations:** Financial manipulation, false confirmations, data theft.

**Expected attack vectors:**
- Sending false "transaction completed" callbacks to Merchant API (4.4.1).
- Replaying valid webhook payloads to trigger duplicate processing (4.4.2).
- Providing manipulated exchange rates for swap operations (4.2.3).
- Returning false collateral valuations to lending adapter (4.2.4).

### 3.5 Malicious Indexer Operator

**Capabilities:**
- Controls the backend indexer infrastructure.
- Can serve incorrect blockchain state to API consumers.
- Can withhold events (selective censorship).
- Can intentionally desynchronize from the blockchain.

**Motivations:** Information manipulation, selective censorship, creating confusion about payment status.

**Expected attack vectors:**
- Serving stale or incorrect balance data to frontend UIs (4.6.1).
- Withholding payment confirmation events so merchants believe payment was not received (4.6.2).
- Showing payments as confirmed when they were reverted by a reorg (4.6.3).

**Structural defense:** The indexer cannot move funds or modify on-chain state. All authoritative verification is available by querying the blockchain directly. The indexer is a convenience layer, not a trust anchor.

### 3.6 Governance Attacker

**Capabilities:**
- Owns or has acquired one or more TBC Diamond NFTs (governance tokens).
- Can submit proposals and cast votes.
- Can collude with other NFT holders to reach quorum (23/222 = ceil 10%).

**Motivations:** Proposal spam, social manipulation, forcing unfavorable governance outcomes.

**Expected attack vectors:**
- Submitting high volume of proposals to overwhelm governance participants (4.5.1).
- Colluding to pass proposals that benefit a minority (4.5.2).
- Manipulating snapshot timing to include/exclude specific voters (4.5.3).
- Injecting false records into TransparencyRegistry (4.5.4) — mitigated by sender authentication (Issue #365 — RESOLVED ✅); only the configured per-domain writers may append records.

**Structural defense:** Governance proposals are non-executable. Even if an attacker passes a malicious proposal, it has no on-chain effect. The proposal is advisory only.

### 3.7 Network-Level Attacker

**Capabilities:**
- Can cause blockchain reorganizations (requires significant stake or validator collusion).
- Can manipulate block finality by controlling validators.
- Can perform network-level denial of service against TON infrastructure.

**Motivations:** Double-spending, finality manipulation, protocol disruption.

**Expected attack vectors:**
- Performing a blockchain reorg to revert settled transactions (7.1).
- Exploiting partial finality to double-spend during confirmation window (7.2).
- DDoS against TON validators or lite servers to prevent protocol usage (7.3).

**Assessment:** TON's BFT consensus requires controlling more than 1/3 of validator stake. This is a blockchain-level attack outside the protocol's control. See Section 7 for finality model.

---

## 4. Attack Surface Classification

### 4.1 Smart Contract Attacks

#### 4.1.1 Reentrancy

**Applicable to:** Payment Hub (FunC and Tact), Merchant Payment Hub, Account Locks.

**TON-specific context:** TON uses a message-passing actor model. Each message is processed atomically in a separate transaction. There are no synchronous external calls during execution (unlike EVM `CALL`). This structurally prevents classical reentrancy.

**Assessment:**
- **FunC Payment Hub:** No reentrancy guard. Relies on TON actor model. All state changes complete before any outgoing messages are sent. `emit_event()` sends external message AFTER state mutation (payment-hub.fc:115–124).
- **Tact Payment Hub:** Explicit reentrancy guard via `self.locked` flag (PaymentHub.tact:121, 149–150).
- **Account Locks:** No reentrancy risk — lock operations are flag-only with no external calls.

**Residual risk:** LOW. TON's actor model provides structural protection. The Tact version adds defense-in-depth with an explicit guard.

#### 4.1.2 Storage Corruption

**Applicable to:** All contracts with persistent storage.

**Analysis:**
- FunC contracts use `load_data()` / `save_data()` patterns with explicit cell serialization.
- Tact contracts use struct-based storage with compiler-enforced layout.
- Dictionary operations (`udict_set`, `udict_get?`) follow standard TVM patterns.

**Residual risk:** LOW. TVM enforces cell structure integrity. Corrupt cells cause TVM exceptions, not silent corruption.

#### 4.1.3 Overflow/Underflow

**Applicable to:** Balance operations in Payment Hub and Merchant Payment Hub.

**Analysis:**
- TVM integers are 257-bit signed. Integer overflow at 2^256 is practically unreachable for token amounts.
- `load_coins()` uses VarUInteger16 (0 to 2^120-1 nanocoins). Sufficient for any realistic balance.
- MerchantPaymentHub.tact performs balance check before debit: `require(payer.balance >= amount, "Insufficient balance")` (line 128).

**Residual risk:** LOW. TVM's native 257-bit arithmetic eliminates practical overflow. Balance checks prevent underflow.

#### 4.1.4 Incorrect State Transitions

**Applicable to:** Account State Machine (`account-state.tact`), Account Locks (`account-locks.fc`).

**Analysis:**
- Account state transitions follow explicit rules (Section 2.1.5).
- `FROZEN` and `COLLATERAL_LOCKED` states currently have no exit path (transition back to `ACTIVE` is not implemented). This means once an account is frozen, it stays frozen until the DAO/risk authorization mechanism is built.
- `CLOSED` is permanent — no transition out.

**Residual risk:** MEDIUM. The absence of unfreezing logic means frozen accounts are effectively permanently frozen until the transition mechanism is implemented.

#### 4.1.5 Access Control Bypass

**Applicable to:** All contracts with privileged functions.

**Current access control inventory:**

| Contract | Function | Required Caller | Implemented? |
|----------|----------|-----------------|--------------|
| payment-hub.fc | `handle_set_paused()` | `admin_address` | Yes (line 235) |
| payment-hub.fc | `handle_flag_account()` | `admin_address` | Yes (line 244) |
| account-locks.fc | `set_fraud_lock` | `risk_authority` | Yes (line 162) |
| account-locks.fc | `clear_fraud_lock` | `risk_authority` | Yes (line 177) |
| account-locks.fc | `set_collateral_lock` | `lending_adapter` | Yes (line 192) |
| account-locks.fc | `clear_collateral_lock` | `lending_adapter` | Yes (line 207) |
| MerchantPaymentHub.tact | `SetAccountState` | Removed from production (Issue #363) — test-only handler now lives in `MerchantPaymentHubHarness` | Yes ✅ |
| MerchantPaymentHub.tact | `SetAccountBalance` | Removed from production (Issue #363) — test-only handler now lives in `MerchantPaymentHubHarness` | Yes ✅ |
| MerchantPaymentHub.tact | `ApplyAccountLock` (replaces `SetAccountLock`, Issue #363) | `account_locks_contract` | Yes ✅ |
| CollateralSignal.tact | `ResolveNFTOwner` (replaces `RegisterNFTOwner`, Issue #364) | `nft_resolver` (immutable on-chain NFT Account Resolver) | Yes ✅ |
| TransparencyRegistry.tact | `RecordProposal` | `proposal_registry` writer (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `RecordVotingResult` | `proposal_registry` writer (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `RecordSnapshot` | `snapshot_verifier` writer (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `RecordProtocolMetrics` | `report_writer` (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `RecordLockActivity` | `report_writer` (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `RecordParameterChange` | `report_writer` (deployer-configurable, fail-closed) | Yes ✅ (Issue #365) |
| TransparencyRegistry.tact | `SetProposalRegistry` / `SetSnapshotVerifier` / `SetReportWriter` | `deployer` (governance multi-sig) | Yes ✅ (Issue #365) |
| ProposalRegistry.tact | `SubmitProposal` | Diamond NFT owner (resolver-verified, async) | Yes ✅ (Issue #248) |
| ProposalRegistry.tact | `CastVote` | Diamond NFT owner (resolver-verified, async) | Yes ✅ (Issue #248) |
| ProposalRegistry.tact | `ConfigureGovernance` | `deployer` (one-time M-of-N bootstrap) | Yes ✅ (Issue #366) |
| ProposalRegistry.tact | `ProposeConfigChange` / `ApproveConfigChange` / `ExecuteConfigChange` / `CancelConfigChange` | governance signer set (M-of-N + 7-day timelock + code-hash) | Yes ✅ (Issue #366) |

**Pre-production remediation required:** All "No" entries must either have access control added or the functions must be removed before mainnet deployment.

**ProposalRegistry ownership & resolver-configuration security (Issues #248 + #366 — RESOLVED ✅):** `SubmitProposal` and `CastVote` never trust a caller-supplied NFT ID; ownership is confirmed asynchronously by a trusted on-chain resolver before any vote/proposal is recorded (Issue #248). The resolver/verifier addresses — the root of that trust — are themselves protected: after a one-time deployer bootstrap (`ConfigureGovernance`), changing either address requires an M-of-N signer quorum (threshold ≥ 2), a 7-day two-phase timelock, and code-hash verification of the target (`contractAddress(StateInit) == target` ∧ `code.hash() == approved_hash`). This defeats the second-order attack in which a compromised deployer key silently swaps in a malicious resolver, and provides a recovery path if the resolver is misconfigured (Issue #366). Covered by `contracts/governance/ProposalRegistry.spec.ts`.

**TransparencyRegistry sender authentication (Issue #365 — RESOLVED ✅):** Each of the six data-ingestion handlers now verifies `sender()` against a dedicated authorized-writer address held in contract state (`proposal_registry` → `RecordProposal`/`RecordVotingResult`; `snapshot_verifier` → `RecordSnapshot`; `report_writer` → the three E4 aggregate handlers). The writer slots start `null` and the handlers **fail closed** until the deployer (the governance multi-sig in production) configures them via the deployer-only `SetProposalRegistry` / `SetSnapshotVerifier` / `SetReportWriter` messages, so fake records cannot be injected even in the window between deployment and writer configuration. Writer reassignment is updatable (expected to be timelocked at the multi-sig layer). Covered by `contracts/governance/TransparencyRegistry.spec.ts` (unauthorized rejection, fail-closed, deployer-only configuration, cross-domain isolation, authorized writes).

#### 4.1.6 Signature Validation Errors

**Applicable to:** All contracts that verify sender identity.

**Analysis:**
- Payment Hub verifies sender via `verify_nft_account()` which checks `equal_slices(owner, expected_owner)` (payment-hub.fc:109).
- TON message signing is handled by the TVM — `msg.sender` is cryptographically authenticated by the blockchain. Contracts do not perform custom signature verification.
- No ECDSA or Ed25519 signature verification in contract code. Sender authentication is delegated to TON's native message authentication.

**Residual risk:** LOW. TON's native message authentication is the industry-standard approach. No custom signature logic means no custom signature bugs.

### 4.2 Economic Attacks

#### 4.2.1 Liquidity Draining

**Applicable to:** TBC/TON pool on TONCO DEX.

**Analysis:**
- The TBC/TON liquidity pool is a standard TONCO DEX pool. It is not controlled by the TONBANKCARD protocol.
- Large swaps can cause slippage, but this is standard DEX behavior, not a protocol vulnerability.
- The protocol does not depend on pool liquidity for core operations (transfers, locks, governance).

**Residual risk:** LOW for protocol operations. MEDIUM for users relying on the pool for TBC price discovery.

#### 4.2.2 Collateral Misrepresentation

**Applicable to:** Collateral Signal Contract, CoinRabbit lending adapter.

**Analysis:**
- The Collateral Signal Contract is purely advisory. It records signals but does not custody or enforce collateral.
- An attacker can no longer register false NFT ownership: the ungated `RegisterNFTOwner` backdoor was removed (Issue #364). Ownership is bound only by the trusted on-chain NFT Account Resolver via the `nft_resolver`-gated `ResolveNFTOwner`, so only the genuine NFT owner can create a signal.
- External lending protocols (CoinRabbit) must independently verify collateral on-chain. The protocol documentation states this requirement.

**Residual risk:** LOW. With ownership bound by the trusted resolver (Issue #364), only the genuine NFT owner can signal; external lending protocols are still expected to perform independent on-chain verification.

#### 4.2.3 Fee Manipulation

**Applicable to:** Internal TBC transfers.

**Analysis:**
- Internal TBC transfers have zero protocol fees. There is no fee parameter to manipulate.
- External operations (DEX swaps, ChangeNOW swaps) have fees set by those external platforms, outside protocol control.

**Residual risk:** LOW. Zero-fee internal transfers eliminate fee manipulation vectors.

#### 4.2.4 Incentive Exploitation

**Applicable to:** Governance voting (TBC Diamonds).

**Analysis:**
- Diamond NFTs have a fixed supply of 222. Acquiring governance power requires purchasing NFTs on the open market.
- The low quorum (23/222 = ceil 10%) means an attacker with 23 NFTs and a favorable vote split could pass proposals.
- However, governance proposals are non-executable, limiting the impact.

**Residual risk:** LOW for protocol operations (non-executable governance). MEDIUM for social/reputational damage from malicious proposals.

### 4.3 State Machine Attacks

#### 4.3.1 Invalid State Transitions

**Applicable to:** Account State Machine, Account Locks.

**Analysis:**
- The Account State Machine enforces valid transitions. `FROZEN -> ACTIVE` and `COLLATERAL_LOCKED -> ACTIVE` transitions are explicitly blocked (not yet implemented).
- Account Locks use boolean flags (`fraud_locked`, `collateral_locked`). Setting a lock on an already-locked account is a no-op, not an error.

**Residual risk:** LOW. State machines have well-defined transition rules.

#### 4.3.2 Locked Account Bypass

**Applicable to:** Payment Hub (FunC), Account Locks.

**Critical finding:** The FunC Payment Hub (`payment-hub.fc`) does NOT call `account-locks.fc::can_send()` before processing transfers in `handle_internal_transfer()` (line 135) or `handle_merchant_payment()` (line 174). These functions verify NFT ownership but skip lock checks.

**Impact:** A locked account could execute transfers through the FunC Payment Hub, violating invariant I6.

**Note:** The Tact Merchant Payment Hub (`MerchantPaymentHub.tact`) DOES check locks at line 116–119 via `canSendWithLocks(payer_locks)`.

**Remediation required:** The FunC Payment Hub must integrate Account Locks checking before mainnet deployment:
```func
// Required addition after verify_nft_account() call:
int sender_can_send = account_locks.can_send(from_nft);
throw_unless(error::account_locked, sender_can_send);
```

**Additional bypass vector:** TBC jetton transfers sent DIRECTLY via the jetton wallet (not through Payment Hub) bypass all protocol controls. The TBC jetton contract is immutable and has no knowledge of Account Locks. This is a fundamental architectural limitation.

**Residual risk:** HIGH (FunC Payment Hub missing lock check). MEDIUM (direct jetton transfer bypass — accepted architectural limitation, documented as advisory locks).

#### 4.3.3 Partial Execution Scenarios

**Applicable to:** Multi-step operations (deposit via external provider, then internal transfer).

**Analysis:**
- Each on-chain operation (internal transfer, merchant payment, lock set/clear) is atomic within a single transaction.
- Multi-step flows involving off-chain components (e.g., user deposits via ChangeNOW, then ChangeNOW sends to DEX, then DEX sends TBC to user) have intermediate states where failure at any step results in funds being held by the intermediate party (ChangeNOW, DEX).
- The protocol cannot prevent partial execution of multi-step off-chain flows. This is inherent to cross-service interactions.

**Residual risk:** MEDIUM for external deposit flows. LOW for purely on-chain operations.

### 4.4 Integration Attacks

#### 4.4.1 Webhook Forgery

**Applicable to:** Merchant API (NOWPayments integration), external adapters.

**Analysis:**
- NOWPayments adapter includes `verifyWebhookSignature()` interface, but implementation is stubbed (nowpayments.ts).
- If webhook verification is not implemented, an attacker could send fake "payment confirmed" webhooks to the Merchant API.
- If the Merchant API acts on unverified webhooks (e.g., marks invoice as paid, triggers fulfillment), the merchant suffers financial loss.

**Mitigation status:** Webhook signature verification is structurally required but not fully implemented.

**Residual risk:** MEDIUM. The Merchant API must verify webhook signatures before acting on them. The protocol's on-chain verification (`verifySettlement()` in SDK) provides an independent confirmation path.

#### 4.4.2 Callback Replay

**Applicable to:** Merchant API, external adapters.

**Analysis:**
- If a valid webhook is intercepted and replayed, the Merchant API could process the same payment twice.
- The Merchant API has idempotency support for invoice creation (InvoiceService.ts), which provides partial protection.
- On-chain, the Payment Hub does NOT check for duplicate invoice IDs. The same invoice can be paid multiple times.

**Residual risk:** MEDIUM. Invoice replay protection is off-chain only. On-chain duplicate payment prevention is not implemented.

#### 4.4.3 Order ID Collision

**Applicable to:** Merchant API invoice management.

**Analysis:**
- Invoice IDs in the Merchant API are generated as deterministic hashes (SDK: `sdk.ts`).
- If two different invoices generate the same ID (hash collision), they would be treated as the same invoice.
- SHA-256 collision resistance makes this practically impossible for random inputs.
- Deliberate collision attempts require finding a SHA-256 collision, which is computationally infeasible.

**Residual risk:** NEGLIGIBLE. SHA-256 collision resistance provides sufficient protection.

#### 4.4.4 Cross-Chain Spoofing

**Applicable to:** External deposit flows via ChangeNOW.

**Analysis:**
- ChangeNOW handles cross-chain swaps (e.g., BTC -> TBC via TON).
- If ChangeNOW is compromised or spoofed, the user's source chain deposit could be lost.
- The protocol cannot verify cross-chain transaction finality. It can only verify TON-side receipt.

**Residual risk:** MEDIUM. Cross-chain verification is ChangeNOW's responsibility. Users should verify on-chain receipt independently.

### 4.5 Governance Attacks

#### 4.5.1 Proposal Flooding

**Applicable to:** ProposalRegistry.

**Analysis:**
- No rate limiting on `SubmitProposal`. An attacker with a Diamond NFT can submit unlimited proposals.
- Each proposal creates on-chain storage, costing gas. This provides economic rate limiting.
- The 7-day voting window means flooding creates noise but does not prevent legitimate proposals from being voted on.

**Residual risk:** LOW. Gas costs provide economic rate limiting. Non-executable proposals limit impact.

#### 4.5.2 Snapshot Manipulation

**Applicable to:** SnapshotVerifier.

**Analysis:**
- The SnapshotVerifier has a permissive fallback: if no snapshot exists, ALL NFTs 1–222 are eligible.
- An attacker could time a governance action to occur when no snapshot exists, ensuring all NFTs are eligible regardless of actual ownership at the relevant time.
- Snapshot recording in TransparencyRegistry is now access-controlled (Issue #365): `RecordSnapshot` is accepted only from the configured `snapshot_verifier` writer and fails closed until that writer is set, so false snapshots can no longer be injected into the transparency layer.

**Residual risk:** MEDIUM. The permissive fallback is a documented design choice. False snapshot injection into TransparencyRegistry is RESOLVED ✅ (Issue #365).

#### 4.5.3 Off-Chain Misinformation

**Applicable to:** Governance communication (outside protocol scope).

**Analysis:**
- An attacker could create fake governance announcements or misleading proposal descriptions.
- The protocol cannot prevent off-chain social attacks.
- On-chain proposal data (stored in ProposalRegistry) is the authoritative record.

**Residual risk:** LOW for protocol. MEDIUM for governance participants who rely on off-chain communication.

#### 4.5.4 False Record Injection

**Applicable to:** TransparencyRegistry.

**Analysis:**
- Issue #365 (RESOLVED ✅): all six data-ingestion handlers (`RecordProposal`, `RecordVotingResult`, `RecordSnapshot`, `RecordProtocolMetrics`, `RecordLockActivity`, `RecordParameterChange`) now verify `sender()` against a dedicated authorized-writer address stored in contract state.
- The writer slots start `null` and the handlers **fail closed** — no record is accepted from any sender until the deployer (governance multi-sig) configures the trusted writer for that data domain, so false records cannot be injected even before the writers are wired up.
- An attacker can therefore no longer inject false governance records; only the designated `proposal_registry` / `snapshot_verifier` / `report_writer` contracts can append data, each restricted to its own data domain.

**Residual risk:** LOW (RESOLVED ✅, Issue #365). Sender authentication is enforced on every record handler and is covered by regression tests in `contracts/governance/TransparencyRegistry.spec.ts`. The authoritative governance data remains in the ProposalRegistry; the TransparencyRegistry is an observation-only mirror.

### 4.6 Off-Chain Infrastructure Attacks

#### 4.6.1 Indexer Desynchronization

**Applicable to:** Backend Indexer, Merchant API, Frontend UIs.

**Analysis:**
- The indexer can fall behind the blockchain due to network issues, infrastructure failures, or deliberate attack.
- During desync, UIs display stale data: incorrect balances, missing transactions, wrong lock states.
- The indexer has reorg detection (compares block hashes), which handles blockchain reorganizations.

**Mitigation:**
- Indexer includes block height and timestamp in responses. Clients can detect staleness.
- Users can verify on-chain state directly via TON lite clients or explorers.
- The SDK's `verifySettlement()` queries the blockchain directly, bypassing the indexer.

**Residual risk:** LOW. The indexer is a convenience layer. All authoritative data is available on-chain.

#### 4.6.2 API Downtime

**Applicable to:** Merchant API, external adapters.

**Analysis:**
- If the Merchant API is down, merchants cannot create invoices via API. However, they can use the SDK to create invoices locally.
- If external adapters are down (ChangeNOW, NOWPayments), on/off-ramp services are unavailable. Internal protocol operations (transfers, governance) continue unaffected.

**Residual risk:** LOW. Core protocol operations do not depend on off-chain APIs.

#### 4.6.3 DNS Poisoning / MITM

**Applicable to:** API clients connecting to Merchant API, external adapters.

**Analysis:**
- DNS poisoning could redirect API calls to attacker-controlled servers.
- MITM attacks could intercept and modify API responses.
- HTTPS/TLS provides transport security when properly configured.

**Mitigation:**
- All external API calls should use HTTPS with certificate pinning.
- On-chain verification provides independent confirmation regardless of DNS/MITM attacks.

**Residual risk:** LOW. Transport security plus on-chain verification provides defense-in-depth.

---

## 5. Trust Boundaries

### 5.1 Trust Boundary Diagram

```
+-----------------------------------------------------------------------+
|                       TRUST BOUNDARY LEVEL 1                          |
|                        (ABSOLUTE TRUST)                               |
|                                                                       |
|   TON Blockchain Consensus Layer                                      |
|   - Validator consensus (BFT, >2/3 honest stake required)            |
|   - Block finality guarantees                                         |
|   - Cryptographic primitives (Ed25519, SHA-256)                       |
|   - TVM deterministic execution                                       |
+-----------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
|                       TRUST BOUNDARY LEVEL 2                          |
|                    (HIGH TRUST - IMMUTABLE)                            |
|                                                                       |
|   Protocol Smart Contracts (On-Chain, Immutable After Deployment)      |
|                                                                       |
|   +-------------------+ +-------------------+ +-------------------+   |
|   | Payment Hub       | | NFT Account       | | Account Locks     |   |
|   | (FunC + Tact)     | | Resolver          | | (FunC)            |   |
|   +-------------------+ +-------------------+ +-------------------+   |
|                                                                       |
|   +-------------------+ +-------------------+ +-------------------+   |
|   | Merchant Payment  | | Collateral Signal | | Governance        |   |
|   | Hub (Tact)        | | (Tact)            | | Contracts (Tact)  |   |
|   +-------------------+ +-------------------+ +-------------------+   |
|                                                                       |
|   External Immutable Contracts (Already Deployed):                     |
|   - TBC Jetton Master + Wallets (TEP-74)                              |
|   - NFT Collections 7777, 8888                                        |
|   - TBC Diamonds (222 governance NFTs)                                |
|   - TBC/TON Pool (TONCO DEX)                                          |
+-----------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
|                       TRUST BOUNDARY LEVEL 3                          |
|                    (MEDIUM TRUST - OFF-CHAIN)                         |
|                                                                       |
|   Protocol Off-Chain Components                                       |
|                                                                       |
|   +-------------------+ +-------------------+ +-------------------+   |
|   | Backend Indexer   | | Merchant API      | | Merchant SDK      |   |
|   | (read-only,       | | (orchestration    | | (informational,   |   |
|   |  convenience)     | |  only)            | |  read-only)       |   |
|   +-------------------+ +-------------------+ +-------------------+   |
|                                                                       |
|   - Cannot modify on-chain state                                      |
|   - Cannot sign transactions on behalf of users                       |
|   - All data verifiable on-chain independently                        |
+-----------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
|                       TRUST BOUNDARY LEVEL 4                          |
|                  (LOW TRUST - EXTERNAL SERVICES)                      |
|                                                                       |
|   External Third-Party Services                                       |
|                                                                       |
|   +-------------------+ +-------------------+ +-------------------+   |
|   | ChangeNOW         | | NOWPayments       | | CoinRabbit        |   |
|   | (swap API)        | | (payment API)     | | (lending API)     |   |
|   +-------------------+ +-------------------+ +-------------------+   |
|                                                                       |
|   - UNTRUSTED: Cannot modify on-chain state                           |
|   - May return false data or be unavailable                           |
|   - All interactions require on-chain confirmation                    |
|   - No authority over user funds or protocol contracts                |
+-----------------------------------------------------------------------+
```

### 5.2 Trust Boundary Rules

**What is trusted:**
- TON blockchain consensus and finality (Level 1).
- Deployed, immutable smart contract code executing on TVM (Level 2).
- Cryptographic primitives: Ed25519 signatures, SHA-256 hashes.
- TBC jetton contract's correct implementation of TEP-74 standard.

**What is NOT trusted:**
- Merchant backend — any merchant can run arbitrary code. Protocol requires on-chain verification.
- External provider API responses — ChangeNOW, NOWPayments, CoinRabbit responses are informational, never authoritative.
- Off-chain indexer data — may be stale, incomplete, or manipulated. Blockchain is the source of truth.
- Frontend UIs — can be spoofed, phished, or modified. Users must verify transaction details in their wallet.
- User private keys — the protocol assumes users protect their keys. Key compromise is outside protocol scope.

**What must be verified independently:**
- Settlement finality — merchants must verify on-chain before fulfilling orders.
- NFT ownership — must be queried on-chain at execution time, never cached.
- Balance sufficiency — verified by TBC jetton wallet contract, not by off-chain services.
- Lock state — must be checked on-chain before transfers (currently missing in FunC Payment Hub).

### 5.3 Explicit Trust Statements

1. **Blockchain = single source of truth.** All balances, ownership, lock states, and governance data are authoritative only when read from the blockchain.

2. **Indexer = convenience layer.** The indexer improves UX by caching blockchain data. It has no authority. If the indexer disagrees with the blockchain, the blockchain is correct.

3. **Merchant backend = untrusted.** A merchant can claim anything via API. Only on-chain settlement is proof of payment.

4. **External provider = partially trusted, never authoritative.** External APIs (ChangeNOW, NOWPayments, CoinRabbit) are trusted to process their own services (swaps, payments, lending) but are never authoritative over protocol state. On-chain confirmation is required for all external operations.

5. **Governance registry = transparency artifact.** The TransparencyRegistry records governance data for public access. It is not the authoritative governance state — the ProposalRegistry is.

---

## 6. Mitigation Mapping

Every identified threat is mapped to its code-level, architectural, and operational mitigations. Residual risk is explicitly acknowledged.

### 6.1 Smart Contract Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Reentrancy** (4.1.1) | Payment Hub (Tact) | Explicit `self.locked` reentrancy guard (PaymentHub.tact:121, 149–150); TON actor model prevents synchronous reentrancy | LOW — TON's actor model is structural protection |
| **Reentrancy** (4.1.1) | Payment Hub (FunC) | TON actor model prevents synchronous reentrancy; state changes complete before outgoing messages (payment-hub.fc:287–295) | LOW — No explicit guard, but TON architecture prevents the attack |
| **Storage corruption** (4.1.2) | All contracts | TVM enforces cell structure integrity; corrupt cells cause exceptions, not silent corruption | LOW — TVM provides structural protection |
| **Overflow/underflow** (4.1.3) | Payment Hub, Merchant Hub | TVM uses 257-bit integers; balance checks before debit (MerchantPaymentHub.tact:128); `load_coins()` uses VarUInteger16 | LOW — 257-bit arithmetic eliminates practical overflow |
| **Invalid state transitions** (4.1.4) | Account State Machine | Explicit transition rules; `FROZEN` and `COLLATERAL_LOCKED` have no exit path (blocked by design until mechanism is built) | MEDIUM — Frozen accounts cannot be unfrozen until DAO mechanism is implemented |
| **Access control bypass** (4.1.5) | MerchantPaymentHub.tact | Test-only functions (`SetAccountState`, `SetAccountBalance`) removed from the production contract and moved to `MerchantPaymentHubHarness` (test-only); `SetAccountLock` replaced by `ApplyAccountLock`, accepted ONLY from `account_locks_contract` (Issue #363) | RESOLVED ✅ (pre-mainnet) — CI regression guard blocks reintroduction |
| **Access control bypass** (4.1.5) | CollateralSignal.tact | Test-only `RegisterNFTOwner` removed from the production contract; ownership is registered ONLY via `ResolveNFTOwner`, accepted from the immutable `nft_resolver` (on-chain NFT Account Resolver), and remains write-once (CONTRACTS-M1) (Issue #364) | RESOLVED ✅ (pre-mainnet) — CI regression guard blocks reintroduction |
| **Access control bypass** (4.1.5) | TransparencyRegistry.tact | All six record handlers verify `sender()` against a deployer-configured per-domain authorized writer (`proposal_registry` / `snapshot_verifier` / `report_writer`); slots start `null` and fail closed; deployer-only `Set*` configuration messages (Issue #365) | RESOLVED ✅ (pre-mainnet) — covered by `TransparencyRegistry.spec.ts` |
| **Access control bypass** (4.1.5) | ProposalRegistry.tact | `SubmitProposal`/`CastVote` confirm ownership asynchronously via a trusted on-chain resolver before recording, failing closed until configured (Issue #248); the resolver/verifier addresses are governed by an M-of-N multi-sig + 7-day timelock + code-hash verification, with a recovery path for misconfiguration (Issue #366) | RESOLVED ✅ (pre-mainnet) — covered by `ProposalRegistry.spec.ts` |

### 6.2 Economic Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Liquidity draining** (4.2.1) | TBC/TON DEX pool | Pool is external (TONCO DEX); protocol does not depend on pool for core operations | LOW — Pool liquidity affects price discovery, not protocol function |
| **Collateral misrepresentation** (4.2.2) | Collateral Signal | Contract is advisory only; external lenders must independently verify; ownership is bound only by the trusted `nft_resolver` via `ResolveNFTOwner` (Issue #364), so only the genuine NFT owner can signal | LOW — Ungated ownership backdoor removed; external lenders still expected to verify independently |
| **Fee manipulation** (4.2.3) | Internal transfers | Zero-fee design eliminates fee manipulation | NEGLIGIBLE |
| **Incentive exploitation** (4.2.4) | Governance | Non-executable proposals limit impact; 10% quorum provides accessibility; gas costs rate-limit spam | LOW — Non-executable governance limits damage |

### 6.3 State Machine Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Invalid transitions** (4.3.1) | Account State Machine | Explicit transition rules enforced in contract logic | LOW |
| **Locked account bypass** (4.3.2) | FunC Payment Hub | **NOT MITIGATED** — `handle_internal_transfer()` and `handle_merchant_payment()` do not check Account Locks | **HIGH** — Must be fixed before deployment |
| **Locked account bypass** (4.3.2) | Tact Merchant Payment Hub | Mitigated — checks `canSendWithLocks(payer_locks)` at line 116–119 | LOW |
| **Locked account bypass** (4.3.2) | Direct TBC jetton transfer | **Architectural limitation** — TBC jetton contract is immutable, does not know about Account Locks | **MEDIUM** — Locks are advisory for direct transfers; documented limitation |
| **Partial execution** (4.3.3) | Multi-step external flows | Each on-chain operation is atomic; off-chain partial execution is inherent to cross-service flows | MEDIUM — Users accept risk of external service failures |

### 6.4 Integration Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Webhook forgery** (4.4.1) | NOWPayments adapter | HMAC webhook verification interface exists but is stubbed; on-chain verification provides independent confirmation | MEDIUM — Webhook verification must be fully implemented |
| **Callback replay** (4.4.2) | Merchant API | Idempotency support for invoice creation; no on-chain duplicate invoice prevention | MEDIUM — On-chain replay protection not implemented |
| **Order ID collision** (4.4.3) | Merchant API/SDK | Deterministic SHA-256 hashing for invoice IDs | NEGLIGIBLE — SHA-256 collision resistance |
| **Cross-chain spoofing** (4.4.4) | ChangeNOW adapter | On-chain TON-side receipt verification; cross-chain verification is ChangeNOW's responsibility | MEDIUM — Users must verify on-chain receipt |

### 6.5 Governance Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Proposal flooding** (4.5.1) | ProposalRegistry | Gas costs provide economic rate limiting; non-executable proposals limit impact | LOW |
| **Snapshot manipulation** (4.5.2) | SnapshotVerifier | Permissive fallback is documented design choice; TransparencyRegistry `RecordSnapshot` now restricted to the configured `snapshot_verifier` writer (Issue #365) | MEDIUM — Permissive fallback remains; false snapshot injection into TransparencyRegistry RESOLVED ✅ |
| **Off-chain misinformation** (4.5.3) | Governance communication | On-chain proposal data is authoritative record | LOW for protocol; MEDIUM for social context |
| **False record injection** (4.5.4) | TransparencyRegistry | **RESOLVED ✅ (Issue #365)** — every record handler authenticates `sender()` against a deployer-configured per-domain writer and fails closed until configured | LOW — Only the designated writers can append records; regression-tested |

### 6.6 Off-Chain Infrastructure Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Indexer desync** (4.6.1) | Backend Indexer | Reorg detection (hash comparison + rollback); block height/timestamp in responses; SDK `verifySettlement()` queries blockchain directly | LOW — Indexer is convenience layer only |
| **API downtime** (4.6.2) | Merchant API, adapters | SDK can create invoices locally; core protocol operates independently of APIs | LOW — Protocol does not depend on off-chain APIs |
| **DNS/MITM** (4.6.3) | All API clients | HTTPS/TLS required; on-chain verification provides independent confirmation | LOW — Transport security + on-chain verification |

### 6.7 Admin/Key Compromise Threat Mitigations

| Threat | Component | Mitigation | Residual Risk |
|--------|-----------|------------|---------------|
| **Admin key compromise** (8.1) | Payment Hub admin | Admin CANNOT move funds (no withdrawal functions); admin CAN pause protocol (DoS) and flag accounts (censorship) | **HIGH** — Single admin key, no multi-sig, no time-lock |
| **Risk authority compromise** (8.2) | Account Locks | Risk authority can set/clear fraud locks but CANNOT move funds; single key with no rotation mechanism | **HIGH** — Single key, no multi-sig |
| **Lending adapter compromise** (8.3) | Account Locks | Lending adapter can set/clear collateral locks but CANNOT move funds; single key with no rotation mechanism | MEDIUM — Single key, limited blast radius (collateral locks only) |
| **Indexer key compromise** (8.4) | Backend Indexer | Indexer is read-only; compromised indexer cannot move funds; can only serve false data | LOW — Indexer has no on-chain authority |

---

## 7. Finality & Reorg Model

### 7.1 Required Confirmation Depth

TON blockchain provides probabilistic finality after each block is processed. For security-critical operations:

| Operation Type | Recommended Confirmation Depth | Rationale |
|---------------|-------------------------------|-----------|
| Internal TBC transfer | 1 block | Single-shard atomic operation; TON BFT provides strong single-block guarantees |
| Merchant payment settlement | 5+ blocks | Higher value operations benefit from additional confirmation depth |
| External deposit (from DEX) | 10+ blocks | Cross-contract operations involving external protocols should wait for deeper finality |
| Governance vote finalization | Full voting window (7 days) | Governance decisions are not time-sensitive |

**Implementation:** The backend indexer supports configurable confirmation depth. The SDK's `verifySettlement()` defaults to 5 block confirmations.

### 7.2 Reorg Tolerance

**TON-specific context:** TON's BFT consensus makes reorganizations rare. A reorg requires more than 1/3 of validator stake to behave maliciously, which would undermine the entire chain's security — not just this protocol.

**Indexer reorg handling:**
- The indexer compares block hashes for each new block against stored hashes.
- If a mismatch is detected, the indexer rolls back its local database to the fork point and re-indexes from there.
- During rollback, affected transactions are marked as reverted.
- API consumers receive updated status reflecting the reorg.

**Contract-level reorg handling:**
- Smart contracts do not handle reorgs. Each transaction executes deterministically based on current state.
- If a block containing a transfer is reverted by a reorg, the transfer never happened from the protocol's perspective.
- The protocol does not maintain "pending" states that could become inconsistent during reorgs.

### 7.3 Replay Handling

**On-chain replay protection:**
- TON natively prevents transaction replay via sequence numbers (seqno) in wallet contracts.
- Each transaction from a wallet has a unique seqno. Replaying a transaction with the same seqno is rejected by the wallet contract.

**Invoice replay (off-chain):**
- The protocol does NOT enforce invoice uniqueness on-chain. The same merchant payment (same invoice_id, same amount) can be submitted multiple times if the user signs each transaction.
- Invoice replay protection is the responsibility of the Merchant API (idempotency support) and the merchant's own systems.

### 7.4 Settlement Finality Threshold

A payment is considered final when:
1. The on-chain transaction is included in a block — probabilistic finality.
2. The recommended confirmation depth has passed without reorg — strong finality.
3. The indexer has processed the block and updated its database — operational finality.

**Partial finality:** Between steps 1 and 2, the transaction has probabilistic finality. The merchant must decide their own risk tolerance for acting on partially-final transactions.

### 7.5 Cross-Contract Consistency

**Within a single transaction:** All state changes are atomic. If any validation fails, the entire transaction reverts. There is no inconsistency between contracts within a single transaction.

**Across transactions:** State changes in different contracts (e.g., Payment Hub and Account Locks) may be observed in different orders by different observers. This is inherent to asynchronous blockchain systems.

**Protocol approach:** The protocol does not depend on cross-contract consistency within the same block. Each contract operation is self-contained and validates its own preconditions.

---

## 8. Key Compromise Scenarios

### 8.1 Payment Hub Admin Key Compromise

**Blast radius:**
- Attacker can pause the Payment Hub, halting all transfers (DoS).
- Attacker can flag any account as blocked, preventing that account from transacting (censorship).
- Attacker CANNOT move funds. No withdrawal, transfer, or drain functions exist.

**Containment:**
- Users' TBC jetton wallets and NFTs are unaffected. Funds are safe but inaccessible via Payment Hub.
- Users can transfer TBC directly via jetton wallets (bypassing the paused Payment Hub).
- Users can transfer NFTs freely (NFT contracts are separate and unaffected).

**Recovery path:**
1. Deploy new Payment Hub contract with a new admin key.
2. Update NFT Resolver to point to the new Payment Hub (if resolver is not immutable) or deploy new resolver.
3. Update frontend UIs and SDKs to use the new contract address.
4. Blocked accounts on the old contract have no effect on the new contract.

**Recovery cost:** Contract redeployment + user migration. No funds are lost.

### 8.2 Risk Authority Key Compromise (Account Locks)

**Blast radius:**
- Attacker can set fraud locks on arbitrary accounts, preventing those accounts from sending via Payment Hub.
- Attacker can clear fraud locks on accounts that were legitimately locked.
- Attacker CANNOT set collateral locks (requires `lending_adapter` key).
- Attacker CANNOT move funds.

**Containment:**
- Locked accounts can still receive funds (invariant I6).
- Users can bypass fraud locks by transferring TBC directly via jetton wallets.
- The blast radius is limited to Payment Hub transfers — not direct jetton operations.

**Recovery path:**
1. Deploy new Account Locks contract with a new risk authority key.
2. Restore correct lock states from blockchain history (all lock/unlock events are logged).
3. Update Payment Hub to use the new Account Locks contract address.

**Recovery cost:** Contract redeployment + lock state migration. No funds are lost.

### 8.3 Lending Adapter Key Compromise (Account Locks)

**Blast radius:**
- Attacker can set collateral locks on arbitrary accounts, preventing those accounts from sending via Payment Hub.
- Attacker can clear collateral locks on accounts with active lending positions, potentially enabling unauthorized collateral withdrawal.
- Attacker CANNOT set fraud locks (requires `risk_authority` key).
- Attacker CANNOT move funds.

**Containment:**
- Impact is limited to accounts with active collateral signals.
- Clearing a collateral lock does not move funds — it only removes the send restriction. The actual loan collateral is held by the external lending protocol (CoinRabbit), not by TONBANKCARD.
- The Collateral Signal Contract is advisory; the external lending protocol must independently verify collateral status.

**Recovery path:**
1. Deploy new Account Locks contract with a new lending adapter key.
2. Restore correct collateral lock states from blockchain history.
3. Notify external lending protocols of the key compromise.

**Recovery cost:** Contract redeployment + coordination with external lending protocols. No funds are lost.

### 8.4 Indexer Infrastructure Compromise

**Blast radius:**
- Attacker can serve false data to API consumers (incorrect balances, fake transaction statuses, missing events).
- Attacker CANNOT modify on-chain state, move funds, or submit transactions.

**Containment:**
- All authoritative data is available on-chain.
- Users and merchants can verify on-chain directly via TON explorers or lite clients.
- The SDK's `verifySettlement()` queries the blockchain directly, bypassing the indexer.

**Recovery path:**
1. Redeploy indexer infrastructure from clean state.
2. Re-index from blockchain history (full re-sync).
3. No on-chain remediation required.

**Recovery cost:** Infrastructure redeployment + re-sync time. No funds are at risk.

### 8.5 Merchant Wallet Compromise

**Blast radius:**
- Attacker gains control of the merchant's NFT and associated account.
- Attacker can withdraw merchant's TBC balance.
- Attacker can receive payments intended for the merchant.
- Attacker CANNOT access other users' accounts or funds.

**Containment:**
- Impact is limited to the compromised merchant's account.
- Other users' accounts are unaffected.
- The risk authority can set a fraud lock on the compromised merchant account to prevent further outgoing transfers (but cannot recover already-transferred funds).

**Recovery path:**
1. Risk authority sets fraud lock on compromised account (if attacker hasn't already drained funds).
2. Merchant acquires new NFT and creates new merchant account.
3. Merchant updates payment integration to use new account.
4. Funds already transferred by attacker cannot be recovered by the protocol (on-chain transfers are final).

**Recovery cost:** Funds drained by attacker are lost. New account setup required.

### 8.6 Governance NFT (Diamond) Compromise

**Blast radius:**
- Attacker gains 1+ governance votes.
- Attacker can submit proposals and vote.
- With 23+ compromised Diamonds (ceil 10% quorum), attacker can pass proposals.
- Governance proposals are non-executable — passed proposals have no on-chain effect.

**Containment:**
- The non-executable nature of governance proposals means a compromised governance NFT cannot directly harm the protocol.
- The attacker can influence social consensus but cannot trigger on-chain actions.

**Recovery path:**
1. Legitimate Diamond holders can submit counter-proposals.
2. Community can publicly flag compromised governance votes.
3. No on-chain remediation is required because governance is non-executable.

**Recovery cost:** Social/reputational coordination. No funds are at risk.

---

## 9. Explicit Non-Goals

This threat model does NOT attempt to:

### 9.1 Guarantee Zero Risk

All systems have residual risks. This document enumerates known risks and their mitigations. New risks may emerge as the protocol evolves, new attack techniques are discovered, or the threat landscape changes.

### 9.2 Eliminate Blockchain-Level Attacks

Attacks on TON consensus (validator collusion, 51% attacks, BFT failures) are outside the scope of this protocol. The protocol assumes TON consensus is secure. If TON consensus fails, all TON-based protocols are affected — this is not a TONBANKCARD-specific risk.

### 9.3 Eliminate Merchant Operational Risk

Merchants are responsible for their own operational security: key management, server security, API authentication, fulfillment logic, refund policies. The protocol provides tools (on-chain verification, SDK) but does not enforce merchant operational practices.

### 9.4 Protect Users from Self-Custody Mistakes

Users who lose their private keys, share their seed phrases, or fall victim to phishing lose access to their accounts. The protocol cannot recover funds from lost keys. This is inherent to non-custodial architecture.

### 9.5 Provide Insurance

The protocol does not insure user funds against any loss scenario, including smart contract bugs, key compromise, or external service failures. Users accept the risks of self-custody.

### 9.6 Prevent External Service Failures

ChangeNOW, NOWPayments, and CoinRabbit are third-party services. Their availability, correctness, and security are their own responsibility. The protocol isolates their failure modes from core operations (invariant I7) but cannot prevent them from failing.

### 9.7 Guarantee TBC Token Price Stability

The TBC token trades on TONCO DEX. Its price is determined by market supply and demand. The protocol does not manage, stabilize, or guarantee the token's market price.

---

## Appendix A: Contract Inventory

### A.1 Protocol Contracts (Not Yet Deployed)

| Contract | Language | Lines | Source Path | Purpose |
|----------|----------|-------|-------------|---------|
| Payment Hub | FunC | 372 | `contracts/payments/payment-hub.fc` | Core payment routing |
| Payment Hub | Tact | 355 | `contracts/payments/PaymentHub.tact` | Core payment routing (Tact version) |
| Merchant Payment Hub | Tact | 288 | `contracts/MerchantPaymentHub.tact` | Merchant settlement |
| Account Locks | FunC | 270 | `contracts/payments/account-locks.fc` | Fraud/collateral locks |
| Account State Machine | Tact | 285 | `contracts/payment-hub/account-state.tact` | Account states and balances |
| NFT Account Resolver | FunC | 150 | `contracts/nft-resolver/nft_account_resolver.fc` | NFT ownership resolution |
| NFT Account Resolver | Tact | 121 | `contracts/nft-resolver/nft_account_resolver.tact` | NFT ownership resolution (Tact version) |
| Collateral Signal | Tact | 370 | `contracts/CollateralSignal.tact` | Non-custodial collateral signaling |
| Public Collateral Lookup | Tact | 180 | `contracts/collateral-lookup/PublicCollateralLookup.tact` | Privacy-preserving collateral query |
| Public Collateral Lookup | FunC | 178 | `contracts/collateral-lookup/public-collateral-lookup.fc` | Privacy-preserving collateral query |
| Proposal Registry | Tact | 414 | `contracts/governance/ProposalRegistry.tact` | Governance proposals |
| Snapshot Verifier | Tact | 207 | `contracts/governance/SnapshotVerifier.tact` | Governance snapshot verification |
| Transparency Registry | Tact | 365 | `contracts/governance/TransparencyRegistry.tact` | Governance transparency layer |
| Diamond Resolver | FunC | 262 | `contracts/governance/diamond_resolver.fc` | Governance helper (read-only) |

### A.2 Deployed Contracts (Immutable, Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| TBC Jetton Master | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | TBC token (TEP-74 Jetton) |
| NFT Series 7777 | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | Account abstraction NFTs |
| NFT Series 8888 | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | Account abstraction NFTs |
| TBC Diamonds | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` | Governance NFTs (222 fixed supply) |
| TBC/TON Pool | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` | TONCO DEX liquidity pool |

### A.3 Off-Chain Components

| Component | Source Path | Purpose |
|-----------|-------------|---------|
| Backend Indexer | `backend/indexer/` | Blockchain event indexing |
| Event Parser | `backend/indexer/src/parsers/event-parser.ts` | Event parsing (stubbed) |
| API Routes | `backend/indexer/src/api/routes.ts` | Indexer API endpoints |
| ChangeNOW Adapter | `backend/adapters/changenow.ts` | Crypto swap integration |
| NOWPayments Adapter | `backend/adapters/nowpayments.ts` | Payment processing integration |
| CoinRabbit Adapter | `backend/adapters/coinrabbit.ts` | Lending integration |
| Merchant API | `api/src/` | Invoice management |
| Merchant SDK | `sdk/src/` | TypeScript SDK for merchants |

---

## Appendix B: Invariant Cross-Reference

This section maps each threat to the seven protocol invariants defined in [docs/invariants.md](../invariants.md).

### B.1 Threat-to-Invariant Matrix

| Threat | I1 Non-Custodial | I2 NFT Authority | I3 No Admin Fund Control | I4 Atomic | I5 Conservation | I6 Lock Not Confiscation | I7 Adapter Isolation |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Reentrancy (4.1.1) | - | - | - | Preserved | Preserved | - | - |
| Storage corruption (4.1.2) | Preserved | Preserved | Preserved | Preserved | Preserved | Preserved | - |
| Overflow/underflow (4.1.3) | - | - | - | Preserved | Preserved | - | - |
| Invalid transitions (4.1.4) | - | - | - | - | - | Preserved | - |
| Access control bypass (4.1.5) | **At risk** | **At risk** | **At risk** | - | **At risk** | - | - |
| NFT race / front-running | Preserved | Preserved | - | Preserved | - | - | - |
| Locked account bypass (4.3.2) | - | - | - | - | - | **At risk** | - |
| Webhook forgery (4.4.1) | - | - | - | - | - | - | Preserved |
| Callback replay (4.4.2) | - | - | - | - | - | - | - |
| Governance attacks (4.5) | - | - | - | - | - | - | - |
| Admin key compromise (8.1) | Preserved | Preserved | Preserved | - | - | **Borderline** | - |
| External adapter exploit (4.4) | - | - | - | - | - | - | Preserved |

**Legend:**
- "Preserved" — Invariant holds despite the threat, mitigations are in place.
- "**At risk**" — Invariant could be violated if the threat materializes (pre-production issues).
- "**Borderline**" — Invariant holds technically (locks don't seize funds) but indefinite locks approach effective confiscation.
- "-" — Threat does not affect this invariant.

### B.2 Pre-Production Risks to Invariants

| Invariant | Risk | Source | Remediation |
|-----------|------|--------|-------------|
| I1 | ~~Test-only functions in MerchantPaymentHub.tact allow anyone to set account state/balance~~ | `SetAccountState`, `SetAccountBalance` messages with no access control | RESOLVED ✅ (Issue #363) — handlers removed from the production contract and moved to `MerchantPaymentHubHarness` (test-only); CI regression guard blocks reintroduction |
| I3 | ~~Test-only functions allow balance modification without NFT owner signature~~ | `SetAccountBalance` message in MerchantPaymentHub.tact | RESOLVED ✅ (Issue #363) — removed from production; merchant payments debit/credit only via NFT-owner-authorised `MerchantPaymentRequest` |
| I5 | ~~`SetAccountBalance` can create/destroy funds~~ | MerchantPaymentHub.tact | RESOLVED ✅ (Issue #363) — removed from production contract before mainnet |
| I6 | FunC Payment Hub does not check Account Locks | payment-hub.fc missing `can_send()` call | Add lock checking integration |

---

## Appendix C: Audit Checklist

This checklist enables an external auditor to systematically verify the protocol's security properties.

### C.1 Smart Contract Security

#### Payment Hub (FunC: `payment-hub.fc`)

- [ ] Verify `verify_nft_account()` (lines 96–112) correctly validates NFT ownership
- [ ] Verify `get_nft_owner()` (lines 73–80) returns actual on-chain NFT owner (currently placeholder)
- [ ] Confirm `handle_internal_transfer()` (lines 127–163) checks Account Locks before transfer — **EXPECTED TO FAIL: lock check is missing**
- [ ] Confirm `handle_merchant_payment()` (lines 166–197) checks Account Locks before transfer — **EXPECTED TO FAIL: lock check is missing**
- [ ] Verify `handle_set_paused()` (lines 233–239) only sets flag, cannot move funds
- [ ] Verify `handle_flag_account()` (lines 242–263) only sets flag, cannot move funds
- [ ] Confirm no admin withdrawal, drain, or privileged transfer functions exist
- [ ] Verify events emitted after state changes, not before (lines 115–124)
- [ ] Check `recv_internal()` (lines 266–332) handles unknown opcodes safely

#### Payment Hub (Tact: `PaymentHub.tact`)

- [ ] Verify reentrancy guard (lines 121, 149–150) is correctly implemented
- [ ] Verify ownership check in `TransferInternalRequest` handler
- [ ] Confirm self-transfer handled as no-op with event emission

#### Merchant Payment Hub (Tact: `MerchantPaymentHub.tact`)

- [ ] Verify `MerchantPaymentRequest` validation sequence (payer ownership, state, locks, balance)
- [ ] Confirm `canSendWithLocks()` check is performed (lines 116–119)
- [x] **CRITICAL: Test-only functions removed before deployment (Issue #363)** — `SetAccountState` / `SetAccountBalance` moved to `MerchantPaymentHubHarness` (test-only); `SetAccountLock` replaced by `account_locks_contract`-gated `ApplyAccountLock`; CI regression guard (`non-production-stubs.spec.ts`) blocks reintroduction
- [ ] Verify atomic debit/credit (lines 134–135) preserves ledger conservation

#### Account Locks (FunC: `account-locks.fc`)

- [ ] Verify `can_send()` (lines 91–100) returns 0 when any lock is active
- [ ] Verify `can_receive()` (lines 104–106) always returns 1
- [ ] Verify risk_authority check (lines 162, 177) for fraud lock operations
- [ ] Verify lending_adapter check (lines 192, 207) for collateral lock operations
- [ ] Confirm lock operations do not modify balances (lines 110–119)
- [ ] Verify lock events are emitted (lines 113–138)

#### NFT Account Resolver (FunC: `nft_account_resolver.fc`)

- [ ] Verify `recv_internal()` rejects ALL messages (line 141)
- [ ] Verify hardcoded collection addresses match deployed mainnet addresses
- [ ] Confirm no state mutations are possible

#### Collateral Signal (Tact: `CollateralSignal.tact`)

- [x] **RESOLVED (Issue #364): `RegisterNFTOwner` removed** — ownership is registered ONLY via `ResolveNFTOwner`, gated by the immutable `nft_resolver` (on-chain NFT Account Resolver), write-once (CONTRACTS-M1); the deployer can no longer register ownership (invariant I3)
- [ ] Verify signal operations are non-custodial (no balance movement)
- [ ] Verify ownership validation in `validateOwnership()`

#### Governance Contracts

- [ ] **CRITICAL: Verify `SubmitProposal` and `CastVote` verify Diamond NFT ownership** — currently unverified
- [x] **CRITICAL: Verify TransparencyRegistry record messages have access control** — RESOLVED ✅ (Issue #365): all six record handlers authenticate `sender()` against deployer-configured per-domain writers and fail closed; covered by `contracts/governance/TransparencyRegistry.spec.ts`
- [ ] Verify ProposalRegistry double-vote prevention (composite key `proposal_id * 1000 + nft_id`)
- [ ] Verify SnapshotVerifier permissive fallback behavior is acceptable
- [ ] Confirm governance proposals are non-executable

### C.2 Invariant Verification

- [ ] **I1 (Non-Custodial):** No function in any contract can move funds without NFT owner signature
- [ ] **I2 (NFT Authority):** NFT ownership is queried on-chain for every operation, never cached
- [ ] **I3 (No Admin Fund Control):** No admin withdrawal, drain, or privileged transfer functions exist
- [ ] **I4 (Atomic Transfers):** All balance updates happen atomically within a single transaction
- [ ] **I5 (Ledger Conservation):** Every debit has an equal credit; no hidden fees
- [ ] **I6 (Lock Not Confiscation):** Locked accounts can receive; locks are reversible; locks don't modify balances
- [ ] **I7 (Adapter Isolation):** External adapters have no direct smart contract access; all operations are user-initiated

### C.3 Key Management

- [ ] Document admin key storage and access controls
- [ ] Verify admin key is not hardcoded in source code
- [ ] Confirm risk_authority and lending_adapter keys are separate from admin key
- [ ] Assess single-key risk for admin, risk_authority, and lending_adapter roles
- [ ] Evaluate need for multi-signature requirements

### C.4 Integration Security

- [ ] Verify webhook signature verification is implemented before production use
- [ ] Confirm on-chain verification is the authoritative settlement check
- [ ] Verify indexer reorg detection and rollback logic
- [ ] Confirm API authentication and rate limiting in Merchant API

---

## Document Maintenance

This threat model is a living document. It must be updated when:

1. New smart contracts are deployed.
2. Protocol features are added or modified.
3. Security vulnerabilities are discovered.
4. Invariants are modified (requires governance approval).
5. External integrations change.
6. Audit findings are addressed.
7. Pre-production issues listed in this document are resolved.

### Version History

| Version | Date | Changes | Reference |
|---------|------|---------|-----------|
| 1.0 | 2025-12-27 | Initial threat model | Issue #20 (`docs/threat-model.md`) |
| 2.0 | 2026-02-27 | Formal security architecture and threat model (this document) | Issue #54 (`docs/security/THREAT_MODEL.md`) |

---

## References

- [Issue #18 — Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
- [Issue #20 — Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
- [Issue #54 — Security Architecture & Threat Model (Protocol-Level, Formalized)](https://github.com/xlabtg/tonbankcard-protocol/issues/54)
- [docs/invariants.md](../invariants.md) — Protocol Invariants
- [docs/architecture.md](../architecture.md) — Protocol Architecture
- [docs/protocol-registry.json](../protocol-registry.json) — Contract Addresses
- [sdk/SECURITY.md](../../sdk/SECURITY.md) — SDK Security Model
- [TON Security Best Practices](https://docs.ton.org/develop/smart-contracts/security/secure-programming)
- [TON Actor Model & Message Delivery](https://docs.ton.org/develop/smart-contracts/guidelines/message-delivery-guarantees)
