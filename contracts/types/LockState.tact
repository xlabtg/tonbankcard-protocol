// Lock State Types for Tonbankcard Protocol
// Based on Issue #7 - Account Locks & Risk Flags

// Lock state structure for NFT accounts
struct LockState {
    fraud_locked: Bool;        // FRAUD_LOCK: suspected fraud
    collateral_locked: Bool;   // COLLATERAL_LOCK: active collateral
}

// Helper functions for lock state
inline fun isLocked(lockState: LockState): Bool {
    return lockState.fraud_locked || lockState.collateral_locked;
}

inline fun hasFraudLock(lockState: LockState): Bool {
    return lockState.fraud_locked;
}

inline fun hasCollateralLock(lockState: LockState): Bool {
    return lockState.collateral_locked;
}

// Check if account can perform outgoing operations
inline fun canSendWithLocks(lockState: LockState): Bool {
    return !isLocked(lockState);
}

// Default unlocked state
inline fun defaultLockState(): LockState {
    return LockState{
        fraud_locked: false,
        collateral_locked: false
    };
}
