// Merchant Payment Hub Contract
// Implementation of Issue #8 - Merchant Payments (On-Chain Settlement in TBC)
// Issue #96: Upgradeable admin system with timelock and two-phase ownership transfer
// Issue #363: Remove test-only bootstrap handlers before mainnet
// Issue #397: Add the resolver-gated account-registration handler (ResolveNFTOwner)
//   that #363 documented but never implemented, so the deployable contract is
//   functional (nft_owners / account_states can be populated). See CHECK393-M1.
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): Validates payer is NFT owner before payment (validateAndExecutePayment)
// - I2 (NFT Authority): NFT ownership stored and validated (nft_owners, registered by
//   the trusted NFT Account Resolver via ResolveNFTOwner; validated in validateAndExecutePayment)
// - I3 (No Admin Control): Admin cannot move funds; there is NO admin path that mints,
//   moves or withdraws balances. Admin/whitelist/lock changes all go through delegated
//   authorities and/or timelocks (see below).
// - I4 (Atomic Transfers): Atomic debit/credit in single transaction (validateAndExecutePayment)
// - I5 (Ledger Conservation): Direct debit/credit with no fees (debitBalance/creditBalance)
// - I6 (Lock ≠ Confiscation): Checks locks before send, allows receive (validateAndExecutePayment)
//
// PRODUCTION HARDENING (Issue #363) + ACCOUNT REGISTRATION (Issue #397):
// This production contract intentionally contains NO test-only bootstrap handlers.
// The previous `SetAccountState` / `SetAccountBalance` / `SetAccountLock` admin
// handlers (test-only, audit findings C-MPH-C1 / C-MPH-H1) have been removed:
//   * Account registration (nft_owners / account_states) is performed ONLY by the
//     trusted on-chain NFT Account Resolver (`nft_resolver`, set immutably at init)
//     via `receive(msg: ResolveNFTOwner)`, NOT by an admin handler. The handler is
//     write-once (CONTRACTS-M1 / #279): it binds an NFT to its resolved owner and
//     marks the account ACTIVE, and cannot silently re-point an existing binding.
//     This directly mirrors how CollateralSignal (Issue #364) replaced its
//     deployer-gated `RegisterNFTOwner` with the resolver-gated `ResolveNFTOwner`.
//     Issue #363 documented this registration path but never implemented it, so a
//     freshly deployed hub had permanently empty maps and every payment failed
//     with ERROR_PAYER_NOT_EXISTS / ERROR_MERCHANT_NOT_EXISTS (audit CHECK393-M1).
//   * Balance funding remains an explicit pre-production backlog item (Issue
//     #414): after removal of the admin-mint backdoor C-MPH-C1, no production
//     handler can credit a freshly registered payer. A non-custodial deposit or
//     settlement design requires protocol-economics review and is intentionally
//     NOT invented in this audit fix.
//   * Account locks are applied ONLY by the dedicated Account Locks contract
//     (`account_locks_contract`), which enforces its own risk-authority + timelock
//     rules. See `receive(msg: ApplyAccountLock)`.
//   * Collection whitelisting is gated behind the admin (expected to be a 3-of-5
//     multi-sig) PLUS a timelock (propose → wait → execute). See the
//     ProposeWhitelistCollection / ExecuteWhitelistCollection / CancelWhitelistCollection
//     handlers.
// The test-only bootstrap handlers live exclusively in the non-deployable test
// harness `contracts/merchant-hub/test/MerchantPaymentHubHarness.tact`. A CI
// regression guard (`contracts/payment-hub/non-production-stubs.spec.ts`) fails the
// build if any of those handlers reappear in this production source, and asserts
// the resolver-gated `ResolveNFTOwner` registration handler IS present (Issue #397).

import "./types/AccountState.tact";
import "./types/LockState.tact";
import "./interfaces/IAccountStateMachine.tact";
import "./interfaces/IAccountLocks.tact";
import "./interfaces/INFTResolver.tact";

