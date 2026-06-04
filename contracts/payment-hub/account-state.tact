// Account State Machine for Tonbankcard Protocol
// Issue #5: Payment Hub - Account State Machine & Internal Ledger
//
// This contract exposes read-only account-state helpers for the production
// payment hub. Test-only deployer-gated balance and state mutation handlers
// were removed under CONTRACTS-LOW / I-1 because production fund movement and
// account-state transitions must be authorized by NFT ownership or dedicated
// protocol roles, not by the deployer key.

import "@stdlib/deploy";

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_UNAUTHORIZED: Int = 401;
const ERROR_INVALID_STATE: Int = 402;
const ERROR_INSUFFICIENT_BALANCE: Int = 403;
const ERROR_INVALID_TRANSITION: Int = 404;
const ERROR_INVALID_NFT: Int = 405;
const ERROR_INVALID_AMOUNT: Int = 406;

// Account States
const STATE_ACTIVE: Int = 1;
const STATE_FROZEN: Int = 2;
const STATE_COLLATERAL_LOCKED: Int = 3;
const STATE_CLOSED: Int = 4;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

// Account state for each NFT
struct AccountState {
    balance_tbc: Int as uint128;  // Balance in TBC tokens
    state: Int as uint8;          // Current account state
}

// Query message to get account state
message GetAccountState {
    nft_address: Address;
}

// Response with account state
message AccountStateResponse {
    nft_address: Address;
    balance_tbc: Int as coins;
    state: Int as uint8;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

contract AccountStateMachine with Deployable {

    // Storage
    accounts: map<Address, AccountState>;  // NFT address -> AccountState
    owner: Address;                         // Contract owner (for governance only)

    init(owner: Address) {
        self.owner = owner;
    }

    // ========================================================================
    // INTERNAL HELPERS
    // ========================================================================

    // Get account or return default ACTIVE account with zero balance
    fun getOrDefault(nft_address: Address): AccountState {
        let existing: AccountState? = self.accounts.get(nft_address);
        if (existing != null) {
            return existing!!;
        }
        return AccountState{ balance_tbc: 0, state: STATE_ACTIVE };
    }

    // ========================================================================
    // QUERIES
    // ========================================================================

    // Get account state (read-only)
    get fun getAccountState(nft_address: Address): AccountState {
        return self.getOrDefault(nft_address);
    }

    // Get account balance (read-only)
    get fun getBalance(nft_address: Address): Int {
        let account: AccountState = self.getOrDefault(nft_address);
        return account.balance_tbc;
    }

    // Get account state value (read-only)
    get fun getState(nft_address: Address): Int {
        let account: AccountState = self.getOrDefault(nft_address);
        return account.state;
    }

    // Check if account can send TBC (read-only)
    get fun canSend(nft_address: Address): Bool {
        let account: AccountState = self.getOrDefault(nft_address);
        return account.state == STATE_ACTIVE;
    }

    // Check if account can receive TBC (read-only)
    // All accounts can receive except CLOSED (future implementation)
    get fun canReceive(nft_address: Address): Bool {
        let account: AccountState = self.getOrDefault(nft_address);
        return account.state != STATE_CLOSED;
    }
}
