// SPDX-License-Identifier: MIT
// Tonbankcard Protocol - Payment Hub: Internal TBC Transfers
// Issue #6: Issue 3.3 Payment Hub — Internal TBC Transfers Between NFT Accounts

import "@stdlib/deploy";

// ========================================
// Account States
// ========================================
// Represents the state of an NFT account within the protocol
const ACCOUNT_STATE_ACTIVE: Int = 0;
const ACCOUNT_STATE_FROZEN: Int = 1;
const ACCOUNT_STATE_COLLATERAL_LOCKED: Int = 2;
const ACCOUNT_STATE_CLOSED: Int = 3;

// ========================================
// Error Codes
// ========================================
const ERROR_INVALID_AMOUNT: Int = 100;           // Transfer amount must be > 0
const ERROR_INSUFFICIENT_BALANCE: Int = 101;      // Insufficient balance for transfer
const ERROR_INVALID_NFT_FROM: Int = 102;          // Invalid from_nft address
const ERROR_INVALID_NFT_TO: Int = 103;            // Invalid to_nft address
const ERROR_UNAUTHORIZED: Int = 104;              // msg.sender is not NFT owner
const ERROR_FROM_ACCOUNT_NOT_ACTIVE: Int = 105;   // From account must be ACTIVE
const ERROR_TO_ACCOUNT_CLOSED: Int = 106;         // Cannot send to CLOSED account
const ERROR_REENTRANCY: Int = 107;                // Reentrancy detected

// ========================================
// Structs
// ========================================

// Account state structure
struct AccountState {
    balance: Int as coins;      // TBC balance in nanocoins
    state: Int as uint8;        // Account state (ACTIVE, FROZEN, etc.)
    owner: Address;             // NFT owner address
}

// Transfer metadata payload (optional)
struct TransferPayload {
    memo: String;               // Optional memo
    orderId: String;            // Optional order ID for merchant payments
}

// ========================================
// Messages
// ========================================

// Request to perform an internal transfer
message TransferInternalRequest {
    from_nft: Address;
    to_nft: Address;
    amount_tbc: Int as coins;
    payload: TransferPayload?;
}

// Response confirming successful transfer
message TransferInternalResponse {
    success: Bool;
    from_nft: Address;
    to_nft: Address;
    amount_tbc: Int as coins;
}

// Request to get account state
message GetAccountStateRequest {
    nft_address: Address;
}

// Response with account state
message GetAccountStateResponse {
    nft_address: Address;
    balance: Int as coins;
    state: Int as uint8;
    owner: Address;
}

// Admin message to initialize an account (for testing/setup)
message InitializeAccount {
    nft_address: Address;
    owner: Address;
    initial_balance: Int as coins;
    initial_state: Int as uint8;
}

// ========================================
// Events
// ========================================

// Event emitted on successful internal transfer
message InternalTransferEvent {
    from_nft: Address;
    to_nft: Address;
    amount_tbc: Int as coins;
    payload_hash: Int as uint256;  // Hash of payload for deterministic indexing
    timestamp: Int as uint32;
}

// Event emitted on account state change
message AccountStateChangedEvent {
    nft_address: Address;
    old_state: Int as uint8;
    new_state: Int as uint8;
    timestamp: Int as uint32;
}

// ========================================
// Payment Hub Contract
// ========================================

