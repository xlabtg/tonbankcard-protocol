// Public Collateral Status Lookup Contract
// Issue Reference: #34 - Issue 6.3 Public Collateral Status Lookup (Privacy-Preserving)
//
// NON-PRODUCTION / NOT PRODUCTION READY:
// hasActiveCollateral currently returns the privacy-preserving default instead
// of reading Account Locks state. This source is intentionally excluded from
// deployable manifests until that integration is implemented.
//
// PURPOSE:
// Provides a PUBLIC, READ-ONLY mechanism to verify whether an NFT-based account
// has active collateral commitments, WITHOUT exposing any sensitive details.
//
// DESIGN PRINCIPLE:
// "Reveal existence, not details."
//
// This contract answers ONLY ONE question:
// "Does this NFT account currently signal active collateral?"
//
// PRIVACY GUARANTEES:
// - Returns ONLY boolean (true/false)
// - No collateral amount exposed
// - No lender identity exposed
// - No loan terms exposed
// - No timestamps exposed
// - No transaction history exposed
// - No wallet linkages possible
// - No access logging
//
// PROTOCOL INVARIANTS (see docs/invariants.md):
// - I6 (Lock != Confiscation): Lookup is informational only, does not enforce restrictions
// - I7 (Adapter Isolation): External systems cannot modify state via lookup
//
// REFERENCE: docs/public-collateral-lookup.md

import "../interfaces/IPublicCollateralLookup.tact";
import "../types/LockState.tact";

// Message for deployment initialization
message Deploy {
    queryId: Int as uint64;
}

// Message for setting the account locks contract address (deployment only)
message SetAccountLocksContract {
    accountLocksAddress: Address;
}

// Public Collateral Status Lookup Contract
// Implements privacy-preserving collateral status queries
contract PublicCollateralLookup with IPublicCollateralLookup {

    // Contract owner (deployer) - used only for initialization
    owner: Address;

    // Address of the Account Locks contract
    // This is queried for collateral lock status
    accountLocksContract: Address;

    // Contract version
    const VERSION: Int = 1;

    // Initialize the contract
    init() {
        self.owner = sender();
        self.accountLocksContract = newAddress(0, 0); // Set during deployment
    }

    // ========================================================================
    // DEPLOYMENT
    // ========================================================================

    receive(msg: Deploy) {
        // Basic deployment - owner already set in init
    }

    receive(msg: SetAccountLocksContract) {
        // Only owner can set account locks contract (during deployment)
        require(sender() == self.owner, "Unauthorized");
        self.accountLocksContract = msg.accountLocksAddress;
    }

    // ========================================================================
    // PUBLIC GET METHODS (READ-ONLY)
    // ========================================================================

    // Check if an NFT account has active collateral commitments
    //
    // @param nft_address The NFT account address to query
    // @return true if active collateral, false if no collateral
    //
    // PRIVACY:
    // - Returns ONLY boolean
    // - No metadata
    // - No timestamps
    // - Constant-time execution (no branching based on state)
    //
    // NOTE: This is the ONLY public interface for collateral status lookup.
    // Any extensions to this interface MUST BE REJECTED per Issue #34.
    //
    // IMPORTANT: The actual implementation would query the Account Locks contract.
    // For now, this demonstrates the privacy-preserving interface pattern.
    get fun hasActiveCollateral(nft_address: Address): Bool {
        // In production, this would call:
        // let lockState = self.accountLocksContract.getLockState(nft_address);
        // return lockState.collateral_locked;

        // Privacy-preserving default: no collateral
        // This demonstrates the boolean-only interface
        return false;
    }

    // Get the contract version
    get fun getVersion(): Int {
        return self.VERSION;
    }

    // Get the Account Locks contract address
    get fun getAccountLocksContract(): Address {
        return self.accountLocksContract;
    }

    // Get the contract owner
    get fun getOwner(): Address {
        return self.owner;
    }

    // ========================================================================
    // COLLATERAL STATUS QUERY HELPER
    // ========================================================================

    // Returns a CollateralStatus struct with ONLY the boolean field
    // This is the canonical response format for collateral queries
    //
    // PRIVACY: The struct contains ONLY hasActiveCollateral
    // No additional fields are allowed
    get fun getCollateralStatus(nft_address: Address): CollateralStatus {
        return CollateralStatus{
            hasActiveCollateral: self.hasActiveCollateral(nft_address)
        };
    }

    // ========================================================================
    // PROHIBITED FUNCTIONS (DO NOT ADD)
    // ========================================================================

    // The following functions are EXPLICITLY PROHIBITED per Issue #34:
    //
    // - getCollateralAmount(nft_address: Address): Int
    //   PROHIBITED: Exposes financial details
    //
    // - getCollateralAsset(nft_address: Address): Address
    //   PROHIBITED: Exposes asset type
    //
    // - getLenderAddress(nft_address: Address): Address
    //   PROHIBITED: Exposes relationship
    //
    // - getLoanTerms(nft_address: Address): Cell
    //   PROHIBITED: Exposes contract terms
    //
    // - getRepaymentStatus(nft_address: Address): Int
    //   PROHIBITED: Exposes financial state
    //
    // - getLockTimestamp(nft_address: Address): Int
    //   PROHIBITED: Enables timing analysis
    //
    // - getTransactionHistory(nft_address: Address): Cell
    //   PROHIBITED: Exposes activity patterns
    //
    // - logQuery(nft_address: Address): Void
    //   PROHIBITED: Creates access patterns
    //
    // - emitQueryEvent(nft_address: Address): Void
    //   PROHIBITED: Creates access patterns
    //
    // - blockTransfer(nft_address: Address): Void
    //   PROHIBITED: This is informational only
    //
    // - enforceRestriction(nft_address: Address): Void
    //   PROHIBITED: This is informational only
    //
    // - notifyThirdParty(nft_address: Address): Void
    //   PROHIBITED: Privacy violation
    //
    // Any attempt to add these functions MUST BE REJECTED.
}
