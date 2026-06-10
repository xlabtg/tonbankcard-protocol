// Collateral Signal Contract
// Implementation of Issue #30 - Collateral Signal Contract (TON-Based, Non-Custodial)
// Issue #364: Add access control to NFT ownership registration before mainnet
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): This contract NEVER custodies funds or initiates transfers
// - I2 (NFT Authority): Only NFT owner can update their collateral signal state
// - I3 (No Admin Control): No admin functions can affect collateral signals
// - I6 (Lock ≠ Confiscation): Signaling does NOT lock, seize, or move any funds
//
// DESIGN PRINCIPLES (MANDATORY):
// - NEVER custody user funds
// - NEVER lock or seize assets
// - NEVER initiate transfers
// - NEVER liquidate positions
// - Strictly opt-in and user-initiated
//
// TRUST MODEL:
// - Protocol does NOT trust lenders
// - Lenders do NOT trust the protocol
// - Collateral existence is verified on-chain
// - Enforcement happens off-protocol
//
// PRODUCTION HARDENING (Issue #364):
// The previous test-only `RegisterNFTOwner` handler was gated only behind the
// deployer address recorded at init() (audit finding HIGH / cross-cutting X-1).
// That let the deployer unilaterally seed the authorisation map, so it MUST NOT
// ship to mainnet. It has been REMOVED. NFT ownership is now registered ONLY by
// the trusted on-chain NFT Account Resolver contract (`nft_resolver`, set
// immutably at init) via `receive(msg: ResolveNFTOwner)` — directly analogous to
// how MerchantPaymentHub (Issue #363) replaced the admin `SetAccountLock` handler
// with the Account-Locks-contract-gated `ApplyAccountLock`. The deployer can no
// longer register ownership, and the one-time write-once binding (CONTRACTS-M1)
// is preserved. A CI regression guard
// (`contracts/payment-hub/non-production-stubs.spec.ts`, Issue #364 block) fails
// the build if the deployer-gated `RegisterNFTOwner` handler ever reappears.

import "./types/CollateralState.tact";
import "./interfaces/ICollateralSignal.tact";

// ============================================
// MESSAGE DEFINITIONS
// ============================================

// Request to signal active collateral (only NFT owner can send)
message SignalCollateralRequest {
    nft_address: Address;             // The NFT account signaling collateral
    collateral_amount_ton: Int as coins;  // Amount of TON collateral to signal
}

// Request to update collateral signal state (only NFT owner can send)
message UpdateCollateralSignalRequest {
    nft_address: Address;             // The NFT account to update
    new_state: Int as uint8;          // New signal state (NONE, ACTIVE, WARNING, RELEASED)
    collateral_amount_ton: Int as coins;  // Updated collateral amount (optional, can be 0)
}

// Request to release/clear collateral signal (only NFT owner can send)
message ReleaseCollateralSignalRequest {
    nft_address: Address;             // The NFT account to release signal from
}

// Response message for all collateral signal operations
message CollateralSignalResponse {
    success: Bool;
    error_code: Int as uint8;
    nft_address: Address;
    signal_state: Int as uint8;
}

// ============================================
// EVENTS (for indexing)
// ============================================

// Emitted when collateral is signaled
message CollateralSignaled {
    nft_address: Address;
    collateral_amount_ton: Int as coins;
    timestamp: Int as uint32;
}

// Emitted when collateral signal state changes
message CollateralSignalUpdated {
    nft_address: Address;
    previous_state: Int as uint8;
    new_state: Int as uint8;
    collateral_amount_ton: Int as coins;
    timestamp: Int as uint32;
}

// Emitted when collateral signal is released
message CollateralSignalReleased {
    nft_address: Address;
    previous_amount_ton: Int as coins;
    timestamp: Int as uint32;
}

// ============================================
// ERROR CODES
// ============================================

const ERROR_CS_NONE: Int = 0;
const ERROR_CS_NOT_OWNER: Int = 1;           // Sender is not the NFT owner
const ERROR_CS_INVALID_STATE: Int = 2;       // Invalid signal state value
const ERROR_CS_INVALID_AMOUNT: Int = 3;      // Invalid collateral amount (negative)
const ERROR_CS_ALREADY_ACTIVE: Int = 4;      // Signal already active (optional warning)
const ERROR_CS_NO_SIGNAL: Int = 5;           // No signal exists to update/release
const ERROR_CS_NFT_NOT_REGISTERED: Int = 6;  // NFT is not registered with this contract

// ============================================
// MAIN CONTRACT
// ============================================

