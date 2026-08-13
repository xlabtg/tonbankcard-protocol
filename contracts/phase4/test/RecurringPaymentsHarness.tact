// TEST-ONLY, NON-DEPLOYABLE harness for RecurringPayments (Issue #432).
import "../../RecurringPayments.tact";

message RegisterNFTOwnerRecurring {
    nft_address: Address;
    owner: Address;
}

contract RecurringPaymentsHarness with RecurringPaymentsBase {
    mandates: map<Int, MandateInfo>;
    nft_owners: map<Address, Address>;
    deployer: Address;

    init() {
        self.mandates = emptyMap();
        self.nft_owners = emptyMap();
        self.deployer = sender();
    }

    receive(msg: RegisterNFTOwnerRecurring) {
        require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
        require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
        self.nft_owners.set(msg.nft_address, msg.owner);
    }
}
