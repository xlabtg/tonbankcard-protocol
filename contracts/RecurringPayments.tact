// Recurring Payments Contract
// Implementation of Phase 4 - Recurring Payments
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): This contract NEVER custodies funds
// - I2 (NFT Authority): Only NFT owner can create/manage recurring payment mandates
// - I3 (No Admin Control): No admin functions can create or modify mandates
// - I4 (Atomic Transfers): Each recurring execution is atomic
// - I5 (Ledger Conservation): Zero fees on internal TBC transfers
//
// DESIGN PRINCIPLES (MANDATORY):
// - Mandates are USER-CREATED and USER-CONTROLLED
// - Users can cancel mandates at ANY time
// - Merchants CANNOT create mandates on behalf of users
// - Each execution requires on-chain verification of mandate validity
// - Mandate parameters are IMMUTABLE after creation (user must cancel and recreate)
// - No automatic fund deduction - external trigger required for each execution
//
// TRUST MODEL:
// - Users create mandates with explicit limits
// - Merchants can trigger execution within mandate limits
// - Protocol enforces mandate constraints (amount, interval, total)
// - User can always cancel, overriding all other considerations

import "./interfaces/INFTResolver.tact";

// ============================================
// MESSAGE DEFINITIONS
// ============================================

// Create a recurring payment mandate (only NFT owner)
message CreateMandate {
    nft_address: Address;               // Payer's NFT account
    merchant_address: Address;          // Merchant's NFT account (recipient)
    mandate_id: Int as uint64;          // Unique mandate ID
    amount_per_period: Int as coins;    // Amount per execution
    period_seconds: Int as uint32;      // Interval between executions (in seconds)
    max_executions: Int as uint32;      // Maximum number of executions (0 = unlimited)
}

// Cancel a recurring payment mandate (only NFT owner)
message CancelMandate {
    nft_address: Address;
    mandate_id: Int as uint64;
}

// Execute a recurring payment (merchant or authorized executor)
message ExecuteRecurringPayment {
    nft_address: Address;
    mandate_id: Int as uint64;
}

// Response message for recurring payment operations
message RecurringPaymentResponse {
    success: Bool;
    error_code: Int as uint8;
    nft_address: Address;
    mandate_id: Int as uint64;
}

// ============================================
// EVENTS (for indexing)
// ============================================

message MandateCreated {
    nft_address: Address;
    merchant_address: Address;
    mandate_id: Int as uint64;
    amount_per_period: Int as coins;
    period_seconds: Int as uint32;
    max_executions: Int as uint32;
    timestamp: Int as uint32;
}

message MandateCancelled {
    nft_address: Address;
    mandate_id: Int as uint64;
    timestamp: Int as uint32;
}

message RecurringPaymentExecuted {
    nft_address: Address;
    merchant_address: Address;
    mandate_id: Int as uint64;
    amount: Int as coins;
    execution_number: Int as uint32;
    timestamp: Int as uint32;
}

// ============================================
// CONSTANTS
// ============================================

const MANDATE_ACTIVE: Int = 0;
const MANDATE_CANCELLED: Int = 1;
const MANDATE_COMPLETED: Int = 2;

const ERROR_RP_NONE: Int = 0;
const ERROR_RP_NOT_OWNER: Int = 1;
const ERROR_RP_INVALID_AMOUNT: Int = 2;
const ERROR_RP_INVALID_PERIOD: Int = 3;
const ERROR_RP_MANDATE_NOT_FOUND: Int = 4;
const ERROR_RP_MANDATE_NOT_ACTIVE: Int = 5;
const ERROR_RP_TOO_EARLY: Int = 6;           // Period not elapsed since last execution
const ERROR_RP_MAX_REACHED: Int = 7;          // Maximum executions reached
const ERROR_RP_NFT_NOT_REGISTERED: Int = 8;
const ERROR_RP_NOT_AUTHORIZED: Int = 9;       // Not merchant or owner

const MIN_PERIOD_SECONDS: Int = 3600;         // Minimum period: 1 hour

// ============================================
// DATA STRUCTURES
// ============================================

struct MandateInfo {
    status: Int as uint8;
    merchant_address: Address;
    amount_per_period: Int as coins;
    period_seconds: Int as uint32;
    max_executions: Int as uint32;
    execution_count: Int as uint32;
    last_executed_at: Int as uint32;
    created_at: Int as uint32;
}

