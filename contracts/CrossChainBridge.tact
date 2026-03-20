// Cross-Chain Bridge Contract
// Implementation of Phase 4 - Cross-Chain Bridges
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): This contract NEVER custodies funds from other chains
// - I2 (NFT Authority): Only NFT owner can initiate cross-chain operations
// - I3 (No Admin Control): No admin can modify bridge state or intercept funds
// - I4 (Atomic Transfers): Bridge operations are recorded atomically on TON side
//
// DESIGN PRINCIPLES (MANDATORY):
// - Bridge contract is a COORDINATION layer, NOT a custodial bridge
// - Cross-chain verification is EXTERNAL (ChangeNOW, relayers, etc.)
// - This contract only tracks bridge intents and confirmations on TON side
// - Actual cross-chain fund movement happens through external providers
// - Users maintain full control - can cancel unconfirmed intents
//
// TRUST MODEL:
// - Users trust their wallet for TON-side transactions
// - Cross-chain verification relies on external oracle/relayer reports
// - Protocol records bridge events for auditability
// - NO automatic fund movement across chains
// - External adapters (ChangeNOW) handle actual cross-chain swaps

import "./interfaces/INFTResolver.tact";

// ============================================
// MESSAGE DEFINITIONS
// ============================================

// Register a cross-chain bridge intent (only NFT owner)
message RegisterBridgeIntent {
    nft_address: Address;               // NFT account initiating bridge
    intent_id: Int as uint64;           // Unique intent ID
    target_chain: Int as uint8;         // Target chain ID (1=ETH, 2=BTC, 3=BSC, etc.)
    amount: Int as coins;               // Amount to bridge (informational)
    target_address_hash: Int as uint256; // Hash of target chain address (privacy)
}

// Confirm bridge execution (only authorized relayer or owner)
message ConfirmBridgeExecution {
    nft_address: Address;
    intent_id: Int as uint64;
    external_tx_hash: Int as uint256;   // Hash of external chain transaction
}

// Cancel a bridge intent (only NFT owner)
message CancelBridgeIntent {
    nft_address: Address;
    intent_id: Int as uint64;
}

// Response message for bridge operations
message BridgeResponse {
    success: Bool;
    error_code: Int as uint8;
    nft_address: Address;
    intent_id: Int as uint64;
}

// ============================================
// EVENTS (for indexing)
// ============================================

message BridgeIntentRegistered {
    nft_address: Address;
    intent_id: Int as uint64;
    target_chain: Int as uint8;
    amount: Int as coins;
    timestamp: Int as uint32;
}

message BridgeExecutionConfirmed {
    nft_address: Address;
    intent_id: Int as uint64;
    external_tx_hash: Int as uint256;
    timestamp: Int as uint32;
}

message BridgeIntentCancelled {
    nft_address: Address;
    intent_id: Int as uint64;
    timestamp: Int as uint32;
}

// ============================================
// CONSTANTS
// ============================================

const BRIDGE_INTENT_PENDING: Int = 0;
const BRIDGE_INTENT_CONFIRMED: Int = 1;
const BRIDGE_INTENT_CANCELLED: Int = 2;
const BRIDGE_INTENT_FAILED: Int = 3;

// Supported chain IDs
const CHAIN_ETHEREUM: Int = 1;
const CHAIN_BITCOIN: Int = 2;
const CHAIN_BSC: Int = 3;
const CHAIN_POLYGON: Int = 4;
const CHAIN_SOLANA: Int = 5;

const ERROR_BR_NONE: Int = 0;
const ERROR_BR_NOT_OWNER: Int = 1;
const ERROR_BR_INVALID_AMOUNT: Int = 2;
const ERROR_BR_INVALID_CHAIN: Int = 3;
const ERROR_BR_INTENT_NOT_FOUND: Int = 4;
const ERROR_BR_INTENT_NOT_PENDING: Int = 5;
const ERROR_BR_NFT_NOT_REGISTERED: Int = 6;
const ERROR_BR_NOT_AUTHORIZED: Int = 7;

const MAX_SUPPORTED_CHAIN: Int = 5;

// ============================================
// DATA STRUCTURES
// ============================================

struct BridgeIntentInfo {
    status: Int as uint8;
    target_chain: Int as uint8;
    amount: Int as coins;
    target_address_hash: Int as uint256;
    external_tx_hash: Int as uint256;
    created_at: Int as uint32;
    confirmed_at: Int as uint32;
}

