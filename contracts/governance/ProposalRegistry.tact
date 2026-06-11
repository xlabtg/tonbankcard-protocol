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

// ---- Governance multi-sig configuration (Issue #366) ----
//
// The resolver and snapshot verifier addresses are protocol-critical: whoever
// controls them controls who can vote. They MUST NOT be settable by a single
// key. After a one-time deployer bootstrap that installs an M-of-N signer set,
// every change to either address requires (a) M independent signer approvals
// and (b) a two-phase timelock, plus (c) verification that the target address
// actually runs the approved contract code (code-hash binding). This defeats
// the second-order attack in which a compromised deployer key silently swaps in
// a malicious resolver.

// Configuration-change targets (route the multi-sig proposal).
const CONFIG_KIND_RESOLVER: Int = 0;
const CONFIG_KIND_VERIFIER: Int = 1;

// Genuine multi-sig bounds: at least two signers must exist and at least two
// must agree, so no single compromised key can reconfigure governance.
const MIN_GOV_SIGNERS: Int = 2;
const MAX_GOV_SIGNERS: Int = 7;
const MIN_GOV_THRESHOLD: Int = 2;

// Timelock delay before an approved configuration change becomes executable
// (7 days, matching the protocol-wide two-phase timelock for privileged roles —
// see docs/invariants.md §I3 and contracts/payments/PaymentHub.tact).
const CONFIG_TIMELOCK_DELAY: Int = 7 * 24 * 60 * 60;

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

// ---- Governance multi-sig configuration messages (Issue #366) ----

// One-time bootstrap: install the M-of-N governance signer set. Callable only
// by the deployer and only once. After this, the deployer key alone can no
// longer change the resolver or verifier — every change needs M signer
// approvals plus a timelock. `signers` is a 0-based contiguous map (indices
// 0..signer_count-1) of distinct, non-zero addresses.
message ConfigureGovernance {
    signers: map<Int, Address>;           // index -> signer address (0..signer_count-1)
    signer_count: Int as uint8;           // number of signers (2..MAX_GOV_SIGNERS)
    threshold: Int as uint8;              // approvals required (2..signer_count)
}

// Propose changing the resolver or verifier to `target`. Callable by any
// governance signer when no other change is pending. `code_hash` is the
// expected code hash of `target`; it is enforced at execution time. The
// proposer implicitly casts the first approval.
message ProposeConfigChange {
    kind: Int as uint8;                   // CONFIG_KIND_RESOLVER | CONFIG_KIND_VERIFIER
    target: Address;                      // proposed resolver/verifier address
    code_hash: Int as uint256;            // expected code.hash() of `target`
}

// Approve the currently pending configuration change. Callable by any
// governance signer; each signer may approve at most once. When approvals first
// reach the threshold the timelock starts.
message ApproveConfigChange {
    kind: Int as uint8;                   // must match the pending change
    target: Address;                      // must match the pending change
}

// Execute the pending configuration change after the threshold is met and the
// timelock has elapsed. The caller supplies the target's StateInit so the
// registry can prove `target` actually runs the approved code:
//   contractAddress(StateInit{code, data}) == target  AND  code.hash() == code_hash.
message ExecuteConfigChange {
    kind: Int as uint8;                   // must match the pending change
    target: Address;                      // must match the pending change
    code: Cell;                           // target contract code
    data: Cell;                           // target contract initial data
}

