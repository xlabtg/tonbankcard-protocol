// Transparency Registry Contract for Tonbankcard Protocol
// Implementation of Issue #40 - Governance Transparency & Public Records (Read-Only)
//
// CORE PRINCIPLE: Governance must be observable, not actionable.
//
// DESIGN CONSTRAINTS:
// - Read-only getters only (no state mutations)
// - No admin functions
// - No protocol authority
// - Zero execution power
// - Privacy-preserving (aggregated data only)
//
// PRIVACY GUARANTEES:
// - No wallet addresses exposed
// - No NFT holder identities exposed
// - No vote timestamps exposed
// - No individual vote choices exposed
// - No delegation graphs exposed
//
// PROTOCOL INVARIANTS:
// - This contract has ZERO influence on protocol behavior
// - All data is historical/archival only
// - No mechanism exists to execute governance outcomes
// - Transparency layer cannot gate any protocol operations

import "./types/TransparencyTypes.tact";
import "./interfaces/ITransparencyRegistry.tact";

// ============================================
// TRANSPARENCY REGISTRY CONTRACT
// ============================================

contract TransparencyRegistry with ITransparencyRegistry {

    // ========================================
    // STORAGE
    // ========================================

    // Proposal data (immutable after creation)
    // Maps proposal_id => ProposalSummary
    proposal_summaries: map<Int, ProposalSummary>;

    // Voting summaries (aggregated, privacy-preserving)
    // Maps proposal_id => VotingSummary
    voting_summaries: map<Int, VotingSummary>;

    // Proposal counts by category
    // Maps category => count
    category_counts: map<Int, Int>;

    // Governance statistics (aggregate counters)
    total_proposals: Int as uint32;
    proposals_accepted: Int as uint32;
    proposals_rejected: Int as uint32;
    proposals_no_quorum: Int as uint32;

    // Latest snapshot data
    latest_snapshot_block: Int as uint64;
    latest_snapshot_hash: Int as uint256;

    // Quorum threshold (configurable at init)
    quorum_threshold: Int as uint16;

    // ========================================
    // E4 AGGREGATE CHECKSUM STORAGE
    // (Issue #135 - On-Chain Transparency Reporting)
    //
    // Append-only checksums for monthly protocol/lock/parameter
    // aggregates. Only the LATEST period and cumulative counters are
    // kept on-chain - the full series lives in the off-chain indexer
    // (TRANSPARENCY_REPORTING.md §3). Storing only the latest period
    // keeps the contract footprint bounded while still anchoring an
    // on-chain checksum for the indexer to verify against.
    // ========================================

    // Latest protocol metrics period (one checksum at a time)
    latest_metrics_period_start: Int as uint32;
    latest_metrics_period_end: Int as uint32;
    latest_metrics_active_accounts: Int as uint32;
    latest_metrics_tbc_volume_transferred: Int as coins;
    latest_metrics_transfer_count: Int as uint32;

    // Latest lock activity period (one checksum at a time)
    latest_lock_period_start: Int as uint32;
    latest_lock_period_end: Int as uint32;
    latest_lock_locks_set: Int as uint32;
    latest_lock_locks_cleared: Int as uint32;
    latest_lock_locks_active: Int as uint32;
    latest_lock_appeals_filed: Int as uint32;
    latest_lock_appeals_overturned: Int as uint32;
    latest_lock_appeals_upheld: Int as uint32;

    // Parameter change audit anchor
    total_parameter_changes: Int as uint32;
    latest_parameter_effective_block: Int as uint64;

    // Cumulative E4 event counters
    total_metric_periods: Int as uint32;
    total_lock_periods: Int as uint32;

    // ========================================
    // INITIALIZATION
    // ========================================

    init(quorum_threshold: Int) {
        self.proposal_summaries = emptyMap();
        self.voting_summaries = emptyMap();
        self.category_counts = emptyMap();

        self.total_proposals = 0;
        self.proposals_accepted = 0;
        self.proposals_rejected = 0;
        self.proposals_no_quorum = 0;

        self.latest_snapshot_block = 0;
        self.latest_snapshot_hash = 0;

        // Default quorum: >50% of 222 = 112 votes
        self.quorum_threshold = quorum_threshold;

        // E4 aggregate checksums (zero-initialized until first record)
        self.latest_metrics_period_start = 0;
        self.latest_metrics_period_end = 0;
        self.latest_metrics_active_accounts = 0;
        self.latest_metrics_tbc_volume_transferred = 0;
        self.latest_metrics_transfer_count = 0;

        self.latest_lock_period_start = 0;
        self.latest_lock_period_end = 0;
        self.latest_lock_locks_set = 0;
        self.latest_lock_locks_cleared = 0;
        self.latest_lock_locks_active = 0;
        self.latest_lock_appeals_filed = 0;
        self.latest_lock_appeals_overturned = 0;
        self.latest_lock_appeals_upheld = 0;

        self.total_parameter_changes = 0;
        self.latest_parameter_effective_block = 0;

        self.total_metric_periods = 0;
        self.total_lock_periods = 0;
    }

    // ========================================
    // PROPOSAL ARCHIVE GETTERS
    // ========================================

    // Get proposal summary by ID
    // Returns null if proposal does not exist
    get fun getProposalSummary(proposal_id: Int): ProposalSummary? {
        return self.proposal_summaries.get(proposal_id);
    }

    // Get total number of proposals
    get fun getProposalCount(): Int {
        return self.total_proposals;
    }

    // Get count of proposals in a specific category
    get fun getProposalsByCategory(category: Int): Int {
        let count: Int? = self.category_counts.get(category);
        if (count == null) {
            return 0;
        }
        return count!!;
    }

    // Get proposal outcome
    // Returns: OUTCOME_PENDING (0), OUTCOME_ACCEPTED (1),
    //          OUTCOME_REJECTED (2), OUTCOME_NO_QUORUM (3)
    // Returns -1 if proposal does not exist
    get fun getProposalOutcome(proposal_id: Int): Int {
        let summary: ProposalSummary? = self.proposal_summaries.get(proposal_id);
        if (summary == null) {
            return -1;
        }
        return summary!!.outcome;
    }

    // ========================================
    // VOTING SUMMARY GETTERS (AGGREGATED)
    // ========================================

    // Get voting summary for a proposal
    // Returns aggregated stats only - NO individual voter data
    get fun getVotingSummary(proposal_id: Int): VotingSummary? {
        return self.voting_summaries.get(proposal_id);
    }

    // Get quorum threshold (minimum votes required)
    get fun getQuorumThreshold(): Int {
        return self.quorum_threshold;
    }

    // Get total votes cast for a proposal (aggregate only)
    get fun getTotalVotesCast(proposal_id: Int): Int {
        let summary: VotingSummary? = self.voting_summaries.get(proposal_id);
        if (summary == null) {
            return 0;
        }
        return summary!!.total_votes_cast;
    }

    // ========================================
    // GOVERNANCE ASSET SNAPSHOT GETTERS
    // ========================================

    // Get current governance asset snapshot
    get fun getGovernanceAssetSnapshot(): AssetSnapshot {
        return AssetSnapshot{
            total_supply: GOVERNANCE_ASSET_TOTAL_SUPPLY,
            snapshot_block_height: self.latest_snapshot_block,
            snapshot_hash: self.latest_snapshot_hash
        };
    }

    // Get total governance supply (fixed: 222)
    get fun getTotalGovernanceSupply(): Int {
        return GOVERNANCE_ASSET_TOTAL_SUPPLY;
    }

    // Get latest snapshot block height
    get fun getLatestSnapshotBlock(): Int {
        return self.latest_snapshot_block;
    }

    // Get snapshot hash for external verification
    get fun getSnapshotHash(): Int {
        return self.latest_snapshot_hash;
    }

    // ========================================
    // AGGREGATE STATISTICS GETTERS
    // ========================================

    // Get overall governance statistics
    get fun getGovernanceStats(): GovernanceStats {
        let pending: Int = self.total_proposals -
            self.proposals_accepted -
            self.proposals_rejected -
            self.proposals_no_quorum;

        return GovernanceStats{
            total_proposals: self.total_proposals,
            proposals_accepted: self.proposals_accepted,
            proposals_rejected: self.proposals_rejected,
            proposals_no_quorum: self.proposals_no_quorum,
            proposals_pending: pending
        };
    }

    // Get statistics for a specific category
    get fun getCategoryStats(category: Int): CategoryStats {
        let count: Int = self.getProposalsByCategory(category);
        return CategoryStats{
            category: category,
            proposal_count: count
        };
    }

    // ========================================
    // DATA INGESTION (FROM PROPOSAL REGISTRY)
    // ========================================

    // Receive proposal record from ProposalRegistry
    // This is the ONLY way data enters the transparency layer
    // Note: This is append-only - records cannot be modified after creation
    receive(msg: RecordProposal) {
        // Validate category
        require(isValidCategory(msg.category), "Invalid category");

        // Create proposal summary
        let summary: ProposalSummary = ProposalSummary{
            proposal_id: msg.proposal_id,
            proposal_hash: msg.proposal_hash,
            category: msg.category,
            voting_window_start: msg.voting_window_start,
            voting_window_end: msg.voting_window_end,
            outcome: OUTCOME_PENDING
        };

        // Store proposal (append-only)
        self.proposal_summaries.set(msg.proposal_id, summary);

        // Initialize voting summary with zero votes
        let voting: VotingSummary = VotingSummary{
            proposal_id: msg.proposal_id,
            total_votes_cast: 0,
            quorum_threshold: self.quorum_threshold,
            quorum_met: false,
            passed: false
        };
        self.voting_summaries.set(msg.proposal_id, voting);

        // Update counters
        self.total_proposals = self.total_proposals + 1;
        let current_count: Int = self.getProposalsByCategory(msg.category);
        self.category_counts.set(msg.category, current_count + 1);

        // Emit event for indexing
        emit(ProposalRecorded{
            proposal_id: msg.proposal_id,
            category: msg.category,
            timestamp: now()
        }.toCell());
    }

    // Receive voting result update
    // Updates aggregated voting data only - no individual votes stored
    receive(msg: RecordVotingResult) {
        // Validate proposal exists
        let summary: ProposalSummary? = self.proposal_summaries.get(msg.proposal_id);
        require(summary != null, "Proposal not found");

        // Validate outcome
        require(isValidOutcome(msg.outcome), "Invalid outcome");

        // Update proposal outcome
        let updated_summary: ProposalSummary = ProposalSummary{
            proposal_id: summary!!.proposal_id,
            proposal_hash: summary!!.proposal_hash,
            category: summary!!.category,
            voting_window_start: summary!!.voting_window_start,
            voting_window_end: summary!!.voting_window_end,
            outcome: msg.outcome
        };
        self.proposal_summaries.set(msg.proposal_id, updated_summary);

        // Update voting summary (aggregated only)
        let quorum_met: Bool = msg.total_votes >= self.quorum_threshold;
        let voting: VotingSummary = VotingSummary{
            proposal_id: msg.proposal_id,
            total_votes_cast: msg.total_votes,
            quorum_threshold: self.quorum_threshold,
            quorum_met: quorum_met,
            passed: msg.outcome == OUTCOME_ACCEPTED
        };
        self.voting_summaries.set(msg.proposal_id, voting);

        // Update outcome counters
        if (msg.outcome == OUTCOME_ACCEPTED) {
            self.proposals_accepted = self.proposals_accepted + 1;
        } else if (msg.outcome == OUTCOME_REJECTED) {
            self.proposals_rejected = self.proposals_rejected + 1;
        } else if (msg.outcome == OUTCOME_NO_QUORUM) {
            self.proposals_no_quorum = self.proposals_no_quorum + 1;
        }

        // Emit event for indexing
        emit(VotingResultRecorded{
            proposal_id: msg.proposal_id,
            outcome: msg.outcome,
            total_votes: msg.total_votes,
            timestamp: now()
        }.toCell());
    }

    // Receive snapshot update
    receive(msg: RecordSnapshot) {
        self.latest_snapshot_block = msg.block_height;
        self.latest_snapshot_hash = msg.snapshot_hash;

        // Emit event for indexing
        emit(SnapshotRecorded{
            block_height: msg.block_height,
            snapshot_hash: msg.snapshot_hash,
            timestamp: now()
        }.toCell());
    }

    // ========================================
    // E4 ADDITIVE RECEIVE HANDLERS
    // (Issue #135 - On-Chain Transparency Reporting)
    //
    // These handlers anchor monthly aggregates on-chain so the
    // off-chain indexer can cross-check its derived counters. Each
    // handler is append-only: it overwrites the LATEST checksum and
    // increments a cumulative counter; nothing is deleted, and no
    // governance state is altered (TRANSPARENCY_REPORTING.md §2.4).
    // ========================================

    receive(msg: RecordProtocolMetrics) {
        // Period must be well-formed (end strictly after start) and
        // monotonically non-decreasing relative to the previous period
        // end (append-only timeline).
        require(msg.period_end > msg.period_start, "Invalid metrics period");
        require(msg.period_end >= self.latest_metrics_period_end, "Metrics period regression");

        self.latest_metrics_period_start = msg.period_start;
        self.latest_metrics_period_end = msg.period_end;
        self.latest_metrics_active_accounts = msg.active_accounts;
        self.latest_metrics_tbc_volume_transferred = msg.tbc_volume_transferred;
        self.latest_metrics_transfer_count = msg.transfer_count;
        self.total_metric_periods = self.total_metric_periods + 1;

        emit(ProtocolMetricsRecorded{
            period_start: msg.period_start,
            period_end: msg.period_end,
            active_accounts: msg.active_accounts,
            tbc_volume_transferred: msg.tbc_volume_transferred,
            transfer_count: msg.transfer_count,
            timestamp: now()
        }.toCell());
    }

    receive(msg: RecordLockActivity) {
        require(msg.period_end > msg.period_start, "Invalid lock period");
        require(msg.period_end >= self.latest_lock_period_end, "Lock period regression");
        // Appeal book-keeping integrity: filed >= overturned + upheld
        require(msg.appeals_filed >= msg.appeals_overturned + msg.appeals_upheld, "Appeals book-keeping mismatch");

        self.latest_lock_period_start = msg.period_start;
        self.latest_lock_period_end = msg.period_end;
        self.latest_lock_locks_set = msg.locks_set;
        self.latest_lock_locks_cleared = msg.locks_cleared;
        self.latest_lock_locks_active = msg.locks_active;
        self.latest_lock_appeals_filed = msg.appeals_filed;
        self.latest_lock_appeals_overturned = msg.appeals_overturned;
        self.latest_lock_appeals_upheld = msg.appeals_upheld;
        self.total_lock_periods = self.total_lock_periods + 1;

        emit(LockActivityRecorded{
            period_start: msg.period_start,
            period_end: msg.period_end,
            locks_set: msg.locks_set,
            locks_cleared: msg.locks_cleared,
            locks_active: msg.locks_active,
            appeals_filed: msg.appeals_filed,
            appeals_overturned: msg.appeals_overturned,
            appeals_upheld: msg.appeals_upheld,
            timestamp: now()
        }.toCell());
    }

    receive(msg: RecordParameterChange) {
        // Effective block must be monotonic (append-only audit trail)
        require(msg.effective_block >= self.latest_parameter_effective_block, "Parameter effective block regression");
        // Hash must actually differ - rejecting no-op records prevents
        // a benign log being mis-attributed to a real parameter change
        require(msg.old_value_hash != msg.new_value_hash, "Parameter change is a no-op");

        self.total_parameter_changes = self.total_parameter_changes + 1;
        self.latest_parameter_effective_block = msg.effective_block;

        emit(ParameterChangeRecorded{
            parameter_id: msg.parameter_id,
            proposal_id: msg.proposal_id,
            old_value_hash: msg.old_value_hash,
            new_value_hash: msg.new_value_hash,
            effective_block: msg.effective_block,
            timestamp: now()
        }.toCell());
    }

    // ========================================
    // E4 AGGREGATE GETTERS
    // ========================================

    get fun getLatestProtocolMetrics(): ProtocolMetricsCheckpoint {
        return ProtocolMetricsCheckpoint{
            period_start: self.latest_metrics_period_start,
            period_end: self.latest_metrics_period_end,
            active_accounts: self.latest_metrics_active_accounts,
            tbc_volume_transferred: self.latest_metrics_tbc_volume_transferred,
            transfer_count: self.latest_metrics_transfer_count
        };
    }

    get fun getLatestLockActivity(): LockActivityCheckpoint {
        return LockActivityCheckpoint{
            period_start: self.latest_lock_period_start,
            period_end: self.latest_lock_period_end,
            locks_set: self.latest_lock_locks_set,
            locks_cleared: self.latest_lock_locks_cleared,
            locks_active: self.latest_lock_locks_active,
            appeals_filed: self.latest_lock_appeals_filed,
            appeals_overturned: self.latest_lock_appeals_overturned,
            appeals_upheld: self.latest_lock_appeals_upheld
        };
    }

    get fun getParameterChangeSummary(): ParameterChangeSummary {
        return ParameterChangeSummary{
            total_parameter_changes: self.total_parameter_changes,
            latest_effective_block: self.latest_parameter_effective_block
        };
    }

    get fun getMetricPeriodsCount(): Int {
        return self.total_metric_periods;
    }

    get fun getLockPeriodsCount(): Int {
        return self.total_lock_periods;
    }
}

