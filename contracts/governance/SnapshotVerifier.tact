// Snapshot Verifier (Issue #38)
// Purpose: Verify NFT ownership at snapshot time for governance voting
// Security: Read-only, no state modifications, no execution authority
//
// IMPORTANT: This verifier is for ADVISORY governance only. It cannot:
// - Trigger contract calls
// - Execute changes
// - Enforce outcomes
//
// SENDER AUTHENTICATION (Issue #370 / PC-01 — HIGH, blocks mainnet):
// - The eligibility roll is the single source of truth ProposalRegistry
//   consults when deciding whether an NFT may vote. The state-mutating
//   `receive(msg: RegisterSnapshot)` handler therefore accepts a snapshot
//   ONLY from the trusted indexer configured by the deployer. Until that
//   indexer is configured the handler fails closed (rejects every snapshot),
//   so a forged eligibility roll can never be injected — not even in the
//   window between deployment and indexer configuration.
// - The `deployer` is a CONFIGURATION authority only: it designates which
//   off-chain indexer address may register snapshots and performs the
//   one-time `SetProposalRegistry` binding. It CANNOT itself forge a snapshot — it
//   never appears in the `RegisterSnapshot` authorization check unless it is
//   also explicitly named as the trusted indexer. In production the deployer
//   MUST be the governance multi-sig (see docs/governance/E1-activation/).

import "@stdlib/deploy";

// ==================== CONSTANTS ====================

// Error codes
const ERROR_SNAPSHOT_NOT_FOUND: Int = 200;
const ERROR_INVALID_NFT_ID: Int = 201;
const ERROR_SNAPSHOT_ALREADY_EXISTS: Int = 202;
const ERROR_INVALID_PROPOSAL_ID: Int = 203;

// TBC Diamonds total supply
const DIAMONDS_TOTAL_SUPPLY: Int = 222;

// ==================== DATA STRUCTURES ====================

// Snapshot data for a proposal
struct Snapshot {
    proposal_id: Int as uint64;           // Proposal this snapshot is for
    timestamp: Int as uint64;             // Snapshot timestamp
    eligible_count: Int as uint64;        // Number of eligible voters at snapshot
}

// Register snapshot message (called ONLY by the trusted indexer — Issue #370)
message RegisterSnapshot {
    proposal_id: Int as uint64;           // Proposal ID
    timestamp: Int as uint64;             // Snapshot timestamp
    eligible_nfts: map<Int, Bool>;        // Map of NFT IDs eligible to vote
}

// Deployer-only configuration message (Issue #370): designate / rotate the
// off-chain indexer address authorized to send RegisterSnapshot. This does
// NOT register any snapshot itself — it only (re)assigns the trusted-writer
// slot (mirrors ProposalRegistry.SetSnapshotVerifier).
message SetTrustedIndexer {
    indexer: Address;                     // Address allowed to register snapshots
}

// Deployer-only, write-once binding to the actual ProposalRegistry contract.
// The address must be carried in the message: using sender() here would always
// persist the deployer/configuration authority instead of the registry.
message SetProposalRegistry {
    registry: Address;
}

// Verify eligibility request
message VerifyEligibility {
    proposal_id: Int as uint64;           // Proposal ID
    nft_id: Int as uint64;                // NFT ID to verify
}

// Asynchronous eligibility check request from the proposal registry.
message EligibilityCheckRequest {
    query_id: Int as uint64;              // Correlates the request with its reply
    proposal_id: Int as uint64;           // Proposal ID
    nft_id: Int as uint64;                // NFT ID to verify
}

// Asynchronous eligibility check response returned to the requester.
message EligibilityCheckResponse {
    query_id: Int as uint64;              // Echoes the request's query_id
    proposal_id: Int as uint64;           // Echoes the request's proposal_id
    nft_id: Int as uint64;                // Echoes the request's nft_id
    eligible: Bool;                       // Fail-closed eligibility result
}

// ==================== EVENTS ====================

// Emitted when snapshot is registered
message SnapshotRegistered {
    proposal_id: Int as uint64;
    timestamp: Int as uint64;
    eligible_count: Int as uint64;
}

