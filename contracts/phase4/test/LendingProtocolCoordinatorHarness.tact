// TEST-ONLY, NON-DEPLOYABLE harness for LendingProtocolCoordinator (Issue #432).
import "../../LendingProtocolCoordinator.tact";

message(0x7e8764ef) RegisterNFTOwnerLending {
    nft_address: Address;
    owner: Address;
}

contract LendingProtocolCoordinatorHarness with LendingProtocolCoordinatorBase {
    lending_intents: map<Address, LendingIntentInfo>;
    nft_owners: map<Address, Address>;
    deployer: Address;

    init() {
        self.lending_intents = emptyMap();
        self.nft_owners = emptyMap();
        self.deployer = sender();
    }

    receive(msg: RegisterNFTOwnerLending) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }
}
