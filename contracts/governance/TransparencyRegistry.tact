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
//
// SENDER AUTHENTICATION (Issue #365 - HIGH, blocks mainnet):
// - The data-ingestion handlers (RecordProposal, RecordVotingResult,
//   RecordSnapshot, RecordProtocolMetrics, RecordLockActivity,
//   RecordParameterChange) accept records ONLY from the authorized writer
//   contract designated for each data domain. Until a writer is configured,
//   the matching handler fails closed (rejects every record), so fake
//   transparency data can never be injected — not even before the real
//   writers are wired up.
// - The `deployer` is a CONFIGURATION authority only: it designates which
//   on-chain contracts may append records. It CANNOT write records itself,
//   cannot mutate or delete archived data, and cannot gate any protocol
//   operation. Granting it the ability to name the trusted writers does not
//   give it protocol authority — the "observation, not control" invariant
//   above is preserved. In production the deployer MUST be the governance
//   multi-sig and any writer reassignment is expected to be timelocked at
//   that multi-sig layer (see docs/governance/TRANSPARENCY_REPORTING.md SR-1).

import "@stdlib/deploy";
import "./types/TransparencyTypes.tact";
import "./interfaces/ITransparencyRegistry.tact";

// ============================================
// AUTHORIZED-WRITER ROLE IDS
// (used only in the AuthorizedWriterUpdated event so off-chain indexers
//  can tell which writer slot was (re)assigned)
// ============================================

const WRITER_ROLE_PROPOSAL_REGISTRY: Int = 0;
const WRITER_ROLE_SNAPSHOT_VERIFIER: Int = 1;
const WRITER_ROLE_REPORT_WRITER: Int = 2;

// ============================================
// TRANSPARENCY REGISTRY CONTRACT
// ============================================

