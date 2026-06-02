// Multi-Signature Card Contract
// Implementation of Phase 4 - Multi-Signature Cards
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I1 (Non-Custodial): This contract NEVER custodies funds
// - I2 (NFT Authority): NFT ownership combined with multi-sig determines account authority
// - I3 (No Admin Control): No admin functions can bypass multi-sig requirements
// - I4 (Atomic Transfers): All multi-sig operations complete fully or revert
//
// DESIGN PRINCIPLES (MANDATORY):
// - Multi-sig is a PERMISSION LAYER, not a custodial mechanism
// - Signers are co-signers, NOT custodians
// - The NFT owner ALWAYS remains the primary authority
// - Multi-sig can only ADD requirements, never REMOVE owner control
// - All operations require owner consent plus required co-signers
//
// TRUST MODEL:
// - NFT owner initiates all proposals
// - Co-signers approve/reject but cannot initiate
// - Protocol enforces signature threshold
// - No single co-signer can block fund access permanently

// Note: ownership is tracked locally via the `nft_owners` map (populated by the
// test-only RegisterNFTOwnerMultiSig handler), so no external NFT resolver
// trait is imported here.

// ============================================
// MESSAGE DEFINITIONS
// ============================================

// Configure multi-sig for an NFT card (only NFT owner)
message ConfigureMultiSig {
    nft_address: Address;
    required_signatures: Int as uint8;    // Number of required co-signatures (1-5)
    signer_1: Address;                     // First co-signer address
    signer_2: Address;                     // Second co-signer (zero address if unused)
    signer_3: Address;                     // Third co-signer (zero address if unused)
}

// Submit a payment proposal (only NFT owner)
message SubmitPaymentProposal {
    nft_address: Address;
    proposal_id: Int as uint64;           // Unique proposal ID
    recipient: Address;                    // Payment recipient
    amount: Int as coins;                  // Payment amount
}

// Approve a payment proposal (only registered co-signer)
message ApprovePaymentProposal {
    nft_address: Address;
    proposal_id: Int as uint64;
}

// Reject a payment proposal (only registered co-signer or owner)
message RejectPaymentProposal {
    nft_address: Address;
    proposal_id: Int as uint64;
}

// Execute an APPROVED payment proposal (only NFT owner).
//
// INVARIANT I1 (Non-Custodial): fund movement is ALWAYS owner-initiated. The
// owner attaches the payment value to this message and the contract forwards
// exactly `amount` to the recipient in the same transaction — the contract
// never custodies funds, it only gates the transfer behind multi-sig approval.
message ExecutePaymentProposal {
    nft_address: Address;
    proposal_id: Int as uint64;
}

// Remove multi-sig configuration (only NFT owner)
message RemoveMultiSig {
    nft_address: Address;
}

// Response message for multi-sig operations
message MultiSigResponse {
    success: Bool;
    error_code: Int as uint8;
    nft_address: Address;
    proposal_id: Int as uint64;
}

// ============================================
// EVENTS (for indexing)
// ============================================

message MultiSigConfigured {
    nft_address: Address;
    required_signatures: Int as uint8;
    timestamp: Int as uint32;
}

message PaymentProposalCreated {
    nft_address: Address;
    proposal_id: Int as uint64;
    recipient: Address;
    amount: Int as coins;
    timestamp: Int as uint32;
}

message PaymentProposalApproved {
    nft_address: Address;
    proposal_id: Int as uint64;
    approver: Address;
    approval_count: Int as uint8;
    timestamp: Int as uint32;
}

message PaymentProposalRejected {
    nft_address: Address;
    proposal_id: Int as uint64;
    timestamp: Int as uint32;
}

message PaymentProposalExecuted {
    nft_address: Address;
    proposal_id: Int as uint64;
    recipient: Address;
    amount: Int as coins;
    timestamp: Int as uint32;
}

message MultiSigRemoved {
    nft_address: Address;
    timestamp: Int as uint32;
}

// ============================================
// CONSTANTS
// ============================================

const PROPOSAL_PENDING: Int = 0;
const PROPOSAL_APPROVED: Int = 1;
const PROPOSAL_REJECTED: Int = 2;
const PROPOSAL_EXECUTED: Int = 3;

