# TONBANKCARD — Per-Contract Smart Contract Security Audit

**Document Type:** Per-Contract Security Audit
**Issue Reference:** [#110 — Критическая проверка всех смарт-контрактов](https://github.com/xlabtg/tonbankcard-protocol/issues/110)
**Scope:** All smart contracts listed in issue #110 (types, interfaces, payment hub, merchant hub, NFT resolver, governance, cross-chain, lending coordinator, multi-sig card)
**Methodology:** Static review against protocol invariants I1–I7, TON best practices, Tact/FunC idioms, and the threat model in `audit/THREAT_MODEL.md`
**Companion Documents:**
- System-level audit: [`docs/audit/FULL_SYSTEM_AUDIT.md`](../docs/audit/FULL_SYSTEM_AUDIT.md)
- Invariants: [`audit/INVARIANTS.md`](INVARIANTS.md)
- Threat model: [`audit/THREAT_MODEL.md`](THREAT_MODEL.md)
- Test coverage: [`audit/TEST_COVERAGE_REPORT.md`](TEST_COVERAGE_REPORT.md)

**Version:** 1.0
**Status:** Draft — Internal Pre-Audit Review
**Last Updated:** 2026-04-20

---

## 0. How to read this document

Each contract section contains:

- **Purpose** — one-line description of the contract's role
- **Invariant mapping** — which of I1–I7 the contract is expected to uphold
- **Findings** — every identified issue with severity, evidence (file:line) and recommendation
- **Standards & logic notes** — TON/Tact/FunC and architectural observations

Severity scale (identical to issue #110):

| Severity | Definition |
|----------|------------|
| 🔴 **CRITICAL** | Threat to user funds or non-custodial guarantee. Must be fixed before any mainnet deployment. |
| 🟠 **HIGH** | Serious logic error that can lead to loss of funds, state corruption, or privilege escalation under plausible conditions. |
| 🟡 **MEDIUM** | Bug or deviation that can produce incorrect behaviour without directly losing funds. |
| 🟢 **LOW** | Style, documentation, or hardening issue; no direct security impact. |

Findings are ID'd as `C<contract-code>-<severity>-<n>` for cross-reference.

---

## 1. Executive summary

| # | Contract | Severity breakdown | Deploy blocker? |
|---|----------|--------------------|-----------------|
| 1 | `types/AccountState.tact`            | LOW ×1                        | No |
| 2 | `types/LockState.tact`               | LOW ×1                        | No |
| 3 | `types/CollateralState.tact`         | LOW ×1                        | No |
| 4 | `interfaces/IAccountStateMachine.tact` | MEDIUM ×1, LOW ×1           | No |
| 5 | `interfaces/IAccountLocks.tact`      | LOW ×1                        | No |
| 6 | `interfaces/INFTResolver.tact`       | MEDIUM ×1                     | No |
| 7 | `MerchantPaymentHub.tact`            | CRITICAL ×1, HIGH ×2, MEDIUM ×2, LOW ×2 | **Yes** |
| 8 | `payments/payment-hub.fc`            | CRITICAL ×2, HIGH ×2, MEDIUM ×1 | **Yes** |
| 9 | `payments/PaymentHub.tact`           | HIGH ×2, MEDIUM ×2, LOW ×1     | **Yes** |
| 10 | `nft-resolver/nft_account_resolver.fc` | HIGH ×1, MEDIUM ×1          | **Yes** |
| 11 | `nft-resolver/nft_account_resolver.tact` | HIGH ×1, MEDIUM ×2        | **Yes** |
| 12 | `payment-hub/account-state.tact`     | CRITICAL ×1, HIGH ×1, MEDIUM ×1 | **Yes** |
| 13 | `governance/ProposalRegistry.tact`   | CRITICAL ×1, HIGH ×2, MEDIUM ×2, LOW ×1 | **Yes** |
| 14 | `governance/SnapshotVerifier.tact`   | CRITICAL ×1, HIGH ×1, MEDIUM ×2 | **Yes** |
| 15 | `CrossChainBridge.tact`              | CRITICAL ×1, HIGH ×2, MEDIUM ×1, LOW ×1 | **Yes** |
| 16 | `LendingProtocolCoordinator.tact`    | CRITICAL ×1, HIGH ×1, MEDIUM ×1 | **Yes** |
| 17 | `MultiSigCard.tact`                  | CRITICAL ×1, HIGH ×2, MEDIUM ×2, LOW ×1 | **Yes** |

**Most findings are *pre-deployment gaps*** rather than bugs in shipped code: several of the reviewed contracts carry explicitly labelled `// FOR TESTING ONLY` backdoors (`RegisterNFTOwner`, `RegisterNFTOwnerBridge`, `RegisterNFTOwnerMultiSig`, …) that allow an arbitrary sender to rewrite the ownership map used for authorisation. None of these contracts should be deployed without removing or gating those handlers. This matches the pre-existing observation in `docs/audit/FULL_SYSTEM_AUDIT.md` §10.1 (F-CRIT-1…F-CRIT-5) and extends it with new contracts that have not previously been flagged (CrossChainBridge, LendingProtocolCoordinator, MultiSigCard).

**No new fund-draining vulnerability was discovered in the two contracts that actually handle TBC balances (`PaymentHub.tact` and `MerchantPaymentHub.tact`)** — the invariant checks I1, I2, I4, I5, I6 hold at the execution paths reviewed. The remaining findings for those contracts concern defence-in-depth, NFT ownership source-of-truth, and admin role scope.

---

## 2. Contract-by-contract findings

### 2.1 `contracts/types/AccountState.tact`

**Purpose:** Enum + helpers for the four-state NFT account lifecycle (ACTIVE / FROZEN / COLLATERAL_LOCKED / CLOSED). Used by `MerchantPaymentHub` and reference to `PaymentHub.tact` / `account-state.tact`.

**Invariant mapping:** I6 (state helpers encode lock ≠ confiscation via `canReceive` allowing all non-CLOSED).

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-AS-L1 | 🟢 LOW | The enum is defined twice — here as `0/1/2/3` and in `payment-hub/account-state.tact` as `1/2/3/4` (STATE_ACTIVE=1). This is inconsistent across contracts and makes cross-contract messaging risky if the two state machines are ever wired together. **Recommendation:** collapse the two encodings into a single shared `types/AccountState.tact` and import it everywhere, or document the ABI mismatch explicitly. |

**Standards notes**

- The struct `AccountState { state: Int as uint8 }` is only 1 byte wide; if the number of states ever exceeds 256 (very unlikely) the `uint8` cast silently truncates. `uint8` is appropriate here — documenting the 0..3 range explicitly would help auditors.
- `canSend` correctly restricts sending to `ACTIVE` only, but downstream contracts must call it before debit — otherwise the helper is cosmetic.

---

### 2.2 `contracts/types/LockState.tact`

**Purpose:** Struct describing the two independent lock flags (`fraud_locked`, `collateral_locked`) and helpers.

**Invariant mapping:** I6 (receive always allowed; `canSendWithLocks` gates sends).

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-LS-L1 | 🟢 LOW | `defaultLockState()` is convenient but is not used consistently in consumer contracts — `MerchantPaymentHub.getLockState` calls it on miss (good), but other future callers could forget. Consider making this the only constructor and exposing it as a `trait` default. |

No security issues found in this type file.

---

### 2.3 `contracts/types/CollateralState.tact`

**Purpose:** Collateral signal states (NONE/ACTIVE/WARNING/RELEASED) with amount and timestamps.

**Invariant mapping:** I1, I2, I6 — signal is purely advisory and never grants control.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-CS-L1 | 🟢 LOW | `updated_at` and `created_at` are `uint32`. They wrap in 2106. Non-issue in practice but worth noting in long-term documentation. |

Type is defensively designed (explicit "NEVER custodies" comment). No issues.

---

### 2.4 `contracts/interfaces/IAccountStateMachine.tact`

**Purpose:** Trait with balance read getters and **virtual** `debitBalance` / `creditBalance`.

**Invariant mapping:** I4 (atomicity), I5 (conservation). Enforcement depends on the implementor.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-ISM-M1 | 🟡 MEDIUM | `debitBalance` / `creditBalance` are declared as plain `virtual fun`, with no access-control contract at the trait level. Because Tact does not enforce visibility on trait functions, any contract that composes this trait inherits publicly callable balance mutators unless the implementor explicitly gates the caller. `MerchantPaymentHub.tact` marks them `virtual override fun` and does not gate them (they are only called from the payment receiver, which is gated), but the trait itself offers no safeguard. **Recommendation:** mark internal mutators as `inline fun` called only from gated receivers and remove them from the trait, or document that implementors MUST ensure no external entry point can invoke them. |
| C-ISM-L1 | 🟢 LOW | `getBalance` returns `Int` instead of `Int as coins`. Consumers must remember that the value is nanoTBC. |

---

### 2.5 `contracts/interfaces/IAccountLocks.tact`

**Purpose:** Pure getter trait for lock state.

**Invariant mapping:** I6 read-side.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-IAL-L1 | 🟢 LOW | Getter-only trait, good. Consider adding a contract-level `canSend(nft)` / `canReceive(nft)` getter to the trait so callers don't have to reconstruct lock semantics client-side. |

No security issues.

---

### 2.6 `contracts/interfaces/INFTResolver.tact`

**Purpose:** Trait exposing `getOwner(nft)` and `isOwner(nft, claimed)`.

**Invariant mapping:** I2.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-INR-M1 | 🟡 MEDIUM | Both methods are `get fun` (off-chain getter). Smart-contract code CANNOT call another contract's `get` methods on-chain in TON — get methods are off-chain. This means any on-chain logic that tries to "ask the resolver for the owner" via these signatures will not compile / will not work. The contracts that rely on ownership (PaymentHub, MerchantPaymentHub, CrossChainBridge, LendingProtocolCoordinator, MultiSigCard) all avoid this by storing `nft_owners: map<Address, Address>` locally — but then the trait name `INFTResolver` is misleading: it is an off-chain read interface, not an on-chain resolver. **Recommendation:** either (a) rename to `INFTResolverOffchain` and document the limitation, or (b) design a message-based resolver (`GetNFTData`/`NFTDataResponse` pattern as `nft_account_resolver.tact` sketches but does not implement) that the payment contracts can use to get authoritative ownership. Without (b), the protocol's on-chain authority check degrades to "whatever the admin wrote into `nft_owners`". |

This is the **root cause** of many of the HIGH findings in the downstream contracts — their local `nft_owners` map is populated by unauthenticated test-only messages.

---

### 2.7 `contracts/MerchantPaymentHub.tact`

**Purpose:** On-chain merchant payment settlement (internal TBC bookkeeping, not jetton), with admin timelock transfer.

**Invariant mapping:** I1, I2, I3, I4, I5, I6.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-MPH-C1 | 🔴 CRITICAL | `SetAccountState`, `SetAccountBalance`, `SetAccountLock` (lines 303–319) are gated on `sender() == self.admin` — GOOD. But they allow the admin to (i) mint arbitrary balances via `SetAccountBalance`, (ii) set any NFT owner via `SetAccountState` (which takes an arbitrary `owner: Address`), and (iii) attach any lock state. This is a direct violation of **I3 "No Admin Control"**: the admin may not be able to `withdraw`, but they can *create* a balance for an NFT they control and then spend it, which is economically equivalent to a mint. The fact that the admin can also **set the owner of any NFT** via `SetAccountState.owner` then use their own sender address to call `MerchantPaymentRequest` means a malicious/compromised admin can drain any merchant account. **Recommendation:** remove `SetAccountBalance` entirely from production, make `SetAccountState` `owner`-less (derive owner via on-chain resolver or require the NFT owner to self-register), and disallow mutating `nft_owners` after first write. At minimum gate these messages behind the same 7-day timelock as admin transfer, or behind a multi-sig. **✅ RESOLVED (Issue #363):** `SetAccountState` / `SetAccountBalance` removed from the production contract (moved to the non-deployable `MerchantPaymentHubHarness`); `SetAccountLock` replaced by `ApplyAccountLock`, accepted only from `account_locks_contract`; `WhitelistMerchantCollection` placed behind a 7-day two-phase timelock. A CI regression guard fails the build if any handler reappears in the deployable source. See the remediation-status table below. |
| C-MPH-H1 | 🟠 HIGH | `nft_owners` is populated by `SetAccountState` and is **never synchronised with the real NFT contract**. If the NFT is transferred after `SetAccountState` is called, the old owner continues to have authority to spend the merchant balance (line 158 compares `sender` to the *stored* owner). This directly breaks the protocol's stated claim that "NFT ownership is the sole authority" (`audit/INVARIANTS.md` I2). **Recommendation:** either (a) query the NFT item contract at execution time via a message-based resolver, or (b) require every `MerchantPaymentRequest` to carry a fresh ownership proof (signed message from the NFT item contract) and verify it inline. |
| C-MPH-H2 | 🟠 HIGH | The `admin` can set/overwrite `nft_owners` via repeated `SetAccountState` calls (line 306: the `if (self.nft_owners.get(...) == null)` guard only prevents overwrite on *first* registration — but `SetAccountState` allows re-registering the state with a different `owner`, and although the owner map itself is write-once, a user that already has state entries can be denied service by a malicious admin setting their account to `ACCOUNT_STATE_CLOSED`). **Recommendation:** document the admin's ability to freeze accounts unilaterally in the threat model (it is already R-CRIT-2 there) and scope it explicitly to the fraud flow. |
| C-MPH-M1 | 🟡 MEDIUM | `validateAndExecutePayment` checks `payer_state` via `getAccountState` which defaults to `ACCOUNT_STATE_ACTIVE` for missing entries (line 225). Combined with C-MPH-H1, if an NFT is never registered but its address happens to be hashed into `nft_owners` (by an attacker using `SetAccountState` with a forged owner field), the default-active behaviour can be exploited. This is a defence-in-depth hardening: make `accountExists(nft) == false` fail the payment explicitly, instead of relying on the balance check. |
| C-MPH-M2 | 🟡 MEDIUM | No per-payment nonce or invoice identifier is enforced on-chain. `payload: Cell?` is opaque. Two identical `MerchantPaymentRequest` messages (same payer, merchant, amount, payload hash) are valid and will debit twice. Off-chain merchants must deduplicate; if they fail, users can be double-charged by a replayed signed message. **Recommendation:** require a strictly-monotonic `invoice_id: uint64` per `(payer_nft, merchant_nft)` and reject duplicates on-chain. Cross-reference F-HIGH-3 / F-MED-5 in the system audit. |
| C-MPH-L1 | 🟢 LOW | The `MerchantPayment` event is defined *after* the contract body (line 402), but is emitted inline (line 207). This compiles in Tact but makes static reading harder. Move event structs above the contract. |
| C-MPH-L2 | 🟢 LOW | `self.getLockState` returns a full `LockState` struct for every check; inline the boolean path (`canSendWithLocks`) into a single get to reduce gas. |

**Standards notes**

- Two-phase admin transfer with 7-day timelock (lines 328–378) is correctly implemented. `require(now() >= self.pending_admin_executable_at)` is a strict lower bound and safely handles the edge case where `now()` equals the expiry.
- `send(..., mode: SendRemainingValue)` is used for responses, which correctly returns remaining TON gas to the sender and avoids leaving dust in the contract. Good.
- Overflow: `balance + amount` and `balance - amount` on `Int as coins` are arbitrary-precision in Tact; no under/overflow issue (the `require(balance >= amount)` prevents negative balances).

---

### 2.8 `contracts/payments/payment-hub.fc` (FunC Core Payment Hub)

**Purpose:** FunC variant of the core payment routing contract — intended to be the "payment-hub.fc" referenced in the issue. Handles internal transfers, merchant payments, and admin flag/pause ops. It is the lowest-level routing layer.

**Invariant mapping:** I1, I2, I3, I6.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-PHF-C1 | 🔴 CRITICAL | `get_nft_owner` / `get_nft_data_raw` are **stubs** (lines 73–93). `get_nft_data_raw` returns *empty* slices as the owner and collection. Every call to `verify_nft_account` therefore succeeds if the caller's address equals the empty slice (which no real user has, but the check is structurally wrong — `equal_slices(owner, expected_owner)` with `owner = empty slice` is a tautology for a bogus caller, and the "ownership" validation is effectively a no-op). **This contract must not be deployed as-is.** The file even admits "Note: Actual implementation requires proper TVM run_method call / This simplified version demonstrates the expected interface". **Recommendation:** implement a real `run_method` or message-based ownership check, or delete the FunC variant and rely solely on `PaymentHub.tact`. |
| C-PHF-C2 | 🔴 CRITICAL | No Account Locks integration. The FunC hub's `handle_internal_transfer`, `handle_merchant_payment`, and `handle_payment_received` do not consult `account-locks.fc`. A `FRAUD_LOCK` on an account does not prevent it from sending via this hub. This is the same gap documented as F-CRIT-5 in `docs/audit/FULL_SYSTEM_AUDIT.md`. Must be fixed before any mainnet deployment. |
| C-PHF-H1 | 🟠 HIGH | `handle_internal_transfer` does not update any balances (lines 147–162 — only emits an event). The FunC hub is purely an event emitter and does not actually move any TBC. If this contract is deployed, users will see successful events but no balance changes. Either (a) implement real jetton transfer messages to the payer's/merchant's jetton wallets, or (b) delete this contract to avoid future confusion. |
| C-PHF-H2 | 🟠 HIGH | `save_data` writes `paused`, `blocked_accounts`, etc., but `load_data` never persists changes until `save_data` is called. `handle_internal_transfer`/`handle_merchant_payment`/`handle_payment_received` never call `save_data`, so any state mutation intended by the flag logic (there is none today, but the pattern is fragile for future changes) will silently drop. Today the `save_data` is only called from the two admin handlers, which is correct, but the omission of `save_data` elsewhere should be asserted invariantly (or the admin path should be separated into its own contract). |
| C-PHF-M1 | 🟡 MEDIUM | `blocked_accounts~udict_set(256, slice_hash(nft_address), …)` uses `slice_hash` as the dictionary key. `slice_hash` of an `addr_std$10` slice is deterministic but different from the commonly used 256-bit integer form of `addr_std` (workchain-qualified). If ever a non-std addr (addr_var / addr_none) is passed, the behaviour is undefined. Prefer `parse_std_addr` and key on `workchain<<256 | hash_part`. |

---

### 2.9 `contracts/payments/PaymentHub.tact` (Tact Payment Hub)

**Purpose:** Tact implementation of the core payment hub with reentrancy guard, account map, whitelist, and admin timelock transfer.

**Invariant mapping:** I1, I2, I3, I4, I5.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-PHT-H1 | 🟠 HIGH | `getOrCreateAccount` (lines 442–463) **auto-creates an account with `owner = nft_address`** when one doesn't exist. The owner check at line 239 (`require(sender() == from_account.owner, ...)`) then requires that the NFT address itself sent the message — impossible in practice, so this is safe for *new* accounts, but it silently populates the accounts map from *any* incoming `TransferInternalRequest` that references an unseen NFT. Combined with `isValidAccountNFT` (which returns `true` for any pre-existing account, line 427) this creates a storage-amplification and griefing surface: an attacker can inflate the `accounts` map by referencing arbitrary addresses, and future calls will treat those inflated entries as valid. **Recommendation:** do not create accounts on read; require an explicit `InitializeAccount` from the admin (with signed ownership proof) before any account is valid. |
| C-PHT-H2 | 🟠 HIGH | `InitializeAccount` (lines 323–335) is admin-only and writes an arbitrary `owner` / `initial_balance`. Identical issue to C-MPH-C1 — the admin can mint balance. The contract's own comment admits: `// NOTE: This is a test-only function`. It must be removed (or severely gated) before production. |
| C-PHT-M1 | 🟡 MEDIUM | Reentrancy guard uses a single `locked: Bool` flag (line 187). TON's actor model already provides natural message-handling atomicity — the flag is defensive but not strictly needed. **However**, the flag is only set `= false` on two code paths (self-transfer early return at line 254, and end of happy path at line 283). If any `require(...)` between `self.locked = true` (line 225) and one of those releases throws, the transaction is reverted (good — storage is rolled back, so the flag is also rolled back). The code is safe today, but the invariant "locked is always unset on return" depends on Tact's transaction-revert semantics. Documenting that dependency or moving to a try/finally idiom (not yet in Tact) is recommended. |
| C-PHT-M2 | 🟡 MEDIUM | `GetAccountStateRequest` (line 403) responds to any sender and materialises a new account via `getOrCreateAccount`. This is a read-only query but it writes to storage. Any querier can cause storage growth. **Recommendation:** use a pure getter (`get fun`) and remove the receiver form. |
| C-PHT-L1 | 🟢 LOW | `InternalTransferEvent.payload_hash` is computed only over `payload!!.memo.asSlice().hash()`, not `orderId`. Two payloads with the same memo but different order IDs produce the same hash, weakening off-chain de-duplication. Hash the whole `payload.toCell()` instead. |

**Standards notes**

- Self-transfer handling at lines 251–269 correctly no-ops the balance change while still emitting an event. Event is useful for transparency; the explicit branch also avoids `from_account.balance - amount + amount` rounding concerns (none in arbitrary-precision integers, but the pattern is still cleaner).
- Admin timelock (lines 344–400) is implemented correctly and matches the pattern in `MerchantPaymentHub.tact`.
- No reentrancy vector into jetton wallets exists because this contract keeps balances internally; if it ever becomes the routing layer to real jetton wallets, the reentrancy guard should be audited again.

---

### 2.10 `contracts/nft-resolver/nft_account_resolver.fc`

**Purpose:** FunC version of the NFT resolver — stateless, read-only, validates whitelisted collections and forwards owner/index data supplied by the caller.

**Invariant mapping:** I2.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-NRF-H1 | 🟠 HIGH | `resolve_owner_with_validation` accepts `owner_addr` **as a parameter** from the caller. The resolver itself does not verify that the supplied owner is the NFT's real owner — it only checks that the collection is whitelisted and that `is_initialized` is set. In other words, the resolver is a pure predicate over its inputs; it does not resolve anything. Anyone can call it with `(nft, whitelisted_collection, attacker_address, 0, true)` and receive back `(attacker_address, true, ...)`. If any downstream contract trusts this result without re-verifying, it effectively has no ownership check. The file comments acknowledge this ("In production, use an indexer to call get_nft_data() on the NFT contract"), but the name "resolver" is misleading. **Recommendation:** rename to `validate_collection_membership`, or implement a real cross-contract ownership check. |
| C-NRF-M1 | 🟡 MEDIUM | Hardcoded whitelisted collections (lines 22–40) are specified as 256-bit hashes. If the collection contract is ever re-deployed (new address) the resolver is frozen out. Since this is deliberate per the file comment, the residual risk is operational, not security — but it should be documented that upgrading collections requires a new resolver deployment. |

---

### 2.11 `contracts/nft-resolver/nft_account_resolver.tact`

**Purpose:** Tact counterpart of the FunC resolver.

**Invariant mapping:** I2.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-NRT-H1 | 🟠 HIGH | `resolveOwner` (lines 55–65) returns `nft_address` unchanged — it is a literal placeholder: `return nft_address; // Placeholder - actual implementation requires cross-contract call`. Any caller that uses this result trusts the NFT address itself as the owner, which is nonsensical. **Must be implemented** (see C-INR-M1 for the architectural root cause). |
| C-NRT-M1 | 🟡 MEDIUM | `receive("set_payment_hub")` (line 117) has `TODO: Add access control - only deployer can set this once` — the body is even commented out. Today the handler is a no-op, but if the TODO is resolved without the gate, **any** sender can hijack the resolver's `payment_hub` pointer. Needs explicit access control added before enabling. |
| C-NRT-M2 | 🟡 MEDIUM | `getAccountFlags` always returns defaults; the contract's own comment acknowledges "Flags are stored in Payment Hub, this resolver only reads them", yet the resolver has no `payment_hub` wired up (the field is nullable and never consulted). Off-chain consumers will receive misleading data. |

**Standards notes**

- `COLLECTION_7777` / `COLLECTION_8888` are declared `const` `Address` — static addresses are safe and cheap. Good.
- The stated TEP-62 compliance is aspirational until the resolver actually invokes `get_nft_data()` on the NFT item; today it only memoises the collection whitelist.

---

### 2.12 `contracts/payment-hub/account-state.tact`

**Purpose:** Standalone Account State Machine (balance + state per NFT) — different encoding from `types/AccountState.tact` (uses 1..4 instead of 0..3).

**Invariant mapping:** I1, I4, I5.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-ASM-C1 | 🔴 CRITICAL | `DepositTBC`, `WithdrawTBC`, `TransferInternal`, `ChangeAccountState` (lines 110–233) have **no sender authorisation at all**. Every receiver is ungated. Any address can call `DepositTBC{ nft_address: X, amount: 1_000_000 }` to mint balance for any NFT, or `TransferInternal{ from_nft: X, to_nft: Y }` to drain X. The file contains explicit `// NOTE: In production, should verify msg.sender == NFT owner` comments at lines 138 and 172 but the checks are absent. **This contract fundamentally breaks I1, I2, and I5 and must never be deployed without fixing the authorisation gaps.** |
| C-ASM-H1 | 🟠 HIGH | `ChangeAccountState` (line 189) has no authority check and no caller restriction. Anyone can freeze or close any account. Even after C-ASM-C1 is fixed, state transitions need per-role gating (risk_authority for FROZEN, lending_adapter for COLLATERAL_LOCKED, DAO for unfreeze — as the file comments on lines 209–216 describe, but none are enforced). |
| C-ASM-M1 | 🟡 MEDIUM | The state encoding (ACTIVE=1, FROZEN=2, COLLATERAL_LOCKED=3, CLOSED=4) differs from `types/AccountState.tact` (ACTIVE=0, FROZEN=1, COLLATERAL_LOCKED=2, CLOSED=3). If these two contracts ever cross-talk, state fields will be misinterpreted. **Recommendation:** pick one encoding (the `types/` one) and eliminate the other, or add a compile-time assertion against mis-use. |

**Standards notes**

- The contract stores `owner: Address` (line 85) but never uses it — it is a contract-level "owner" not an account owner. Dead state; remove.

---

### 2.13 `contracts/governance/ProposalRegistry.tact`

**Purpose:** On-chain record of governance proposals and votes for TBC Diamonds (222 NFTs, advisory).

**Invariant mapping:** advisory-only (no fund control), but correctness of voting integrity matters.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-PR-C1 | 🔴 CRITICAL | `SubmitProposal` (lines 148–207) has **no check that `sender()` owns the Diamond NFT with ID `author_nft_id`**. Anyone can submit a proposal claiming any NFT ID. Identical comment to the one acknowledged in `docs/audit/FULL_SYSTEM_AUDIT.md` §6.3 (F-CRIT-4). |
| C-PR-H1 | 🟠 HIGH | `CastVote` (lines 211–269) has **no check that `sender()` owns the Diamond NFT with ID `voter_nft_id`**. Any address can cast votes on behalf of any NFT ID (subject only to the `votes_cast` de-duplication by ID, so each ID can still only vote once — but the *first* caller to claim an NFT ID wins the vote, regardless of real ownership). Must be fixed before enabling any executable governance. |
| C-PR-H2 | 🟠 HIGH | The double-vote key is `proposal_id * 1000 + nft_id` (lines 241, 329). The Diamonds supply is 222 and `1000 > 222`, so collisions are avoided today, but the `uint64` key leaves no headroom if the supply is ever raised or the encoding ever changes. Collisions become silent double-votes. **Recommendation:** use a collision-resistant composite (e.g., `sha256(proposal_id, nft_id)` or TL-B packing). |
| C-PR-M1 | 🟡 MEDIUM | `DIAMONDS_COLLECTION` is a placeholder string `"EQDiamondsCollectionAddressPlaceholder123456789"` (line 125). This will fail to compile as a real TON address; the contract as written cannot be deployed. **Recommendation:** either make the collection address settable at `init(…)`, or wait to populate until the Diamonds collection is deployed. |
| C-PR-M2 | 🟡 MEDIUM | `FinalizeProposal` (line 273) has no caller restriction. Anyone can finalize once voting ends. This is acceptable (finalization is deterministic from state) but the lack of rate limiting means griefers can flood the chain with redundant finalize calls until the proposal status is set. Low impact; document as accepted. |
| C-PR-L1 | 🟢 LOW | `getVoteCounts` returns a `map<Int, Int>` with only three entries — a struct would be more ergonomic and self-describing. |

---

### 2.14 `contracts/governance/SnapshotVerifier.tact`

**Purpose:** Records the set of eligible voters per proposal at snapshot time.

**Invariant mapping:** advisory (no funds), but integrity of the snapshot matters for vote correctness.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-SV-C1 | 🔴 CRITICAL | `RegisterSnapshot` (lines 87–124) has **no access control**. Anyone can register snapshots for any proposal (the only guard is `self.snapshots.get(msg.proposal_id) == null`, i.e., first-come-first-served). An attacker who front-runs the legitimate indexer can install a snapshot that excludes most honest voters, censoring them. **Recommendation:** restrict `RegisterSnapshot` to a designated indexer address (set at init) or to the `proposal_registry` address. |
| C-SV-H1 | 🟠 HIGH | `isEligible` falls back to "all valid NFT IDs are eligible" when no snapshot exists (line 140). Combined with C-SV-C1 this means: (a) if nobody registers a snapshot, everyone is eligible — votes use current ownership which may have changed; (b) if an attacker registers a bogus snapshot first, the real eligibility is permanently mis-recorded (there is no overwrite path). Either branch of the fallback is a failure mode. **Recommendation:** require a snapshot before `CastVote` is allowed on a proposal, and make the snapshot oracle access-controlled. |
| C-SV-M1 | 🟡 MEDIUM | `set_registry` (lines 77–80) uses `require(self.proposal_registry == null, …)` to make the setup one-shot. First caller wins — same race as C-SV-C1. Set the registry at `init(…)` instead or deploy with an init-only code path. |
| C-SV-M2 | 🟡 MEDIUM | `batchVerifyEligibility` (lines 192–206) iterates 222 times regardless of `nft_ids` size and returns a `map<Int, Bool>` — this is a `get fun`, so it's off-chain only, but the O(n) iteration on large Diamonds supplies (if ever raised) is a footgun. Document the bound or parametrise `DIAMONDS_TOTAL_SUPPLY`. |

---

### 2.15 `contracts/CrossChainBridge.tact`

**Purpose:** Coordination layer for cross-chain bridge intents. Explicitly non-custodial (comment header: "Cross-chain verification is EXTERNAL").

**Invariant mapping:** I1, I2, I3, I4.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-CCB-C1 | 🔴 CRITICAL | `RegisterNFTOwnerBridge` (lines 399–401) is **ungated**. Any address can call this and set themselves (or anyone else) as the owner of any NFT in `self.nft_owners`. Once set, they pass `validateOwnership` and can register/cancel bridge intents for that NFT. Because this contract doesn't move funds, the direct financial impact is limited to causing external relayers to bridge TBC from the wrong address — but indexers and relayers that trust this registry are misled. **Must be removed or gated** before deployment. Same file also has an ungated `RegisterRelayer` that lets anyone whitelist themselves as an authorised relayer (see C-CCB-H1). |
| C-CCB-H1 | 🟠 HIGH | `RegisterRelayer` (lines 403–405) has **no access control**. Anyone can whitelist themselves as an authorised relayer and call `ConfirmBridgeExecution` on behalf of users. A malicious relayer cannot move funds on-chain, but they can mark *unexecuted* bridge intents as CONFIRMED with an arbitrary `external_tx_hash`, misleading off-chain systems into believing a cross-chain transfer succeeded. |
| C-CCB-H2 | 🟠 HIGH | The `intentKey` (line 377) hashes only `nft_address` and adds `intent_id`: `sha256(nft_address.asSlice()) + intent_id`. Because `intent_id` is user-supplied and the addition is plain Int addition (not a hash), an attacker can craft an `intent_id` that makes `intentKey(attacker_nft, attacker_intent) == intentKey(victim_nft, victim_intent)` (the collision requires `sha256(a) - sha256(b) == victim_intent - attacker_intent`, which is hard to search but not infeasible — 64-bit `intent_id` provides `2^64` grinding room against a 256-bit hash diff, so practically safe but theoretically unsound). **Recommendation:** use `sha256(concat(nft_address.asSlice(), intent_id_bytes))` or a TL-B-packed composite. |
| C-CCB-M1 | 🟡 MEDIUM | The authorised-relayer check (lines 226–228) treats relayer confirmations and owner confirmations identically, so a relayer can confirm an intent the owner did not initiate. Combined with C-CCB-C1/H1 this is a coordination hazard; even after gating the register functions, consider requiring the owner's prior `RegisterBridgeIntent` before any relayer confirmation is accepted (the current code does enforce `intent != null`, so this holds — but it is worth asserting in a test). |
| C-CCB-L1 | 🟢 LOW | `target_chain` is a `uint8` and validated `1..MAX_SUPPORTED_CHAIN` (currently 5). When new chains are added, all client code must be updated; consider a registry of supported chains instead of a hardcoded constant. |

---

### 2.16 `contracts/LendingProtocolCoordinator.tact`

**Purpose:** Coordination layer for opt-in lending intents. Explicitly non-custodial.

**Invariant mapping:** I1, I2, I3, I6.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-LPC-C1 | 🔴 CRITICAL | `RegisterNFTOwner` (lines 347–350) is **ungated**. Any address can set any NFT's owner in `self.nft_owners`. Once set, they pass `validateOwnership` and can register/update/cancel lending intents for arbitrary NFTs. The contract does not move funds, so the blast radius is limited to misleading off-chain lenders (CoinRabbit). **Must be removed or gated.** Identical flavour to F-CRIT-2 / F-CRIT-4 in the system audit. |
| C-LPC-H1 | 🟠 HIGH | The file defines **two** conflicting messages: `RegisterNFTOwner` (line 347, no opcode) and `message(0x7e8764ef) RegisterNFTOwnerLending` (line 359). Only `RegisterNFTOwner` has a handler; `RegisterNFTOwnerLending` appears to be dead code. If both are ever deployed, opcode collision on `RegisterNFTOwner` with `CollateralSignal.RegisterNFTOwner` could cause cross-contract message confusion. **Recommendation:** explicitly opcode-tag `RegisterNFTOwner` (or remove the dead `RegisterNFTOwnerLending`) and add a comment explaining the test-only nature. |
| C-LPC-M1 | 🟡 MEDIUM | `UpdateLendingIntent` (line 238) does not verify the intent was previously `ACTIVE` — it happily resurrects a `CANCELLED` intent into `ACTIVE`. This may be intended (user can re-enable) but is undocumented. Document or add a state check. |

---

### 2.17 `contracts/MultiSigCard.tact`

**Purpose:** Permission layer that adds required co-signatures for an NFT's payments. **Note:** The contract records APPROVED proposals but does **not** actually dispatch any payment message; the "execution" step is purely an event emission. Users must still sign the real payment elsewhere.

**Invariant mapping:** I1, I2, I3, I4.

**Findings**

| ID | Severity | Finding |
|----|----------|---------|
| C-MSC-C1 | 🔴 CRITICAL | `RegisterNFTOwnerMultiSig` (lines 559–561) is **ungated**. Any address can claim ownership of any NFT in `self.nft_owners`, then call `ConfigureMultiSig` / `SubmitPaymentProposal` / `RemoveMultiSig` to impersonate the real owner. Because the contract itself does not move funds, the impact is confined to creating fake multi-sig proposals, but the contract's *claim* that "NFT owner ALWAYS remains the primary authority" is false. **Must be removed or gated.** |
| C-MSC-H1 | 🟠 HIGH | **No actual settlement.** `PaymentProposalApproved` events are emitted when threshold is reached, but there is no handler that debits the NFT's TBC balance or forwards the payment to the Payment Hub. A user who configures multi-sig on their account and believes co-signers now gate their payments will be surprised to learn that their real payments still flow through `PaymentHub.tact` with only the NFT-owner signature — the multi-sig constraint is cosmetic unless the Payment Hub is taught to consult this contract. **Recommendation:** either (a) wire PaymentHub to refuse non-multisig-approved transfers when `MultiSigCard.isMultiSigEnabled(nft) == true`, or (b) delete the contract to avoid giving users a false sense of security. |
| C-MSC-H2 | 🟠 HIGH | `approvalKey` (line 536) uses `sha256(nft_addr) + proposal_id*1000 + sha256(signer)`. Plain additions of two 256-bit hashes do not produce a collision-resistant composite; an attacker can search `signer'` such that `sha256(signer) == sha256(signer') - k` for any chosen offset. The practical impact is limited because `signer` must be a real on-chain address whose message is verified, but the mathematical weakness is still worth fixing. Use `sha256(concat(addr, id_bytes, signer))`. |
| C-MSC-M1 | 🟡 MEDIUM | `ConfigureMultiSig` takes a fixed `signer_1/2/3` plus `required_signatures: 1..3`. If the owner wants 2-of-2, they must set `signer_3 = zero address` and the `isSigner` check (line 524) must reject zero. Today `isSigner` compares the sender address to `config.signer_3` — if `signer_3 == 0` and the zero-address was ever the sender (structurally impossible today), it would pass. Not exploitable, but clean up by explicitly rejecting zero or null signer slots. |
| C-MSC-M2 | 🟡 MEDIUM | `RemoveMultiSig` clears the config but does **not** reject or auto-complete any pending proposals. Pending proposals become orphaned (status still PENDING, but `isMultiSigEnabled == false`). `ApprovePaymentProposal` would then fail with `ERROR_MS_NO_CONFIG`, so approvals cannot land — but existing approvals remain in the `approvals` map forever. Clean up on remove, or document that removing multi-sig locks out pending proposals forever. |
| C-MSC-L1 | 🟢 LOW | The same `RegisterNFTOwner…` test-only pattern appears in three separate contracts (CollateralSignal, CrossChainBridge, LendingProtocolCoordinator, MultiSigCard). Factor into a shared trait `ITestOnlyRegistrar` and delete it pre-production via a feature flag / build target. |

---

## 3. Cross-cutting findings

These are patterns that appear in multiple contracts and deserve a single architectural decision.

| ID | Severity | Finding |
|----|----------|---------|
| X-1 | 🔴 CRITICAL | **Ungated `RegisterNFTOwner*` test backdoors.** Five contracts (`CollateralSignal`, `CrossChainBridge`, `LendingProtocolCoordinator`, `MultiSigCard`, and implicitly any future contract using the same pattern) expose a message handler that allows **any sender** to overwrite the authorisation map used for ownership checks. This is the same class of bug as F-CRIT-2…F-CRIT-4 in the existing system audit but this audit adds `CrossChainBridge`, `LendingProtocolCoordinator`, and `MultiSigCard` to the list. Recommendation: add a single CI guard that fails the build if `RegisterNFTOwner*` is present without an authority check. |
| X-2 | 🟠 HIGH | **NFT ownership source-of-truth.** Most contracts store `nft_owners: map<Address, Address>` as a local mirror of on-chain ownership, with no sync protocol back to the NFT item contract. When the NFT is transferred, these mirrors go stale and the contracts continue to grant authority to the previous owner. This directly contradicts invariant I2. A protocol-wide fix is needed: either (a) a message-based `INFTResolver` that the authority contracts consult at the moment of execution, or (b) ownership proofs (signed by the NFT item contract) attached to each authorising message. |
| X-3 | 🟠 HIGH | **Dual encodings of `AccountState`.** `types/AccountState.tact` uses `0..3`; `payment-hub/account-state.tact` uses `1..4`. `PaymentHub.tact` locally re-declares the `0..3` constants. Any cross-contract integration that transmits a state byte risks mis-interpretation. Collapse to one canonical encoding. |
| X-4 | 🟡 MEDIUM | **`get fun` misused as on-chain API.** `INFTResolver.tact` and `nft_account_resolver.tact` expose ownership lookups via `get fun`, which are off-chain only. All the on-chain authority checks therefore fall back to `nft_owners` local mirrors (see X-2). |
| X-5 | 🟡 MEDIUM | **Composite keys via addition.** `CrossChainBridge.intentKey`, `MultiSigCard.proposalKey` / `approvalKey`, and `ProposalRegistry`'s `proposal_id * 1000 + nft_id` all use non-collision-resistant composites. Any future expansion of ID ranges (e.g. >222 diamonds) can introduce silent collisions. |
| X-6 | 🟡 MEDIUM | **Storage-growth on read.** `PaymentHub.getOrCreateAccount` writes on `get fun` calls and on receive of `GetAccountStateRequest`. Any caller can inflate contract storage. Make read paths pure. |
| X-7 | 🟢 LOW | **Placeholder addresses in constants.** `ProposalRegistry.DIAMONDS_COLLECTION` and `SnapshotVerifier.DIAMONDS_COLLECTION` both hold the literal string `"EQDiamondsCollectionAddressPlaceholder123456789"`. The build will fail at these; replace before any audit build. |

---

## 4. Threat-model coverage check

Mapping of the threat classes in `audit/THREAT_MODEL.md` against the findings above:

| Threat class | Contracts most affected | Findings |
|--------------|------------------------|----------|
| T1 — NFT transfer race | PaymentHub.tact, MerchantPaymentHub.tact | C-MPH-H1, X-2 |
| T2 — Reentrancy & callback abuse | PaymentHub.tact | C-PHT-M1 (guard is present; note semantics) |
| T3 — Ledger desynchronisation | payment-hub.fc | C-PHF-H1 (FunC hub emits but never mutates) |
| T4 — Lock bypass | payment-hub.fc | C-PHF-C2 (no lock integration) |
| T5 — Merchant payment abuse | MerchantPaymentHub.tact | C-MPH-M2 (replay protection off-chain) |
| T6 — External adapter exploits | CrossChainBridge.tact | C-CCB-H1 (self-whitelist as relayer) |
| T7 — Oracle / price manipulation | n/a (out of scope) | — |
| T8 — Admin key compromise | All `admin:` state contracts | C-MPH-C1 (admin-mint via `SetAccountBalance`) — ✅ RESOLVED for MerchantPaymentHub (Issue #363): admin-mint handlers removed; admin can no longer mint balances or write lock state |

---

## 5. Standards compliance notes

- **TON best practices:** bounced-message handling is present only in the FunC files (`account-locks.fc`, `nft_account_resolver.fc`, `payment-hub.fc`). Tact contracts inherit the default bounce behaviour; this is acceptable for actors that emit `SendRemainingValue` replies but should be explicitly tested.
- **Tact idioms:** use of `inline fun`, `Int as coins`, `Int as uint32`/`uint64` is consistent. Map iteration in `SnapshotVerifier.batchVerifyEligibility` relies on a hard-coded supply bound, which is the right pattern for Tact (no unbounded iteration).
- **TEP-62 / TIP-4 (NFT Standard):** `nft_account_resolver.tact` claims compliance in its comment header but does not actually invoke `get_nft_data()` on the NFT item contract. True compliance requires the message-based resolver in X-2.
- **Audit Scope (`audit/SCOPE.md`):** all contracts listed in issue #110 have been visited in this document. The following additional contracts were encountered and are either out of scope for this audit or were touched only incidentally: `RecurringPayments.tact`, `TransparencyRegistry.tact`, `PublicCollateralLookup.tact`, `governance/diamond_resolver.fc`. They should be reviewed in a follow-up audit pass.

---

## 6. Recommended remediation order

1. **Before any mainnet deployment** — fix all 🔴 CRITICAL findings (C-MPH-C1, C-PHF-C1/C2, C-ASM-C1, C-PR-C1, C-SV-C1, C-CCB-C1, C-LPC-C1, C-MSC-C1) and the cross-cutting X-1.
2. **Before enabling executable governance** — fix C-PR-H1, C-PR-H2, C-SV-H1 (vote integrity) and X-2 (ownership source-of-truth).
3. **Before announcing multi-sig as a security feature** — fix C-MSC-H1 (wire PaymentHub to consult multi-sig) or remove the contract.
4. **Before announcing cross-chain bridge UX** — fix C-CCB-H1 (relayer whitelist) and document the trust model around `ConfirmBridgeExecution`.
5. **Defence-in-depth pass** — address MEDIUM findings (X-3 dual encodings, X-5 composite keys, X-6 storage growth) as a batch.

---

## 7. Mitigations applied in this PR

The following mitigations have been applied as part of this audit PR. They
address the most exploitable findings (anonymous-sender attacks against the
test-only ownership backdoors and the deploy-blocker for the FunC stub) and
reduce the immediate attack surface, but **do not** by themselves resolve the
underlying architectural items (X-2 NFT ownership source-of-truth, X-3 dual
encodings, the missing message-based `INFTResolver`, etc.).

| Finding | Contract | Mitigation in this PR | Residual risk |
|---------|----------|-----------------------|---------------|
| X-1, C-CS-* (CollateralSignal `RegisterNFTOwner`) | `contracts/CollateralSignal.tact` | Handler now requires `sender() == deployer` (deployer recorded at `init()`). Anonymous senders can no longer poison the ownership map. | Test-only handler still present; remove (or compile-out) before mainnet. |
| X-1, C-CCB-C1 (CrossChainBridge `RegisterNFTOwnerBridge`) | `contracts/CrossChainBridge.tact` | Handler gated by deployer + write-once on `nft_owners`. `RegisterRelayer` likewise gated. | Same — test-only path remains. C-CCB-H2 (composite key) and X-2 still open. |
| X-1, C-LPC-C1 (LendingProtocolCoordinator `RegisterNFTOwner`) | `contracts/LendingProtocolCoordinator.tact` | Handler gated by deployer + write-once on `nft_owners`. | Same. C-LPC-H1 (dead `RegisterNFTOwnerLending` opcode) still open. |
| X-1, C-MSC-C1 (MultiSigCard `RegisterNFTOwnerMultiSig`) | `contracts/MultiSigCard.tact` | Handler gated by deployer + write-once on `nft_owners`. | Same. C-MSC-H1 (no real settlement) still open. |
| X-1 (RecurringPayments `RegisterNFTOwnerRecurring`) | `contracts/RecurringPayments.tact` | Handler gated by deployer + write-once on `nft_owners`. | Same. |
| C-ASM-C1, C-ASM-H1 (account-state.tact unauthenticated mutators) | `contracts/payment-hub/account-state.tact` | `DepositTBC`, `WithdrawTBC`, `TransferInternal`, `ChangeAccountState` now require `sender() == self.owner` (deployer set at `init`). Anonymous senders can no longer mint balance or freeze accounts. | Real per-role / per-NFT-owner authorisation still pending the NFT Account Resolver integration; contract remains explicitly TEST-ONLY. |
| C-PHF-C1, C-PHF-C2, C-PHF-H1 (FunC `payment-hub.fc` stub) | `contracts/payments/payment-hub.fc` | `recv_internal` now `throw`s `DEPLOY_BLOCKER_NOT_PRODUCTION_READY` (0xDEAD) on every entry, making accidental deployment impossible until the verify_ownership stub, the missing Account Locks integration, and the missing balance updates are implemented. The throw and the constant are documented inline so the gate is removed in one place. | Contract still semantically incomplete; the deploy-blocker is a guardrail, not a fix. |
| C-MPH-C1 (MerchantPaymentHub `SetAccountBalance` admin mint) | `contracts/MerchantPaymentHub.tact` | **RESOLVED (Issue #363).** `SetAccountBalance` and `SetAccountState` have been **removed entirely** from the deployable production contract. The shared payment logic now lives in the `MerchantPaymentHubBase` trait; the two admin-mint / admin-register handlers exist ONLY in the non-deployable test harness `contracts/merchant-hub/test/MerchantPaymentHubHarness.tact`. A CI regression guard (`contracts/payment-hub/non-production-stubs.spec.ts`) fails the build if either handler reappears in the production source, and `scripts/deploy/deployable-contracts.ts` lists the harness as a non-production stub. In production, balances are funded by the on-chain TBC ledger/settlement flow and accounts are registered by the NFT Account Resolver — there is no admin-mint path. | None for the admin-mint vector. The architectural NFT-ownership source-of-truth item (`C-MPH-H1` / `X-2`) is tracked separately. |

Findings **not** addressed in this PR (and the reason):

- `X-2` (NFT ownership source-of-truth), `C-MPH-H1` (stale `nft_owners` after NFT transfer): requires a message-based `INFTResolver` and re-architecting every authority check. Architectural change — needs its own issue and tests.
- `X-3` (dual `AccountState` encodings): needs coordinated refactor across `types/AccountState.tact` and `payment-hub/account-state.tact`; safer to land in a dedicated PR with cross-contract integration tests.
- `C-PR-C1`, `C-PR-H1`, `C-PR-H2`, `C-SV-C1`, `C-SV-H1` (governance vote integrity): require a real Diamonds collection address and a snapshot oracle role; out of scope until governance is funded.
- `C-MPH-M2` (per-payment nonce / replay protection): requires an ABI change to `MerchantPaymentRequest` and downstream off-chain merchant integration work.
- `C-PHT-H1`, `C-PHT-H2`, `C-PHT-M2` (Tact `PaymentHub` admin-mint and storage growth): needs the same `InitializeAccount` rework as `SetAccountBalance` plus a pure-getter migration; tracked separately.

The owner's remediation plan posted on PR #111 (https://github.com/xlabtg/tonbankcard-protocol/pull/111#issuecomment-4284760756) lists the full P0 / P1 backlog; this PR closes the items that can be safely landed without breaking the existing test suite.

---

## 8. Limitations of this review

- Review is **static**: findings were derived by reading the code and cross-referencing invariants, threat model, and system audit. No automated tooling (Tact Analyzer, Slither-on-Tact, fuzzers) was run as part of this document. Issue #110 asks for Tact Analyzer / Slither; those should be executed in a follow-up once the CRITICAL findings above are addressed (running them against the backdoored test-only handlers would bury real findings under noise).
- Review covered the contracts listed in issue #110 plus the immediate dependencies in `contracts/types/`, `contracts/interfaces/`, and `contracts/governance/`. It did not cover `RecurringPayments.tact`, the `TransparencyRegistry.tact` state-mutation paths, or the FunC `diamond_resolver.fc` / `PublicCollateralLookup.*`.
- No on-chain execution tests were performed. The existing test suite (`audit/TEST_COVERAGE_REPORT.md`) is referenced but not re-run.
- The findings here should be validated against the externally commissioned audit once available.
