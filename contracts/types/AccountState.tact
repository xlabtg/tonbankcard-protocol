// Account State Types for Tonbankcard Protocol
// Based on Issue #5 - Account State Machine

// Account state enum representing the lifecycle of an NFT account
struct AccountState {
    state: Int as uint8;  // 0: ACTIVE, 1: FROZEN, 2: COLLATERAL_LOCKED, 3: CLOSED
}

// Constants for account states
const ACCOUNT_STATE_ACTIVE: Int = 0;
const ACCOUNT_STATE_FROZEN: Int = 1;
const ACCOUNT_STATE_COLLATERAL_LOCKED: Int = 2;
const ACCOUNT_STATE_CLOSED: Int = 3;

// Helper functions for account state
inline fun isActive(state: Int): Bool {
    return state == ACCOUNT_STATE_ACTIVE;
}

inline fun isFrozen(state: Int): Bool {
    return state == ACCOUNT_STATE_FROZEN;
}

inline fun isCollateralLocked(state: Int): Bool {
    return state == ACCOUNT_STATE_COLLATERAL_LOCKED;
}

inline fun isClosed(state: Int): Bool {
    return state == ACCOUNT_STATE_CLOSED;
}

// Check if account can send TBC
inline fun canSend(state: Int): Bool {
    return state == ACCOUNT_STATE_ACTIVE;
}

// Check if account can receive TBC
inline fun canReceive(state: Int): Bool {
    return state != ACCOUNT_STATE_CLOSED;
}
