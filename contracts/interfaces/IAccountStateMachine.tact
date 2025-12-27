// Account State Machine Interface
// Based on Issue #5 - Account State Machine & Internal Ledger

import "../types/AccountState.tact";

// Interface for Account State Machine
// Manages account states and TBC balances
trait IAccountStateMachine {

    // Get the current state of an NFT account
    get fun getAccountState(nft_address: Address): Int;

    // Get the TBC balance of an NFT account
    get fun getBalance(nft_address: Address): Int;

    // Check if account exists
    get fun accountExists(nft_address: Address): Bool;

    // Internal function to update balance (debit)
    virtual fun debitBalance(nft_address: Address, amount: Int);

    // Internal function to update balance (credit)
    virtual fun creditBalance(nft_address: Address, amount: Int);
}
