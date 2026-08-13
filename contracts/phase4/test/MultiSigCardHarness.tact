// TEST-ONLY, NON-DEPLOYABLE harness for MultiSigCard (Issue #432).
import "../../MultiSigCard.tact";

message RegisterNFTOwnerMultiSig {
    nft_address: Address;
    owner: Address;
}

contract MultiSigCardHarness with MultiSigCardBase {
    multisig_configs: map<Address, MultiSigConfig>;
    proposals: map<Int, PaymentProposal>;
    approvals: map<Int, Bool>;
    nft_owners: map<Address, Address>;
    deployer: Address;

    init() {
        self.multisig_configs = emptyMap();
        self.proposals = emptyMap();
        self.approvals = emptyMap();
        self.nft_owners = emptyMap();
        self.deployer = sender();
    }

    receive(msg: RegisterNFTOwnerMultiSig) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }
}
