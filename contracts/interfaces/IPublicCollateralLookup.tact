// Public Collateral Status Lookup Interface
// Issue Reference: #34 - Issue 6.3 Public Collateral Status Lookup (Privacy-Preserving)
//
// PURPOSE:
// Defines the public, read-only interface for checking if an NFT account
// has active collateral commitments.
//
// DESIGN PRINCIPLE:
// "Reveal existence, not details."
//
// PRIVACY GUARANTEES:
// - Returns ONLY boolean (true/false)
// - No metadata exposed
// - No timestamps exposed
// - No access logging
//
// PROTOCOL INVARIANTS:
// - I6 (Lock != Confiscation): Informational only, no enforcement
// - I7 (Adapter Isolation): Read-only, no state modification

// Interface for Public Collateral Status Lookup
// Provides privacy-preserving collateral status queries
trait IPublicCollateralLookup {

    // Check if an NFT account has active collateral commitments
    //
    // @param nft_address The NFT account address to query
    // @return true if active collateral, false if no collateral
    //
    // PRIVACY:
    // - Returns ONLY boolean
    // - No metadata
    // - No timing information
    // - Constant-time execution
    //
    // IMPORTANT: This is the ONLY method for collateral status lookup.
    // Any extensions MUST BE REJECTED per Issue #34.
    get fun hasActiveCollateral(nft_address: Address): Bool;

    // Get the contract version
    get fun getVersion(): Int;
}

// Output structure for collateral status queries
// IMPORTANT: This struct MUST remain minimal to preserve privacy
struct CollateralStatus {
    hasActiveCollateral: Bool;    // The ONLY field - true if active collateral
    // NO additional fields allowed:
    // - No amount
    // - No asset type
    // - No lender
    // - No timestamp
    // - No metadata
}

// PROHIBITED EXTENSIONS (DO NOT ADD)
//
// The following getters are EXPLICITLY PROHIBITED per Issue #34:
//
// get fun getCollateralAmount(nft_address: Address): Int;        // PROHIBITED
// get fun getCollateralAsset(nft_address: Address): Address;     // PROHIBITED
// get fun getLenderAddress(nft_address: Address): Address;       // PROHIBITED
// get fun getLoanTerms(nft_address: Address): Cell;              // PROHIBITED
// get fun getRepaymentStatus(nft_address: Address): Int;         // PROHIBITED
// get fun getLockTimestamp(nft_address: Address): Int;           // PROHIBITED
// get fun getTransactionHistory(nft_address: Address): Cell;     // PROHIBITED
//
// Any attempt to add these methods MUST BE REJECTED.