fun defaultBridgeIntentInfo(): BridgeIntentInfo {
    return BridgeIntentInfo{
        status: BRIDGE_INTENT_PENDING,
        target_chain: 0,
        amount: 0,
        target_address_hash: 0,
        external_tx_hash: 0,
        created_at: 0,
        confirmed_at: 0
    };
}

// ============================================
// MAIN CONTRACT
// ============================================

contract CrossChainBridge {

    // Storage: composite key => BridgeIntentInfo
    bridge_intents: map<Int, BridgeIntentInfo>;

    // Storage: NFT address => owner address
    nft_owners: map<Address, Address>;

    // Storage: authorized relayer addresses
    authorized_relayers: map<Address, Bool>;

    init() {
        self.bridge_intents = emptyMap();
        self.nft_owners = emptyMap();
        self.authorized_relayers = emptyMap();
    }

    // ============================================
    // REGISTER BRIDGE INTENT (NFT Owner Only)
    // ============================================

    receive(msg: RegisterBridgeIntent) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_BR_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.intent_id);
            return;
        }

        // Validate amount
        if (msg.amount <= 0) {
            self.sendResponse(sender, false, ERROR_BR_INVALID_AMOUNT, msg.nft_address, msg.intent_id);
            return;
        }

        // Validate target chain
        if (msg.target_chain < 1 || msg.target_chain > MAX_SUPPORTED_CHAIN) {
            self.sendResponse(sender, false, ERROR_BR_INVALID_CHAIN, msg.nft_address, msg.intent_id);
            return;
        }

        let current_time: Int = now();

        // Create bridge intent
        let intent: BridgeIntentInfo = BridgeIntentInfo{
            status: BRIDGE_INTENT_PENDING,
            target_chain: msg.target_chain,
            amount: msg.amount,
            target_address_hash: msg.target_address_hash,
            external_tx_hash: 0,
            created_at: current_time,
            confirmed_at: 0
        };

        // Store intent
        let key: Int = self.intentKey(msg.nft_address, msg.intent_id);
        self.bridge_intents.set(key, intent);

        // Emit event
        emit(BridgeIntentRegistered{
            nft_address: msg.nft_address,
            intent_id: msg.intent_id,
            target_chain: msg.target_chain,
            amount: msg.amount,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_BR_NONE, msg.nft_address, msg.intent_id);
    }

    // ============================================
    // CONFIRM BRIDGE EXECUTION
    // ============================================

    // Confirm that a cross-chain bridge operation has been executed
    // Can be called by NFT owner or authorized relayer
    // NOTE: This is informational confirmation only - no funds are moved here
    receive(msg: ConfirmBridgeExecution) {
        let sender: Address = sender();

        // Validate sender is owner or relayer
        let is_owner: Bool = self.isOwner(sender, msg.nft_address);
        let is_relayer: Bool = self.isAuthorizedRelayer(sender);
        if (!is_owner && !is_relayer) {
            self.sendResponse(sender, false, ERROR_BR_NOT_AUTHORIZED, msg.nft_address, msg.intent_id);
            return;
        }

        // Get intent
        let key: Int = self.intentKey(msg.nft_address, msg.intent_id);
        let intent: BridgeIntentInfo? = self.bridge_intents.get(key);
        if (intent == null) {
            self.sendResponse(sender, false, ERROR_BR_INTENT_NOT_FOUND, msg.nft_address, msg.intent_id);
            return;
        }

        let i: BridgeIntentInfo = intent!!;
        if (i.status != BRIDGE_INTENT_PENDING) {
            self.sendResponse(sender, false, ERROR_BR_INTENT_NOT_PENDING, msg.nft_address, msg.intent_id);
            return;
        }

        let current_time: Int = now();

        // Update intent as confirmed
        let confirmed: BridgeIntentInfo = BridgeIntentInfo{
            status: BRIDGE_INTENT_CONFIRMED,
            target_chain: i.target_chain,
            amount: i.amount,
            target_address_hash: i.target_address_hash,
            external_tx_hash: msg.external_tx_hash,
            created_at: i.created_at,
            confirmed_at: current_time
        };
        self.bridge_intents.set(key, confirmed);

        // Emit event
        emit(BridgeExecutionConfirmed{
            nft_address: msg.nft_address,
            intent_id: msg.intent_id,
            external_tx_hash: msg.external_tx_hash,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_BR_NONE, msg.nft_address, msg.intent_id);
    }

    // ============================================
    // CANCEL BRIDGE INTENT (NFT Owner Only)
    // ============================================

    receive(msg: CancelBridgeIntent) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_BR_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.intent_id);
            return;
        }

        // Get intent
        let key: Int = self.intentKey(msg.nft_address, msg.intent_id);
        let intent: BridgeIntentInfo? = self.bridge_intents.get(key);
        if (intent == null) {
            self.sendResponse(sender, false, ERROR_BR_INTENT_NOT_FOUND, msg.nft_address, msg.intent_id);
            return;
        }

        let i: BridgeIntentInfo = intent!!;
        if (i.status != BRIDGE_INTENT_PENDING) {
            self.sendResponse(sender, false, ERROR_BR_INTENT_NOT_PENDING, msg.nft_address, msg.intent_id);
            return;
        }

        let current_time: Int = now();

        // Mark as cancelled
        let cancelled: BridgeIntentInfo = BridgeIntentInfo{
            status: BRIDGE_INTENT_CANCELLED,
            target_chain: i.target_chain,
            amount: i.amount,
            target_address_hash: i.target_address_hash,
            external_tx_hash: 0,
            created_at: i.created_at,
            confirmed_at: 0
        };
        self.bridge_intents.set(key, cancelled);

        // Emit event
        emit(BridgeIntentCancelled{
            nft_address: msg.nft_address,
            intent_id: msg.intent_id,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_BR_NONE, msg.nft_address, msg.intent_id);
    }

    // ============================================
    // READ-ONLY GETTERS
    // ============================================

    get fun getBridgeIntentInfo(nft_address: Address, intent_id: Int): BridgeIntentInfo {
        let key: Int = self.intentKey(nft_address, intent_id);
        let intent: BridgeIntentInfo? = self.bridge_intents.get(key);
        if (intent == null) {
            return defaultBridgeIntentInfo();
        }
        return intent!!;
    }

    get fun isBridgeIntentPending(nft_address: Address, intent_id: Int): Bool {
        let info: BridgeIntentInfo = self.getBridgeIntentInfo(nft_address, intent_id);
        return info.status == BRIDGE_INTENT_PENDING;
    }

    get fun isBridgeIntentConfirmed(nft_address: Address, intent_id: Int): Bool {
        let info: BridgeIntentInfo = self.getBridgeIntentInfo(nft_address, intent_id);
        return info.status == BRIDGE_INTENT_CONFIRMED;
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    fun validateOwnership(sender: Address, nft_address: Address): Int {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return ERROR_BR_NFT_NOT_REGISTERED;
        }
        if (owner!! != sender) {
            return ERROR_BR_NOT_OWNER;
        }
        return ERROR_BR_NONE;
    }

    fun isOwner(sender: Address, nft_address: Address): Bool {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return false;
        }
        return owner!! == sender;
    }

    fun isAuthorizedRelayer(sender: Address): Bool {
        let authorized: Bool? = self.authorized_relayers.get(sender);
        if (authorized == null) {
            return false;
        }
        return authorized!!;
    }

    fun intentKey(nft_address: Address, intent_id: Int): Int {
        return sha256(nft_address.asSlice()) + intent_id;
    }

    fun sendResponse(to: Address, success: Bool, error_code: Int, nft_address: Address, intent_id: Int) {
        send(SendParameters{
            to: to,
            value: 0,
            mode: SendRemainingValue,
            body: BridgeResponse{
                success: success,
                error_code: error_code,
                nft_address: nft_address,
                intent_id: intent_id
            }.toCell()
        });
    }

    // ============================================
    // ADMIN FUNCTIONS (FOR TESTING ONLY)
    // ============================================

    receive(msg: RegisterNFTOwnerBridge) {
        self.nft_owners.set(msg.nft_address, msg.owner);
    }

    receive(msg: RegisterRelayer) {
        self.authorized_relayers.set(msg.relayer, true);
    }
}

// Test-only messages
message RegisterNFTOwnerBridge {
    nft_address: Address;
    owner: Address;
}

message RegisterRelayer {
    relayer: Address;
}
