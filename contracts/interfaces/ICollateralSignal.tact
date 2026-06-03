// Collateral Signal Interface
// Based on Issue #30 - Collateral Signal Contract (TON-Based, Non-Custodial)
//
// DESIGN PRINCIPLE: This interface is READ-ONLY for external consumers.
// The protocol does NOT trust lenders, and lenders do NOT trust the protocol.
// Collateral existence is verified on-chain; enforcement happens off-protocol.
//
// IMPORTANT: This interface provides signaling ONLY. It does NOT provide:
// - Custody mechanisms
// - Locking mechanisms
// - Transfer initiation
// - Liquidation triggers

import "../types/CollateralState.tact";

// Interface for Collateral Signal (Read-Only for External Consumers)
// External lenders and Payment Hub can read collateral state through these functions.
trait ICollateralSignal {

    // Get the full collateral signal information for an NFT account
    // Returns: CollateralSignalInfo struct with state, amount, and timestamps
    abstract get fun getCollateralSignalInfo(nft_address: Address): CollateralSignalInfo;

    // Get the current collateral signal state for an NFT account
    // Returns: NONE (0), ACTIVE (1), WARNING (2), or RELEASED (3)
    abstract get fun getCollateralSignalState(nft_address: Address): Int;

    // Get the signaled collateral amount for an NFT account (informational only)
    // Returns: The amount of TON signaled as collateral (does NOT imply custody)
    abstract get fun getSignaledCollateralAmount(nft_address: Address): Int;

    // Check if an NFT account has active collateral signaled
    // Returns: true if state is ACTIVE or WARNING
    abstract get fun hasActiveCollateralSignal(nft_address: Address): Bool;
}
