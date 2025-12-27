// Account Locks Interface
// Based on Issue #7 - Account Locks & Risk Flags

import "../types/LockState.tact";

// Interface for Account Locks
// Manages fraud and collateral locks on NFT accounts
trait IAccountLocks {

    // Get the lock state of an NFT account
    get fun getLockState(nft_address: Address): LockState;

    // Check if account is locked (any lock active)
    get fun isAccountLocked(nft_address: Address): Bool;

    // Check if account has fraud lock
    get fun hasFraudLock(nft_address: Address): Bool;

    // Check if account has collateral lock
    get fun hasCollateralLock(nft_address: Address): Bool;
}