// Message structure for merchant payment requests
message MerchantPaymentRequest {
    payer_nft: Address;
    merchant_nft: Address;
    amount_tbc: Int as coins;
    payload: Cell?;  // Optional invoice/order metadata
}

// Message structure for merchant payment response
message MerchantPaymentResponse {
    success: Bool;
    error_code: Int as uint8;
}

// Error codes
const ERROR_NONE: Int = 0;
const ERROR_NOT_OWNER: Int = 1;
const ERROR_PAYER_NOT_ACTIVE: Int = 2;
const ERROR_PAYER_LOCKED: Int = 3;
const ERROR_MERCHANT_CLOSED: Int = 4;
const ERROR_INVALID_AMOUNT: Int = 5;
const ERROR_INSUFFICIENT_BALANCE: Int = 6;
const ERROR_PAYER_NOT_EXISTS: Int = 7;
const ERROR_MERCHANT_NOT_EXISTS: Int = 8;

// Admin transfer messages (Issue #96)

// Phase 1: Current admin proposes a new admin (starts 7-day timelock)
// INVARIANT I3: Proposing a new admin does NOT grant any fund control
message MerchantProposeAdminTransfer {
    new_admin: Address;
}

// Phase 2: Proposed admin executes the transfer after timelock expires
message MerchantExecuteAdminTransfer {
}

// Cancel a pending admin transfer proposal (only current admin)
message MerchantCancelAdminTransfer {
}

// Admin transfer events
message MerchantAdminTransferProposed {
    current_admin: Address;
    proposed_admin: Address;
    executable_at: Int as uint32;
    timestamp: Int as uint32;
}

message MerchantAdminTransferExecuted {
    old_admin: Address;
    new_admin: Address;
    timestamp: Int as uint32;
}

message MerchantAdminTransferCancelled {
    admin: Address;
    cancelled_proposed: Address;
    timestamp: Int as uint32;
}

// Collection whitelist messages (Issue #363: multi-sig + timelock)
//
// Whitelisting an NFT collection is a governance action. The `admin` is expected
// to be a 3-of-5 multi-sig in production (the contract only sees a single admin
// address; the M-of-N approval happens inside that multi-sig). On top of the
// multi-sig, a timelock gives the public time to react before a collection becomes
// whitelisted: propose → wait MERCHANT_WHITELIST_TIMELOCK_DELAY → execute.

// Phase 1: admin (multi-sig) proposes whitelisting a collection (starts timelock)
message ProposeWhitelistCollection {
    collection_address: Address;
}

// Phase 2: admin (multi-sig) executes the whitelist after the timelock expires
message ExecuteWhitelistCollection {
}

// Cancel a pending collection-whitelist proposal (only admin)
message CancelWhitelistCollection {
}

message MerchantCollectionWhitelistProposed {
    collection_address: Address;
    executable_at: Int as uint32;
    timestamp: Int as uint32;
}

message MerchantCollectionWhitelistExecuted {
    collection_address: Address;
    timestamp: Int as uint32;
}

message MerchantCollectionWhitelistCancelled {
    collection_address: Address;
    timestamp: Int as uint32;
}

// Account Locks integration message (Issue #363: replaces admin SetAccountLock)
//
// Locks are NOT controlled by the admin. They are applied by the dedicated Account
// Locks contract (`contracts/payments/account-locks.fc`), which enforces its own
// risk-authority + lending-adapter roles and 7-day timelock. The MerchantPaymentHub
// trusts that contract as the single source of lock truth and only accepts lock
// updates that originate from it.
message ApplyAccountLock {
    nft_address: Address;
    lock_state: LockState;
}

message MerchantAccountLockApplied {
    nft_address: Address;
    fraud_locked: Bool;
    collateral_locked: Bool;
    timestamp: Int as uint32;
}

