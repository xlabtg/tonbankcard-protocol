// Account State Machine Interface
// Based on Issue #5 - Account State Machine & Internal Ledger

import "../types/AccountState.tact";

// Interface for Account State Machine
// Manages account states and TBC balances
trait IAccountStateMachine {

    // Get the current state of an NFT account
    abstract get fun getAccountState(nft_address: Address): Int;

    // Get the TBC balance of an NFT account
    abstract get fun getBalance(nft_address: Address): Int;

    // Check if account exists
    abstract get fun accountExists(nft_address: Address): Bool;

    // Internal function to update balance (debit)
    abstract fun debitBalance(nft_address: Address, amount: Int);

    // Internal function to update balance (credit)
    abstract fun creditBalance(nft_address: Address, amount: Int);
}
