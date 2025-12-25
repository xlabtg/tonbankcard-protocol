// NFT Account Resolver Interface
// Based on Issue #5 reference to NFT Account Resolver (Issue 3.1)

// Interface for NFT Account Resolver
// Verifies NFT ownership
trait INFTResolver {

    // Get the owner of an NFT card
    get fun getOwner(nft_address: Address): Address;

    // Verify that sender is the owner of the NFT
    get fun isOwner(nft_address: Address, claimed_owner: Address): Bool;
}