// NFT Account Resolver integration message (Issue #397: account registration)
//
// Account registration is NOT controlled by the admin. NFT ownership and the
// initial ACTIVE account state are bound by the dedicated NFT Account Resolver
// (`nft_resolver`), which verifies real NFT ownership off-contract (synchronous
// cross-contract owner resolution is impossible on TON; see CONTRACTS-H3 / #260)
// and pushes the result here. Accepted ONLY from `nft_resolver`; write-once. This
// is the SAME message shape (and opcode) the resolver sends to CollateralSignal
// (Issue #364), so a single resolver code path can register an NFT across the
// protocol's consumer contracts.
message ResolveNFTOwner {
    nft_address: Address;
    owner: Address;
}

// 7-day timelock delay for admin transfers (in seconds)
const MERCHANT_ADMIN_TRANSFER_DELAY: Int = 7 * 24 * 60 * 60;

// 7-day timelock delay for collection whitelisting (in seconds)
const MERCHANT_WHITELIST_TIMELOCK_DELAY: Int = 7 * 24 * 60 * 60;

// ============================================================================
// MerchantPaymentHubBase: shared production logic
// ============================================================================
//
// All production payment logic lives in this trait so that the non-deployable
// test harness (MerchantPaymentHubHarness) can reuse the EXACT same compiled
// logic while adding test-only bootstrap handlers, without duplicating any of the
// payment / admin / lock / whitelist code. The deployable production contract
// `MerchantPaymentHub` adds nothing but storage declarations and `init`.
//
// NOTE (Tact storage model): trait fields are declared without serialization
// specifiers. Each contract that uses this trait re-declares the same fields WITH
// their serialization specifiers (e.g. `Int as uint32`). Keep the field lists in
// `MerchantPaymentHub` and the harness in sync with this trait.
// NOTE (Tact trait model): this trait declares the account-state-machine and
// account-locks accessors (getAccountState / getBalance / getLockState / ...) as
// plain concrete members rather than `override`s of IAccountStateMachine /
// IAccountLocks. Tact forbids `override` outside a contract and rejects a trait
// re-implementing an abstract supertrait method, so an intermediate trait cannot
// conform to those interfaces while also providing the shared implementation. The
// accessors are kept here (single source of truth for both the production contract
// and the test harness); the interface shapes are documented in
// contracts/interfaces/IAccountStateMachine.tact and IAccountLocks.tact.
trait MerchantPaymentHubBase {

    // ---- Storage (see serialization-annotated copies in the contracts) ----

    // Current admin address (transferable via two-phase timelock, see MerchantProposeAdminTransfer).
    // Expected to be a 3-of-5 multi-sig in production.
    // INVARIANT I3: Admin cannot move or withdraw user funds.
    admin: Address;

    // Pending admin transfer: proposed new admin address (null if no transfer pending)
    pending_admin: Address? = null;

    // Unix timestamp when the pending admin transfer becomes executable (after 7-day timelock)
    pending_admin_executable_at: Int = 0;

    // The dedicated Account Locks contract authorised to apply locks (immutable, set at init).
    account_locks_contract: Address;

    // The trusted on-chain NFT Account Resolver authorised to register NFT ownership +
    // the initial account state via ResolveNFTOwner (immutable, set at init).
    // INVARIANT I3 (No Admin Control): this address cannot move funds or change
    // balances — it can only bind an NFT to its resolved owner and mark it ACTIVE
    // (write-once). The admin/deployer has NO account-registration path (Issue #397).
    nft_resolver: Address;

    account_states: map<Address, Int>;      // nft_address => state
    account_balances: map<Address, Int>;    // nft_address => balance_tbc
    account_locks: map<Address, LockState>; // nft_address => lock_state
    nft_owners: map<Address, Address>;      // nft_address => owner_address
    whitelisted_collections: map<Address, Bool>; // collection_address => whitelisted

    // Pending collection whitelist (timelock): proposed collection (null if none pending)
    pending_whitelist_collection: Address? = null;

