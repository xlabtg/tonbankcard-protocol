// Lending Protocol Coordinator Contract
// Implementation of Phase 4 - Lending Protocol Integration
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): This contract NEVER custodies funds or initiates transfers
// - I2 (NFT Authority): Only NFT owner can manage their lending intents
// - I3 (No Admin Control): No admin functions can affect lending state or funds
// - I6 (Lock ≠ Confiscation): Lending coordination does NOT lock, seize, or move any funds
//
// DESIGN PRINCIPLES (MANDATORY):
// - NEVER custody user funds
// - NEVER lock or seize assets
// - NEVER initiate transfers
// - NEVER liquidate positions
// - NEVER enforce loan terms
// - Strictly opt-in and user-initiated
// - Coordination layer ONLY - all enforcement is external
//
// TRUST MODEL:
// - Protocol does NOT trust lenders
// - Lenders do NOT trust the protocol
// - Lending intents are user-initiated signals only
// - Enforcement happens off-protocol (CoinRabbit or other external lender)

import "./types/CollateralState.tact";
import "./interfaces/ICollateralSignal.tact";
import "./interfaces/INFTResolver.tact";

// ============================================
// MESSAGE DEFINITIONS
// ============================================

// Request to register a lending intent (only NFT owner can send)
message RegisterLendingIntent {
    nft_address: Address;              // The NFT account registering intent
    collateral_signal_amount: Int as coins;  // Collateral amount signaled (informational)
    target_lender: Int as uint8;       // Target lender ID (0 = CoinRabbit, 1-255 reserved)
}

// Request to cancel a lending intent (only NFT owner can send)
message CancelLendingIntent {
    nft_address: Address;              // The NFT account cancelling intent
}

// Request to update lending intent metadata (only NFT owner can send)
message UpdateLendingIntent {
    nft_address: Address;              // The NFT account to update
    collateral_signal_amount: Int as coins;  // Updated collateral amount
    target_lender: Int as uint8;       // Updated target lender ID
}

// Response message for lending intent operations
message LendingIntentResponse {
    success: Bool;
    error_code: Int as uint8;
    nft_address: Address;
    intent_state: Int as uint8;
}

// ============================================
// EVENTS (for indexing)
// ============================================

// Emitted when a lending intent is registered
message LendingIntentRegistered {
    nft_address: Address;
    collateral_signal_amount: Int as coins;
    target_lender: Int as uint8;
    timestamp: Int as uint32;
}

// Emitted when a lending intent is cancelled
message LendingIntentCancelled {
    nft_address: Address;
    timestamp: Int as uint32;
}

// Emitted when a lending intent is updated
message LendingIntentUpdated {
    nft_address: Address;
    collateral_signal_amount: Int as coins;
    target_lender: Int as uint8;
    timestamp: Int as uint32;
}

// ============================================
// INTENT STATE CONSTANTS
// ============================================
//
// LENDING INTENT STATE MACHINE (audit finding CHECK393-L1, issue #398):
//
//     NONE ──RegisterLendingIntent──▶ ACTIVE ──CancelLendingIntent──▶ CANCELLED
//      ▲                               │   ▲                              │
//      │                               │   └──UpdateLendingIntent─────────┘ (self-loop)
//      └───────────────────────────────┴──RegisterLendingIntent───────────┘
//
// - RegisterLendingIntent is the (re)creation path: it may move NONE or a
//   terminal CANCELLED intent to ACTIVE (a fresh intent with new metadata).
// - UpdateLendingIntent only mutates an already-ACTIVE intent (ACTIVE → ACTIVE).
//   It MUST NOT create a NONE intent or resurrect a CANCELLED one.
// - CancelLendingIntent only terminates an ACTIVE intent (ACTIVE → CANCELLED).
//   CANCELLED is terminal until a new RegisterLendingIntent.

const LENDING_INTENT_NONE: Int = 0;
const LENDING_INTENT_ACTIVE: Int = 1;
const LENDING_INTENT_CANCELLED: Int = 2;

