// Key-derivation regression harness — Audit finding CONTRACTS-H1.
//
// This contract is a TEST-ONLY harness. It does not custody funds and is never
// deployed to production. It exposes, as on-chain getters, both:
//
//   * the ORIGINAL (vulnerable) additive composite-key constructions, and
//   * the FIXED, collision-resistant serialized-cell-hash constructions
//
// used by the production contracts:
//
//   * MultiSigCard.proposalKey / approvalKey
//   * RecurringPayments.mandateKey
//   * CrossChainBridge.intentKey
//
// The accompanying ts-jest spec (KeyCollision.spec.ts) uses these getters to
// prove that distinct (address, id) pairs which collided under integer addition
// now map to distinct storage keys, while legitimate per-account lookups still
// resolve deterministically.

import "@stdlib/deploy";

contract KeyDerivation with Deployable {
    init() {}

    // =========================================================================
    // FIXED constructions — these MUST stay byte-for-byte identical to the
    // production key functions they mirror (audit CONTRACTS-H1).
    // =========================================================================

    // Mirrors MultiSigCard.proposalKey
    get fun proposalKey(nft_address: Address, proposal_id: Int): Int {
        return beginCell()
            .storeAddress(nft_address)
            .storeInt(proposal_id, 257)
            .endCell()
            .hash();
    }

    // Mirrors MultiSigCard.approvalKey
    get fun approvalKey(nft_address: Address, proposal_id: Int, signer: Address): Int {
        return beginCell()
            .storeAddress(nft_address)
            .storeInt(proposal_id, 257)
            .storeAddress(signer)
            .endCell()
            .hash();
    }

    // Mirrors RecurringPayments.mandateKey
    get fun mandateKey(nft_address: Address, mandate_id: Int): Int {
        return beginCell()
            .storeAddress(nft_address)
            .storeInt(mandate_id, 257)
            .endCell()
            .hash();
    }

    // Mirrors CrossChainBridge.intentKey
    get fun intentKey(nft_address: Address, intent_id: Int): Int {
        return beginCell()
            .storeAddress(nft_address)
            .storeInt(intent_id, 257)
            .endCell()
            .hash();
    }

    // =========================================================================
    // LEGACY (vulnerable) constructions — kept only so the regression test can
    // demonstrate the collisions the fix removes. NEVER use these in production.
    //
    // The production code combined the address hash via `sha256(addr.asSlice())`.
    // The collision is a property of the INTEGER ADDITION, not of the particular
    // 256-bit hash, so these harness getters use `addr.asSlice().hash()` — a
    // 256-bit address hash that runs on the current Tact toolchain (the original
    // `sha256(Slice)` underflows on a non-byte-aligned 267-bit address slice in
    // Tact 1.4.x). Either hash exhibits the same additive aliasing.
    // =========================================================================

    get fun legacyProposalKey(nft_address: Address, proposal_id: Int): Int {
        return nft_address.asSlice().hash() + proposal_id;
    }

    // Note: the production legacyApprovalKey was
    //   sha256(addr) + proposal_id * 1000 + sha256(signer)
    // i.e. `addressHash + signerHash` (modulo the id term). Because addition is
    // commutative, (account=A, signer=B) aliases (account=B, signer=A). The spec
    // demonstrates this directly from the address hashes returned by
    // legacyProposalKey, so no overflowing two-hash getter is needed here (the
    // sum of two full 256-bit hashes exceeds Tact's 257-bit Int and traps).

    get fun legacyMandateKey(nft_address: Address, mandate_id: Int): Int {
        return nft_address.asSlice().hash() + mandate_id;
    }

    get fun legacyIntentKey(nft_address: Address, intent_id: Int): Int {
        return nft_address.asSlice().hash() + intent_id;
    }
}