fun defaultMandateInfo(): MandateInfo {
    return MandateInfo{
        status: MANDATE_ACTIVE,
        merchant_address: newAddress(0, 0),
        amount_per_period: 0,
        period_seconds: 0,
        max_executions: 0,
        execution_count: 0,
        last_executed_at: 0,
        created_at: 0
    };
}

// ============================================
// MAIN CONTRACT
// ============================================

contract RecurringPayments {

    // Storage: composite key (hash of nft_address + mandate_id) => MandateInfo
    mandates: map<Int, MandateInfo>;

    // Storage: NFT address => owner address (for ownership verification)
    nft_owners: map<Address, Address>;

    // Deployer address — gates the test-only RegisterNFTOwnerRecurring handler.
    // INVARIANT I3: deployer cannot move funds (this contract never custodies
    // them) or override an existing owner entry.
    deployer: Address;

    init() {
        self.mandates = emptyMap();
        self.nft_owners = emptyMap();
        self.deployer = sender();
    }

    // ============================================
    // CREATE MANDATE (NFT Owner Only)
    // ============================================

    receive(msg: CreateMandate) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_RP_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.mandate_id);
            return;
        }

        // Validate amount
        if (msg.amount_per_period <= 0) {
            self.sendResponse(sender, false, ERROR_RP_INVALID_AMOUNT, msg.nft_address, msg.mandate_id);
            return;
        }

        // Validate period (minimum 1 hour)
        if (msg.period_seconds < MIN_PERIOD_SECONDS) {
            self.sendResponse(sender, false, ERROR_RP_INVALID_PERIOD, msg.nft_address, msg.mandate_id);
            return;
        }

        let current_time: Int = now();

        // Create mandate
        let mandate: MandateInfo = MandateInfo{
            status: MANDATE_ACTIVE,
            merchant_address: msg.merchant_address,
            amount_per_period: msg.amount_per_period,
            period_seconds: msg.period_seconds,
            max_executions: msg.max_executions,
            execution_count: 0,
            last_executed_at: 0,
            created_at: current_time
        };

        // Store mandate
        let key: Int = self.mandateKey(msg.nft_address, msg.mandate_id);
        self.mandates.set(key, mandate);

        // Emit event
        emit(MandateCreated{
            nft_address: msg.nft_address,
            merchant_address: msg.merchant_address,
            mandate_id: msg.mandate_id,
            amount_per_period: msg.amount_per_period,
            period_seconds: msg.period_seconds,
            max_executions: msg.max_executions,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_RP_NONE, msg.nft_address, msg.mandate_id);
    }

    // ============================================
    // CANCEL MANDATE (NFT Owner Only)
    // ============================================

    receive(msg: CancelMandate) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_RP_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.mandate_id);
            return;
        }

        // Get mandate
        let key: Int = self.mandateKey(msg.nft_address, msg.mandate_id);
        let mandate: MandateInfo? = self.mandates.get(key);
        if (mandate == null) {
            self.sendResponse(sender, false, ERROR_RP_MANDATE_NOT_FOUND, msg.nft_address, msg.mandate_id);
            return;
        }

        let m: MandateInfo = mandate!!;
        let current_time: Int = now();

        // Mark as cancelled
        let cancelled: MandateInfo = MandateInfo{
            status: MANDATE_CANCELLED,
            merchant_address: m.merchant_address,
            amount_per_period: m.amount_per_period,
            period_seconds: m.period_seconds,
            max_executions: m.max_executions,
            execution_count: m.execution_count,
            last_executed_at: m.last_executed_at,
            created_at: m.created_at
        };
        self.mandates.set(key, cancelled);

        // Emit event
        emit(MandateCancelled{
            nft_address: msg.nft_address,
            mandate_id: msg.mandate_id,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_RP_NONE, msg.nft_address, msg.mandate_id);
    }

    // ============================================
    // EXECUTE RECURRING PAYMENT
    // ============================================

    // Execute a recurring payment within mandate limits
    // Can be triggered by the mandate's merchant or the NFT owner
    // NOTE: This does NOT directly transfer funds. It emits an event
    // that the Payment Hub can observe. Actual fund transfer happens
    // through the Payment Hub contract (maintaining I1 non-custodial).
    receive(msg: ExecuteRecurringPayment) {
        let sender: Address = sender();

        // Get mandate
        let key: Int = self.mandateKey(msg.nft_address, msg.mandate_id);
        let mandate: MandateInfo? = self.mandates.get(key);
        if (mandate == null) {
            self.sendResponse(sender, false, ERROR_RP_MANDATE_NOT_FOUND, msg.nft_address, msg.mandate_id);
            return;
        }

        let m: MandateInfo = mandate!!;

        // Validate mandate is active
        if (m.status != MANDATE_ACTIVE) {
            self.sendResponse(sender, false, ERROR_RP_MANDATE_NOT_ACTIVE, msg.nft_address, msg.mandate_id);
            return;
        }

        // Validate sender is owner or merchant
        let is_owner: Bool = self.isOwner(sender, msg.nft_address);
        let is_merchant: Bool = sender == m.merchant_address;
        if (!is_owner && !is_merchant) {
            self.sendResponse(sender, false, ERROR_RP_NOT_AUTHORIZED, msg.nft_address, msg.mandate_id);
            return;
        }

        // Check max executions
        if (m.max_executions > 0 && m.execution_count >= m.max_executions) {
            self.sendResponse(sender, false, ERROR_RP_MAX_REACHED, msg.nft_address, msg.mandate_id);
            return;
        }

        let current_time: Int = now();

        // Check period elapsed (skip for first execution)
        if (m.last_executed_at > 0) {
            let next_allowed: Int = m.last_executed_at + m.period_seconds;
            if (current_time < next_allowed) {
                self.sendResponse(sender, false, ERROR_RP_TOO_EARLY, msg.nft_address, msg.mandate_id);
                return;
            }
        }

        // Update mandate state
        let new_count: Int = m.execution_count + 1;
        let new_status: Int = MANDATE_ACTIVE;

        // Check if this is the last execution
        if (m.max_executions > 0 && new_count >= m.max_executions) {
            new_status = MANDATE_COMPLETED;
        }

        let updated: MandateInfo = MandateInfo{
            status: new_status,
            merchant_address: m.merchant_address,
            amount_per_period: m.amount_per_period,
            period_seconds: m.period_seconds,
            max_executions: m.max_executions,
            execution_count: new_count,
            last_executed_at: current_time,
            created_at: m.created_at
        };
        self.mandates.set(key, updated);

        // Emit execution event (Payment Hub uses this for fund transfer)
        emit(RecurringPaymentExecuted{
            nft_address: msg.nft_address,
            merchant_address: m.merchant_address,
            mandate_id: msg.mandate_id,
            amount: m.amount_per_period,
            execution_number: new_count,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_RP_NONE, msg.nft_address, msg.mandate_id);
    }

    // ============================================
    // READ-ONLY GETTERS
    // ============================================

    get fun getMandateInfo(nft_address: Address, mandate_id: Int): MandateInfo {
        let key: Int = self.mandateKey(nft_address, mandate_id);
        let mandate: MandateInfo? = self.mandates.get(key);
        if (mandate == null) {
            return defaultMandateInfo();
        }
        return mandate!!;
    }

    get fun isMandateActive(nft_address: Address, mandate_id: Int): Bool {
        let info: MandateInfo = self.getMandateInfo(nft_address, mandate_id);
        return info.status == MANDATE_ACTIVE;
    }

    get fun getMandateExecutionCount(nft_address: Address, mandate_id: Int): Int {
        let info: MandateInfo = self.getMandateInfo(nft_address, mandate_id);
        return info.execution_count;
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    fun validateOwnership(sender: Address, nft_address: Address): Int {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return ERROR_RP_NFT_NOT_REGISTERED;
        }
        if (owner!! != sender) {
            return ERROR_RP_NOT_OWNER;
        }
        return ERROR_RP_NONE;
    }

    fun isOwner(sender: Address, nft_address: Address): Bool {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return false;
        }
        return owner!! == sender;
    }

    fun mandateKey(nft_address: Address, mandate_id: Int): Int {
        return sha256(nft_address.asSlice()) + mandate_id;
    }

    fun sendResponse(to: Address, success: Bool, error_code: Int, nft_address: Address, mandate_id: Int) {
        send(SendParameters{
            to: to,
            value: 0,
            mode: SendRemainingValue,
            body: RecurringPaymentResponse{
                success: success,
                error_code: error_code,
                nft_address: nft_address,
                mandate_id: mandate_id
            }.toCell()
        });
    }

    // ============================================
    // ADMIN FUNCTIONS (FOR TESTING ONLY)
    // ============================================
    //
    // Mitigation for cross-cutting audit finding X-1: the handler is now
    // gated behind the deployer recorded at init() and refuses to overwrite
    // an already-registered owner. It remains test-only and MUST be removed
    // (or compiled out) before mainnet.

    receive(msg: RegisterNFTOwnerRecurring) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }
}

// Test-only message
message RegisterNFTOwnerRecurring {
    nft_address: Address;
    owner: Address;
}