// Emitted whenever the trusted-indexer slot is (re)assigned (Issue #370) so
// off-chain indexers can audit the authorization history.
message TrustedIndexerUpdated {
    indexer: Address;
    timestamp: Int as uint32;
}

// ==================== CONTRACT ====================

contract SnapshotVerifier with Deployable {

    // TBC Diamonds NFT collection address
    const DIAMONDS_COLLECTION: Address = address("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

    // Configuration authority captured at init() (the deployer / governance
    // multi-sig). It can ONLY designate the trusted indexer and perform the
    // one-time SetProposalRegistry binding — it can never forge a snapshot itself
    // (Issue #370).
    deployer: Address;

    // Off-chain indexer authorized to register snapshots. Starts null so the
    // RegisterSnapshot handler fails closed until the deployer configures it
    // (Issue #370). Until then NO address — not even the deployer — can
    // register a snapshot.
    trusted_indexer: Address?;

    // Proposal registry address (for cross-contract verification)
    proposal_registry: Address?;

    // Snapshot metadata by proposal ID
    snapshots: map<Int, Snapshot>;

    // Eligible voters by proposal: key = proposal_id * 1000 + nft_id
    eligibility: map<Int, Bool>;

    init() {
        // Sender authentication (Issue #370): record the deployer as the
        // configuration authority and leave the indexer slot unset so the
        // RegisterSnapshot handler fails closed until it is wired up.
        self.deployer = sender();
        self.trusted_indexer = null;
        self.proposal_registry = null;
    }

    // ==================== CONFIGURATION ====================

    // Designate / rotate the off-chain indexer authorized to register
    // snapshots (Issue #370). Deployer-only. Intentionally updatable (no
    // "already set" guard) so a compromised or rotated indexer key can be
    // replaced without redeploying the verifier; in production the deployer is
    // the governance multi-sig and any rotation is timelocked at that layer.
    receive(msg: SetTrustedIndexer) {
        require(sender() == self.deployer, "Only deployer can set trusted indexer");
        self.trusted_indexer = msg.indexer;
        emit(TrustedIndexerUpdated{
            indexer: msg.indexer,
            timestamp: now()
        }.toCell());
    }

    // Set the actual proposal registry address (one-time setup). Deployer-only
    // so the binding cannot be claimed by an arbitrary first caller; the
    // write-once guard preserves the irreversible E1 activation semantics
    // (RUNBOOK §4 / gate G-9). Issue #414 replaces the old string receiver,
    // which could only store sender() (the deployer), with this typed message.
    receive(msg: SetProposalRegistry) {
        require(sender() == self.deployer, "Only deployer can set registry");
        require(self.proposal_registry == null, "Registry already set");
        self.proposal_registry = msg.registry;
    }

    // ==================== SENDER AUTHENTICATION GUARD (Issue #370) ====================

    // Fail-closed: if the indexer slot is still null (not yet configured) the
    // snapshot is rejected, so a forged eligibility roll can never be injected —
    // not even in the window between deployment and indexer configuration. Once
    // configured, only the exact authorized address may register snapshots.
    fun requireTrustedIndexer() {
        require(self.trusted_indexer != null, "Unauthorized: trusted indexer not configured");
        require(sender() == self.trusted_indexer!!, "Unauthorized: only trusted indexer");
    }

    // ==================== REGISTER SNAPSHOT ====================

    // Register a snapshot of eligible voters for a proposal.
    // Called ONLY by the trusted indexer (configured via SetTrustedIndexer),
    // which captures NFT ownership state at the voting start time.
    receive(msg: RegisterSnapshot) {
        // Sender authentication (Issue #370): only the configured indexer.
        // Enforced first so an unauthorized caller is rejected before any
        // state is read or written.
        self.requireTrustedIndexer();

        // Validate proposal ID
        require(msg.proposal_id > 0, "Invalid proposal ID");

        // Check if snapshot already exists
        require(self.snapshots.get(msg.proposal_id) == null, "Snapshot already exists");

        // Count eligible NFTs and store eligibility
        let count: Int = 0;

        // Iterate through possible NFT IDs (1-222)
        // Store eligibility for each NFT that was included in the snapshot
        let nft_id: Int = 1;
        while (nft_id <= DIAMONDS_TOTAL_SUPPLY) {
            let is_eligible: Bool? = msg.eligible_nfts.get(nft_id);
            if (is_eligible != null && is_eligible!!) {
                let key: Int = msg.proposal_id * 1000 + nft_id;
                self.eligibility.set(key, true);
                count = count + 1;
            }
            nft_id = nft_id + 1;
        }

        // Store snapshot metadata
        let snapshot: Snapshot = Snapshot{
            proposal_id: msg.proposal_id,
            timestamp: msg.timestamp,
            eligible_count: count
        };
        self.snapshots.set(msg.proposal_id, snapshot);

        // Emit event
        emit(SnapshotRegistered{
            proposal_id: msg.proposal_id,
            timestamp: msg.timestamp,
            eligible_count: count
        }.toCell());
    }

    // Answer asynchronous eligibility requests with the same fail-closed logic
    // used by the getter. The verifier never assumes eligibility without an
    // explicit snapshot entry.
    receive(msg: EligibilityCheckRequest) {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: EligibilityCheckResponse{
                query_id: msg.query_id,
                proposal_id: msg.proposal_id,
                nft_id: msg.nft_id,
                eligible: self.isEligible(msg.proposal_id, msg.nft_id)
            }.toCell()
        });
    }

    // ==================== GET METHODS ====================

    // Verify if an NFT ID was eligible to vote at snapshot time
    get fun isEligible(proposal_id: Int, nft_id: Int): Bool {
        // Validate inputs
        if (proposal_id <= 0 || nft_id <= 0 || nft_id > DIAMONDS_TOTAL_SUPPLY) {
            return false;
        }

        // Check snapshot exists
        let snapshot: Snapshot? = self.snapshots.get(proposal_id);
        if (snapshot == null) {
            return false;
        }

        // Check eligibility map
        let key: Int = proposal_id * 1000 + nft_id;
        let eligible: Bool? = self.eligibility.get(key);
        return eligible != null && eligible!!;
    }

    // Get snapshot metadata for a proposal
    get fun getSnapshot(proposal_id: Int): Snapshot? {
        return self.snapshots.get(proposal_id);
    }

    // Check if snapshot exists for a proposal
    get fun hasSnapshot(proposal_id: Int): Bool {
        return self.snapshots.get(proposal_id) != null;
    }

    // Get eligible voter count for a proposal
    get fun getEligibleCount(proposal_id: Int): Int {
        let snapshot: Snapshot? = self.snapshots.get(proposal_id);
        if (snapshot == null) {
            return 0;
        }
        return snapshot!!.eligible_count;
    }

    // Get snapshot timestamp for a proposal
    get fun getSnapshotTimestamp(proposal_id: Int): Int {
        let snapshot: Snapshot? = self.snapshots.get(proposal_id);
        if (snapshot == null) {
            return 0;
        }
        return snapshot!!.timestamp;
    }

    // Get TBC Diamonds total supply
    get fun getDiamondsTotalSupply(): Int {
        return DIAMONDS_TOTAL_SUPPLY;
    }

    // Get proposal registry address
    get fun getProposalRegistry(): Address? {
        return self.proposal_registry;
    }

    // Get the configuration authority (deployer / governance multi-sig) that
    // designates the trusted indexer and performs the SetProposalRegistry binding.
    get fun getDeployer(): Address {
        return self.deployer;
    }

    // Get the trusted indexer authorized to register snapshots (null until the
    // deployer configures it; while null every RegisterSnapshot fails closed).
    get fun getTrustedIndexer(): Address? {
        return self.trusted_indexer;
    }

    // ==================== HELPER FUNCTIONS ====================

    // Batch verify multiple NFT IDs for eligibility
    // Returns a map of NFT ID -> eligible (true/false)
    get fun batchVerifyEligibility(proposal_id: Int, nft_ids: map<Int, Bool>): map<Int, Bool> {
        let results: map<Int, Bool> = emptyMap();

        // Iterate through requested NFT IDs
        let nft_id: Int = 1;
        while (nft_id <= DIAMONDS_TOTAL_SUPPLY) {
            let check: Bool? = nft_ids.get(nft_id);
            if (check != null && check!!) {
                results.set(nft_id, self.isEligible(proposal_id, nft_id));
            }
            nft_id = nft_id + 1;
        }

        return results;
    }
}