// Cancel the pending configuration change (escape hatch). Callable by any
// governance signer; must match the pending change to avoid stale cancels.
message CancelConfigChange {
    kind: Int as uint8;                   // must match the pending change
    target: Address;                      // must match the pending change
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

// ---- Governance configuration events (Issue #366) ----

// Emitted once when the governance signer set is installed.
message GovernanceConfigured {
    signer_count: Int as uint8;
    threshold: Int as uint8;
}

// Emitted when a configuration change is proposed.
message ConfigChangeProposed {
    kind: Int as uint8;
    target: Address;
    code_hash: Int as uint256;
    proposer: Address;
}

// Emitted on each approval; carries the running tally and (once queued) the
// timestamp at which the change becomes executable.
message ConfigChangeApproved {
    kind: Int as uint8;
    target: Address;
    approver: Address;
    approvals: Int as uint8;
    executable_at: Int as uint64;         // 0 until the threshold is reached
}

// Emitted when a configuration change is applied.
message ConfigChangeExecuted {
    kind: Int as uint8;
    target: Address;
}

// Emitted when a pending configuration change is cancelled.
message ConfigChangeCancelled {
    kind: Int as uint8;
    target: Address;
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

    // Deployer address — bootstraps the governance signer set once at genesis.
    // Recorded once at init() and never mutated. After ConfigureGovernance the
    // deployer key alone can no longer change the resolver or verifier.
    deployer: Address;

    // NFT ownership resolver (TEP-62 owner resolution / NFT Account Resolver).
    // Installed and later updated only through the governance multi-sig +
    // timelock flow (ProposeConfigChange/ApproveConfigChange/ExecuteConfigChange).
    // Until configured, voting and proposal submission are rejected so a vote can
    // never be recorded without an on-chain ownership check.
    owner_resolver: Address?;

    // Snapshot verifier used for voter eligibility. Installed/updated through the
    // same governance multi-sig + timelock flow as the resolver.
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

    // ---- Governance multi-sig state (Issue #366) ----
    //
    // The signer set that authorises resolver/verifier changes. Installed once
    // by the deployer via ConfigureGovernance; afterwards the deployer key alone
    // cannot reconfigure governance.
    governance_configured: Bool;
    governance_signers: map<Address, Bool>;   // authorized signer -> true
    governance_signer_count: Int as uint8;
    governance_threshold: Int as uint8;

    // ---- Pending configuration change (at most one at a time) ----
    config_pending: Bool;
    config_kind: Int as uint8;                // CONFIG_KIND_RESOLVER | CONFIG_KIND_VERIFIER
    config_target: Address?;                  // proposed resolver/verifier
    config_code_hash: Int as uint256;         // expected code.hash() of config_target
    config_approvals: Int as uint8;           // running approval tally
    config_executable_at: Int as uint64;      // timelock expiry; 0 until threshold reached
    config_approvers: map<Address, Bool>;     // approval dedup for the current change

    init() {
        self.proposal_count = 0;
        self.deployer = sender();
        self.owner_resolver = null;
        self.snapshot_verifier = null;
        self.next_query_id = 0;

        // Governance starts unconfigured: voting/proposals are frozen and no
        // resolver/verifier change is possible until a signer set is installed.
        self.governance_configured = false;
        self.governance_signer_count = 0;
        self.governance_threshold = 0;

        self.config_pending = false;
        self.config_kind = 0;
        self.config_target = null;
        self.config_code_hash = 0;
        self.config_approvals = 0;
        self.config_executable_at = 0;
    }

    // ==================== GOVERNANCE CONFIGURATION ====================
    //
    // Bootstrap once, then every resolver/verifier change requires M-of-N signer
    // approvals + a timelock + code-hash verification (Issue #366).

    // One-time bootstrap of the governance signer set (deployer only).
    receive(msg: ConfigureGovernance) {
        require(sender() == self.deployer, "Only deployer can configure governance");
        require(!self.governance_configured, "Governance already configured");
        require(msg.signer_count >= MIN_GOV_SIGNERS, "At least two signers required");
        require(msg.signer_count <= MAX_GOV_SIGNERS, "Too many signers");
        require(msg.threshold >= MIN_GOV_THRESHOLD, "Threshold must be at least two");
        require(msg.threshold <= msg.signer_count, "Threshold exceeds signer count");

        // Populate the signer set, rejecting gaps, zero addresses and duplicates.
        let zero: Address = newAddress(0, 0);
        let i: Int = 0;
        while (i < msg.signer_count) {
            let entry: Address? = msg.signers.get(i);
            require(entry != null, "Missing signer entry");
            let signer: Address = entry!!;
            require(signer != zero, "Zero signer address");
            require(self.governance_signers.get(signer) == null, "Duplicate signer");
            self.governance_signers.set(signer, true);
            i = i + 1;
        }

        self.governance_signer_count = msg.signer_count;
        self.governance_threshold = msg.threshold;
        self.governance_configured = true;

        emit(GovernanceConfigured{
            signer_count: msg.signer_count,
            threshold: msg.threshold
        }.toCell());
    }

    // Propose a resolver/verifier change (any signer; proposer auto-approves).
    receive(msg: ProposeConfigChange) {
        self.requireGovernanceSigner();
        require(!self.config_pending, "A configuration change is already pending");
        require(
            msg.kind == CONFIG_KIND_RESOLVER || msg.kind == CONFIG_KIND_VERIFIER,
            "Invalid configuration kind"
        );
        require(msg.code_hash != 0, "Code hash required");

        self.config_pending = true;
        self.config_kind = msg.kind;
        self.config_target = msg.target;
        self.config_code_hash = msg.code_hash;
        self.config_executable_at = 0;

        // Reset the approver set for this fresh proposal and record the
        // proposer's implicit first approval.
        self.config_approvers = emptyMap();
        self.config_approvers.set(sender(), true);
        self.config_approvals = 1;

        // With MIN_GOV_THRESHOLD >= 2 a single proposer never reaches the
        // threshold, so the timelock is started in ApproveConfigChange.

        emit(ConfigChangeProposed{
            kind: msg.kind,
            target: msg.target,
            code_hash: msg.code_hash,
            proposer: sender()
        }.toCell());
    }

    // Approve the pending change (any signer, once each).
    receive(msg: ApproveConfigChange) {
        self.requireGovernanceSigner();
        require(self.config_pending, "No configuration change pending");
        require(msg.kind == self.config_kind, "Configuration kind mismatch");
        require(
            self.config_target != null && msg.target == self.config_target!!,
            "Configuration target mismatch"
        );
        require(self.config_approvers.get(sender()) == null, "Signer already approved");

        self.config_approvers.set(sender(), true);
        self.config_approvals = self.config_approvals + 1;

        // Start the timelock the first time the threshold is reached.
        if (self.config_approvals >= self.governance_threshold && self.config_executable_at == 0) {
            self.config_executable_at = now() + CONFIG_TIMELOCK_DELAY;
        }

        emit(ConfigChangeApproved{
            kind: self.config_kind,
            target: msg.target,
            approver: sender(),
            approvals: self.config_approvals,
            executable_at: self.config_executable_at
        }.toCell());
    }

    // Execute the pending change after threshold + timelock + code-hash proof.
    receive(msg: ExecuteConfigChange) {
        self.requireGovernanceSigner();
        require(self.config_pending, "No configuration change pending");
        require(msg.kind == self.config_kind, "Configuration kind mismatch");
        require(
            self.config_target != null && msg.target == self.config_target!!,
            "Configuration target mismatch"
        );
        require(self.config_approvals >= self.governance_threshold, "Not enough approvals");
        require(
            self.config_executable_at != 0 && now() >= self.config_executable_at,
            "Timelock has not elapsed"
        );

        // Code-hash verification (Issue #366 acceptance criterion). Prove that
        // `target` actually runs the approved code: the supplied StateInit must
        // reconstruct the target address AND its code must hash to the approved
        // value. A malicious resolver with different code can therefore never be
        // installed, even by a signer quorum that approved a specific contract.
        require(msg.code.hash() == self.config_code_hash, "Resolver code hash mismatch");
        let derived: Address = contractAddress(StateInit{ code: msg.code, data: msg.data });
        require(derived == self.config_target!!, "Target address does not match code");

        let applied_kind: Int = self.config_kind;
        let applied_target: Address = self.config_target!!;

        if (applied_kind == CONFIG_KIND_RESOLVER) {
            self.owner_resolver = self.config_target;
        } else {
            self.snapshot_verifier = self.config_target;
        }

        self.clearPendingConfig();

        emit(ConfigChangeExecuted{
            kind: applied_kind,
            target: applied_target
        }.toCell());
    }

    // Cancel the pending change (escape hatch; any signer).
    receive(msg: CancelConfigChange) {
        self.requireGovernanceSigner();
        require(self.config_pending, "No configuration change pending");
        require(msg.kind == self.config_kind, "Configuration kind mismatch");
        require(
            self.config_target != null && msg.target == self.config_target!!,
            "Configuration target mismatch"
        );

        let cancelled_kind: Int = self.config_kind;
        let cancelled_target: Address = self.config_target!!;

        self.clearPendingConfig();

        emit(ConfigChangeCancelled{
            kind: cancelled_kind,
            target: cancelled_target
        }.toCell());
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

    // Abort unless governance is configured and the sender is an authorised
    // signer. Guards every multi-sig configuration handler.
    fun requireGovernanceSigner() {
        require(self.governance_configured, "Governance not configured");
        require(self.governance_signers.get(sender()) != null, "Not a governance signer");
    }

    // Clear all pending-configuration state back to its idle defaults.
    fun clearPendingConfig() {
        self.config_pending = false;
        self.config_kind = 0;
        self.config_target = null;
        self.config_code_hash = 0;
        self.config_approvals = 0;
        self.config_executable_at = 0;
        self.config_approvers = emptyMap();
    }

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

    // Get the deployer address (governance bootstrap authority)
    get fun getDeployer(): Address {
        return self.deployer;
    }

    // ---- Governance multi-sig getters (Issue #366) ----

    // Whether the governance signer set has been installed.
    get fun isGovernanceConfigured(): Bool {
        return self.governance_configured;
    }

    // Number of approvals required to change the resolver/verifier.
    get fun getGovernanceThreshold(): Int {
        return self.governance_threshold;
    }

    // Number of authorised governance signers.
    get fun getGovernanceSignerCount(): Int {
        return self.governance_signer_count;
    }

    // Whether `addr` is an authorised governance signer.
    get fun isGovernanceSigner(addr: Address): Bool {
        return self.governance_signers.get(addr) != null;
    }

    // The configured timelock delay (seconds) for configuration changes.
    get fun getConfigTimelockDelay(): Int {
        return CONFIG_TIMELOCK_DELAY;
    }

    // Whether a configuration change is currently pending.
    get fun isConfigChangePending(): Bool {
        return self.config_pending;
    }

    // The pending change kind (meaningful only while a change is pending).
    get fun getPendingConfigKind(): Int {
        return self.config_kind;
    }

    // The pending change target (null when no change is pending).
    get fun getPendingConfigTarget(): Address? {
        return self.config_target;
    }

    // The expected code hash of the pending change target.
    get fun getPendingConfigCodeHash(): Int {
        return self.config_code_hash;
    }

    // Running approval tally for the pending change.
    get fun getPendingConfigApprovals(): Int {
        return self.config_approvals;
    }

    // Timestamp at which the pending change becomes executable (0 until the
    // threshold is reached).
    get fun getPendingConfigExecutableAt(): Int {
        return self.config_executable_at;
    }
}