const ERROR_MS_NONE: Int = 0;
const ERROR_MS_NOT_OWNER: Int = 1;
const ERROR_MS_NOT_SIGNER: Int = 2;
const ERROR_MS_INVALID_THRESHOLD: Int = 3;
const ERROR_MS_PROPOSAL_NOT_FOUND: Int = 4;
const ERROR_MS_ALREADY_APPROVED: Int = 5;
const ERROR_MS_PROPOSAL_NOT_PENDING: Int = 6;
const ERROR_MS_NFT_NOT_REGISTERED: Int = 7;
const ERROR_MS_NO_CONFIG: Int = 8;
const ERROR_MS_INVALID_AMOUNT: Int = 9;
const ERROR_MS_PROPOSAL_NOT_APPROVED: Int = 10;
const ERROR_MS_INSUFFICIENT_VALUE: Int = 11;

const MAX_SIGNERS: Int = 3;

// ============================================
// DATA STRUCTURES
// ============================================

struct MultiSigConfig {
    is_active: Bool;
    required_signatures: Int as uint8;
    signer_1: Address;
    signer_2: Address;
    signer_3: Address;
    created_at: Int as uint32;
}

struct PaymentProposal {
    status: Int as uint8;
    recipient: Address;
    amount: Int as coins;
    approval_count: Int as uint8;
    created_at: Int as uint32;
}

fun defaultMultiSigConfig(): MultiSigConfig {
    return MultiSigConfig{
        is_active: false,
        required_signatures: 0,
        signer_1: newAddress(0, 0),
        signer_2: newAddress(0, 0),
        signer_3: newAddress(0, 0),
        created_at: 0
    };
}

fun defaultPaymentProposal(): PaymentProposal {
    return PaymentProposal{
        status: PROPOSAL_PENDING,
        recipient: newAddress(0, 0),
        amount: 0,
        approval_count: 0,
        created_at: 0
    };
}

// ============================================
// MAIN CONTRACT
// ============================================