contract CollateralSignal with ICollateralSignal {

    // Storage: NFT address => CollateralSignalInfo
    collateral_signals: map<Address, CollateralSignalInfo>;

    // Storage: NFT address => owner address (for ownership verification)
    nft_owners: map<Address, Address>;

    // The trusted on-chain NFT Account Resolver contract authorised to register
    // NFT ownership via ResolveNFTOwner. Set ONCE at init() and never mutated.
    // INVARIANT I3 (No Admin Control): this address cannot move funds or change
    // collateral signal state — it can only bind an NFT to its resolved owner
    // (write-once). The deployer has NO ownership-registration path (Issue #364).
    nft_resolver: Address;

    // @param nft_resolver  the on-chain NFT Account Resolver contract whose
    //                      resolved-owner callbacks (ResolveNFTOwner) this contract
    //                      trusts. Immutable for the lifetime of the contract.
    init(nft_resolver: Address) {
        self.collateral_signals = emptyMap();
        self.nft_owners = emptyMap();
        self.nft_resolver = nft_resolver;
    }

    // ============================================
    // SIGNAL COLLATERAL (NFT Owner Only)
    // ============================================

    // Signal active collateral for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can signal, no fund custody
    receive(msg: SignalCollateralRequest) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_CS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Validate amount (must be non-negative)
        if (msg.collateral_amount_ton < 0) {
            self.sendResponse(sender, false, ERROR_CS_INVALID_AMOUNT, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Get existing signal info (or default)
        let existing_info: CollateralSignalInfo = self.getCollateralSignalInfo(msg.nft_address);
        let previous_state: Int = existing_info.signal_state;
        let current_time: Int = now();

        // Create new signal info
        let new_info: CollateralSignalInfo = CollateralSignalInfo{
            signal_state: COLLATERAL_SIGNAL_ACTIVE,
            collateral_amount_ton: msg.collateral_amount_ton,
            created_at: existing_info.created_at == 0 ? current_time : existing_info.created_at,
            updated_at: current_time
        };

        // Store signal
        self.collateral_signals.set(msg.nft_address, new_info);

        // Emit event: CollateralSignaled
        emit(CollateralSignaled{
            nft_address: msg.nft_address,
            collateral_amount_ton: msg.collateral_amount_ton,
            timestamp: current_time
        }.toCell());

        // If state changed, also emit update event
        if (previous_state != COLLATERAL_SIGNAL_ACTIVE) {
            emit(CollateralSignalUpdated{
                nft_address: msg.nft_address,
                previous_state: previous_state,
                new_state: COLLATERAL_SIGNAL_ACTIVE,
                collateral_amount_ton: msg.collateral_amount_ton,
                timestamp: current_time
            }.toCell());
        }

        // Send success response
        self.sendResponse(sender, true, ERROR_CS_NONE, msg.nft_address, COLLATERAL_SIGNAL_ACTIVE);
    }

    // ============================================
    // UPDATE COLLATERAL SIGNAL (NFT Owner Only)
    // ============================================

    // Update collateral signal state for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can update, no fund custody
    receive(msg: UpdateCollateralSignalRequest) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_CS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Validate new state
        if (msg.new_state < COLLATERAL_SIGNAL_NONE || msg.new_state > COLLATERAL_SIGNAL_RELEASED) {
            self.sendResponse(sender, false, ERROR_CS_INVALID_STATE, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Validate amount (must be non-negative)
        if (msg.collateral_amount_ton < 0) {
            self.sendResponse(sender, false, ERROR_CS_INVALID_AMOUNT, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Get existing signal info
        let existing_info: CollateralSignalInfo = self.getCollateralSignalInfo(msg.nft_address);
        let previous_state: Int = existing_info.signal_state;
        let current_time: Int = now();

        // Create updated signal info
        let new_info: CollateralSignalInfo = CollateralSignalInfo{
            signal_state: msg.new_state,
            collateral_amount_ton: msg.collateral_amount_ton,
            created_at: existing_info.created_at == 0 ? current_time : existing_info.created_at,
            updated_at: current_time
        };

        // Store updated signal
        self.collateral_signals.set(msg.nft_address, new_info);

        // Emit event: CollateralSignalUpdated
        emit(CollateralSignalUpdated{
            nft_address: msg.nft_address,
            previous_state: previous_state,
            new_state: msg.new_state,
            collateral_amount_ton: msg.collateral_amount_ton,
            timestamp: current_time
        }.toCell());

        // Send success response
        self.sendResponse(sender, true, ERROR_CS_NONE, msg.nft_address, msg.new_state);
    }

    // ============================================
    // RELEASE COLLATERAL SIGNAL (NFT Owner Only)
    // ============================================

    // Release/clear collateral signal for an NFT account
    // INVARIANT I1 & I2: Only NFT owner can release, no fund custody
    receive(msg: ReleaseCollateralSignalRequest) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_CS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, COLLATERAL_SIGNAL_NONE);
            return;
        }

        // Get existing signal info
        let existing_info: CollateralSignalInfo = self.getCollateralSignalInfo(msg.nft_address);
        let previous_state: Int = existing_info.signal_state;
        let previous_amount: Int = existing_info.collateral_amount_ton;
        let current_time: Int = now();

        // Create released signal info
        let new_info: CollateralSignalInfo = CollateralSignalInfo{
            signal_state: COLLATERAL_SIGNAL_RELEASED,
            collateral_amount_ton: 0,
            created_at: existing_info.created_at,
            updated_at: current_time
        };

        // Store updated signal
        self.collateral_signals.set(msg.nft_address, new_info);

        // Emit event: CollateralSignalReleased
        emit(CollateralSignalReleased{
            nft_address: msg.nft_address,
            previous_amount_ton: previous_amount,
            timestamp: current_time
        }.toCell());

        // If state changed, also emit update event
        if (previous_state != COLLATERAL_SIGNAL_RELEASED) {
            emit(CollateralSignalUpdated{
                nft_address: msg.nft_address,
                previous_state: previous_state,
                new_state: COLLATERAL_SIGNAL_RELEASED,
                collateral_amount_ton: 0,
                timestamp: current_time
            }.toCell());
        }

        // Send success response
        self.sendResponse(sender, true, ERROR_CS_NONE, msg.nft_address, COLLATERAL_SIGNAL_RELEASED);
    }

    // ============================================
    // READ-ONLY INTERFACE IMPLEMENTATION
    // ============================================

    // Get the full collateral signal information for an NFT account
    // `override`: implements the abstract getter declared in trait ICollateralSignal.
    override get fun getCollateralSignalInfo(nft_address: Address): CollateralSignalInfo {
        let info: CollateralSignalInfo? = self.collateral_signals.get(nft_address);
        if (info == null) {
            return defaultCollateralSignalInfo();
        }
        return info!!;
    }

    // Get the current collateral signal state for an NFT account
    // `override`: implements the abstract getter declared in trait ICollateralSignal.
    override get fun getCollateralSignalState(nft_address: Address): Int {
        let info: CollateralSignalInfo = self.getCollateralSignalInfo(nft_address);
        return info.signal_state;
    }

    // Get the signaled collateral amount for an NFT account
    // `override`: implements the abstract getter declared in trait ICollateralSignal.
    override get fun getSignaledCollateralAmount(nft_address: Address): Int {
        let info: CollateralSignalInfo = self.getCollateralSignalInfo(nft_address);
        return info.collateral_amount_ton;
    }

    // Check if an NFT account has active collateral signaled
    // `override`: implements the abstract getter declared in trait ICollateralSignal.
    override get fun hasActiveCollateralSignal(nft_address: Address): Bool {
        let info: CollateralSignalInfo = self.getCollateralSignalInfo(nft_address);
        return hasActiveSignal(info.signal_state);
    }

    // Expose the immutable NFT Account Resolver address so deploy/verify tooling
    // can confirm the only authorised ownership-registration authority (Issue #364).
    get fun getNFTResolver(): Address {
        return self.nft_resolver;
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    // Validate that sender is the owner of the NFT
    fun validateOwnership(sender: Address, nft_address: Address): Int {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return ERROR_CS_NFT_NOT_REGISTERED;
        }
        if (owner!! != sender) {
            return ERROR_CS_NOT_OWNER;
        }
        return ERROR_CS_NONE;
    }

    // Send response to caller
    fun sendResponse(to: Address, success: Bool, error_code: Int, nft_address: Address, signal_state: Int) {
        send(SendParameters{
            to: to,
            value: 0,
            mode: SendRemainingValue,
            body: CollateralSignalResponse{
                success: success,
                error_code: error_code,
                nft_address: nft_address,
                signal_state: signal_state
            }.toCell()
        });
    }

    // ============================================
    // NFT OWNERSHIP REGISTRATION (NFT Account Resolver only)
    // ============================================

    // Register the resolved owner of an NFT account (Issue #364).
    //
    // INVARIANT I2 (NFT Authority) & I3 (No Admin Control): ownership is bound by
    // the trusted on-chain NFT Account Resolver ONLY — never by the deployer or an
    // arbitrary sender. The resolver verifies real NFT ownership outside this
    // contract (synchronous cross-contract owner resolution is impossible on TON;
    // see audit CONTRACTS-H3 / #260) and pushes the result here. This handler
    // neither moves funds nor changes any collateral signal state.
    //
    // The binding is write-once (CONTRACTS-M1 / #279): once an NFT is bound to an
    // owner it cannot be silently re-pointed, so even a buggy resolver cannot
    // hijack an existing collateral signal.
    receive(msg: ResolveNFTOwner) {
        require(sender() == self.nft_resolver, "Unauthorized: only NFT resolver");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);

        emit(NFTOwnerRegistered{
            nft_address: msg.nft_address,
            owner: msg.owner,
            timestamp: now()
        }.toCell());
    }
}

// ============================================
// NFT OWNERSHIP RESOLUTION MESSAGES
// ============================================

// Sent by the trusted NFT Account Resolver to bind an NFT account to its
// resolved owner (Issue #364). Accepted ONLY from `nft_resolver`; write-once.
message ResolveNFTOwner {
    nft_address: Address;
    owner: Address;
}

// Emitted (for indexers) when an NFT account is bound to its resolved owner.
message NFTOwnerRegistered {
    nft_address: Address;
    owner: Address;
    timestamp: Int as uint32;
}
