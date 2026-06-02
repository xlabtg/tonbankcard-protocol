// Test-only NFT ownership resolver for ProposalRegistry regression tests.
//
// Stands in for the production NFT Account Resolver (TEP-62 owner resolution).
// It holds an explicit nft_id -> owner mapping seeded by the tests and answers
// the registry's ResolveOwnership requests with the authoritative owner. In a
// real deployment the resolver performs an on-chain cross-contract lookup of the
// Diamond NFT item's owner instead of reading a local map.
//
// This file is NOT a production artifact. It imports the registry purely to
// reuse the shared ResolveOwnership / OwnershipResolved message definitions so
// that their opcodes match the registry exactly.

import "../ProposalRegistry.tact";
import "@stdlib/deploy";

// Seed/replace the owner of a Diamond NFT (test harness only).
message RegisterOwner {
    nft_id: Int as uint64;
    owner: Address;
}

contract TestOwnershipResolver with Deployable {

    // nft_id -> current owner
    owners: map<Int, Address>;

    init() {}

    // Seed ownership for tests.
    receive(msg: RegisterOwner) {
        self.owners.set(msg.nft_id, msg.owner);
    }

    // Answer the registry's ownership query with the authoritative owner.
    receive(msg: ResolveOwnership) {
        let registry: Address = sender();
        let known: Address? = self.owners.get(msg.nft_id);

        // For an unknown NFT, reply with our own address. It can never equal a
        // user's claimant address, so the registry will reject the action and
        // clean up its pending request.
        let resolvedOwner: Address = (known == null) ? myAddress() : known!!;

        send(SendParameters{
            to: registry,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: OwnershipResolved{
                query_id: msg.query_id,
                nft_id: msg.nft_id,
                owner: resolvedOwner
            }.toCell()
        });
    }

    // Read back a registered owner (debugging helper).
    get fun getOwner(nft_id: Int): Address? {
        return self.owners.get(nft_id);
    }
}
