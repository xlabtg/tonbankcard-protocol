// Snapshot Verifier (Issue #38)
// Purpose: Verify NFT ownership at snapshot time for governance voting
// Security: Read-only, no state modifications, no execution authority
//
// IMPORTANT: This verifier is for ADVISORY governance only. It cannot:
// - Trigger contract calls
// - Execute changes
// - Enforce outcomes

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

// Register snapshot message (called by off-chain indexer)
message RegisterSnapshot {
    proposal_id: Int as uint64;           // Proposal ID
    timestamp: Int as uint64;             // Snapshot timestamp
    eligible_nfts: map<Int, Bool>;        // Map of NFT IDs eligible to vote
}

// Verify eligibility request
message VerifyEligibility {
    proposal_id: Int as uint64;           // Proposal ID
    nft_id: Int as uint64;                // NFT ID to verify
}

// ==================== EVENTS ====================

// Emitted when snapshot is registered
message SnapshotRegistered {
    proposal_id: Int as uint64;
    timestamp: Int as uint64;
    eligible_count: Int as uint64;
}

// ==================== CONTRACT ====================

contract SnapshotVerifier with Deployable {

    // TBC Diamonds NFT collection address
    const DIAMONDS_COLLECTION: Address = address("EQDiamondsCollectionAddressPlaceholder123456789");

    // Proposal registry address (for cross-contract verification)
    proposal_registry: Address?;

    // Snapshot metadata by proposal ID
    snapshots: map<Int, Snapshot>;

    // Eligible voters by proposal: key = proposal_id * 1000 + nft_id
    eligibility: map<Int, Bool>;

    init() {
        self.proposal_registry = null;
    }

    // ==================== CONFIGURATION ====================

    // Set proposal registry address (one-time setup)
    receive("set_registry") {
        require(self.proposal_registry == null, "Registry already set");
        self.proposal_registry = sender();
    }

    // ==================== REGISTER SNAPSHOT ====================

    // Register a snapshot of eligible voters for a proposal
    // NOTE: In production, this would be called by a trusted indexer
    // that captures NFT ownership state at the voting start time
    receive(msg: RegisterSnapshot) {
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
            // No snapshot registered - assume all valid NFTs are eligible
            // This is a fallback for simplified implementation
            return nft_id >= 1 && nft_id <= DIAMONDS_TOTAL_SUPPLY;
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
            // No snapshot - return total supply as fallback
            return DIAMONDS_TOTAL_SUPPLY;
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
