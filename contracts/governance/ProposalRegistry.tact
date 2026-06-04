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
const ERROR_RESOLVER_NOT_SET: Int = 112;
const ERROR_SNAPSHOT_VERIFIER_NOT_SET: Int = 113;

// Ownership-resolution request kinds (used to route the resolver callback)
const REQUEST_KIND_VOTE: Int = 0;
const REQUEST_KIND_PROPOSAL: Int = 1;

// Default voting window (7 days in seconds)
const DEFAULT_VOTING_DURATION: Int = 604800;

// TBC Diamonds total supply and quorum policy.
const DIAMONDS_TOTAL_SUPPLY: Int = 222;
const DEFAULT_QUORUM_PERCENTAGE: Int = 10;
const QUORUM_PERCENT_DENOMINATOR: Int = 100;

// Default quorum threshold: ceil(222 * 10 / 100) = 23 votes.
const DEFAULT_QUORUM_THRESHOLD: Int =
    (DIAMONDS_TOTAL_SUPPLY * DEFAULT_QUORUM_PERCENTAGE + QUORUM_PERCENT_DENOMINATOR - 1) / QUORUM_PERCENT_DENOMINATOR;

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

// Pending vote awaiting on-chain ownership confirmation from the resolver.
struct PendingVote {
    proposal_id: Int as uint64;
    nft_id: Int as uint64;                // Voter's claimed Diamond NFT ID
    vote: Int as uint8;                   // 0=FOR, 1=AGAINST, 2=ABSTAIN
    claimant: Address;                    // Original sender that must own nft_id
}

