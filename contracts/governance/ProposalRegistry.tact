// Governance Proposal Registry (Issue #38)
// Purpose: Non-executable proposal registry for TBC Diamonds governance
// Security: Read-only index, append-only operations, no execution authority
//
// IMPORTANT: This registry is PURELY ADVISORY. It cannot:
// - Trigger contract calls
// - Execute changes
// - Enforce outcomes
// - Control protocol operations

import "@stdlib/deploy";

// ==================== CONSTANTS ====================

// Proposal categories (fixed enum - no custom categories allowed)
const CATEGORY_ROADMAP_SIGNAL: Int = 0;
const CATEGORY_INTEGRATION_RECOMMENDATION: Int = 1;
const CATEGORY_DOCUMENTATION_UPDATE: Int = 2;
const CATEGORY_RISK_DISCLOSURE: Int = 3;
const CATEGORY_DEPRECATION_NOTICE: Int = 4;
const CATEGORY_ECOSYSTEM_GRANT_SIGNAL: Int = 5;

// Proposal status
const STATUS_ACTIVE: Int = 0;
const STATUS_ACCEPTED: Int = 1;
const STATUS_REJECTED: Int = 2;
const STATUS_NO_QUORUM: Int = 3;

// Vote types
const VOTE_FOR: Int = 0;
const VOTE_AGAINST: Int = 1;
const VOTE_ABSTAIN: Int = 2;

// Error codes
const ERROR_INVALID_CATEGORY: Int = 100;
const ERROR_INVALID_VOTING_WINDOW: Int = 101;
const ERROR_NOT_DIAMOND_HOLDER: Int = 102;
const ERROR_PROPOSAL_NOT_FOUND: Int = 103;
const ERROR_VOTING_NOT_STARTED: Int = 104;
const ERROR_VOTING_ENDED: Int = 105;
const ERROR_ALREADY_VOTED: Int = 106;
const ERROR_ALREADY_FINALIZED: Int = 107;
const ERROR_VOTING_NOT_ENDED: Int = 108;
const ERROR_NOT_ELIGIBLE_VOTER: Int = 109;
const ERROR_INVALID_VOTE_TYPE: Int = 110;
const ERROR_ZERO_QUORUM: Int = 111;

// Default voting window (7 days in seconds)
const DEFAULT_VOTING_DURATION: Int = 604800;

// Default quorum threshold (10% of 222 = 22 votes minimum)
const DEFAULT_QUORUM_THRESHOLD: Int = 22;

// ==================== DATA STRUCTURES ====================

// Proposal data structure
struct Proposal {
    id: Int as uint64;                    // Auto-incrementing proposal ID
    metadata_hash: Int as uint256;        // SHA-256 hash of off-chain content
    author_nft_id: Int as uint64;         // Diamond NFT ID
    category: Int as uint8;               // 0-5 (fixed enum)
    voting_start: Int as uint64;          // Unix timestamp
    voting_end: Int as uint64;            // Unix timestamp
    status: Int as uint8;                 // 0=ACTIVE, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
    votes_for: Int as uint64;             // Total FOR votes
    votes_against: Int as uint64;         // Total AGAINST votes
    votes_abstain: Int as uint64;         // Total ABSTAIN votes
    quorum_threshold: Int as uint64;      // Minimum votes required
}

// Proposal submission message
message SubmitProposal {
    metadata_hash: Int as uint256;        // Hash of off-chain proposal content
    author_nft_id: Int as uint64;         // Author's Diamond NFT ID
    category: Int as uint8;               // Proposal category (0-5)
    voting_duration: Int as uint64;       // Voting duration in seconds (optional, uses default)
    quorum_threshold: Int as uint64;      // Minimum votes required (optional, uses default)
}

// Vote cast message
message CastVote {
    proposal_id: Int as uint64;           // Proposal to vote on
    voter_nft_id: Int as uint64;          // Voter's Diamond NFT ID
    vote: Int as uint8;                   // 0=FOR, 1=AGAINST, 2=ABSTAIN
}

// Finalize proposal message
message FinalizeProposal {
    proposal_id: Int as uint64;           // Proposal to finalize
}

// ==================== EVENTS ====================

// Emitted when a new proposal is submitted
message ProposalSubmitted {
    proposal_id: Int as uint64;
    metadata_hash: Int as uint256;
    author_nft_id: Int as uint64;
    category: Int as uint8;
    voting_start: Int as uint64;
    voting_end: Int as uint64;
}

// Emitted when a vote is cast (NFT ID not exposed for privacy)
message VoteCast {
    proposal_id: Int as uint64;
    vote_type: Int as uint8;              // 0=FOR, 1=AGAINST, 2=ABSTAIN
    // Note: voter_nft_id is intentionally not included for privacy
}

// Emitted when a proposal is finalized
message ProposalFinalized {
    proposal_id: Int as uint64;
    status: Int as uint8;                 // 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
    votes_for: Int as uint64;
    votes_against: Int as uint64;
    votes_abstain: Int as uint64;
}