    // Unix timestamp when the pending collection whitelist becomes executable
    pending_whitelist_executable_at: Int = 0;

    // ============================================
    // MERCHANT PAYMENT FUNCTIONS
    // ============================================

    // Main merchant payment function
    receive(msg: MerchantPaymentRequest) {
        let sender: Address = sender();

        // Validate and process payment
        let error_code: Int = self.validateAndExecutePayment(
            sender,
            msg.payer_nft,
            msg.merchant_nft,
            msg.amount_tbc,
            msg.payload
        );

        // Send response
        send(SendParameters{
            to: sender,
            value: 0,
            mode: SendRemainingValue,
            body: MerchantPaymentResponse{
                success: error_code == ERROR_NONE,
                error_code: error_code
            }.toCell()
        });
    }

    // Internal function to validate and execute payment
    fun validateAndExecutePayment(
        sender: Address,
        payer_nft: Address,
        merchant_nft: Address,
        amount_tbc: Int,
        payload: Cell?
    ): Int {

        // INVARIANT I1 & I2: Check ownership (non-custodial, NFT authority)
        let payer_owner: Address? = self.nft_owners.get(payer_nft);
        if (payer_owner == null) {
            return ERROR_PAYER_NOT_EXISTS;
        }
        if (payer_owner!! != sender) {
            return ERROR_NOT_OWNER;  // Only NFT owner can initiate payment
        }

        // VALIDATION 2: Check merchant exists
        let merchant_state_opt: Int? = self.account_states.get(merchant_nft);
        if (merchant_state_opt == null) {
            return ERROR_MERCHANT_NOT_EXISTS;
        }

        // VALIDATION 3: Check amount
        if (amount_tbc <= 0) {
            return ERROR_INVALID_AMOUNT;
        }

        // VALIDATION 4: Check payer state (must be ACTIVE)
        let payer_state: Int = self.getAccountState(payer_nft);
        if (!canSend(payer_state)) {
            return ERROR_PAYER_NOT_ACTIVE;
        }

        // INVARIANT I6: Check payer locks (locks prevent sending, not confiscation)
        let payer_locks: LockState = self.getLockState(payer_nft);
        if (!canSendWithLocks(payer_locks)) {
            return ERROR_PAYER_LOCKED;  // Lock prevents send but doesn't move funds
        }

        // VALIDATION 6: Check merchant state (must not be CLOSED)
        let merchant_state: Int = merchant_state_opt!!;
        if (!canReceive(merchant_state)) {
            return ERROR_MERCHANT_CLOSED;
        }

        // VALIDATION 7: Check payer balance
        let payer_balance: Int = self.getBalance(payer_nft);
        if (payer_balance < amount_tbc) {
            return ERROR_INSUFFICIENT_BALANCE;
        }

        // INVARIANT I4 & I5: Execute atomic transfer with balance conservation
        self.debitBalance(payer_nft, amount_tbc);
        self.creditBalance(merchant_nft, amount_tbc);

        // EMIT EVENT: MerchantPayment
        let payload_hash: Int = 0;
        if (payload != null) {
            payload_hash = payload!!.hash();
        }

        emit(MerchantPayment{
            payer_nft: payer_nft,
            merchant_nft: merchant_nft,
            amount_tbc: amount_tbc,
            payload_hash: payload_hash,
            timestamp: now()
        }.toCell());

        return ERROR_NONE;
    }

    // ============================================
    // ACCOUNT STATE MACHINE IMPLEMENTATION
    // ============================================

    get fun getAccountState(nft_address: Address): Int {
        let state: Int? = self.account_states.get(nft_address);
        if (state == null) {
            return ACCOUNT_STATE_ACTIVE; // Default to ACTIVE for new accounts
        }
        return state!!;
    }

    get fun getBalance(nft_address: Address): Int {
        let balance: Int? = self.account_balances.get(nft_address);
        if (balance == null) {
            return 0;
        }
        return balance!!;
    }