// Pending proposal awaiting on-chain ownership confirmation from the resolver.
struct PendingProposal {
    metadata_hash: Int as uint256;
    author_nft_id: Int as uint64;         // Author's claimed Diamond NFT ID
    category: Int as uint8;
    voting_duration: Int as uint64;       // Resolved voting duration (seconds)
    quorum_threshold: Int as uint64;      // Resolved quorum threshold
    claimant: Address;                    // Original sender that must own author_nft_id
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

// One-time configuration message: set the NFT ownership resolver address.
// Only the deployer can call this, and only once (the resolver is immutable
// afterwards). The resolver is the on-chain authority that maps a Diamond NFT
// ID to its current owner (TEP-62 owner resolution / NFT Account Resolver).
message SetOwnerResolver {
    resolver: Address;                    // Address of the NFT ownership resolver
}

// One-time configuration message: set the snapshot verifier address.
// Voting is rejected until this verifier is configured because eligibility must
// fail closed when no proposal snapshot exists.
message SetSnapshotVerifier {
    verifier: Address;                    // Address of the SnapshotVerifier
}

// ==================== OWNERSHIP-VERIFICATION PROTOCOL ====================
//
// Voting and proposal submission never trust a caller-supplied NFT ID. Instead
// the registry asks a trusted on-chain resolver "who owns Diamond NFT N?" and
// only records the action once the resolver confirms that the original sender
// is the owner. This is an asynchronous request/response flow:
//
//   1. User -> ProposalRegistry: CastVote / SubmitProposal (records a PENDING
//      request keyed by query_id, binds it to sender()).
//   2. ProposalRegistry -> Resolver: ResolveOwnership{nft_id, claimant}.
//   3. Resolver -> ProposalRegistry: OwnershipResolved{nft_id, owner}.
//   4. ProposalRegistry records the vote/proposal IFF owner == claimant.

// Sent by the registry to the resolver to ask who owns a Diamond NFT.
message ResolveOwnership {
    query_id: Int as uint64;              // Correlates the request with its reply
    nft_id: Int as uint64;                // Diamond NFT ID whose owner is requested
    claimant: Address;                    // Address that claims to own nft_id
    request_kind: Int as uint8;           // 0 = vote, 1 = proposal
}

// Sent by the resolver back to the registry with the resolved on-chain owner.
message OwnershipResolved {
    query_id: Int as uint64;              // Echoes the request's query_id
    nft_id: Int as uint64;                // Echoes the request's nft_id
    owner: Address;                       // Current on-chain owner of nft_id
}

// Sent by the registry to the snapshot verifier after ownership is confirmed.
message EligibilityCheckRequest {
    query_id: Int as uint64;              // Correlates the request with its reply
    proposal_id: Int as uint64;           // Proposal being voted on
    nft_id: Int as uint64;                // Diamond NFT ID whose eligibility is checked
}

// Sent by the snapshot verifier back to the registry.
message EligibilityCheckResponse {
    query_id: Int as uint64;              // Echoes the request's query_id
    proposal_id: Int as uint64;           // Echoes the request's proposal_id
    nft_id: Int as uint64;                // Echoes the request's nft_id
    eligible: Bool;                       // True only when snapshot contains nft_id
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

    // TBC Diamonds NFT collection address (222 total supply).
    // Placeholder zero-address; replace with the real collection address at
    // deployment. Must be a syntactically valid TON address so the contract
    // compiles.
    const DIAMONDS_COLLECTION: Address = address("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

    // Contract state
    proposal_count: Int as uint64;
    proposals: map<Int, Proposal>;

    // Track votes per proposal per NFT ID to prevent double voting
    // Key: proposal_id * 1000 + nft_id (simple composite key)
    votes_cast: map<Int, Bool>;

    // Deployer address — the only account allowed to configure the resolver.
    // Recorded once at init() and never mutated.
    deployer: Address;

    // NFT ownership resolver (TEP-62 owner resolution / NFT Account Resolver).
    // Set once by the deployer via SetOwnerResolver. Until configured, voting and
    // proposal submission are rejected so a vote can never be recorded without an
    // on-chain ownership check.
    owner_resolver: Address?;

    // Snapshot verifier used for voter eligibility. Set once by the deployer.
    snapshot_verifier: Address?;

    // Monotonic counter correlating ownership requests with their replies.
    next_query_id: Int as uint64;

    // In-flight ownership-resolution requests, keyed by query_id. A vote/proposal
    // is only materialised once the resolver confirms the claimant owns the NFT.
    pending_votes: map<Int, PendingVote>;
    pending_proposals: map<Int, PendingProposal>;

    // In-flight snapshot eligibility requests, keyed by query_id. A vote is
    // recorded only after both ownership and snapshot eligibility are confirmed.
    pending_eligibility_votes: map<Int, PendingVote>;

    init() {
        self.proposal_count = 0;
        self.deployer = sender();
        self.owner_resolver = null;
        self.snapshot_verifier = null;
        self.next_query_id = 0;
    }

    // ==================== CONFIGURATION ====================

    // Configure the NFT ownership resolver (one-time, deployer only).
    receive(msg: SetOwnerResolver) {
        require(sender() == self.deployer, "Only deployer can set resolver");
        require(self.owner_resolver == null, "Resolver already set");
        self.owner_resolver = msg.resolver;
    }

    // Configure the snapshot verifier (one-time, deployer only).
    receive(msg: SetSnapshotVerifier) {
        require(sender() == self.deployer, "Only deployer can set snapshot verifier");
        require(self.snapshot_verifier == null, "Snapshot verifier already set");
        self.snapshot_verifier = msg.verifier;
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
            msg.author_nft_id <= DIAMONDS_TOTAL_SUPPLY,
            "Invalid Diamond NFT ID"
        );

        // Resolve the voting window / quorum now so that invalid configuration is
        // rejected synchronously (before any cross-contract round-trip).
        let voting_duration: Int = msg.voting_duration > 0 ? msg.voting_duration : DEFAULT_VOTING_DURATION;

        // Validate quorum threshold
        let quorum: Int = msg.quorum_threshold > 0 ? msg.quorum_threshold : DEFAULT_QUORUM_THRESHOLD;
        require(quorum > 0, "Quorum must be positive");
        require(quorum <= DIAMONDS_TOTAL_SUPPLY, "Quorum exceeds total supply");

        // The proposal is NOT recorded here. The sender's ownership of
        // author_nft_id must first be confirmed on-chain by the resolver. We
        // stash the request and ask the resolver who owns the Diamond NFT; the
        // proposal is only materialised in the OwnershipResolved callback when
        // the resolved owner equals this sender. A caller-supplied author_nft_id
        // can therefore never, on its own, create a proposal.
        let resolver: Address = self.requireResolver();
        let qid: Int = self.next_query_id;
        self.next_query_id = self.next_query_id + 1;

        self.pending_proposals.set(qid, PendingProposal{
            metadata_hash: msg.metadata_hash,
            author_nft_id: msg.author_nft_id,
            category: msg.category,
            voting_duration: voting_duration,
            quorum_threshold: quorum,
            claimant: sender()
        });

        send(SendParameters{
            to: resolver,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ResolveOwnership{
                query_id: qid,
                nft_id: msg.author_nft_id,
                claimant: sender(),
                request_kind: REQUEST_KIND_PROPOSAL
            }.toCell()
        });
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
            msg.voter_nft_id <= DIAMONDS_TOTAL_SUPPLY,
            "Invalid Diamond NFT ID"
        );

        // Validate vote type
        require(
            msg.vote == VOTE_FOR ||
            msg.vote == VOTE_AGAINST ||
            msg.vote == VOTE_ABSTAIN,
            "Invalid vote type"
        );

        // Check if already voted (using composite key). This is an early
        // rejection only; the authoritative dedup check is re-run when the vote
        // is actually recorded in the OwnershipResolved callback.
        let vote_key: Int = msg.proposal_id * 1000 + msg.voter_nft_id;
        require(self.votes_cast.get(vote_key) == null, "Already voted");

        // Voting must fail closed until a snapshot verifier is configured.
        self.requireSnapshotVerifier();

        // The vote is NOT recorded here. We bind the request to sender() and ask
        // the resolver who owns voter_nft_id on-chain. The vote is only recorded
        // in the OwnershipResolved callback when the resolved owner equals this
        // sender. A caller-supplied voter_nft_id can therefore never, on its own,
        // record a vote — defeating the "iterate 1..222 from one wallet" attack.
        let resolver: Address = self.requireResolver();
        let qid: Int = self.next_query_id;
        self.next_query_id = self.next_query_id + 1;

        self.pending_votes.set(qid, PendingVote{
            proposal_id: msg.proposal_id,
            nft_id: msg.voter_nft_id,
            vote: msg.vote,
            claimant: sender()
        });

        send(SendParameters{
            to: resolver,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ResolveOwnership{
                query_id: qid,
                nft_id: msg.voter_nft_id,
                claimant: sender(),
                request_kind: REQUEST_KIND_VOTE
            }.toCell()
        });
    }

