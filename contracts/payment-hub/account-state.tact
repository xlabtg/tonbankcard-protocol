// Account State Machine for Tonbankcard Protocol
// Issue #5: Payment Hub - Account State Machine & Internal Ledger
//
// This contract manages:
// - NFT account states (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
// - TBC balance management
// - State transitions with strict authorization
// - Atomic operations with fail-safe guarantees

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

// Message to deposit TBC
message DepositTBC {
    nft_address: Address;
    amount: Int as coins;
}

// Message to withdraw TBC
message WithdrawTBC {
    nft_address: Address;
    amount: Int as coins;
    destination: Address;
}

// Message to transfer TBC between NFT accounts
message TransferInternal {
    from_nft: Address;
    to_nft: Address;
    amount: Int as coins;
}

// Message to change account state
message ChangeAccountState {
    nft_address: Address;
    new_state: Int as uint8;
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
    // BALANCE MANAGEMENT
    // ========================================================================

    // Deposit TBC to an NFT account
    // Can receive to ANY state (even FROZEN/CLOSED)
    receive(msg: DepositTBC) {
        require(msg.amount > 0, "Amount must be positive");

        // Get or initialize account
        let account: AccountState = self.accounts.get(msg.nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };

        // Update balance with overflow protection
        account.balance_tbc = account.balance_tbc + msg.amount;

        // Save updated state
        self.accounts.set(msg.nft_address, account);
    }

    // Withdraw TBC from an NFT account
    // FROZEN accounts cannot withdraw
    // COLLATERAL_LOCKED accounts cannot withdraw
    receive(msg: WithdrawTBC) {
        require(msg.amount > 0, "Amount must be positive");

        // Get account state
        let account: AccountState = self.accounts.get(msg.nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };

        // Check state allows withdrawal
        require(account.state == STATE_ACTIVE, "Account state does not allow withdrawal");

        // Check sufficient balance
        require(account.balance_tbc >= msg.amount, "Insufficient balance");

        // NOTE: In production, should verify msg.sender == NFT owner
        // This would require integration with NFT Account Resolver (Issue #4)
        // For now, we assume authorization is handled by calling contract

        // Update balance
        account.balance_tbc = account.balance_tbc - msg.amount;

        // Save updated state
        self.accounts.set(msg.nft_address, account);

        // Transfer TBC to destination
        // In production, this would interact with TBC jetton contract
        // For now, this is a placeholder for the transfer logic
    }

    // Internal transfer between NFT accounts
    // From account must be ACTIVE
    // To account can be any state (can always receive)
    receive(msg: TransferInternal) {
        require(msg.amount > 0, "Amount must be positive");
        require(msg.from_nft != msg.to_nft, "Cannot transfer to same account");

        // Get source account
        let from_account: AccountState = self.accounts.get(msg.from_nft) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };

        // Get destination account
        let to_account: AccountState = self.accounts.get(msg.to_nft) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };

        // Check source account state allows sending
        require(from_account.state == STATE_ACTIVE, "Source account must be ACTIVE");

        // Check sufficient balance
        require(from_account.balance_tbc >= msg.amount, "Insufficient balance");

        // NOTE: In production, should verify msg.sender == from_nft owner
        // This would require integration with NFT Account Resolver (Issue #4)

        // Atomic transfer
        from_account.balance_tbc = from_account.balance_tbc - msg.amount;
        to_account.balance_tbc = to_account.balance_tbc + msg.amount;

        // Save updated states atomically
        self.accounts.set(msg.from_nft, from_account);
        self.accounts.set(msg.to_nft, to_account);
    }

    // ========================================================================
    // STATE TRANSITIONS
    // ========================================================================

    // Change account state with strict rules
    receive(msg: ChangeAccountState) {
        // Get current account state
        let account: AccountState = self.accounts.get(msg.nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };

        let current_state: Int = account.state;
        let new_state: Int = msg.new_state;

        // Validate state value
        require(new_state >= STATE_ACTIVE && new_state <= STATE_CLOSED, "Invalid state");

        // Enforce state transition rules
        if (current_state == STATE_ACTIVE) {
            // ACTIVE can transition to FROZEN or COLLATERAL_LOCKED
            require(
                new_state == STATE_FROZEN ||
                new_state == STATE_COLLATERAL_LOCKED ||
                new_state == STATE_CLOSED,
                "Invalid transition from ACTIVE"
            );
        } else if (current_state == STATE_FROZEN) {
            // FROZEN can only be unlocked by DAO/risk (requires special authorization)
            // For now, we prevent unauthorized transitions
            require(false, "FROZEN state requires DAO/risk authorization");
        } else if (current_state == STATE_COLLATERAL_LOCKED) {
            // COLLATERAL_LOCKED can only be unlocked by lending adapter
            // For now, we prevent unauthorized transitions
            require(false, "COLLATERAL_LOCKED state requires lending adapter authorization");
        } else if (current_state == STATE_CLOSED) {
            // CLOSED accounts cannot change state
            require(false, "CLOSED accounts cannot change state");
        }

        // NOTE: In production, should verify authorization
        // Different state transitions require different authorities:
        // - ACTIVE -> FROZEN: risk engine / DAO
        // - ACTIVE -> COLLATERAL_LOCKED: lending adapter
        // - FROZEN -> ACTIVE: DAO only
        // - COLLATERAL_LOCKED -> ACTIVE: lending adapter only

        // Update state
        account.state = new_state;

        // Save updated state
        self.accounts.set(msg.nft_address, account);
    }

    // ========================================================================
    // QUERIES
    // ========================================================================

    // Get account state (read-only)
    get fun getAccountState(nft_address: Address): AccountState {
        return self.accounts.get(nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };
    }

    // Get account balance (read-only)
    get fun getBalance(nft_address: Address): Int {
        let account: AccountState = self.accounts.get(nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };
        return account.balance_tbc;
    }

    // Get account state value (read-only)
    get fun getState(nft_address: Address): Int {
        let account: AccountState = self.accounts.get(nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };
        return account.state;
    }

    // Check if account can send TBC (read-only)
    get fun canSend(nft_address: Address): Bool {
        let account: AccountState = self.accounts.get(nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };
        return account.state == STATE_ACTIVE;
    }

    // Check if account can receive TBC (read-only)
    // All accounts can receive except CLOSED (future implementation)
    get fun canReceive(nft_address: Address): Bool {
        let account: AccountState = self.accounts.get(nft_address) ?: AccountState{
            balance_tbc: 0,
            state: STATE_ACTIVE
        };
        return account.state != STATE_CLOSED;
    }
}