// ============================================
// ERROR CODES
// ============================================

const ERROR_LI_NONE: Int = 0;
const ERROR_LI_NOT_OWNER: Int = 1;           // Sender is not the NFT owner
const ERROR_LI_INVALID_AMOUNT: Int = 2;      // Invalid collateral amount
const ERROR_LI_ALREADY_ACTIVE: Int = 3;      // Intent already active
const ERROR_LI_NO_INTENT: Int = 4;           // No intent exists to cancel/update
const ERROR_LI_NFT_NOT_REGISTERED: Int = 5;  // NFT is not registered

// ============================================
// LENDING INTENT INFO STRUCT
// ============================================

struct LendingIntentInfo {
    intent_state: Int as uint8;
    collateral_signal_amount: Int as coins;
    target_lender: Int as uint8;
    created_at: Int as uint32;
    updated_at: Int as uint32;
}

fun defaultLendingIntentInfo(): LendingIntentInfo {
    return LendingIntentInfo{
        intent_state: LENDING_INTENT_NONE,
        collateral_signal_amount: 0,
        target_lender: 0,
        created_at: 0,
        updated_at: 0
    };
}

// ============================================
// MAIN CONTRACT
// ============================================

trait LendingProtocolCoordinatorBase {

    // Storage: NFT address => LendingIntentInfo
    lending_intents: map<Address, LendingIntentInfo>;

    // Storage: NFT address => owner address (for ownership verification)
    nft_owners: map<Address, Address>;

    // ============================================
    // REGISTER LENDING INTENT (NFT Owner Only)
    // ============================================

