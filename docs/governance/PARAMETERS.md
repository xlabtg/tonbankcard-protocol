# Initial Governance Parameters & Protocol Parameter Inventory

**Engagements:**
- [E1 — DAO Governance Activation](./E1-activation/ENGAGEMENT.md) — voting-side parameters (§§ 1–7)
- [E2 — Protocol Parameter Governance](https://github.com/xlabtg/tonbankcard-protocol/issues/133) — protocol-wide inventory (§§ 8–11)

**Issues:** [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132), [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133)
**Status:** Proposed — pending ratification by the first governance proposal (`E1-PROP-001`)
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** Governance is **non-executable** by design — see [`docs/dao-governance.md`](../dao-governance.md) and [`docs/governance-process.md`](../governance-process.md). The parameters below configure **how votes are counted**; they do not configure **how outcomes are executed**, because there is no on-chain execution engine. The term "execution delay" in this document refers exclusively to the **off-chain implementation cooldown** described in §5.

---

## 1. Purpose

This document fixes the **initial governance parameters** used by `ProposalRegistry.tact` and `SnapshotVerifier.tact` at activation time, the **process parameters** observed off-chain by maintainers, proposal authors and indexers, and — added in [E2](https://github.com/xlabtg/tonbankcard-protocol/issues/133) — the **protocol-wide parameter inventory** that classifies every mutable post-deployment knob across all production contracts.

The parameters in §§ 2–7 are the values that the **first governance proposal** (`E1-PROP-001`, [`E1-activation/ACTIVATION_PROPOSAL.md`](./E1-activation/ACTIVATION_PROPOSAL.md)) asks the community to ratify. Until that proposal is `ACCEPTED`, the values are **proposed defaults** and the runbook ([`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md)) instructs the deployer to use them verbatim.

§§ 8–11 enumerate every mutable parameter across the rest of the codebase (PaymentHub, MerchantPaymentHub, RecurringPayments, MultiSigCard, CrossChainBridge, CollateralSignal, LendingProtocolCoordinator, SnapshotVerifier, TransparencyRegistry, PublicCollateralLookup). For each, the table records the access control mechanism, the change cadence, and the governance classification (**governance-controlled**, **time-locked**, or **immutable**). Authoring a proposal that changes any of those parameters requires the template in [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md).

Changes to these parameters after ratification require a new governance proposal of category `ROADMAP_SIGNAL` and the contract redeployment policy in §6.

---

## 2. Parameter table (canonical values)

| # | Parameter | Value | On-chain? | Source |
|---|-----------|-------|-----------|--------|
| P-1 | **Governance asset** | TBC Diamonds NFT collection (222 NFTs, 1 NFT = 1 vote) | Yes — `DIAMONDS_TOTAL_SUPPLY = 222` | `contracts/governance/ProposalRegistry.tact` |
| P-2 | **Voting power model** | Flat — `1 NFT = 1 vote`, no delegation, no fractionalisation | Yes — enforced by `CastVote` deduplication via `votes_cast` map | `docs/dao-governance.md` §"TBC Diamonds NFT Collection" |
| P-3 | **Voting period (duration)** | **7 days** (`604 800` seconds) | Yes — `DEFAULT_VOTING_DURATION = 604800` | `ProposalRegistry.tact` |
| P-4 | **Quorum threshold** | **23 votes** (ceil(10 % of 222)) | Yes — `DEFAULT_QUORUM_THRESHOLD = 23` | `ProposalRegistry.tact` |
| P-5 | **Decision rule** | Simple majority among non-abstain votes when quorum is met | Yes — `votes_for > votes_against` after quorum check | `ProposalRegistry.tact` `FinalizeProposal` handler |
| P-6 | **Proposal threshold (submission)** | **1 TBC Diamond NFT** owned by the author at submission time | Partly — author NFT ID stored, ownership verified off-chain at the snapshot block | `ProposalRegistry.tact` `SubmitProposal` + [`SNAPSHOT.md`](./SNAPSHOT.md) §4 |
| P-7 | **Snapshot timing** | Snapshot block taken **strictly before** proposal `SubmitProposal` is broadcast; recorded by indexer | Off-chain (indexer) + on-chain `RegisterSnapshot` to `SnapshotVerifier` before `voting_start` | [`SNAPSHOT.md`](./SNAPSHOT.md) §3 |
| P-8 | **Off-chain implementation cooldown** ("execution delay") | **≥ 48 hours** between `ProposalFinalized` and any voluntary off-chain implementation step | Off-chain — see §5 | This document, §5 |
| P-9 | **Proposal categories** | Fixed enum `0 … 5` (no custom categories) | Yes — `require(category >= 0 && category <= 5)` | `ProposalRegistry.tact` |
| P-10 | **Vote options** | `FOR = 0`, `AGAINST = 1`, `ABSTAIN = 2` | Yes — `require(msg.vote == VOTE_FOR …)` | `ProposalRegistry.tact` |
| P-11 | **Vote privacy** | NFT ID is **not** emitted in the `VoteCast` event | Yes — see comment in `VoteCast` message struct | `ProposalRegistry.tact` |
| P-12 | **Finalisation actor** | Any wallet may invoke `FinalizeProposal` once `now() > voting_end`; finalisation is permissionless | Yes | `ProposalRegistry.tact` `FinalizeProposal` handler |
| P-13 | **Transparency logging** | All `ProposalSubmitted`, `VoteCast`, `ProposalFinalized` events mirrored to `TransparencyRegistry.tact` via the indexer | On-chain (events) + off-chain (mirroring) | [`SNAPSHOT.md`](./SNAPSHOT.md) §6, `contracts/governance/TransparencyRegistry.tact` |

> Values P-3 and P-4 are **already encoded as compile-time constants** in `contracts/governance/ProposalRegistry.tact`. Changing them is not a parameter update — it is a code change that requires a redeployment under the same multi-sig ceremony used in B2 ([`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md)).

---

## 3. Rationale (per parameter)

### P-3 — Voting period: 7 days

- Issue #132 §6 requires "minimum 7 days" for community participation.
- 7 days is the contract default (`DEFAULT_VOTING_DURATION = 604 800` s).
- A 7-day window covers one full weekly cycle, which is necessary because TBC Diamonds holders are geographically distributed.
- Per-proposal authors **may extend** the window via `SubmitProposal.voting_duration`. They **must not** shorten it: the runbook treats any value below `604 800` as a P-3 violation and aborts.

### P-4 — Quorum: 23 votes (ceil 10 %)

- Issue #132 §6/§7 require quorum "high enough to prevent governance capture by small groups" and "set conservatively initially (err on side of higher quorum)".
- Contract default is `23 = ceil(0.10 × 222)`. The 222-NFT supply is small; quorum lower than 23 weakens capture resistance and diverges from the resolver's rounded-up requirement.
- The 10 % figure mirrors the precedent recorded in [`docs/dao-governance.md`](../dao-governance.md) §"Voting Model" ("recommended: 10–20 % of supply"), at the conservative end of the band.
- Authors **may raise** quorum per proposal via `SubmitProposal.quorum_threshold`. They **must not** lower it below 23: the runbook treats any value < 23 as a P-4 violation and aborts.

### P-5 — Decision rule: simple majority on non-abstain

- Contract logic in `FinalizeProposal` performs `votes_for > votes_against` only **after** the quorum gate.
- Abstentions count towards quorum but not towards majority. This lets large holders meet quorum without distorting outcome direction.

### P-6 — Proposal threshold: 1 NFT

- Contract enforces `1 ≤ author_nft_id ≤ 222`; ownership at the snapshot block is verified off-chain by the indexer and on-chain by `SnapshotVerifier.isEligible(proposal_id, author_nft_id)`.
- A higher threshold (e.g. "must hold ≥ 5 NFTs") would entrench whales. Single-NFT threshold is consistent with `docs/governance-process.md` §"Submission" ("Author must own at least 1 TBC Diamond NFT").

### P-7 — Snapshot timing

- Snapshot **must precede** `SubmitProposal` to defeat last-minute vote buying (issue #132 §7).
- The exact block-selection protocol lives in [`SNAPSHOT.md`](./SNAPSHOT.md) §3.

### P-8 — Off-chain implementation cooldown ("execution delay" ≥ 48 hours)

- Issue #132 §5/§7 use the words "execution delay" and "timelock". Because governance is **non-executable** (no on-chain action), neither concept maps to a smart-contract primitive in this protocol. The contracts intentionally provide **no** timelock module — adding one would re-introduce execution authority.
- Instead, the protocol applies a **process cooldown**: from the moment a proposal moves to `ACCEPTED`, no maintainer, deployer, or external integrator may begin voluntary off-chain implementation steps for **≥ 48 hours**. The cooldown is observed by the maintainer team and audited by the indexer's event timestamps.
- The cooldown protects against same-day implementation racing under social pressure and gives independent reviewers time to detect malicious proposals.
- The cooldown does **not** apply to:
  - Documentation-only proposals where the implementation is the publication itself.
  - Proposals that finalise as `REJECTED` or `NO_QUORUM`.
- The cooldown is enforced by maintainer policy (`docs/governance-process.md` §"Implementation Phase"). It is not enforced on-chain because there is nothing on-chain to delay.

### P-11 — Vote privacy

- Contract intentionally omits `voter_nft_id` from the `VoteCast` event. Mirrored privacy guarantees are documented in [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md).

### P-12 — Permissionless finalisation

- Anyone may pay the gas to finalise a proposal whose voting window has closed. This prevents a single party from blocking finalisation. The action is idempotent — the contract enforces `require(p.status == STATUS_ACTIVE)`.

---

## 4. Cross-references with contract constants

The table below is the authoritative cross-walk between the **values in this document** and the **constants in `contracts/governance/ProposalRegistry.tact`**. CI verifies that the two stay in sync via the harness described in [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §7.

| Parameter | Document value | Contract constant | Match? |
|-----------|----------------|-------------------|--------|
| P-1 | 222 NFTs | `DIAMONDS_TOTAL_SUPPLY = 222` | ✅ |
| P-3 | 7 days = 604 800 s | `DEFAULT_VOTING_DURATION = 604800` | ✅ |
| P-4 | 23 votes | `DEFAULT_QUORUM_THRESHOLD = 23` | ✅ |
| P-9 | 6 categories (0..5) | `CATEGORY_ROADMAP_SIGNAL = 0 … CATEGORY_ECOSYSTEM_GRANT_SIGNAL = 5` | ✅ |
| P-10 | 3 vote options | `VOTE_FOR = 0`, `VOTE_AGAINST = 1`, `VOTE_ABSTAIN = 2` | ✅ |

Any drift between this table and the contract source is a CI-blocking defect.

---

## 5. Off-chain implementation cooldown (the "48-hour rule")

Because the protocol has **no execution engine**, traditional governance timelocks do not apply. Instead, the maintainer team observes the following discipline once a proposal finalises:

1. **T+0** — `ProposalFinalized` event emitted on-chain. The indexer mirrors it to `TransparencyRegistry`.
2. **T+0 → T+48h** — Cooldown window. The maintainer team **must not**:
   - Open implementation PRs that cite the proposal as the sole justification.
   - Publish a release that depends on the proposal's outcome.
   - Sign off-chain attestations referencing the proposal as authority.
   The team **may**:
   - Open discussion issues / RFCs.
   - Draft (but not merge) implementation PRs.
   - Plan staged rollouts.
3. **T+48h** — Cooldown ends. Implementation work may proceed in accordance with `docs/governance-process.md`.
4. **Audit trail** — Indexer records the `ProposalFinalized` timestamp; any maintainer commit timestamp that references the proposal **must** be ≥ `ProposalFinalized + 48 hours`. CI tooling (`scripts/governance/check-cooldown.ts`, scheduled by [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §6) verifies the gap on every PR mentioning a proposal ID.

The cooldown can be lengthened **per proposal** by the author. It cannot be shortened below 48 hours without a new governance proposal that explicitly amends this section.

---

## 6. Change-management policy

| Change | Required process |
|--------|------------------|
| Adjust **on-chain default** (P-3, P-4) | Code change → new B2-style multi-sig ceremony → new contract address → manifest entry with `supersedes` set; previous contract is `paused` per [`docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md`](../deployments/B2-mainnet/ROLLBACK_PROCEDURES.md) §3 |
| Adjust **off-chain parameter** (P-7, P-8) | New governance proposal (category `ROADMAP_SIGNAL`), `ACCEPTED` outcome, ≥ 48 h cooldown, then a documentation PR that updates this file |
| Lower P-3 below 7 days, lower P-4 below 23, lower P-8 below 48 h | **Forbidden** in the initial activation cycle. Requires a separate governance round following ratification of this document |
| Add a new proposal category | **Forbidden** — categories are a fixed enum in the contract |

---

## 7. References

- [`docs/dao-governance.md`](../dao-governance.md) — governance philosophy and constraints
- [`docs/governance-process.md`](../governance-process.md) — proposal lifecycle
- [`docs/governance-transparency.md`](../governance-transparency.md) — public transparency layer
- [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md) — voter privacy guarantees
- [`SNAPSHOT.md`](./SNAPSHOT.md) — voter snapshot methodology
- [`E1-activation/ENGAGEMENT.md`](./E1-activation/ENGAGEMENT.md) — activation engagement plan
- [`E1-activation/ACTIVATION_PROPOSAL.md`](./E1-activation/ACTIVATION_PROPOSAL.md) — first governance proposal text
- `contracts/governance/ProposalRegistry.tact` — canonical source of P-3, P-4, P-9, P-10
- `contracts/governance/SnapshotVerifier.tact` — canonical source of snapshot semantics
- `contracts/governance/TransparencyRegistry.tact` — public mirror of governance events

---

## 8. Protocol parameter inventory (E2)

This section is the **complete inventory** of every parameter that can be changed after a contract has been deployed, across **every Tact / FunC contract** shipped by the protocol. It satisfies acceptance criterion 2 of issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) ("Audit of all mutable parameters completed").

### 8.1 Classification scheme

| Class | Meaning | Change procedure |
|-------|---------|------------------|
| **G** — governance-controlled | Value can change post-deployment and the change must follow a governance proposal | Submit `PARAMETER_CHANGES` proposal → vote → ≥ 48 h cooldown → multi-sig sends setter message → TransparencyRegistry log |
| **T** — time-locked | Value can change post-deployment but is constrained by a contract-level timelock, independent of governance | Multi-sig signs proposal → wait timelock → multi-sig signs execution |
| **I** — immutable | Value is encoded in source as a `const` or fixed at `init()` and cannot be mutated without redeployment | Redeployment ceremony under B2 multi-sig per [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md); previous contract `paused` |
| **U** — user-controlled (non-governance) | State that belongs to an individual NFT owner / merchant / signer and is mutable by that party only — not a protocol parameter | Out of governance scope; included for completeness |

> **Single-key elimination.** Every entry below classified **G** or **T** is reachable only through an `admin: Address` field that **must** be a multi-sig address — see §10. No EOA (externally owned account) controls any parameter classified **G** or **T** in production. The B2 mainnet deployment ceremony installs a `min-2-of-3` multi-sig as the initial admin for every contract before community release; see [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md). Deployment manifests pin the multi-sig address per contract; the manifest hash is mirrored on-chain via `TransparencyRegistry.RecordSnapshot`.

### 8.2 Governance & transparency contracts

| # | Parameter | Contract | Type | Current value | Setter / mechanism | Access guard | Class |
|---|-----------|----------|------|---------------|--------------------|--------------|-------|
| PP-1 | `DEFAULT_VOTING_DURATION` | `ProposalRegistry.tact:54` | `const Int` | 604 800 s (7 days) | None — recompile | n/a (const) | **I** |
| PP-2 | `DEFAULT_QUORUM_THRESHOLD` | `ProposalRegistry.tact:62` | `const Int` | 23 votes | None — recompile | n/a (const) | **I** |
| PP-3 | `DIAMONDS_TOTAL_SUPPLY` | `ProposalRegistry.tact:57`, `SnapshotVerifier.tact:36` | `const Int` | 222 | None — recompile | n/a (const) | **I** |
| PP-4 | `DIAMONDS_COLLECTION` | `ProposalRegistry.tact:193`, `SnapshotVerifier.tact:104` | `const Address` | `EQDiamondsCollectionAddressPlaceholder…` (overwritten by B2 deploy) | None — recompile | n/a (const) | **I** |
| PP-5 | Category enum `0..5` | `ProposalRegistry.tact:16-21` | `const Int` × 6 | `ROADMAP_SIGNAL … ECOSYSTEM_GRANT_SIGNAL` | None — recompile | n/a (const) | **I** |
| PP-6 | Vote enum `0..2` | `ProposalRegistry.tact:30-32` | `const Int` × 3 | `FOR/AGAINST/ABSTAIN` | None — recompile | n/a (const) | **I** |
| PP-7 | `proposal_registry: Address?` | `SnapshotVerifier.tact:119` | state, write-once | unset at init | `receive("set_registry")` (line 156) | sender = `deployer` only — Issue #370 / PC-01 (the binding was previously **unguarded**, i.e. "sender = any"); write-once guard on line 158 | **T** (write-once after deploy) |
| PP-41 | `trusted_indexer: Address?` | `SnapshotVerifier.tact:116` | state | unset at init (**fail-closed**: `RegisterSnapshot` rejected until set) | `receive(msg: SetTrustedIndexer)` (line 143) | sender = `deployer` only (multi-sig in production); **rotatable**; the sole writer authorised to call `RegisterSnapshot` (Issue #370 / PC-01) | **G** |
| PP-8 | `latest_snapshot_block`, `latest_snapshot_hash` | `TransparencyRegistry.tact:58-59` | state (data) | 0 / 0 | `RecordSnapshot` receiver (line 300) | sender = indexer wallet (deployment manifest); enforced off-chain pending [#41](https://github.com/xlabtg/tonbankcard-protocol/issues/41) | **G** |
| PP-9 | `quorum_threshold` | `TransparencyRegistry.tact:62` | state (data), set in `init()` | 23 | none after `init()` | n/a (write-once) | **I** |
| PP-10 | Counters: `total_proposals`, `proposals_accepted`, `proposals_rejected`, `proposals_no_quorum` | `TransparencyRegistry.tact:52-55` | state (data) | 0 (incremented) | mirrored from `ProposalRegistry` via `RecordProposal` / `RecordVotingResult` | sender = indexer wallet | **U** (append-only mirror; not a governance parameter) |

### 8.3 Payment contracts

| # | Parameter | Contract | Type | Current value | Setter / mechanism | Access guard | Class |
|---|-----------|----------|------|---------------|--------------------|--------------|-------|
| PP-11 | `admin: Address` | `payments/PaymentHub.tact:178` | state | initial deployer (B2 multi-sig) | `ProposeAdminTransfer` + `ExecuteAdminTransfer` (lines 344, 363) | sender = current admin (propose), proposed admin (execute), 7-day timelock | **T** (7 days) |
| PP-12 | `ADMIN_TRANSFER_DELAY` | `payments/PaymentHub.tact:40` | `const Int` | 7 days | None — recompile | n/a (const) | **I** |
| PP-13 | `whitelisted_collections: map<Address, Bool>` | `payments/PaymentHub.tact:193` | state | empty at deploy | `WhitelistCollection` (line 306) | sender = admin (multi-sig) | **G** |
| PP-14 | `accounts: map<Address, AccountState>` (admin-initialised entries only; **create-once** — Issue #371 / PC-02) | `payments/PaymentHub.tact:190` | state | empty | `InitializeAccount` (line 323) — rejects re-init of a live slot (`require(self.accounts.get(msg.nft_address) == null, ...)`) | sender = admin (multi-sig) | **G** (during setup) / **U** (post-init transfers via owner) |
| PP-15 | `admin: Address` | `MerchantPaymentHub.tact:89` | state | initial deployer (B2 multi-sig) | `MerchantProposeAdminTransfer` + `MerchantExecuteAdminTransfer` (lines 339, 356) | sender = current admin / proposed admin, 7-day timelock | **T** (7 days) |
| PP-16 | `MERCHANT_ADMIN_TRANSFER_DELAY` | `MerchantPaymentHub.tact:81` | `const Int` | 7 days | None — recompile | n/a (const) | **I** |
| PP-17 | `whitelisted_collections` (merchant) | `MerchantPaymentHub.tact` | state | empty | two-phase `ProposeWhitelistCollection` → `ExecuteWhitelistCollection` (+ `CancelWhitelistCollection`), 7-day `MERCHANT_WHITELIST_TIMELOCK_DELAY` (Issue #363) | sender = admin (multi-sig) on both phases; execute requires timelock elapsed | **T** (7 days) |
| PP-18 | `account_states` | `MerchantPaymentHub.tact` | state | empty | **No production setter** — `SetAccountState` removed before mainnet (Issue #363, audit C-MPH-C1). State seeding now lives only in the test-only `MerchantPaymentHubHarness`; production states change exclusively through the `MerchantPaymentRequest` flow | **U** (owner-driven via payments; no admin write path) |
| PP-19 | `account_balances` | `MerchantPaymentHub.tact` | state | empty | **No production setter** — `SetAccountBalance` removed before mainnet (Issue #363, audit C-MPH-C1, admin-mint backdoor). Balance seeding now lives only in the test-only `MerchantPaymentHubHarness`; production balances change only via atomic debit/credit inside `MerchantPaymentRequest` | **U** (owner-authorised payments only; no admin write path) |
| PP-20 | `account_locks` | `MerchantPaymentHub.tact` | state | empty | `ApplyAccountLock` (replaces admin `SetAccountLock`, Issue #363) | sender = `account_locks_contract` ONLY (admin cannot write locks — invariant I3) | **G** (Account-Locks-gated) |

### 8.4 Recurring payments, multi-sig cards, cross-chain bridge

| # | Parameter | Contract | Type | Current value | Setter / mechanism | Access guard | Class |
|---|-----------|----------|------|---------------|--------------------|--------------|-------|
| PP-21 | `MIN_PERIOD_SECONDS` | `RecurringPayments.tact:109` | `const Int` | 3 600 s (1 h) | None — recompile | n/a (const) | **I** |
| PP-22 | `mandates: map<Int, MandateInfo>` | `RecurringPayments.tact:146` | state | empty | `CreateMandate`, `CancelMandate`, `ExecuteRecurringPayment` | sender = NFT owner (or merchant for execute) | **U** |
| PP-23 | `multisig_configs: map<Address, MultiSigConfig>` | `MultiSigCard.tact:187` | state | empty | `ConfigureMultiSig` (line 214) | sender = NFT owner; threshold validated 1..3 | **U** |
| PP-24 | `MAX_SIGNERS` | `MultiSigCard.tact:136` | `const Int` | 3 | None — recompile | n/a (const) | **I** |
| PP-25 | `bridge_intents: map<Int, BridgeIntentInfo>` | `CrossChainBridge.tact:145` | state | empty | `RegisterBridgeIntent`, `ConfirmBridgeExecution`, `CancelBridgeIntent` | sender = NFT owner (register/cancel) or registered relayer (confirm) | **U** |
| PP-26 | `authorized_relayers: map<Address, Bool>` | `CrossChainBridge.tact:151` | state | empty | `RegisterRelayer` (line 421) | sender = deployer / admin (must be multi-sig in production); allows overwrite | **G** |
| PP-27 | Chain IDs `CHAIN_ETHEREUM … CHAIN_SOLANA` | `CrossChainBridge.tact:95-99` | `const Int` | 1..5 | None — recompile | n/a (const) | **I** |
| PP-28 | `MAX_SUPPORTED_CHAIN` | `CrossChainBridge.tact:110` | `const Int` | 5 | None — recompile | n/a (const) | **I** |

### 8.5 Signaling, lending and lookup contracts

| # | Parameter | Contract | Type | Current value | Setter / mechanism | Access guard | Class |
|---|-----------|----------|------|---------------|--------------------|--------------|-------|
| PP-29 | `collateral_signals` | `CollateralSignal.tact:103` | state | empty | `SignalCollateralRequest`, `UpdateCollateralSignalRequest`, `ReleaseCollateralSignalRequest` | sender = NFT owner | **U** |
| PP-30 | `lending_intents` | `LendingProtocolCoordinator.tact:134` | state | empty | `RegisterLendingIntent`, `CancelLendingIntent`, `UpdateLendingIntent` | sender = NFT owner | **U** |
| PP-31 | `owner: Address` | `collateral-lookup/PublicCollateralLookup.tact:48` | state | initial deployer | none (not transferable) | n/a | **I** (effectively, once deployed) |
| PP-32 | `accountLocksContract: Address` | `collateral-lookup/PublicCollateralLookup.tact:52` | state | unset at init | `SetAccountLocksContract` (line 71) | sender = `owner` (deployer) | **G** (one-shot wiring; reset requires governance) |
| PP-33 | `VERSION` | `collateral-lookup/PublicCollateralLookup.tact:55` | `const Int` | 1 | None — recompile | n/a (const) | **I** |
| PP-34 | `payment_hub: Address?` | `nft-resolver/nft_account_resolver.tact:43` | state | unset at init | `receive("set_payment_hub")` (line 117 — body currently unimplemented) | sender = (TODO — must be admin/multi-sig before activation) | **G** (gated by [#41](https://github.com/xlabtg/tonbankcard-protocol/issues/41)) |
| PP-35 | `COLLECTION_7777`, `COLLECTION_8888` | `nft-resolver/nft_account_resolver.tact:39-40` | `const Address` | fixed | None — recompile | n/a (const) | **I** |

### 8.6 Test-only handlers (must be removed before mainnet)

The audit identified a family of handlers that exist solely to bootstrap test scenarios. They are guarded by `sender() == self.deployer` plus a write-once flag, but the audit X-1 mitigation requires they be **excluded from the mainnet build** (or, equivalently, behind a feature flag that is disabled in the mainnet artefact). They are listed here so governance can verify their removal:

| # | Handler | Contract | Mitigation status |
|---|---------|----------|-------------------|
| ~~PP-36~~ | ~~`RegisterNFTOwner`~~ | `CollateralSignal.tact` | **RESOLVED (Issue #364)** — test-only handler removed; ownership now registered ONLY via `ResolveNFTOwner`, gated by the immutable `nft_resolver` (on-chain NFT Account Resolver), write-once (CONTRACTS-M1). CI regression guard blocks reintroduction |
| PP-37 | `RegisterNFTOwner` | `LendingProtocolCoordinator.tact:357` | test-only — remove before mainnet (audit C-LPC-C1 / X-1) |
| PP-38 | `RegisterNFTOwnerRecurring` | `RecurringPayments.tact:428` | test-only — remove before mainnet (audit X-1) |
| PP-39 | `RegisterNFTOwnerMultiSig` | `MultiSigCard.tact:569` | test-only — remove before mainnet (audit C-MSC-C1 / X-1) |
| PP-40 | `RegisterNFTOwnerBridge`, `RegisterRelayer` | `CrossChainBridge.tact:413, 421` | test-only — remove before mainnet (audit C-CCB-C1 / H1 / X-1) |

These handlers are **not** governance parameters. They are tracked in this document so the E2 audit explicitly accounts for every state-mutating receiver in the codebase.

> **Update (Issue #364):** PP-36 (`CollateralSignal`) is the first of this family to be remediated. Its test-only `RegisterNFTOwner` handler is removed; NFT ownership is now bound exclusively by the trusted on-chain NFT Account Resolver (`ResolveNFTOwner`, gated by the immutable `nft_resolver`), preserving the write-once binding (CONTRACTS-M1). PP-37…PP-40 remain open and must still be removed before mainnet.

---

## 9. Governance-controlled parameters: per-parameter process

For every parameter classified **G** in §8 the table below records the proposal category, the recommended quorum threshold (which may exceed the default 23-vote floor), and the timelock window observed off-chain before the multi-sig executes the setter message. The proposal template that fills in these fields lives in [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md).

| Parameter | Proposal category | Recommended quorum | Off-chain cooldown | Executor |
|-----------|-------------------|--------------------|--------------------|----------|
| PP-8 — TransparencyRegistry snapshot pointer | `RISK_DISCLOSURE` (3) | default (23) | 48 h | Indexer multi-sig (`B2-mainnet/multisig.indexer.json`) |
| PP-13 — PaymentHub whitelisted collections | `ROADMAP_SIGNAL` (0) | **44 (supermajority of voters needed; 20% of 222)** | 48 h | PaymentHub admin multi-sig |
| PP-14 — PaymentHub account initialisation | `ROADMAP_SIGNAL` (0) | default (23) | 48 h | PaymentHub admin multi-sig |
| PP-17 — MerchantPaymentHub whitelisted collections | `ROADMAP_SIGNAL` (0) | **44** | 48 h + on-chain 7-day timelock (Issue #363) | MerchantPaymentHub admin multi-sig (two-phase propose/execute) |
| ~~PP-18 — Merchant account state~~ | n/a | n/a | n/a | **Removed from production (Issue #363)** — no governance path; `SetAccountState` exists only in the test-only harness |
| ~~PP-19 — Merchant account balance (initial)~~ | n/a | n/a | n/a | **Removed from production (Issue #363)** — no governance path; `SetAccountBalance` exists only in the test-only harness |
| PP-20 — Merchant account lock | `RISK_DISCLOSURE` (3) | default (23) | **24 h** (incident response — see [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) §4) | Account Locks contract via `ApplyAccountLock` (Issue #363 — admin multi-sig drives the risk authority, not a direct hub write) |
| PP-26 — CrossChainBridge relayer set | `INTEGRATION_RECOMMENDATION` (1) | **44** | 48 h | Bridge admin multi-sig |
| PP-32 — PublicCollateralLookup wiring | `INTEGRATION_RECOMMENDATION` (1) | default (23) | 48 h | Lookup admin (multi-sig) |
| PP-34 — NFTAccountResolver wiring | `INTEGRATION_RECOMMENDATION` (1) | default (23) | 48 h | Resolver admin (multi-sig); blocked on [#41](https://github.com/xlabtg/tonbankcard-protocol/issues/41) |
| PP-41 — SnapshotVerifier trusted indexer (eligibility-oracle writer) | `INTEGRATION_RECOMMENDATION` (1) | **44** | 48 h | SnapshotVerifier deployer multi-sig via `SetTrustedIndexer` (Issue #370 / PC-01) |

The **off-chain cooldown** is the minimum interval between `ProposalFinalized = ACCEPTED` and the moment the multi-sig sends the setter message on-chain. For lock-state changes (PP-20) the incident-response runbook permits a 24 h cooldown when the proposal cites a documented incident ticket; all other parameter changes default to the 48 h floor from §5.

Setting the recommended quorum for whitelisting / balance / relayer / eligibility-oracle-writer changes to **44** (20 % of 222) reflects the security requirement that "supermajority" votes guard parameters with direct economic impact (issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) §3 "some parameters may need supermajority"). Rotating the SnapshotVerifier `trusted_indexer` (PP-41) carries the same weight: a malicious writer could forge the governance eligibility roll, so it is held to the supermajority floor like the bridge relayer set (PP-26). Authors **may raise** quorum further per proposal. They **must not** lower it below the value in this table — the runbook ([`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §7) treats a lower value as a CI-blocking defect.

---

## 10. Single-key elimination policy

Every parameter classified **G** or **T** in §8 sits behind an `admin: Address` field. Issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) §7 requires that "no single EOA key can change any governance-controlled parameter". This is enforced by the following invariants:

1. **Mainnet admin must be a multi-sig.** Every `admin` field is initialised at deployment to a multi-sig wallet address listed in `docs/deployments/B2-mainnet/multisig.<contract>.json`. The B2 ceremony record ([`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md)) captures the signer set, the threshold, and the hardware-wallet attestations.
2. **Minimum 2-of-3 threshold.** Per issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) §7, every admin multi-sig must require **at least 2-of-3** signatures. Higher thresholds are permitted; 1-of-N is forbidden.
3. **Admin transfers are timelocked.** Every contract with an `admin` field implements the two-phase `ProposeAdminTransfer` → `ExecuteAdminTransfer` pattern with a 7-day timelock (PaymentHub `ADMIN_TRANSFER_DELAY`, MerchantPaymentHub `MERCHANT_ADMIN_TRANSFER_DELAY`). Replacing the multi-sig itself therefore requires the same 7-day window plus the off-chain cooldown.
4. **CI guardrail.** `scripts/governance/check-parameter-changes.ts` (added in [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133)) refuses to publish a deployment manifest in which any `admin` address is flagged as `eoa: true`. The check runs on every PR that touches `docs/deployments/`.
5. **Emergency overrides require multi-sig.** Issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) §7 requires that "emergency parameter changes (if any) must require multi-sig (minimum 2-of-3)". The protocol has no emergency-bypass admin path — the only fast lane is the 24 h cooldown for lock-state changes (PP-20), and even that requires the standard multi-sig.

If a future contract introduces a new `admin` field, the change-management policy in §6 applies: the contract must be deployed under the B2 ceremony and the manifest must record the multi-sig signer set before activation. CI rejects any deployment manifest whose `multisig: {threshold, signers}` shape is missing.

---

## 11. Audit-trail logging via TransparencyRegistry

Issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) §5.4 requires that "all parameter changes [are] logged via `TransparencyRegistry`". The protocol satisfies this by:

1. **Direct on-chain logging.** `ProposalRegistry` emits `ProposalSubmitted`, `VoteCast`, `ProposalFinalized` events. The indexer mirrors them to `TransparencyRegistry` via `RecordProposal`, `RecordVotingResult`, `RecordSnapshot`.
2. **Parameter-change linkage.** Every setter call that mutates a **G**-classified parameter must reference the `proposal_id` of the accepted proposal in its TON message payload. The indexer's parameter-change tracker (`scripts/governance/check-parameter-changes.ts`) reconstructs the `(proposal_id, parameter_id, old_value, new_value, executor_address)` tuple from the chain trace and asserts that the setter transaction's `from` address is the contract's `admin`. A mismatch raises a CI alert.
3. **Public diff.** The tracker writes a JSON-Lines audit file at `docs/governance/parameter-changes.log` (gitignored from the runtime branch; published nightly to the docs site). Each line has the schema:

   ```json
   {
     "ts": 1747459200,
     "proposal_id": 12,
     "parameter_id": "PP-13",
     "contract": "PaymentHub.tact",
     "setter_msg": "WhitelistCollection",
     "old_value": {"sha256": "…"},
     "new_value": {"sha256": "…"},
     "executor": "EQ…multisig",
     "tx_hash": "…"
   }
   ```

4. **Cross-reference.** Every `PARAMETER_CHANGES.md` proposal must, at finalisation, be cross-linked from the corresponding line in `parameter-changes.log` via its `proposal_id`. Missing cross-links surface as a CI failure of the nightly audit job.

This closes the loop: a holder can verify, from the public TransparencyRegistry alone, that every parameter change observed on chain was preceded by an `ACCEPTED` proposal with the matching quorum and cooldown.