    // ==================== OWNERSHIP RESOLUTION CALLBACK ====================

    // Reply from the trusted resolver carrying the on-chain owner of an NFT.
    // This is the ONLY place a vote or proposal is materialised, and it does so
    // only when the resolved owner matches the address that originally requested
    // the action. Spoofed callbacks are rejected because the sender must be the
    // configured resolver.
    receive(msg: OwnershipResolved) {
        // Only the configured resolver may confirm ownership.
        require(self.owner_resolver != null, "Resolver not set");
        require(sender() == self.owner_resolver!!, "Unauthorized resolver");

        // Route to a pending vote, if any.
        let pv: PendingVote? = self.pending_votes.get(msg.query_id);
        if (pv != null) {
            let v: PendingVote = pv!!;
            self.pending_votes.del(msg.query_id);
            self.requestVoteEligibility(v, msg.nft_id, msg.owner);
            return;
        }

        // Otherwise route to a pending proposal, if any.
        let pp: PendingProposal? = self.pending_proposals.get(msg.query_id);
        if (pp != null) {
            let pr: PendingProposal = pp!!;
            self.pending_proposals.del(msg.query_id);
            self.finalizeProposal(pr, msg.nft_id, msg.owner);
            return;
        }

        // No matching request — nothing to do (stale or duplicate reply).
    }

    // Reply from the configured snapshot verifier. The vote is only recorded if
    // the response matches an in-flight request and the NFT was explicitly
    // included in the proposal snapshot.
    receive(msg: EligibilityCheckResponse) {
        require(self.snapshot_verifier != null, "Snapshot verifier not set");
        require(sender() == self.snapshot_verifier!!, "Unauthorized snapshot verifier");

        let pv: PendingVote? = self.pending_eligibility_votes.get(msg.query_id);
        if (pv == null) {
            return;
        }

        let v: PendingVote = pv!!;
        self.pending_eligibility_votes.del(msg.query_id);

        if (msg.proposal_id != v.proposal_id) { return; }
        if (msg.nft_id != v.nft_id) { return; }
        if (!msg.eligible) { return; }

        self.recordEligibleVote(v);
    }

    // ==================== INTERNAL HELPERS ====================

    // Resolve the configured resolver address or abort if it has not been set.
    fun requireResolver(): Address {
        require(self.owner_resolver != null, "Owner resolver not configured");
        return self.owner_resolver!!;
    }

    // Resolve the configured snapshot verifier address or abort if it has not
    // been set.
    fun requireSnapshotVerifier(): Address {
        require(self.snapshot_verifier != null, "Snapshot verifier not configured");
        return self.snapshot_verifier!!;
    }