    // Register a lending intent for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can register, no fund custody
    receive(msg: RegisterLendingIntent) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_LI_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, LENDING_INTENT_NONE);
            return;
        }

        // Validate amount (must be non-negative)
        if (msg.collateral_signal_amount < 0) {
            self.sendResponse(sender, false, ERROR_LI_INVALID_AMOUNT, msg.nft_address, LENDING_INTENT_NONE);
            return;
        }

        let current_time: Int = now();

        // Create new intent info
        let new_info: LendingIntentInfo = LendingIntentInfo{
            intent_state: LENDING_INTENT_ACTIVE,
            collateral_signal_amount: msg.collateral_signal_amount,
            target_lender: msg.target_lender,
            created_at: current_time,
            updated_at: current_time
        };

        // Store intent
        self.lending_intents.set(msg.nft_address, new_info);

        // Emit event
        emit(LendingIntentRegistered{
            nft_address: msg.nft_address,
            collateral_signal_amount: msg.collateral_signal_amount,
            target_lender: msg.target_lender,
            timestamp: current_time
        }.toCell());

        // Send success response
        self.sendResponse(sender, true, ERROR_LI_NONE, msg.nft_address, LENDING_INTENT_ACTIVE);
    }

    // ============================================
    // CANCEL LENDING INTENT (NFT Owner Only)
    // ============================================

    // Cancel a lending intent for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can cancel, no fund custody
    receive(msg: CancelLendingIntent) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_LI_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, LENDING_INTENT_NONE);
            return;
        }

        let existing: LendingIntentInfo? = self.lending_intents.get(msg.nft_address);
        require(existing != null, "No lending intent");

        let i: LendingIntentInfo = existing!!;
        require(i.intent_state == LENDING_INTENT_ACTIVE, "Lending intent is not active");

        // Create cancelled intent info
        let current_time: Int = now();
        let cancelled_info: LendingIntentInfo = LendingIntentInfo{
            intent_state: LENDING_INTENT_CANCELLED,
            collateral_signal_amount: i.collateral_signal_amount,
            target_lender: i.target_lender,
            created_at: i.created_at,
            updated_at: current_time
        };

        // Store cancelled state
        self.lending_intents.set(msg.nft_address, cancelled_info);

        // Emit event
        emit(LendingIntentCancelled{
            nft_address: msg.nft_address,
            timestamp: current_time
        }.toCell());

        // Send success response
        self.sendResponse(sender, true, ERROR_LI_NONE, msg.nft_address, LENDING_INTENT_CANCELLED);
    }

    // ============================================
    // UPDATE LENDING INTENT (NFT Owner Only)
    // ============================================

    // Update a lending intent for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can update, no fund custody
    receive(msg: UpdateLendingIntent) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_LI_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, LENDING_INTENT_NONE);
            return;
        }

        // Validate amount
        if (msg.collateral_signal_amount < 0) {
            self.sendResponse(sender, false, ERROR_LI_INVALID_AMOUNT, msg.nft_address, LENDING_INTENT_NONE);
            return;
        }

        // Get existing intent and enforce the state-transition guard:
        // an update may only mutate an ACTIVE intent. Without this check an
        // UpdateLendingIntent would silently materialize a never-registered
        // intent or resurrect a CANCELLED one back to ACTIVE.
        let existing: LendingIntentInfo? = self.lending_intents.get(msg.nft_address);
        require(existing != null, "No lending intent");

        let i: LendingIntentInfo = existing!!;
        require(i.intent_state == LENDING_INTENT_ACTIVE, "Lending intent is not active");

        let current_time: Int = now();

        // Create updated intent info (creation metadata is preserved)
        let updated_info: LendingIntentInfo = LendingIntentInfo{
            intent_state: LENDING_INTENT_ACTIVE,
            collateral_signal_amount: msg.collateral_signal_amount,
            target_lender: msg.target_lender,
            created_at: i.created_at,
            updated_at: current_time
        };

        // Store updated intent
        self.lending_intents.set(msg.nft_address, updated_info);

        // Emit event
        emit(LendingIntentUpdated{
            nft_address: msg.nft_address,
            collateral_signal_amount: msg.collateral_signal_amount,
            target_lender: msg.target_lender,
            timestamp: current_time
        }.toCell());

        // Send success response
        self.sendResponse(sender, true, ERROR_LI_NONE, msg.nft_address, LENDING_INTENT_ACTIVE);
    }

    // ============================================
    // READ-ONLY GETTERS
    // ============================================

    // Get lending intent information for an NFT account
    get fun getLendingIntentInfo(nft_address: Address): LendingIntentInfo {
        let info: LendingIntentInfo? = self.lending_intents.get(nft_address);
        if (info == null) {
            return defaultLendingIntentInfo();
        }
        return info!!;
    }

    // Get lending intent state for an NFT account
    get fun getLendingIntentState(nft_address: Address): Int {
        let info: LendingIntentInfo = self.getLendingIntentInfo(nft_address);
        return info.intent_state;
    }

    // Check if an NFT account has an active lending intent
    get fun hasActiveLendingIntent(nft_address: Address): Bool {
        let info: LendingIntentInfo = self.getLendingIntentInfo(nft_address);
        return info.intent_state == LENDING_INTENT_ACTIVE;
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    // Validate that sender is the owner of the NFT
    fun validateOwnership(sender: Address, nft_address: Address): Int {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return ERROR_LI_NFT_NOT_REGISTERED;
        }
        if (owner!! != sender) {
            return ERROR_LI_NOT_OWNER;
        }
        return ERROR_LI_NONE;
    }

    // Send response to caller
    fun sendResponse(to: Address, success: Bool, error_code: Int, nft_address: Address, intent_state: Int) {
        send(SendParameters{
            to: to,
            value: 0,
            mode: SendRemainingValue,
            body: LendingIntentResponse{
                success: success,
                error_code: error_code,
                nft_address: nft_address,
                intent_state: intent_state
            }.toCell()
        });
    }

}

contract LendingProtocolCoordinator with LendingProtocolCoordinatorBase {
    lending_intents: map<Address, LendingIntentInfo>;
    nft_owners: map<Address, Address>;

    init() {
        self.lending_intents = emptyMap();
        self.nft_owners = emptyMap();
    }
}