contract PaymentHub with Deployable {

    // ========================================
    // State Variables
    // ========================================

    // Deployer address (for administrative functions during development)
    deployer: Address;

    // Reentrancy guard
    locked: Bool = false;

    // Account states mapping (nft_address => AccountState)
    accounts: map<Address, AccountState>;

    // Whitelisted NFT collections (for NFT Account Resolver functionality)
    whitelisted_collections: map<Address, Bool>;

    // ========================================
    // Initialization
    // ========================================

    init(deployer_address: Address) {
        self.deployer = deployer_address;

        // Initialize whitelisted NFT collections
        // Series 7777: EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le
        // Series 8888: EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7
        // Note: These are placeholder addresses for development
        // In production, these would be the actual deployed NFT collection addresses
    }

    // ========================================
    // Core Transfer Function
    // ========================================

    receive(msg: TransferInternalRequest) {
        // Reentrancy guard
        require(!self.locked, "Reentrancy detected");
        self.locked = true;

        // Validation 1: Amount must be positive
        require(msg.amount_tbc > 0, "Transfer amount must be positive");

        // Validation 2: from_nft and to_nft must be valid NFT accounts
        require(self.isValidAccountNFT(msg.from_nft), "Invalid from_nft address");
        require(self.isValidAccountNFT(msg.to_nft), "Invalid to_nft address");

        // Get account states
        let from_account: AccountState = self.getOrCreateAccount(msg.from_nft);
        let to_account: AccountState = self.getOrCreateAccount(msg.to_nft);

        // Validation 3: msg.sender must be owner of from_nft
        require(sender() == from_account.owner, "Unauthorized: sender is not NFT owner");

        // Validation 4: from_account must be ACTIVE (can send)
        require(from_account.state == ACCOUNT_STATE_ACTIVE, "From account is not ACTIVE");

        // Validation 5: to_account must not be CLOSED (can receive)
        require(to_account.state != ACCOUNT_STATE_CLOSED, "Cannot send to CLOSED account");

        // Validation 6: Sufficient balance
        require(from_account.balance >= msg.amount_tbc, "Insufficient balance");

        // Handle self-transfer (edge case)
        if (msg.from_nft == msg.to_nft) {
            // Self-transfer is a no-op but we still emit event for transparency
            self.emitTransferEvent(msg.from_nft, msg.to_nft, msg.amount_tbc, msg.payload);
            self.locked = false;

            // Send success response
            send(SendParameters{
                to: sender(),
                value: 0,
                mode: SendRemainingValue,
                body: TransferInternalResponse{
                    success: true,
                    from_nft: msg.from_nft,
                    to_nft: msg.to_nft,
                    amount_tbc: msg.amount_tbc
                }.toCell()
            });
            return;
        }

        // Atomic balance update
        from_account.balance = from_account.balance - msg.amount_tbc;
        to_account.balance = to_account.balance + msg.amount_tbc;

        // Save updated states
        self.accounts.set(msg.from_nft, from_account);
        self.accounts.set(msg.to_nft, to_account);

        // Emit transfer event
        self.emitTransferEvent(msg.from_nft, msg.to_nft, msg.amount_tbc, msg.payload);

        // Release lock
        self.locked = false;

        // Send success response
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: TransferInternalResponse{
                success: true,
                from_nft: msg.from_nft,
                to_nft: msg.to_nft,
                amount_tbc: msg.amount_tbc
            }.toCell()
        });
    }

    // ========================================
    // Account Management
    // ========================================

    // Initialize or update an account (for testing/development)
    receive(msg: InitializeAccount) {
        // Only deployer can initialize accounts during development
        require(sender() == self.deployer, "Unauthorized: only deployer");

        let account: AccountState = AccountState{
            balance: msg.initial_balance,
            state: msg.initial_state,
            owner: msg.owner
        };

        self.accounts.set(msg.nft_address, account);
    }

    // Get account state (read-only query)
    receive(msg: GetAccountStateRequest) {
        let account: AccountState = self.getOrCreateAccount(msg.nft_address);

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: GetAccountStateResponse{
                nft_address: msg.nft_address,
                balance: account.balance,
                state: account.state,
                owner: account.owner
            }.toCell()
        });
    }

    // ========================================
    // Helper Functions
    // ========================================

    // NFT Account Resolver: Validate if NFT is a valid account
    // This is a simplified version - in production, this would query actual NFT contracts
    fun isValidAccountNFT(nft_address: Address): Bool {
        // For development: check if account exists or could be created
        // In production: would verify NFT is from whitelisted collection and not burned
        return true;  // Simplified for development
    }

    // Get account state or create new one if doesn't exist
    fun getOrCreateAccount(nft_address: Address): AccountState {
        let existing: AccountState? = self.accounts.get(nft_address);

        if (existing != null) {
            return existing!!;
        }

        // Create new account with default state
        // Note: In production, this would integrate with NFT Account Resolver
        // to verify ownership before creating account
        return AccountState{
            balance: 0,
            state: ACCOUNT_STATE_ACTIVE,
            owner: nft_address  // Simplified: using NFT address as owner for now
        };
    }

    // Emit transfer event with payload hash
    fun emitTransferEvent(from_nft: Address, to_nft: Address, amount: Int, payload: TransferPayload?) {
        // Calculate deterministic payload hash
        let payload_hash: Int = 0;
        if (payload != null) {
            // Hash payload for deterministic indexing
            // In production: would use proper hash function
            payload_hash = payload!!.memo.asSlice().hash();
        }

        emit(InternalTransferEvent{
            from_nft: from_nft,
            to_nft: to_nft,
            amount_tbc: amount,
            payload_hash: payload_hash,
            timestamp: now()
        }.toCell());
    }

    // ========================================
    // Getter Functions
    // ========================================

    // Get account balance
    get fun getBalance(nft_address: Address): Int {
        let account: AccountState = self.getOrCreateAccount(nft_address);
        return account.balance;
    }

    // Get account state
    get fun getAccountState(nft_address: Address): Int {
        let account: AccountState = self.getOrCreateAccount(nft_address);
        return account.state;
    }

    // Get account owner
    get fun getOwner(nft_address: Address): Address {
        let account: AccountState = self.getOrCreateAccount(nft_address);
        return account.owner;
    }

    // Check if account can send (ACTIVE state)
    get fun canSend(nft_address: Address): Bool {
        let account: AccountState = self.getOrCreateAccount(nft_address);
        return account.state == ACCOUNT_STATE_ACTIVE;
    }

    // Check if account can receive (not CLOSED)
    get fun canReceive(nft_address: Address): Bool {
        let account: AccountState = self.getOrCreateAccount(nft_address);
        return account.state != ACCOUNT_STATE_CLOSED;
    }
}
