// Transparency Registry Interface for Tonbankcard Protocol
// Based on Issue #40 - Governance Transparency & Public Records
//
// DESIGN PRINCIPLES:
// - Read-only interface (no write methods)
// - No admin functions
// - No protocol authority
// - Privacy-preserving (aggregated data only)
//
// This interface defines the read-only getters for the transparency layer.
// Implementations MUST NOT include any mutable state or write operations.

import "../types/TransparencyTypes.tact";

// ============================================
// TRANSPARENCY REGISTRY INTERFACE
// ============================================

trait ITransparencyRegistry {

    // ========================================
    // PROPOSAL ARCHIVE GETTERS
    // ========================================

    // Get proposal summary by ID
    // Returns null if proposal does not exist
    // Privacy: Does NOT include voter addresses or individual votes
    get fun getProposalSummary(proposal_id: Int): ProposalSummary?;

    // Get total number of proposals
    get fun getProposalCount(): Int;

    // Get count of proposals in a specific category
    get fun getProposalsByCategory(category: Int): Int;

    // Get proposal outcome
    // Returns: OUTCOME_PENDING (0), OUTCOME_ACCEPTED (1),
    //          OUTCOME_REJECTED (2), OUTCOME_NO_QUORUM (3)
    // Returns -1 if proposal does not exist
    get fun getProposalOutcome(proposal_id: Int): Int;

    // ========================================
    // VOTING SUMMARY GETTERS (AGGREGATED)
    // ========================================

    // Get voting summary for a proposal
    // Returns aggregated stats only - NO individual voter data
    // Privacy: Does NOT expose who voted or how they voted
    get fun getVotingSummary(proposal_id: Int): VotingSummary?;

    // Get quorum threshold (minimum votes required)
    get fun getQuorumThreshold(): Int;

    // Get total votes cast for a proposal (aggregate only)
    // Privacy: Does NOT expose individual vote choices
    get fun getTotalVotesCast(proposal_id: Int): Int;

    // ========================================
    // GOVERNANCE ASSET SNAPSHOT GETTERS
    // ========================================

    // Get current governance asset snapshot
    get fun getGovernanceAssetSnapshot(): AssetSnapshot;

    // Get total governance supply (fixed: 222)
    get fun getTotalGovernanceSupply(): Int;

    // Get latest snapshot block height
    get fun getLatestSnapshotBlock(): Int;

    // Get snapshot hash for external verification
    get fun getSnapshotHash(): Int;

    // ========================================
    // AGGREGATE STATISTICS GETTERS
    // ========================================

    // Get overall governance statistics
    get fun getGovernanceStats(): GovernanceStats;

    // Get statistics for a specific category
    get fun getCategoryStats(category: Int): CategoryStats;

    // ========================================
    // E4 AGGREGATE CHECKSUM GETTERS
    // (Issue #135 - On-Chain Transparency Reporting)
    //
    // Read-only checksums for the LATEST monthly aggregates anchored
    // on-chain via the three additive receive handlers
    // (RecordProtocolMetrics, RecordLockActivity, RecordParameterChange).
    // Full historical series live in the off-chain indexer
    // (TRANSPARENCY_REPORTING.md §3). Privacy guarantees of §7 apply.
    // ========================================

    // Latest protocol-metrics monthly checksum
    get fun getLatestProtocolMetrics(): ProtocolMetricsCheckpoint;

    // Latest lock-activity monthly checksum
    get fun getLatestLockActivity(): LockActivityCheckpoint;

    // Parameter-change cumulative audit summary
    get fun getParameterChangeSummary(): ParameterChangeSummary;

    // Cumulative count of RecordProtocolMetrics receipts (>=0)
    get fun getMetricPeriodsCount(): Int;

    // Cumulative count of RecordLockActivity receipts (>=0)
    get fun getLockPeriodsCount(): Int;
}