// ============================================
// MESSAGES (INBOUND FROM GOVERNANCE CONTRACTS)
// ============================================

// Message to record a new proposal
message RecordProposal {
    proposal_id: Int as uint64;
    proposal_hash: Int as uint256;
    category: Int as uint8;
    voting_window_start: Int as uint32;
    voting_window_end: Int as uint32;
}

// Message to record voting result (aggregated only)
// PRIVACY: Does NOT include individual vote data
message RecordVotingResult {
    proposal_id: Int as uint64;
    outcome: Int as uint8;           // 0=PENDING, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
    total_votes: Int as uint16;      // Aggregate count only
}

// Message to record snapshot update
message RecordSnapshot {
    block_height: Int as uint64;
    snapshot_hash: Int as uint256;
}

// ============================================
// EVENTS (FOR OFF-CHAIN INDEXING)
// ============================================

// Event emitted when proposal is recorded
message ProposalRecorded {
    proposal_id: Int as uint64;
    category: Int as uint8;
    timestamp: Int as uint32;
}

// Event emitted when voting result is recorded
message VotingResultRecorded {
    proposal_id: Int as uint64;
    outcome: Int as uint8;
    total_votes: Int as uint16;
    timestamp: Int as uint32;
}

// Event emitted when snapshot is recorded
message SnapshotRecorded {
    block_height: Int as uint64;
    snapshot_hash: Int as uint256;
    timestamp: Int as uint32;
}

