// Collateral Signal State Types for Tonbankcard Protocol
// Based on Issue #30 - Collateral Signal Contract (TON-Based, Non-Custodial)
//
// DESIGN PRINCIPLE: This is a pure signaling layer.
// The contract NEVER:
// - custodies user funds
// - locks or seizes assets
// - initiates transfers
// - liquidates positions
// All collateral existence is verified on-chain, enforcement happens off-protocol.

// Collateral signal states (informational, non-authoritative)
// These states indicate the presence of active collateral but do NOT
// give the protocol or lenders any control over the collateral.
const COLLATERAL_SIGNAL_NONE: Int = 0;      // No collateral signaled
const COLLATERAL_SIGNAL_ACTIVE: Int = 1;    // Active collateral signaled
const COLLATERAL_SIGNAL_WARNING: Int = 2;   // Warning state (user-defined threshold)
const COLLATERAL_SIGNAL_RELEASED: Int = 3;  // Collateral released

// Collateral signal information structure
struct CollateralSignalInfo {
    signal_state: Int as uint8;           // Current signal state (NONE, ACTIVE, WARNING, RELEASED)
    collateral_amount_ton: Int as coins;  // Signaled TON collateral amount (for informational purposes only)
    created_at: Int as uint32;            // Timestamp when signal was created
    updated_at: Int as uint32;            // Timestamp of last state update
}

// Helper functions for collateral signal states
inline fun isSignalNone(state: Int): Bool {
    return state == COLLATERAL_SIGNAL_NONE;
}

inline fun isSignalActive(state: Int): Bool {
    return state == COLLATERAL_SIGNAL_ACTIVE;
}

inline fun isSignalWarning(state: Int): Bool {
    return state == COLLATERAL_SIGNAL_WARNING;
}

inline fun isSignalReleased(state: Int): Bool {
    return state == COLLATERAL_SIGNAL_RELEASED;
}

// Check if collateral is currently signaled (ACTIVE or WARNING)
inline fun hasActiveSignal(state: Int): Bool {
    return state == COLLATERAL_SIGNAL_ACTIVE || state == COLLATERAL_SIGNAL_WARNING;
}

// Create default collateral signal info (no collateral signaled)
inline fun defaultCollateralSignalInfo(): CollateralSignalInfo {
    return CollateralSignalInfo{
        signal_state: COLLATERAL_SIGNAL_NONE,
        collateral_amount_ton: 0,
        created_at: 0,
        updated_at: 0
    };
}
