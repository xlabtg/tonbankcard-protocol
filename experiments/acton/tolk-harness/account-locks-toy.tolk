// ============================================================================
// Toy Tolk harness — illustrative re-expression of one frozen FunC helper.
//
// Source of inspiration:  contracts/payments/account-locks.fc
// Status:                 ILLUSTRATIVE ONLY (D6 / Issue #143)
// Purpose:                Demonstrate Tolk *syntax* coverage for the
//                         FRAUD_LOCK / COLLATERAL_LOCK bit-flag toggle
//                         documented in docs/tooling/ACTON_EVALUATION.md §4.3.
//
// This file:
//   - is NOT compiled by CI;
//   - is NOT byte-for-byte equivalent to the FunC source;
//   - MUST NOT be deployed;
//   - is NOT a migration target. The source FunC file is 🔒 frozen per
//     docs/audit-scope.md §G.5 and any migration requires a NEW issue.
//
// Invariants modelled (cf. docs/invariants.md):
//   - I3 (No Admin Control): roles can ONLY set lock flags, not move funds.
//   - I6 (Lock ≠ Confiscation): can_receive() ALWAYS returns true; locks
//                               affect only can_send().
//
// Tolk syntax referenced: ton-blockchain.github.io/acton (v1.0.0).
// ============================================================================

// ---- Lock-type bit flags (parallel to account-locks.fc lines 22..25) -------

const LOCK_NONE        : int = 0;
const FRAUD_LOCK       : int = 1;
const COLLATERAL_LOCK  : int = 2;
const READ_ONLY        : int = 4;   // future-proof; unused today

// ---- Operation codes (parallel to account-locks.fc lines 28..33) -----------

const OP_SET_FRAUD_LOCK         : int = 0x1001;
const OP_CLEAR_FRAUD_LOCK       : int = 0x1002;
const OP_SET_COLLATERAL_LOCK    : int = 0x1003;
const OP_CLEAR_COLLATERAL_LOCK  : int = 0x1004;
const OP_CHECK_CAN_SEND         : int = 0x2001;
const OP_GET_LOCK_STATE         : int = 0x3001;

// ---- Exit codes (parallel to account-locks.fc lines 46..52) ----------------

const ERR_UNAUTHORIZED  : int = 401;
const ERR_LOCKED        : int = 403;

// ---- Storage shape ---------------------------------------------------------
// Reduced for illustration: just the lock dictionary and two role addresses.
// The two-phase role transfer (Issue #96, 7-day timelock) is NOT modelled
// here — it is documented in the FunC source and would be reproduced in a
// real Tolk port.

struct LockState {
    fraud_locked       : int;   // 1 bit
    collateral_locked  : int;   // 1 bit
}

struct Storage {
    lock_dict          : dict<int256, LockState>;
    risk_authority     : address;
    lending_adapter    : address;
}

// ---- Pure helpers ----------------------------------------------------------

fun lock_state_for(s : Storage, nft : address) : LockState {
    val key = slice_hash(nft);
    return s.lock_dict.get(key).unwrap_or(LockState { fraud_locked: 0, collateral_locked: 0 });
}

fun is_locked(state : LockState) : int {
    return state.fraud_locked | state.collateral_locked;
}

// INVARIANT I6: can_receive() ignores all lock state.
fun can_receive() : int {
    return 1;
}

// INVARIANT I6: only can_send() observes the lock state.
fun can_send(s : Storage, nft : address) : int {
    val state = lock_state_for(s, nft);
    return is_locked(state) == 0 ? 1 : 0;
}

// ---- Mutators (lock-flag toggles ONLY — no balance access) -----------------

// INVARIANT I3: only set/clear flags. Never move or read balances here.
fun set_fraud_lock(s : Storage, nft : address, on : int) : Storage {
    val key   = slice_hash(nft);
    val prev  = lock_state_for(s, nft);
    val next  = LockState { fraud_locked: on, collateral_locked: prev.collateral_locked };
    s.lock_dict.set(key, next);
    return s;
}

fun set_collateral_lock(s : Storage, nft : address, on : int) : Storage {
    val key   = slice_hash(nft);
    val prev  = lock_state_for(s, nft);
    val next  = LockState { fraud_locked: prev.fraud_locked, collateral_locked: on };
    s.lock_dict.set(key, next);
    return s;
}

// ---- Message entry point ---------------------------------------------------

fun on_internal_message(sender : address, op : int, body : slice, storage : Storage) : Storage {
    if (op == OP_SET_FRAUD_LOCK) {
        require(sender == storage.risk_authority, ERR_UNAUTHORIZED);
        val nft = body.load_address();
        return set_fraud_lock(storage, nft, 1);
    }

    if (op == OP_CLEAR_FRAUD_LOCK) {
        require(sender == storage.risk_authority, ERR_UNAUTHORIZED);
        val nft = body.load_address();
        return set_fraud_lock(storage, nft, 0);
    }

    if (op == OP_SET_COLLATERAL_LOCK) {
        require(sender == storage.lending_adapter, ERR_UNAUTHORIZED);
        val nft = body.load_address();
        return set_collateral_lock(storage, nft, 1);
    }

    if (op == OP_CLEAR_COLLATERAL_LOCK) {
        require(sender == storage.lending_adapter, ERR_UNAUTHORIZED);
        val nft = body.load_address();
        return set_collateral_lock(storage, nft, 0);
    }

    if (op == OP_CHECK_CAN_SEND) {
        val nft = body.load_address();
        require(can_send(storage, nft) == 1, ERR_LOCKED);
        return storage;
    }

    return storage;
}

// ---- Illustrative @test attributes (would be picked up by `acton test`) ----
// These are sketches; they are NOT executed by repo CI.

@test.contract
fun test_can_receive_is_unconditional() {
    val s = Storage {
        lock_dict       : dict<int256, LockState> {},
        risk_authority  : address.zero(),
        lending_adapter : address.zero(),
    };
    assert(can_receive() == 1);
    val nft = address.from_uint256(0xDEAD);
    val s2  = set_fraud_lock(s, nft, 1);
    assert(can_receive() == 1);                 // INVARIANT I6
    assert(can_send(s2, nft) == 0);             // locked → cannot send
}

@test.contract
fun test_fraud_and_collateral_locks_are_orthogonal() {
    val s = Storage {
        lock_dict       : dict<int256, LockState> {},
        risk_authority  : address.zero(),
        lending_adapter : address.zero(),
    };
    val nft = address.from_uint256(0xBEEF);
    val s1  = set_fraud_lock(s, nft, 1);
    val s2  = set_collateral_lock(s1, nft, 1);
    val s3  = set_fraud_lock(s2, nft, 0);
    val st  = lock_state_for(s3, nft);
    assert(st.fraud_locked == 0);
    assert(st.collateral_locked == 1);          // collateral lock survives
}