    get fun accountExists(nft_address: Address): Bool {
        return self.account_states.get(nft_address) != null;
    }

    fun debitBalance(nft_address: Address, amount: Int) {
        let current_balance: Int = self.getBalance(nft_address);
        require(current_balance >= amount, "Insufficient balance");
        self.account_balances.set(nft_address, current_balance - amount);
    }

    fun creditBalance(nft_address: Address, amount: Int) {
        let current_balance: Int = self.getBalance(nft_address);
        self.account_balances.set(nft_address, current_balance + amount);
    }

    // ============================================
    // NFT ACCOUNT REGISTRATION (NFT Account Resolver only, Issue #397)
    // ============================================

    // Register the resolved owner of an NFT account and mark it ACTIVE (Issue #397).
    //
    // This is the production replacement for the removed test-only `SetAccountState`
    // bootstrap (#363) and the handler #363 documented but never shipped (audit
    // CHECK393-M1). Without it the deployable contract had permanently empty
    // nft_owners / account_states maps, so every MerchantPaymentRequest failed with
    // ERROR_PAYER_NOT_EXISTS / ERROR_MERCHANT_NOT_EXISTS.
    //
    // INVARIANT I2 (NFT Authority) & I3 (No Admin Control): ownership is bound by the
    // trusted on-chain NFT Account Resolver ONLY — never by the admin/deployer or an
    // arbitrary sender. The resolver verifies real NFT ownership outside this contract
    // (synchronous cross-contract owner resolution is impossible on TON; see audit
    // CONTRACTS-H3 / #260) and pushes the result here. This handler neither moves
    // funds nor mints balances (balances come from the on-chain TBC ledger /
    // settlement flow), so it does not re-introduce the admin-mint backdoor C-MPH-C1.
    //
    // The binding is write-once (CONTRACTS-M1 / #279): once an NFT is bound to an
    // owner it cannot be silently re-pointed, so even a buggy resolver cannot hijack
    // an already-registered account. Mirrors CollateralSignal.ResolveNFTOwner (#364).
    receive(msg: ResolveNFTOwner) {
        require(sender() == self.nft_resolver, "Unauthorized: only NFT resolver");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
        self.account_states.set(msg.nft_address, ACCOUNT_STATE_ACTIVE);

        emit(MerchantNFTOwnerRegistered{
            nft_address: msg.nft_address,
            owner: msg.owner,
            state: ACCOUNT_STATE_ACTIVE,
            timestamp: now()
        }.toCell());
    }

    // Expose the immutable NFT Account Resolver address so deploy/verify tooling can
    // confirm the only authorised account-registration authority (Issue #397).
    get fun getNFTResolver(): Address {
        return self.nft_resolver;
    }

    // ============================================
    // ACCOUNT LOCKS IMPLEMENTATION
    // ============================================

    get fun getLockState(nft_address: Address): LockState {
        let lock_state: LockState? = self.account_locks.get(nft_address);
        if (lock_state == null) {
            return defaultLockState();
        }
        return lock_state!!;
    }

    get fun isAccountLocked(nft_address: Address): Bool {
        let lock_state: LockState = self.getLockState(nft_address);
        return isLocked(lock_state);
    }

    get fun hasFraudLock(nft_address: Address): Bool {
        let lock_state: LockState = self.getLockState(nft_address);
        return lock_state.fraud_locked;
    }

    get fun hasCollateralLock(nft_address: Address): Bool {
        let lock_state: LockState = self.getLockState(nft_address);
        return lock_state.collateral_locked;
    }