// ============================================
// E4 ADDITIVE MESSAGES (INBOUND)
// (Issue #135 - On-Chain Transparency Reporting)
//
// Sent by the E1 / E3 multi-sig writers when publishing the monthly
// transparency report. The sender is the multi-sig writer; no
// individual user addresses are persisted by these messages.
// ============================================

message RecordProtocolMetrics {
    period_start: Int as uint32;
    period_end: Int as uint32;
    active_accounts: Int as uint32;
    tbc_volume_transferred: Int as coins;
    transfer_count: Int as uint32;
}

message RecordLockActivity {
    period_start: Int as uint32;
    period_end: Int as uint32;
    locks_set: Int as uint32;
    locks_cleared: Int as uint32;
    locks_active: Int as uint32;
    appeals_filed: Int as uint32;
    appeals_overturned: Int as uint32;
    appeals_upheld: Int as uint32;
}

message RecordParameterChange {
    parameter_id: Int as uint64;
    proposal_id: Int as uint64;
    old_value_hash: Int as uint256;
    new_value_hash: Int as uint256;
    effective_block: Int as uint64;
}

// ============================================
// E4 ADDITIVE EVENTS (OUTBOUND - for indexing)
// ============================================

message ProtocolMetricsRecorded {
    period_start: Int as uint32;
    period_end: Int as uint32;
    active_accounts: Int as uint32;
    tbc_volume_transferred: Int as coins;
    transfer_count: Int as uint32;
    timestamp: Int as uint32;
}

message LockActivityRecorded {
    period_start: Int as uint32;
    period_end: Int as uint32;
    locks_set: Int as uint32;
    locks_cleared: Int as uint32;
    locks_active: Int as uint32;
    appeals_filed: Int as uint32;
    appeals_overturned: Int as uint32;
    appeals_upheld: Int as uint32;
    timestamp: Int as uint32;
}

message ParameterChangeRecorded {
    parameter_id: Int as uint64;
    proposal_id: Int as uint64;
    old_value_hash: Int as uint256;
    new_value_hash: Int as uint256;
    effective_block: Int as uint64;
    timestamp: Int as uint32;
}