// ==================== CONTRACT ====================

contract ProposalRegistry with Deployable {

    // TBC Diamonds NFT collection address (222 total supply)
    const DIAMONDS_COLLECTION: Address = address("EQDiamondsCollectionAddressPlaceholder123456789");

    // Total supply of TBC Diamonds
    const DIAMONDS_TOTAL_SUPPLY: Int = 222;

    // Contract state
    proposal_count: Int as uint64;
    proposals: map<Int, Proposal>;

    // Track votes per proposal per NFT ID to prevent double voting
    // Key: proposal_id * 1000 + nft_id (simple composite key)
    votes_cast: map<Int, Bool>;

    // Snapshot storage: maps proposal_id to snapshot of eligible voters
    // In production, this would be populated by off-chain indexer at voting start
    // For now, we validate against current ownership (simplified implementation)

    init() {
        self.proposal_count = 0;
    }

    // ==================== SUBMIT PROPOSAL ====================

    receive(msg: SubmitProposal) {
        // Validate category is within allowed range
        require(
            msg.category >= CATEGORY_ROADMAP_SIGNAL &&
            msg.category <= CATEGORY_ECOSYSTEM_GRANT_SIGNAL,
            "Invalid category"
        );

        // Validate author NFT ID is valid Diamond (1-222)
        require(
            msg.author_nft_id >= 1 &&
            msg.author_nft_id <= self.DIAMONDS_TOTAL_SUPPLY,
            "Invalid Diamond NFT ID"
        );

        // NOTE: In production, we would verify the sender owns the Diamond NFT
        // This requires a cross-contract call to the NFT collection
        // For this implementation, we trust the caller to provide valid ownership proof

        // Calculate voting window
        let voting_start: Int = now();
        let voting_duration: Int = msg.voting_duration > 0 ? msg.voting_duration : DEFAULT_VOTING_DURATION;
        let voting_end: Int = voting_start + voting_duration;

        // Validate quorum threshold
        let quorum: Int = msg.quorum_threshold > 0 ? msg.quorum_threshold : DEFAULT_QUORUM_THRESHOLD;
        require(quorum > 0, "Quorum must be positive");
        require(quorum <= self.DIAMONDS_TOTAL_SUPPLY, "Quorum exceeds total supply");

        // Increment proposal count
        self.proposal_count = self.proposal_count + 1;

        // Create proposal
        let proposal: Proposal = Proposal{
            id: self.proposal_count,
            metadata_hash: msg.metadata_hash,
            author_nft_id: msg.author_nft_id,
            category: msg.category,
            voting_start: voting_start,
            voting_end: voting_end,
            status: STATUS_ACTIVE,
            votes_for: 0,
            votes_against: 0,
            votes_abstain: 0,
            quorum_threshold: quorum
        };

        // Store proposal (append-only operation)
        self.proposals.set(self.proposal_count, proposal);

        // Emit event for indexing
        emit(ProposalSubmitted{
            proposal_id: self.proposal_count,
            metadata_hash: msg.metadata_hash,
            author_nft_id: msg.author_nft_id,
            category: msg.category,
            voting_start: voting_start,
            voting_end: voting_end
        }.toCell());
    }

    // ==================== CAST VOTE ====================

    receive(msg: CastVote) {
        // Validate proposal exists
        let proposal: Proposal? = self.proposals.get(msg.proposal_id);
        require(proposal != null, "Proposal not found");

        let p: Proposal = proposal!!;

        // Validate proposal is still active
        require(p.status == STATUS_ACTIVE, "Proposal already finalized");

        // Validate voting window
        require(now() >= p.voting_start, "Voting not started");
        require(now() <= p.voting_end, "Voting ended");

        // Validate voter NFT ID is valid Diamond (1-222)
        require(
            msg.voter_nft_id >= 1 &&
            msg.voter_nft_id <= self.DIAMONDS_TOTAL_SUPPLY,
            "Invalid Diamond NFT ID"
        );

        // Validate vote type
        require(
            msg.vote == VOTE_FOR ||
            msg.vote == VOTE_AGAINST ||
            msg.vote == VOTE_ABSTAIN,
            "Invalid vote type"
        );

        // Check if already voted (using composite key)
        let vote_key: Int = msg.proposal_id * 1000 + msg.voter_nft_id;
        require(self.votes_cast.get(vote_key) == null, "Already voted");

        // NOTE: In production, we would verify:
        // 1. Sender owns the Diamond NFT
        // 2. NFT was owned at snapshot time
        // This requires cross-contract calls or off-chain verification

        // Record vote
        self.votes_cast.set(vote_key, true);

        // Update vote counts
        if (msg.vote == VOTE_FOR) {
            p.votes_for = p.votes_for + 1;
        } else if (msg.vote == VOTE_AGAINST) {
            p.votes_against = p.votes_against + 1;
        } else {
            p.votes_abstain = p.votes_abstain + 1;
        }

        // Update proposal
        self.proposals.set(msg.proposal_id, p);

        // Emit event (NFT ID not included for privacy)
        emit(VoteCast{
            proposal_id: msg.proposal_id,
            vote_type: msg.vote
        }.toCell());
    }

    // ==================== FINALIZE PROPOSAL ====================

    receive(msg: FinalizeProposal) {
        // Validate proposal exists
        let proposal: Proposal? = self.proposals.get(msg.proposal_id);
        require(proposal != null, "Proposal not found");

        let p: Proposal = proposal!!;

        // Validate proposal is still active
        require(p.status == STATUS_ACTIVE, "Proposal already finalized");

        // Validate voting window has ended
        require(now() > p.voting_end, "Voting not ended");

        // Calculate total votes
        let total_votes: Int = p.votes_for + p.votes_against + p.votes_abstain;

        // Determine final status
        let final_status: Int = STATUS_NO_QUORUM;

        if (total_votes >= p.quorum_threshold) {
            // Quorum met - determine outcome based on votes
            if (p.votes_for > p.votes_against) {
                final_status = STATUS_ACCEPTED;
            } else {
                final_status = STATUS_REJECTED;
            }
        }

        // Update proposal status (immutable after this)
        p.status = final_status;
        self.proposals.set(msg.proposal_id, p);

        // Emit event
        emit(ProposalFinalized{
            proposal_id: msg.proposal_id,
            status: final_status,
            votes_for: p.votes_for,
            votes_against: p.votes_against,
            votes_abstain: p.votes_abstain
        }.toCell());
    }

    // ==================== GET METHODS ====================

    // Get proposal by ID
    get fun getProposal(proposal_id: Int): Proposal? {
        return self.proposals.get(proposal_id);
    }

    // Get total proposal count
    get fun getProposalCount(): Int {
        return self.proposal_count;
    }

    // Check if NFT has voted on proposal
    get fun hasVoted(proposal_id: Int, nft_id: Int): Bool {
        let vote_key: Int = proposal_id * 1000 + nft_id;
        let voted: Bool? = self.votes_cast.get(vote_key);
        return voted != null && voted!!;
    }

    // Get proposal status
    get fun getProposalStatus(proposal_id: Int): Int {
        let proposal: Proposal? = self.proposals.get(proposal_id);
        if (proposal == null) {
            return -1; // Not found
        }
        return proposal!!.status;
    }

    // Get vote counts for proposal
    get fun getVoteCounts(proposal_id: Int): map<Int, Int> {
        let counts: map<Int, Int> = emptyMap();
        let proposal: Proposal? = self.proposals.get(proposal_id);
        if (proposal != null) {
            let p: Proposal = proposal!!;
            counts.set(VOTE_FOR, p.votes_for);
            counts.set(VOTE_AGAINST, p.votes_against);
            counts.set(VOTE_ABSTAIN, p.votes_abstain);
        }
        return counts;
    }

    // Check if voting is open for proposal
    get fun isVotingOpen(proposal_id: Int): Bool {
        let proposal: Proposal? = self.proposals.get(proposal_id);
        if (proposal == null) {
            return false;
        }
        let p: Proposal = proposal!!;
        return p.status == STATUS_ACTIVE &&
               now() >= p.voting_start &&
               now() <= p.voting_end;
    }

    // Get category name (helper for off-chain use)
    get fun getCategoryName(category: Int): String {
        if (category == CATEGORY_ROADMAP_SIGNAL) {
            return "ROADMAP_SIGNAL";
        } else if (category == CATEGORY_INTEGRATION_RECOMMENDATION) {
            return "INTEGRATION_RECOMMENDATION";
        } else if (category == CATEGORY_DOCUMENTATION_UPDATE) {
            return "DOCUMENTATION_UPDATE";
        } else if (category == CATEGORY_RISK_DISCLOSURE) {
            return "RISK_DISCLOSURE";
        } else if (category == CATEGORY_DEPRECATION_NOTICE) {
            return "DEPRECATION_NOTICE";
        } else if (category == CATEGORY_ECOSYSTEM_GRANT_SIGNAL) {
            return "ECOSYSTEM_GRANT_SIGNAL";
        }
        return "UNKNOWN";
    }

    // Get status name (helper for off-chain use)
    get fun getStatusName(status: Int): String {
        if (status == STATUS_ACTIVE) {
            return "ACTIVE";
        } else if (status == STATUS_ACCEPTED) {
            return "ACCEPTED";
        } else if (status == STATUS_REJECTED) {
            return "REJECTED";
        } else if (status == STATUS_NO_QUORUM) {
            return "NO_QUORUM";
        }
        return "UNKNOWN";
    }

    // Get TBC Diamonds total supply
    get fun getDiamondsTotalSupply(): Int {
        return self.DIAMONDS_TOTAL_SUPPLY;
    }

    // Get default quorum threshold
    get fun getDefaultQuorumThreshold(): Int {
        return DEFAULT_QUORUM_THRESHOLD;
    }

    // Get default voting duration
    get fun getDefaultVotingDuration(): Int {
        return DEFAULT_VOTING_DURATION;
    }
}
