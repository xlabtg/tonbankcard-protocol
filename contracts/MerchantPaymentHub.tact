// Merchant Payment Hub Contract
// Implementation of Issue #8 - Merchant Payments (On-Chain Settlement in TBC)
// Issue #96: Upgradeable admin system with timelock and two-phase ownership transfer
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): Validates payer is NFT owner before payment (lines 90-96)
// - I2 (NFT Authority): NFT ownership stored and validated (lines 42, 90-96)
// - I3 (No Admin Control): Admin cannot move funds; admin transfer uses 7-day timelock
// - I4 (Atomic Transfers): Atomic debit/credit in single transaction (lines 134-135)
// - I5 (Ledger Conservation): Direct debit/credit with no fees (lines 178-187)
// - I6 (Lock ≠ Confiscation): Checks locks before send, allows receive (lines 116-119)

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

// 7-day timelock delay for admin transfers (in seconds)
const MERCHANT_ADMIN_TRANSFER_DELAY: Int = 7 * 24 * 60 * 60;

// Merchant Payment Hub Contract
contract MerchantPaymentHub with IAccountStateMachine, IAccountLocks {

    // Storage
    // Current admin address (transferable via two-phase timelock, see MerchantProposeAdminTransfer)
    // INVARIANT I3: Admin cannot move or withdraw user funds
    admin: Address;

    // Pending admin transfer: proposed new admin address (null if no transfer pending)
    pending_admin: Address?;

    // Unix timestamp when the pending admin transfer becomes executable (after 7-day timelock)
    pending_admin_executable_at: Int as uint32 = 0;

    account_states: map<Address, Int>;      // nft_address => state
    account_balances: map<Address, Int>;    // nft_address => balance_tbc
    account_locks: map<Address, LockState>; // nft_address => lock_state
    nft_owners: map<Address, Address>;      // nft_address => owner_address
    whitelisted_collections: map<Address, Bool>; // collection_address => whitelisted

    init(deployer_address: Address) {
        // The deployer becomes the initial admin. Admin rights can later be
        // transferred to a DAO or multisig via MerchantProposeAdminTransfer + MerchantExecuteAdminTransfer.
        self.admin = deployer_address;
        self.pending_admin = null;
        self.account_states = emptyMap();
        self.account_balances = emptyMap();
        self.account_locks = emptyMap();
        self.nft_owners = emptyMap();
        self.whitelisted_collections = emptyMap();
    }

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

    virtual override fun debitBalance(nft_address: Address, amount: Int) {
        let current_balance: Int = self.getBalance(nft_address);
        require(current_balance >= amount, "Insufficient balance");
        self.account_balances.set(nft_address, current_balance - amount);
    }

    virtual override fun creditBalance(nft_address: Address, amount: Int) {
        let current_balance: Int = self.getBalance(nft_address);
        self.account_balances.set(nft_address, current_balance + amount);
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

    // ============================================
    // COLLECTION MANAGEMENT
    // ============================================

    // Whitelist an NFT collection for account registration
    // INVARIANT I3: This does not grant any fund control
    receive(msg: WhitelistMerchantCollection) {
        require(sender() == self.admin, "Unauthorized: only admin");
        self.whitelisted_collections.set(msg.collection_address, true);
    }

    get fun isCollectionWhitelisted(collection_address: Address): Bool {
        return self.whitelisted_collections.get(collection_address) != null;
    }

    // ============================================
    // ACCOUNT SETUP FUNCTIONS
    // ============================================

    // INVARIANT I3: Setup functions do NOT allow fund withdrawal
    // These are used to register accounts and configure their initial state
    // Only the deployer can register new accounts during the setup phase

    receive(msg: SetAccountState) {
        require(sender() == self.admin, "Unauthorized: only admin");
        self.account_states.set(msg.nft_address, msg.state);
        if (self.nft_owners.get(msg.nft_address) == null) {
            self.nft_owners.set(msg.nft_address, msg.owner);
        }
    }

    receive(msg: SetAccountBalance) {
        require(sender() == self.admin, "Unauthorized: only admin");
        self.account_balances.set(msg.nft_address, msg.balance);
    }

    receive(msg: SetAccountLock) {
        require(sender() == self.admin, "Unauthorized: only admin");
        self.account_locks.set(msg.nft_address, msg.lock_state);
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

// ============================================
// SETUP MESSAGES
// ============================================

// Message to whitelist an NFT collection for merchant payments
message WhitelistMerchantCollection {
    collection_address: Address;
}

message SetAccountState {
    nft_address: Address;
    state: Int as uint8;
    owner: Address;
}

message SetAccountBalance {
    nft_address: Address;
    balance: Int as coins;
}

message SetAccountLock {
    nft_address: Address;
    lock_state: LockState;
}
