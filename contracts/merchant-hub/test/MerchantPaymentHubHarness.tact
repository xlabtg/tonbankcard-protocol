// Test-only harness for MerchantPaymentHub (Issue #363).
//
// This contract is NOT a production artifact and MUST NOT be deployed. It exists
// solely so the Jest suite can exercise the REAL compiled production logic
// (MerchantPaymentHubBase) against on-chain state that, in production, is populated
// by the NFT Account Resolver and the on-chain TBC ledger.
//
// It imports the production contract purely to reuse MerchantPaymentHubBase (all
// payment / admin / lock / whitelist logic) and the shared message definitions, so
// their opcodes match the production contract exactly. The two `receive` handlers
// below — SetAccountState / SetAccountBalance — are the ONLY test-only additions;
// they were removed from the production contract because they were an admin-mint /
// admin-register backdoor (audit C-MPH-C1 / C-MPH-H1).
//
// A CI regression guard (contracts/payment-hub/non-production-stubs.spec.ts) asserts
// that these handlers exist ONLY here and never in the deployable production source,
// and scripts/deploy/deployable-contracts.ts lists this file as a non-production stub.

import "../../MerchantPaymentHub.tact";

// Test-only bootstrap: register an account state + owner (stand-in for the NFT
// Account Resolver registration flow). NOT present in the production contract.
message SetAccountState {
    nft_address: Address;
    state: Int as uint8;
    owner: Address;
}

// Test-only bootstrap: seed an account balance (stand-in for the on-chain TBC
// ledger funding flow). NOT present in the production contract.
message SetAccountBalance {
    nft_address: Address;
    balance: Int as coins;
}

contract MerchantPaymentHubHarness with MerchantPaymentHubBase {

    // Storage mirrors MerchantPaymentHubBase / MerchantPaymentHub (Tact storage model).
    admin: Address;
    pending_admin: Address? = null;
    pending_admin_executable_at: Int as uint32 = 0;
    account_locks_contract: Address;
    account_states: map<Address, Int>;
    account_balances: map<Address, Int>;
    account_locks: map<Address, LockState>;
    nft_owners: map<Address, Address>;
    whitelisted_collections: map<Address, Bool>;
    pending_whitelist_collection: Address? = null;
    pending_whitelist_executable_at: Int as uint32 = 0;

    init(deployer_address: Address, account_locks_contract: Address) {
        self.admin = deployer_address;
        self.account_locks_contract = account_locks_contract;
    }

    // ---- TEST-ONLY bootstrap handlers (never deployed) ----

    receive(msg: SetAccountState) {
        require(sender() == self.admin, "Unauthorized: only admin (test-only)");
        self.account_states.set(msg.nft_address, msg.state);
        if (self.nft_owners.get(msg.nft_address) == null) {
            self.nft_owners.set(msg.nft_address, msg.owner);
        }
    }

    receive(msg: SetAccountBalance) {
        require(sender() == self.admin, "Unauthorized: only admin (test-only)");
        self.account_balances.set(msg.nft_address, msg.balance);
    }
}
