// Transparency Layer Types for Tonbankcard Protocol
// Based on Issue #40 - Governance Transparency & Public Records
//
// DESIGN PRINCIPLES:
// - All types are for read-only data exposure
// - No mutable state references
// - Privacy-preserving (no wallet addresses, no voter identities)
// - Aggregated data only for voting information

// ============================================
// PROPOSAL OUTCOME CONSTANTS
// ============================================

const OUTCOME_PENDING: Int = 0;
const OUTCOME_ACCEPTED: Int = 1;
const OUTCOME_REJECTED: Int = 2;
const OUTCOME_NO_QUORUM: Int = 3;

// ============================================
// PROPOSAL CATEGORY CONSTANTS
// (Mirrors Issue 7.2 categories)
// ============================================

const CATEGORY_ROADMAP_SIGNAL: Int = 0;
const CATEGORY_INTEGRATION_RECOMMENDATION: Int = 1;
const CATEGORY_DOCUMENTATION_UPDATE: Int = 2;
const CATEGORY_RISK_DISCLOSURE: Int = 3;
const CATEGORY_DEPRECATION_NOTICE: Int = 4;
const CATEGORY_ECOSYSTEM_GRANT_SIGNAL: Int = 5;

// Total number of fixed categories
const CATEGORY_COUNT: Int = 6;

// ============================================
// GOVERNANCE ASSET CONSTANTS
// ============================================

// Fixed total supply of TBC Diamond NFTs
const GOVERNANCE_ASSET_TOTAL_SUPPLY: Int = 222;

// ============================================
// DATA STRUCTURES
// ============================================

// Proposal summary - privacy-preserving public record
// Does NOT include: voter addresses, individual votes, timestamps
struct ProposalSummary {
    proposal_id: Int as uint64;           // Unique proposal identifier
    proposal_hash: Int as uint256;        // Hash of proposal content (not content itself)
    category: Int as uint8;               // Proposal category (0-5)
    voting_window_start: Int as uint32;   // Start of voting period (unix timestamp)
    voting_window_end: Int as uint32;     // End of voting period (unix timestamp)
    outcome: Int as uint8;                // 0=PENDING, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
}

// Voting summary - aggregated only, no individual voter data
// PRIVACY: Does NOT expose who voted or how they voted
struct VotingSummary {
    proposal_id: Int as uint64;           // Reference to proposal
    total_votes_cast: Int as uint16;      // Aggregate count only (max 222)
    quorum_threshold: Int as uint16;      // Minimum votes for quorum
    quorum_met: Bool;                     // Whether quorum was achieved
    passed: Bool;                         // Whether proposal passed (quorum + majority)
}

// Governance asset snapshot
// Provides verifiable point-in-time record of governance assets
struct AssetSnapshot {
    total_supply: Int as uint16;          // Fixed: 222 TBC Diamond NFTs
    snapshot_block_height: Int as uint64; // Block height at snapshot time
    snapshot_hash: Int as uint256;        // Hash for external verification
}

// Governance statistics - aggregated protocol-wide stats
struct GovernanceStats {
    total_proposals: Int as uint32;       // Total proposals submitted
    proposals_accepted: Int as uint32;    // Count of accepted proposals
    proposals_rejected: Int as uint32;    // Count of rejected proposals
    proposals_no_quorum: Int as uint32;   // Count of no-quorum proposals
    proposals_pending: Int as uint32;     // Count of active proposals
}

// Category statistics - per-category proposal counts
struct CategoryStats {
    category: Int as uint8;               // Category ID (0-5)
    proposal_count: Int as uint32;        // Number of proposals in category
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check if outcome is valid
inline fun isValidOutcome(outcome: Int): Bool {
    return outcome >= OUTCOME_PENDING && outcome <= OUTCOME_NO_QUORUM;
}

// Check if category is valid
inline fun isValidCategory(category: Int): Bool {
    return category >= CATEGORY_ROADMAP_SIGNAL && category <= CATEGORY_ECOSYSTEM_GRANT_SIGNAL;
}

// Check if proposal is still pending
inline fun isPending(outcome: Int): Bool {
    return outcome == OUTCOME_PENDING;
}

// Check if proposal was accepted
inline fun isAccepted(outcome: Int): Bool {
    return outcome == OUTCOME_ACCEPTED;
}

// Check if proposal was rejected
inline fun isRejected(outcome: Int): Bool {
    return outcome == OUTCOME_REJECTED;
}

// Check if proposal failed quorum
inline fun isNoQuorum(outcome: Int): Bool {
    return outcome == OUTCOME_NO_QUORUM;
}

// Get human-readable category name (for documentation)
// Returns category index as string representation
inline fun getCategoryIndex(category: Int): Int {
    if (category < CATEGORY_ROADMAP_SIGNAL || category > CATEGORY_ECOSYSTEM_GRANT_SIGNAL) {
        return -1; // Invalid category
    }
    return category;
}
