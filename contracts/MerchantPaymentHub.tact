// Merchant Payment Hub Contract
// Implementation of Issue #8 - Merchant Payments (On-Chain Settlement in TBC)

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

// Merchant Payment Hub Contract
contract MerchantPaymentHub with IAccountStateMachine, IAccountLocks {

    // Storage
    account_states: map<Address, Int>;      // nft_address => state
    account_balances: map<Address, Int>;    // nft_address => balance_tbc
    account_locks: map<Address, LockState>; // nft_address => lock_state
    nft_owners: map<Address, Address>;      // nft_address => owner_address

    init() {
        self.account_states = emptyMap();
        self.account_balances = emptyMap();
        self.account_locks = emptyMap();
        self.nft_owners = emptyMap();
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

        // VALIDATION 1: Check ownership
        let payer_owner: Address? = self.nft_owners.get(payer_nft);
        if (payer_owner == null) {
            return ERROR_PAYER_NOT_EXISTS;
        }
        if (payer_owner!! != sender) {
            return ERROR_NOT_OWNER;
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

        // VALIDATION 5: Check payer locks (must not be locked)
        let payer_locks: LockState = self.getLockState(payer_nft);
        if (!canSendWithLocks(payer_locks)) {
            return ERROR_PAYER_LOCKED;
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

        // SETTLEMENT: Execute atomic transfer
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
    // ADMIN FUNCTIONS (FOR TESTING/SETUP ONLY)
    // ============================================

    // Note: In production, these would be removed or restricted
    // They are here for testing purposes only

    receive("setup_account") {
        // Setup test accounts - for testing only
        let test_payer: Address = sender();
        self.account_states.set(test_payer, ACCOUNT_STATE_ACTIVE);
        self.account_balances.set(test_payer, 1000000000); // 1000 TBC
        self.account_locks.set(test_payer, defaultLockState());
        self.nft_owners.set(test_payer, sender());
    }

    receive(msg: SetAccountState) {
        self.account_states.set(msg.nft_address, msg.state);
        if (self.nft_owners.get(msg.nft_address) == null) {
            self.nft_owners.set(msg.nft_address, msg.owner);
        }
    }

    receive(msg: SetAccountBalance) {
        self.account_balances.set(msg.nft_address, msg.balance);
    }

    receive(msg: SetAccountLock) {
        self.account_locks.set(msg.nft_address, msg.lock_state);
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
// ADMIN MESSAGES (FOR TESTING)
// ============================================

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