    // Account Locks integration (Issue #363): the ONLY way a lock is applied.
    // INVARIANT I3 & I6: the admin cannot lock/unlock accounts; only the dedicated
    // Account Locks contract can, and a lock never moves funds (send is blocked,
    // balances are untouched). Applying an unlocked LockState clears the lock.
    receive(msg: ApplyAccountLock) {
        require(sender() == self.account_locks_contract, "Unauthorized: only Account Locks contract");
        self.account_locks.set(msg.nft_address, msg.lock_state);

        emit(MerchantAccountLockApplied{
            nft_address: msg.nft_address,
            fraud_locked: msg.lock_state.fraud_locked,
            collateral_locked: msg.lock_state.collateral_locked,
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // COLLECTION MANAGEMENT (multi-sig + timelock, Issue #363)
    // ============================================

    // Phase 1: admin (multi-sig) proposes whitelisting a collection (starts timelock)
    // INVARIANT I3: This does not grant any fund control
    receive(msg: ProposeWhitelistCollection) {
        require(sender() == self.admin, "Unauthorized: only admin");

        self.pending_whitelist_collection = msg.collection_address;
        self.pending_whitelist_executable_at = now() + MERCHANT_WHITELIST_TIMELOCK_DELAY;

        emit(MerchantCollectionWhitelistProposed{
            collection_address: msg.collection_address,
            executable_at: self.pending_whitelist_executable_at,
            timestamp: now()
        }.toCell());
    }

    // Phase 2: admin (multi-sig) executes the whitelist after the timelock expires
    receive(msg: ExecuteWhitelistCollection) {
        require(sender() == self.admin, "Unauthorized: only admin");
        require(self.pending_whitelist_collection != null, "No pending collection whitelist");
        require(now() >= self.pending_whitelist_executable_at, "Timelock not expired: wait 7 days");

        let collection: Address = self.pending_whitelist_collection!!;
        self.whitelisted_collections.set(collection, true);
        self.pending_whitelist_collection = null;
        self.pending_whitelist_executable_at = 0;

        emit(MerchantCollectionWhitelistExecuted{
            collection_address: collection,
            timestamp: now()
        }.toCell());
    }

    // Cancel a pending collection-whitelist proposal (only admin)
    receive(msg: CancelWhitelistCollection) {
        require(sender() == self.admin, "Unauthorized: only admin");
        require(self.pending_whitelist_collection != null, "No pending collection whitelist");

        let cancelled: Address = self.pending_whitelist_collection!!;
        self.pending_whitelist_collection = null;
        self.pending_whitelist_executable_at = 0;

        emit(MerchantCollectionWhitelistCancelled{
            collection_address: cancelled,
            timestamp: now()
        }.toCell());
    }

    get fun isCollectionWhitelisted(collection_address: Address): Bool {
        return self.whitelisted_collections.get(collection_address) != null;
    }

    get fun getPendingWhitelistCollection(): Address? {
        return self.pending_whitelist_collection;
    }

    get fun getPendingWhitelistExecutableAt(): Int {
        return self.pending_whitelist_executable_at;
    }

    get fun getAccountLocksContract(): Address {
        return self.account_locks_contract;
    }

    // ============================================
    // ADMIN TRANSFER FUNCTIONS (Issue #96)
    // ============================================

    /// @notice Phase 1: Propose a new admin address (starts 7-day timelock)
    /// @dev Only the current admin can propose a transfer
    /// @dev INVARIANT I3: Proposing new admin does NOT grant any fund control
    receive(msg: MerchantProposeAdminTransfer) {
        require(sender() == self.admin, "Unauthorized: only admin");

        self.pending_admin = msg.new_admin;
        self.pending_admin_executable_at = now() + MERCHANT_ADMIN_TRANSFER_DELAY;

        emit(MerchantAdminTransferProposed{
            current_admin: self.admin,
            proposed_admin: msg.new_admin,
            executable_at: self.pending_admin_executable_at,
            timestamp: now()
        }.toCell());
    }

    /// @notice Phase 2: Execute the admin transfer after timelock expires
    /// @dev Only the proposed new admin can execute; timelock must have elapsed
    /// @dev INVARIANT I3: Changing admin does NOT move any user funds
    receive(msg: MerchantExecuteAdminTransfer) {
        require(self.pending_admin != null, "No pending admin transfer");
        require(sender() == self.pending_admin!!, "Unauthorized: only proposed admin");
        require(now() >= self.pending_admin_executable_at, "Timelock not expired: wait 7 days");

        let old_admin: Address = self.admin;
        let new_admin: Address = self.pending_admin!!;

        self.admin = new_admin;
        self.pending_admin = null;
        self.pending_admin_executable_at = 0;

        emit(MerchantAdminTransferExecuted{
            old_admin: old_admin,
            new_admin: new_admin,
            timestamp: now()
        }.toCell());
    }

    /// @notice Cancel a pending admin transfer proposal (only current admin)
    receive(msg: MerchantCancelAdminTransfer) {
        require(sender() == self.admin, "Unauthorized: only admin");
        require(self.pending_admin != null, "No pending admin transfer");

        let cancelled: Address = self.pending_admin!!;
        self.pending_admin = null;
        self.pending_admin_executable_at = 0;

        emit(MerchantAdminTransferCancelled{
            admin: self.admin,
            cancelled_proposed: cancelled,
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // ADMIN GETTER FUNCTIONS
    // ============================================

    get fun getAdmin(): Address {
        return self.admin;
    }

    get fun getPendingAdmin(): Address? {
        return self.pending_admin;
    }

    get fun getPendingAdminExecutableAt(): Int {
        return self.pending_admin_executable_at;
    }
}

// ============================================================================
// MerchantPaymentHub: deployable production contract
// ============================================================================
//
// Adds ONLY storage declarations (with serialization specifiers) and `init`.
// All behaviour comes from MerchantPaymentHubBase. There are deliberately NO
// test-only bootstrap handlers here (Issue #363).
contract MerchantPaymentHub with MerchantPaymentHubBase {

    admin: Address;
    pending_admin: Address? = null;
    pending_admin_executable_at: Int as uint32 = 0;
    account_locks_contract: Address;
    nft_resolver: Address;
    account_states: map<Address, Int>;
    account_balances: map<Address, Int>;
    account_locks: map<Address, LockState>;
    nft_owners: map<Address, Address>;
    whitelisted_collections: map<Address, Bool>;
    pending_whitelist_collection: Address? = null;
    pending_whitelist_executable_at: Int as uint32 = 0;

    // @param deployer_address    initial admin (expected to be handed to a 3-of-5
    //                            multi-sig / DAO via MerchantProposeAdminTransfer)
    // @param account_locks_contract  the dedicated Account Locks contract allowed to
    //                            apply locks via ApplyAccountLock (immutable)
    // @param nft_resolver        the trusted on-chain NFT Account Resolver allowed to
    //                            register NFT ownership + ACTIVE state via
    //                            ResolveNFTOwner (immutable). Without this the maps
    //                            stay empty and every payment fails (Issue #397).
    init(deployer_address: Address, account_locks_contract: Address, nft_resolver: Address) {
        // The deployer becomes the initial admin. Admin rights can later be
        // transferred to a DAO or multisig via MerchantProposeAdminTransfer + MerchantExecuteAdminTransfer.
        self.admin = deployer_address;
        self.account_locks_contract = account_locks_contract;
        self.nft_resolver = nft_resolver;
    }
}

// ============================================
// EVENTS
// ============================================

// Merchant Payment Event
message MerchantPayment {
    payer_nft: Address;
    merchant_nft: Address;
    amount_tbc: Int as coins;
    payload_hash: Int;
    timestamp: Int as uint32;
}

// Emitted (for indexers) when the NFT Account Resolver binds an NFT account to its
// resolved owner and marks it ACTIVE (Issue #397). `state` is always
// ACCOUNT_STATE_ACTIVE on registration; it is included so indexers do not have to
// special-case the initial state.
message MerchantNFTOwnerRegistered {
    nft_address: Address;
    owner: Address;
    state: Int as uint8;
    timestamp: Int as uint32;
}