    // Request snapshot eligibility once ownership has been confirmed. Silently
    // drops the vote when ownership does not match or the proposal is no longer
    // votable, so that pending state is always cleaned up.
    fun requestVoteEligibility(v: PendingVote, resolved_nft_id: Int, resolved_owner: Address) {
        // The reply must concern the NFT we asked about and the resolved owner
        // must be the original sender.
        if (resolved_nft_id != v.nft_id) { return; }
        if (resolved_owner != v.claimant) { return; }

        // Re-validate the proposal is still open (time may have advanced).
        let proposal: Proposal? = self.proposals.get(v.proposal_id);
        if (proposal == null) { return; }
        let p: Proposal = proposal!!;
        if (p.status != STATUS_ACTIVE) { return; }
        if (now() < p.voting_start || now() > p.voting_end) { return; }

        // Authoritative double-vote guard.
        let vote_key: Int = v.proposal_id * 1000 + v.nft_id;
        if (self.votes_cast.get(vote_key) != null) { return; }

        let verifier: Address = self.requireSnapshotVerifier();
        let qid: Int = self.next_query_id;
        self.next_query_id = self.next_query_id + 1;

        self.pending_eligibility_votes.set(qid, v);

        send(SendParameters{
            to: verifier,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: EligibilityCheckRequest{
                query_id: qid,
                proposal_id: v.proposal_id,
                nft_id: v.nft_id
            }.toCell()
        });
    }

    // Record a vote once ownership and snapshot eligibility have both been
    // confirmed. Re-runs proposal and double-vote checks because time/state may
    // have changed during the asynchronous round-trip.
    fun recordEligibleVote(v: PendingVote) {
        // Re-validate the proposal is still open (time may have advanced).
        let proposal: Proposal? = self.proposals.get(v.proposal_id);
        if (proposal == null) { return; }
        let p: Proposal = proposal!!;
        if (p.status != STATUS_ACTIVE) { return; }
        if (now() < p.voting_start || now() > p.voting_end) { return; }

        // Authoritative double-vote guard.
        let vote_key: Int = v.proposal_id * 1000 + v.nft_id;
        if (self.votes_cast.get(vote_key) != null) { return; }
        self.votes_cast.set(vote_key, true);

        // Update vote counts
        if (v.vote == VOTE_FOR) {
            p.votes_for = p.votes_for + 1;
        } else if (v.vote == VOTE_AGAINST) {
            p.votes_against = p.votes_against + 1;
        } else {
            p.votes_abstain = p.votes_abstain + 1;
        }

        self.proposals.set(v.proposal_id, p);

        // Emit event (NFT ID not included for privacy)
        emit(VoteCast{
            proposal_id: v.proposal_id,
            vote_type: v.vote
        }.toCell());
    }

    // Record a proposal once authorship has been confirmed. Silently drops the
    // request when the resolved owner is not the claimant.
    fun finalizeProposal(pr: PendingProposal, resolved_nft_id: Int, resolved_owner: Address) {
        if (resolved_nft_id != pr.author_nft_id) { return; }
        if (resolved_owner != pr.claimant) { return; }

        // Calculate voting window relative to confirmation time.
        let voting_start: Int = now();
        let voting_end: Int = voting_start + pr.voting_duration;

        // Increment proposal count
        self.proposal_count = self.proposal_count + 1;

        // Create proposal
        let proposal: Proposal = Proposal{
            id: self.proposal_count,
            metadata_hash: pr.metadata_hash,
            author_nft_id: pr.author_nft_id,
            category: pr.category,
            voting_start: voting_start,
            voting_end: voting_end,
            status: STATUS_ACTIVE,
            votes_for: 0,
            votes_against: 0,
            votes_abstain: 0,
            quorum_threshold: pr.quorum_threshold
        };

        // Store proposal (append-only operation)
        self.proposals.set(self.proposal_count, proposal);

        // Emit event for indexing
        emit(ProposalSubmitted{
            proposal_id: self.proposal_count,
            metadata_hash: pr.metadata_hash,
            author_nft_id: pr.author_nft_id,
            category: pr.category,
            voting_start: voting_start,
            voting_end: voting_end
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
        return DIAMONDS_TOTAL_SUPPLY;
    }

    // Get default quorum threshold
    get fun getDefaultQuorumThreshold(): Int {
        return DEFAULT_QUORUM_THRESHOLD;
    }

    // Get default voting duration
    get fun getDefaultVotingDuration(): Int {
        return DEFAULT_VOTING_DURATION;
    }

    // Get the configured NFT ownership resolver (null until set by the deployer)
    get fun getOwnerResolver(): Address? {
        return self.owner_resolver;
    }

    // Get the configured snapshot verifier (null until set by the deployer)
    get fun getSnapshotVerifier(): Address? {
        return self.snapshot_verifier;
    }

    // Get the deployer address (resolver configuration authority)
    get fun getDeployer(): Address {
        return self.deployer;
    }
}
