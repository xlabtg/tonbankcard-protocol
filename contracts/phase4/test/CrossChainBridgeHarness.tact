// TEST-ONLY, NON-DEPLOYABLE harness for CrossChainBridge (Issue #432).
import "../../CrossChainBridge.tact";

message RegisterNFTOwnerBridge {
    nft_address: Address;
    owner: Address;
}

message RegisterRelayer {
    relayer: Address;
}

contract CrossChainBridgeHarness with CrossChainBridgeBase {
    bridge_intents: map<Int, BridgeIntentInfo>;
    nft_owners: map<Address, Address>;
    authorized_relayers: map<Address, Bool>;
    deployer: Address;

    init() {
        self.bridge_intents = emptyMap();
        self.nft_owners = emptyMap();
        self.authorized_relayers = emptyMap();
        self.deployer = sender();
    }

    receive(msg: RegisterNFTOwnerBridge) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }

    receive(msg: RegisterRelayer) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        self.authorized_relayers.set(msg.relayer, true);
    }
}