contract MultiSigCard {

    // Storage: NFT address => MultiSigConfig
    multisig_configs: map<Address, MultiSigConfig>;

    // Storage: composite key (hash of nft_address + proposal_id) => PaymentProposal
    proposals: map<Int, PaymentProposal>;

    // Storage: composite key (hash of nft_address + proposal_id + signer) => has approved
    approvals: map<Int, Bool>;

    // Storage: NFT address => owner address (for ownership verification)
    nft_owners: map<Address, Address>;

    // Deployer address — gates the test-only RegisterNFTOwnerMultiSig handler.
    // INVARIANT I3: deployer cannot bypass the multi-sig flow or move funds.
    deployer: Address;

    init() {
        self.multisig_configs = emptyMap();
        self.proposals = emptyMap();
        self.approvals = emptyMap();
        self.nft_owners = emptyMap();
        self.deployer = sender();
    }

    // ============================================
    // CONFIGURE MULTI-SIG (NFT Owner Only)
    // ============================================

    receive(msg: ConfigureMultiSig) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_MS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, 0);
            return;
        }

        // Validate threshold (1-3 co-signers required)
        if (msg.required_signatures < 1 || msg.required_signatures > MAX_SIGNERS) {
            self.sendResponse(sender, false, ERROR_MS_INVALID_THRESHOLD, msg.nft_address, 0);
            return;
        }

        let current_time: Int = now();

        // Create config
        let config: MultiSigConfig = MultiSigConfig{
            is_active: true,
            required_signatures: msg.required_signatures,
            signer_1: msg.signer_1,
            signer_2: msg.signer_2,
            signer_3: msg.signer_3,
            created_at: current_time
        };

        self.multisig_configs.set(msg.nft_address, config);

        // Emit event
        emit(MultiSigConfigured{
            nft_address: msg.nft_address,
            required_signatures: msg.required_signatures,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_MS_NONE, msg.nft_address, 0);
    }

    // ============================================
    // SUBMIT PAYMENT PROPOSAL (NFT Owner Only)
    // ============================================

    receive(msg: SubmitPaymentProposal) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_MS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.proposal_id);
            return;
        }

        // Validate amount
        if (msg.amount <= 0) {
            self.sendResponse(sender, false, ERROR_MS_INVALID_AMOUNT, msg.nft_address, msg.proposal_id);
            return;
        }

        // Check multi-sig is configured
        let config: MultiSigConfig = self.getMultiSigConfig(msg.nft_address);
        if (!config.is_active) {
            self.sendResponse(sender, false, ERROR_MS_NO_CONFIG, msg.nft_address, msg.proposal_id);
            return;
        }

        let current_time: Int = now();

        // Create proposal
        let proposal: PaymentProposal = PaymentProposal{
            status: PROPOSAL_PENDING,
            recipient: msg.recipient,
            amount: msg.amount,
            approval_count: 0,
            created_at: current_time
        };

        // Store using composite key
        let proposal_key: Int = self.proposalKey(msg.nft_address, msg.proposal_id);
        self.proposals.set(proposal_key, proposal);

        // Emit event
        emit(PaymentProposalCreated{
            nft_address: msg.nft_address,
            proposal_id: msg.proposal_id,
            recipient: msg.recipient,
            amount: msg.amount,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_MS_NONE, msg.nft_address, msg.proposal_id);
    }

    // ============================================
    // APPROVE PAYMENT PROPOSAL (Co-signer Only)
    // ============================================

    receive(msg: ApprovePaymentProposal) {
        let sender: Address = sender();

        // Validate sender is a registered signer for this NFT
        let config: MultiSigConfig = self.getMultiSigConfig(msg.nft_address);
        if (!config.is_active) {
            self.sendResponse(sender, false, ERROR_MS_NO_CONFIG, msg.nft_address, msg.proposal_id);
            return;
        }

        if (!self.isSigner(sender, config)) {
            self.sendResponse(sender, false, ERROR_MS_NOT_SIGNER, msg.nft_address, msg.proposal_id);
            return;
        }

        // Get proposal
        let proposal_key: Int = self.proposalKey(msg.nft_address, msg.proposal_id);
        let proposal: PaymentProposal? = self.proposals.get(proposal_key);
        if (proposal == null) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_FOUND, msg.nft_address, msg.proposal_id);
            return;
        }

        let p: PaymentProposal = proposal!!;
        if (p.status != PROPOSAL_PENDING) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_PENDING, msg.nft_address, msg.proposal_id);
            return;
        }

        // Check if already approved by this signer
        let approval_key: Int = self.approvalKey(msg.nft_address, msg.proposal_id, sender);
        let already_approved: Bool? = self.approvals.get(approval_key);
        if (already_approved != null && already_approved!!) {
            self.sendResponse(sender, false, ERROR_MS_ALREADY_APPROVED, msg.nft_address, msg.proposal_id);
            return;
        }

        // Record approval
        self.approvals.set(approval_key, true);
        let new_count: Int = p.approval_count + 1;

        let current_time: Int = now();

        // Check if threshold reached
        if (new_count >= config.required_signatures) {
            // Mark as approved
            let approved_proposal: PaymentProposal = PaymentProposal{
                status: PROPOSAL_APPROVED,
                recipient: p.recipient,
                amount: p.amount,
                approval_count: new_count,
                created_at: p.created_at
            };
            self.proposals.set(proposal_key, approved_proposal);

            // Emit approval event
            emit(PaymentProposalApproved{
                nft_address: msg.nft_address,
                proposal_id: msg.proposal_id,
                approver: sender,
                approval_count: new_count,
                timestamp: current_time
            }.toCell());
        } else {
            // Update count
            let updated_proposal: PaymentProposal = PaymentProposal{
                status: PROPOSAL_PENDING,
                recipient: p.recipient,
                amount: p.amount,
                approval_count: new_count,
                created_at: p.created_at
            };
            self.proposals.set(proposal_key, updated_proposal);

            // Emit approval event
            emit(PaymentProposalApproved{
                nft_address: msg.nft_address,
                proposal_id: msg.proposal_id,
                approver: sender,
                approval_count: new_count,
                timestamp: current_time
            }.toCell());
        }

        self.sendResponse(sender, true, ERROR_MS_NONE, msg.nft_address, msg.proposal_id);
    }

    // ============================================
    // REJECT PAYMENT PROPOSAL (Owner or Co-signer)
    // ============================================

    receive(msg: RejectPaymentProposal) {
        let sender: Address = sender();

        // Validate sender is owner or signer
        let is_owner: Bool = self.isOwner(sender, msg.nft_address);
        let config: MultiSigConfig = self.getMultiSigConfig(msg.nft_address);
        let is_signer: Bool = self.isSigner(sender, config);

        if (!is_owner && !is_signer) {
            self.sendResponse(sender, false, ERROR_MS_NOT_SIGNER, msg.nft_address, msg.proposal_id);
            return;
        }

        // Get proposal
        let proposal_key: Int = self.proposalKey(msg.nft_address, msg.proposal_id);
        let proposal: PaymentProposal? = self.proposals.get(proposal_key);
        if (proposal == null) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_FOUND, msg.nft_address, msg.proposal_id);
            return;
        }

        let p: PaymentProposal = proposal!!;
        if (p.status != PROPOSAL_PENDING) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_PENDING, msg.nft_address, msg.proposal_id);
            return;
        }

        let current_time: Int = now();

        // Mark as rejected
        let rejected_proposal: PaymentProposal = PaymentProposal{
            status: PROPOSAL_REJECTED,
            recipient: p.recipient,
            amount: p.amount,
            approval_count: p.approval_count,
            created_at: p.created_at
        };
        self.proposals.set(proposal_key, rejected_proposal);

        // Emit event
        emit(PaymentProposalRejected{
            nft_address: msg.nft_address,
            proposal_id: msg.proposal_id,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_MS_NONE, msg.nft_address, msg.proposal_id);
    }

    // ============================================
    // EXECUTE PAYMENT PROPOSAL (NFT Owner Only)
    // ============================================
    //
    // Closes the multi-sig lifecycle: an APPROVED proposal is carried out by
    // forwarding the approved `amount` to the recipient, emitting
    // PaymentProposalExecuted, and moving the proposal to the terminal
    // PROPOSAL_EXECUTED state.
    //
    // INVARIANT I1 (Non-Custodial): only the NFT owner can execute, and the
    // funds are supplied by the owner with this very message — the contract
    // forwards them atomically and never holds user funds.
    // INVARIANT I4 (Atomic): the state transition happens before the outgoing
    // transfer, and an insufficient-value execution is rejected up-front, so a
    // proposal is either fully executed (once) or not at all.

    receive(msg: ExecutePaymentProposal) {
        let sender: Address = sender();

        // Only the NFT owner may move funds (I1).
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_MS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, msg.proposal_id);
            return;
        }

        // Get proposal
        let proposal_key: Int = self.proposalKey(msg.nft_address, msg.proposal_id);
        let proposal: PaymentProposal? = self.proposals.get(proposal_key);
        if (proposal == null) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_FOUND, msg.nft_address, msg.proposal_id);
            return;
        }

        let p: PaymentProposal = proposal!!;

        // Only APPROVED proposals can be executed. This single check also makes
        // double execution impossible: after the first execution the status is
        // PROPOSAL_EXECUTED, so a second attempt is rejected here.
        if (p.status != PROPOSAL_APPROVED) {
            self.sendResponse(sender, false, ERROR_MS_PROPOSAL_NOT_APPROVED, msg.nft_address, msg.proposal_id);
            return;
        }

        // The owner must fund the payment with this message (non-custodial:
        // the contract owns no user balance to draw from).
        if (context().value < p.amount) {
            self.sendResponse(sender, false, ERROR_MS_INSUFFICIENT_VALUE, msg.nft_address, msg.proposal_id);
            return;
        }

        let current_time: Int = now();

        // Transition to the terminal EXECUTED state BEFORE forwarding funds so
        // the proposal can never be replayed (I4).
        let executed_proposal: PaymentProposal = PaymentProposal{
            status: PROPOSAL_EXECUTED,
            recipient: p.recipient,
            amount: p.amount,
            approval_count: p.approval_count,
            created_at: p.created_at
        };
        self.proposals.set(proposal_key, executed_proposal);

        // Forward an out-message carrying exactly `amount` to the recipient.
        // SendPayGasSeparately pays the forward fee on top of (not out of) the
        // message value, so the full `amount` is delivered; bounce: false
        // because the payment is final and must not be reversed on the card.
        send(SendParameters{
            to: p.recipient,
            value: p.amount,
            mode: SendPayGasSeparately,
            bounce: false,
            body: PaymentProposalExecuted{
                nft_address: msg.nft_address,
                proposal_id: msg.proposal_id,
                recipient: p.recipient,
                amount: p.amount,
                timestamp: current_time
            }.toCell()
        });

        // Emit execution event for off-chain indexers.
        emit(PaymentProposalExecuted{
            nft_address: msg.nft_address,
            proposal_id: msg.proposal_id,
            recipient: p.recipient,
            amount: p.amount,
            timestamp: current_time
        }.toCell());

        // Refund the unused gas to the owner and acknowledge success. The
        // recipient payment above already committed exactly `amount`; this
        // best-effort notification carries whatever incoming value is left.
        // SendIgnoreErrors guarantees that, should the leftover be too small to
        // cover its own forward fee, the action is simply skipped instead of
        // aborting the whole action phase and reverting the payment.
        send(SendParameters{
            to: sender,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: MultiSigResponse{
                success: true,
                error_code: ERROR_MS_NONE,
                nft_address: msg.nft_address,
                proposal_id: msg.proposal_id
            }.toCell()
        });
    }

    // ============================================
    // REMOVE MULTI-SIG (NFT Owner Only)
    // ============================================

    receive(msg: RemoveMultiSig) {
        let sender: Address = sender();

        // Validate ownership
        let error_code: Int = self.validateOwnership(sender, msg.nft_address);
        if (error_code != ERROR_MS_NONE) {
            self.sendResponse(sender, false, error_code, msg.nft_address, 0);
            return;
        }

        let current_time: Int = now();

        // Deactivate config
        self.multisig_configs.set(msg.nft_address, defaultMultiSigConfig());

        // Emit event
        emit(MultiSigRemoved{
            nft_address: msg.nft_address,
            timestamp: current_time
        }.toCell());

        self.sendResponse(sender, true, ERROR_MS_NONE, msg.nft_address, 0);
    }

    // ============================================
    // READ-ONLY GETTERS
    // ============================================

    get fun getMultiSigConfig(nft_address: Address): MultiSigConfig {
        let config: MultiSigConfig? = self.multisig_configs.get(nft_address);
        if (config == null) {
            return defaultMultiSigConfig();
        }
        return config!!;
    }

    get fun isMultiSigEnabled(nft_address: Address): Bool {
        let config: MultiSigConfig = self.getMultiSigConfig(nft_address);
        return config.is_active;
    }

    get fun getProposalStatus(nft_address: Address, proposal_id: Int): Int {
        let key: Int = self.proposalKey(nft_address, proposal_id);
        let proposal: PaymentProposal? = self.proposals.get(key);
        if (proposal == null) {
            return PROPOSAL_PENDING;
        }
        return proposal!!.status;
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    fun validateOwnership(sender: Address, nft_address: Address): Int {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return ERROR_MS_NFT_NOT_REGISTERED;
        }
        if (owner!! != sender) {
            return ERROR_MS_NOT_OWNER;
        }
        return ERROR_MS_NONE;
    }

    fun isOwner(sender: Address, nft_address: Address): Bool {
        let owner: Address? = self.nft_owners.get(nft_address);
        if (owner == null) {
            return false;
        }
        return owner!! == sender;
    }

    fun isSigner(sender: Address, config: MultiSigConfig): Bool {
        if (sender == config.signer_1) { return true; }
        if (sender == config.signer_2) { return true; }
        if (sender == config.signer_3) { return true; }
        return false;
    }

    fun proposalKey(nft_address: Address, proposal_id: Int): Int {
        // Composite key = representation hash of a cell packing the NFT address
        // and proposal ID.
        //
        // NOTE: the previous implementation used `sha256(nft_address.asSlice())`
        // and added hashes together. That was doubly broken on-chain:
        //   1. sha256() over an Address slice (267 bits, not byte-aligned) throws
        //      a cell-underflow (exit 9), so every proposal handler reverted; and
        //   2. summing two 256-bit hashes overflows TVM's 257-bit signed integer
        //      range (exit 4) and is collision-prone.
        // Hashing a single packed cell avoids both: Cell.hash() always returns a
        // 256-bit value that fits the integer range and uniquely binds all fields.
        return beginCell()
            .storeAddress(nft_address)
            .storeUint(proposal_id, 64)
            .endCell()
            .hash();
    }

    fun approvalKey(nft_address: Address, proposal_id: Int, signer: Address): Int {
        // Composite key binding NFT address, proposal ID and signer. See
        // proposalKey() for why a packed-cell hash is used instead of summing
        // sha256() values.
        return beginCell()
            .storeAddress(nft_address)
            .storeUint(proposal_id, 64)
            .storeAddress(signer)
            .endCell()
            .hash();
    }

    fun sendResponse(to: Address, success: Bool, error_code: Int, nft_address: Address, proposal_id: Int) {
        send(SendParameters{
            to: to,
            value: 0,
            mode: SendRemainingValue,
            body: MultiSigResponse{
                success: success,
                error_code: error_code,
                nft_address: nft_address,
                proposal_id: proposal_id
            }.toCell()
        });
    }

    // ============================================
    // ADMIN FUNCTIONS (FOR TESTING ONLY)
    // ============================================
    //
    // Mitigation for audit finding C-MSC-C1 / cross-cutting X-1: the handler
    // is now gated behind the deployer recorded at init() and refuses to
    // overwrite an already-registered owner. It remains test-only and MUST be
    // removed (or compiled out) before mainnet.

    receive(msg: RegisterNFTOwnerMultiSig) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }
}

// Test-only message
message RegisterNFTOwnerMultiSig {
    nft_address: Address;
    owner: Address;
}