contract TransparencyRegistry with ITransparencyRegistry, Deployable {

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
    // SENDER AUTHENTICATION STATE (Issue #365)
    //
    // `deployer` is the configuration authority captured at init() (the
    // address that deployed the contract). It can ONLY (re)assign the
    // authorized writer addresses below — it can never write records or
    // alter archived data. In production it is the governance multi-sig.
    //
    // Each authorized-writer slot starts null so that the matching
    // record handler fails closed until a real writer is configured:
    //   - proposal_registry -> RecordProposal, RecordVotingResult
    //   - snapshot_verifier -> RecordSnapshot
    //   - report_writer     -> RecordProtocolMetrics, RecordLockActivity,
    //                          RecordParameterChange
    // ========================================

    deployer: Address;
    proposal_registry: Address?;
    snapshot_verifier: Address?;
    report_writer: Address?;

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

        // Sender authentication (Issue #365): record the deployer as the
        // configuration authority and start every writer slot unset so all
        // ingestion handlers fail closed until the trusted writers are wired up.
        self.deployer = sender();
        self.proposal_registry = null;
        self.snapshot_verifier = null;
        self.report_writer = null;

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
    // SENDER AUTHENTICATION — CONFIGURATION (Issue #365)
    //
    // Deployer-only setters that designate which on-chain contract may
    // append each class of record. They are intentionally UPDATABLE (no
    // "already set" guard) so a writer can be rotated if a sibling contract
    // is redeployed — the acceptance criteria require the deployer to be
    // able to *update* authorized senders. In production the deployer is the
    // governance multi-sig and any rotation is timelocked at that layer
    // (docs/governance/TRANSPARENCY_REPORTING.md SR-1).
    // ========================================

    // Designate the contract allowed to append proposal/voting records
    // (RecordProposal, RecordVotingResult). Mirrors the ProposalRegistry
    // deployer-config pattern (ProposalRegistry.tact SetOwnerResolver).
    receive(msg: SetProposalRegistry) {
        require(sender() == self.deployer, "Unauthorized: only deployer can configure writers");
        self.proposal_registry = msg.registry;
        emit(AuthorizedWriterUpdated{
            writer_role: WRITER_ROLE_PROPOSAL_REGISTRY,
            writer: msg.registry,
            timestamp: now()
        }.toCell());
    }

    // Designate the contract allowed to append snapshot records (RecordSnapshot)
    receive(msg: SetSnapshotVerifier) {
        require(sender() == self.deployer, "Unauthorized: only deployer can configure writers");
        self.snapshot_verifier = msg.verifier;
        emit(AuthorizedWriterUpdated{
            writer_role: WRITER_ROLE_SNAPSHOT_VERIFIER,
            writer: msg.verifier,
            timestamp: now()
        }.toCell());
    }

    // Designate the contract allowed to append the E4 monthly aggregates
    // (RecordProtocolMetrics, RecordLockActivity, RecordParameterChange)
    receive(msg: SetReportWriter) {
        require(sender() == self.deployer, "Unauthorized: only deployer can configure writers");
        self.report_writer = msg.writer;
        emit(AuthorizedWriterUpdated{
            writer_role: WRITER_ROLE_REPORT_WRITER,
            writer: msg.writer,
            timestamp: now()
        }.toCell());
    }

    // ========================================
    // SENDER AUTHENTICATION — GUARDS (Issue #365)
    //
    // Fail-closed: if the writer slot is still null (not yet configured)
    // the record is rejected, so fake transparency data can never be
    // injected — not even in the window between deployment and writer
    // configuration. Once configured, only the exact authorized address
    // may append records.
    // ========================================

    fun requireProposalRegistryWriter() {
        require(self.proposal_registry != null, "Unauthorized: ProposalRegistry writer not configured");
        require(sender() == self.proposal_registry!!, "Unauthorized: only ProposalRegistry");
    }

    fun requireSnapshotVerifierWriter() {
        require(self.snapshot_verifier != null, "Unauthorized: SnapshotVerifier writer not configured");
        require(sender() == self.snapshot_verifier!!, "Unauthorized: only SnapshotVerifier");
    }

    fun requireReportWriter() {
        require(self.report_writer != null, "Unauthorized: report writer not configured");
        require(sender() == self.report_writer!!, "Unauthorized: only report writer");
    }

    // ========================================
    // PROPOSAL ARCHIVE GETTERS
    // ========================================

    // Get proposal summary by ID
    // Returns null if proposal does not exist
    override get fun getProposalSummary(proposal_id: Int): ProposalSummary? {
        return self.proposal_summaries.get(proposal_id);
    }

    // Get total number of proposals
    override get fun getProposalCount(): Int {
        return self.total_proposals;
    }

    // Get count of proposals in a specific category
    override get fun getProposalsByCategory(category: Int): Int {
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
    override get fun getProposalOutcome(proposal_id: Int): Int {
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
    override get fun getVotingSummary(proposal_id: Int): VotingSummary? {
        return self.voting_summaries.get(proposal_id);
    }

    // Get quorum threshold (minimum votes required)
    override get fun getQuorumThreshold(): Int {
        return self.quorum_threshold;
    }

    // Get total votes cast for a proposal (aggregate only)
    override get fun getTotalVotesCast(proposal_id: Int): Int {
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
    override get fun getGovernanceAssetSnapshot(): AssetSnapshot {
        return AssetSnapshot{
            total_supply: GOVERNANCE_ASSET_TOTAL_SUPPLY,
            snapshot_block_height: self.latest_snapshot_block,
            snapshot_hash: self.latest_snapshot_hash
        };
    }

    // Get total governance supply (fixed: 222)
    override get fun getTotalGovernanceSupply(): Int {
        return GOVERNANCE_ASSET_TOTAL_SUPPLY;
    }

    // Get latest snapshot block height
    override get fun getLatestSnapshotBlock(): Int {
        return self.latest_snapshot_block;
    }

    // Get snapshot hash for external verification
    override get fun getSnapshotHash(): Int {
        return self.latest_snapshot_hash;
    }

    // ========================================
    // AGGREGATE STATISTICS GETTERS
    // ========================================

    // Get overall governance statistics
    override get fun getGovernanceStats(): GovernanceStats {
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
    override get fun getCategoryStats(category: Int): CategoryStats {
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
        // Sender authentication (Issue #365): only the configured ProposalRegistry
        self.requireProposalRegistryWriter();

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
        // Sender authentication (Issue #365): only the configured ProposalRegistry
        self.requireProposalRegistryWriter();

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
        // Sender authentication (Issue #365): only the configured SnapshotVerifier
        self.requireSnapshotVerifierWriter();

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
        // Sender authentication (Issue #365): only the configured report writer
        self.requireReportWriter();

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
        // Sender authentication (Issue #365): only the configured report writer
        self.requireReportWriter();

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
        // Sender authentication (Issue #365): only the configured report writer
        self.requireReportWriter();

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

    override get fun getLatestProtocolMetrics(): ProtocolMetricsCheckpoint {
        return ProtocolMetricsCheckpoint{
            period_start: self.latest_metrics_period_start,
            period_end: self.latest_metrics_period_end,
            active_accounts: self.latest_metrics_active_accounts,
            tbc_volume_transferred: self.latest_metrics_tbc_volume_transferred,
            transfer_count: self.latest_metrics_transfer_count
        };
    }

    override get fun getLatestLockActivity(): LockActivityCheckpoint {
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

    override get fun getParameterChangeSummary(): ParameterChangeSummary {
        return ParameterChangeSummary{
            total_parameter_changes: self.total_parameter_changes,
            latest_effective_block: self.latest_parameter_effective_block
        };
    }

    override get fun getMetricPeriodsCount(): Int {
        return self.total_metric_periods;
    }

    override get fun getLockPeriodsCount(): Int {
        return self.total_lock_periods;
    }

    // ========================================
    // SENDER AUTHENTICATION GETTERS (Issue #365)
    //
    // Read-only visibility into the configuration authority and the
    // currently-authorized writers. A null writer means that data domain
    // still fails closed (no writer configured yet).
    // ========================================

    // Configuration authority captured at init (the deployer / governance multi-sig)
    get fun getDeployer(): Address {
        return self.deployer;
    }

    // Address allowed to append proposal/voting records (null until configured)
    get fun getProposalRegistry(): Address? {
        return self.proposal_registry;
    }

    // Address allowed to append snapshot records (null until configured)
    get fun getSnapshotVerifier(): Address? {
        return self.snapshot_verifier;
    }

    // Address allowed to append E4 monthly aggregates (null until configured)
    get fun getReportWriter(): Address? {
        return self.report_writer;
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

// ============================================
// SENDER AUTHENTICATION — CONFIGURATION MESSAGES (Issue #365)
//
// Deployer-only messages used to designate which on-chain contract is
// authorized to append each class of record. These do NOT write any
// transparency data themselves — they only (re)assign the trusted writer
// slots (mirrors ProposalRegistry.SetOwnerResolver / SetSnapshotVerifier).
// ============================================

// Set/rotate the contract allowed to send RecordProposal & RecordVotingResult
message SetProposalRegistry {
    registry: Address;
}

// Set/rotate the contract allowed to send RecordSnapshot
message SetSnapshotVerifier {
    verifier: Address;
}

// Set/rotate the contract allowed to send the E4 monthly aggregates
// (RecordProtocolMetrics, RecordLockActivity, RecordParameterChange)
message SetReportWriter {
    writer: Address;
}

// ============================================
// SENDER AUTHENTICATION — EVENT (OUTBOUND, for indexing)
//
// Emitted whenever a writer slot is (re)assigned so off-chain indexers can
// audit the authorization history. writer_role is one of the
// WRITER_ROLE_* constants declared at the top of this file.
// ============================================

message AuthorizedWriterUpdated {
    writer_role: Int as uint8;
    writer: Address;
    timestamp: Int as uint32;
}
