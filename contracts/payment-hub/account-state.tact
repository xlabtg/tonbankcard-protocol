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
    // BALANCE MANAGEMENT
    // ========================================================================

    // Deposit TBC to an NFT account
    // Can receive to ANY state (even FROZEN/CLOSED)
    //
    // AUDIT C-ASM-C1 mitigation: gate writes behind the deployer recorded at
    // init() so that an arbitrary external sender can no longer mint balance
    // for any NFT. This is a stop-gap until the NFT Account Resolver
    // (Issue #4) integration lands and sender authorization can be verified
    // against on-chain NFT ownership; the contract is still TEST-ONLY and
    // MUST NOT be deployed to mainnet in this form.
    receive(msg: DepositTBC) {
        require(sender() == self.owner, "Unauthorized: only deployer (test-only)");
        require(msg.amount > 0, "Amount must be positive");

        // Get or initialize account
        let account: AccountState = self.getOrDefault(msg.nft_address);

        // Update balance with overflow protection
        account.balance_tbc = account.balance_tbc + msg.amount;

        // Save updated state
        self.accounts.set(msg.nft_address, account);
    }

    // Withdraw TBC from an NFT account
    // FROZEN accounts cannot withdraw
    // COLLATERAL_LOCKED accounts cannot withdraw
    //
    // AUDIT C-ASM-C1 mitigation: gated behind the deployer (see DepositTBC).
    receive(msg: WithdrawTBC) {
        require(sender() == self.owner, "Unauthorized: only deployer (test-only)");
        require(msg.amount > 0, "Amount must be positive");

        // Get account state
        let account: AccountState = self.getOrDefault(msg.nft_address);

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
    //
    // AUDIT C-ASM-C1 mitigation: gated behind the deployer (see DepositTBC).
    receive(msg: TransferInternal) {
        require(sender() == self.owner, "Unauthorized: only deployer (test-only)");
        require(msg.amount > 0, "Amount must be positive");
        require(msg.from_nft != msg.to_nft, "Cannot transfer to same account");

        // Fail-fast: validate the source account fully BEFORE touching the
        // destination dictionary entry. Loading `to_account` is a dict_get
        // that costs gas; if the source is locked or under-funded the
        // transfer aborts anyway, so the destination lookup is wasted work.
        // Reordering preserves all observable behavior (the same requires
        // fail in the same priority order) while saving one dict_get on
        // every rejected transfer.
        let from_account: AccountState = self.getOrDefault(msg.from_nft);
        require(from_account.state == STATE_ACTIVE, "Source account must be ACTIVE");
        require(from_account.balance_tbc >= msg.amount, "Insufficient balance");

        // Now that the source is known good, fetch the destination.
        let to_account: AccountState = self.getOrDefault(msg.to_nft);

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
    //
    // AUDIT C-ASM-H1 mitigation: gated behind the deployer recorded at init().
    // Per-role gating (risk_authority for FROZEN, lending_adapter for
    // COLLATERAL_LOCKED, DAO for unfreeze) is the production design and is
    // tracked in the audit follow-up; this gate prevents anonymous freezes.
    receive(msg: ChangeAccountState) {
        require(sender() == self.owner, "Unauthorized: only deployer (test-only)");
        // Get current account state
        let account: AccountState = self.getOrDefault(msg.nft_address);

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
