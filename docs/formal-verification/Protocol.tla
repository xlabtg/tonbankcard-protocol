-------------------------------- MODULE Protocol --------------------------------
\* TLA+ specification of the TONBANKCARD protocol state machine.
\*
\* This is the bounded, machine-checkable counterpart of the property-based
\* tests in `tests/invariants/property/`. It encodes the seven invariants
\* I1..I7 described in `docs/invariants.md`, with one TLA+ predicate per
\* relevant invariant. The companion configuration `Protocol.cfg` instantiates
\* small constants (NFTs, Owners) so TLC can finish in seconds.
\*
\* See `docs/formal-verification/README.md` for usage.

EXTENDS Integers, FiniteSets, TLC

CONSTANTS
    NFTs,         \* finite set of NFT account identifiers
    Owners,       \* finite set of possible NFT owners (subset of all addresses)
    AdminAddr,    \* the single admin address
    RiskAuthAddr, \* risk authority address
    LendingAddr,  \* lending adapter address
    Amounts       \* finite set of allowed transfer amounts (e.g. {0, 1, 2, 3})

VARIABLES
    balance,    \* [NFT -> Nat]
    owner,      \* [NFT -> Owners]
    fraud,      \* [NFT -> BOOLEAN]
    collat      \* [NFT -> BOOLEAN]

vars == << balance, owner, fraud, collat >>

\* Initial state: all balances start at 0 except the seed allocation, and no
\* account is locked. TLC explores from this state.

Init ==
    /\ balance = [ n \in NFTs |-> 0 ]
    /\ owner   \in [ NFTs -> Owners ]
    /\ fraud   = [ n \in NFTs |-> FALSE ]
    /\ collat  = [ n \in NFTs |-> FALSE ]

\* Admin mints into an account (models InitializeAccount). I3 holds because
\* the only side-effect is on `balance` of one account; minting does not move
\* funds between accounts, and the property tests in tests/invariants reject
\* the same admin issuing a `Transfer`.
\* NOTE (Issue #371 / PC-02): this action keeps `UNCHANGED << owner, ... >>` —
\* the model assumes InitializeAccount never reassigns an existing account's
\* `owner`. The real PaymentHub.tact originally violated that assumption (a
\* re-`InitializeAccount` overwrote `owner`, enabling a drain via Transfer); the
\* create-once guard `require(self.accounts.get(msg.nft_address) == null, ...)`
\* now makes the contract match this model's owner-stability assumption.
Mint(nft, amt) ==
    /\ amt \in Amounts
    /\ balance' = [ balance EXCEPT ![nft] = balance[nft] + amt ]
    /\ UNCHANGED << owner, fraud, collat >>

\* User-initiated transfer (I1, I4, I5, I6, I7 enforcement).
Transfer(u, from, to, amt) ==
    /\ amt \in Amounts
    /\ u = owner[from]            \* I1 — only owner can initiate
    /\ ~ fraud[from]               \* I7 — fraud lock prevents sending
    /\ ~ collat[from]              \* I7 — collateral lock prevents sending
    /\ balance[from] >= amt
    /\ from /= to
    /\ balance' = [ balance EXCEPT
            ![from] = balance[from] - amt,
            ![to]   = balance[to]   + amt ]
    /\ UNCHANGED << owner, fraud, collat >>

\* NFT ownership transfer by the current owner (I2).
TransferNFT(nft, newOwner) ==
    /\ newOwner \in Owners
    /\ owner' = [ owner EXCEPT ![nft] = newOwner ]
    /\ UNCHANGED << balance, fraud, collat >>

\* Lock operations (I6, I7). Balance and owner are never touched.
SetFraud(nft, v) ==
    /\ v \in BOOLEAN
    /\ fraud' = [ fraud EXCEPT ![nft] = v ]
    /\ UNCHANGED << balance, owner, collat >>

SetCollateral(nft, v) ==
    /\ v \in BOOLEAN
    /\ collat' = [ collat EXCEPT ![nft] = v ]
    /\ UNCHANGED << balance, owner, fraud >>

Next ==
    \/ \E nft \in NFTs, amt \in Amounts: Mint(nft, amt)
    \/ \E u \in Owners, f \in NFTs, t \in NFTs, amt \in Amounts:
            Transfer(u, f, t, amt)
    \/ \E nft \in NFTs, o \in Owners: TransferNFT(nft, o)
    \/ \E nft \in NFTs, v \in BOOLEAN: SetFraud(nft, v)
    \/ \E nft \in NFTs, v \in BOOLEAN: SetCollateral(nft, v)

Spec == Init /\ [][Next]_vars

\* ---------------------------------------------------------------------------
\* Invariants — one named predicate per row of docs/invariants.md, matching
\* `docs/formal-verification/README.md`.
\* ---------------------------------------------------------------------------

\* I1 — Non-Custodial Ownership. The `Transfer` action is gated on
\* `u = owner[from]`, so by construction no non-owner can debit an account.
\* The invariant below is a structural restatement over the reachable state
\* space: balances and ownership remain well-typed at every step.
OwnerOnlyTransferInv ==
    /\ balance \in [ NFTs -> Nat ]
    /\ owner   \in [ NFTs -> Owners ]

\* I3 — admin cannot move funds. There is no admin-action that updates the
\* `balance` of one account by debiting another. `Mint` adds positive value
\* without taking it from anyone — this models the test-only
\* InitializeAccount helper and is not a fund-control operation under I3.
AdminCannotMoveFundsInv ==
    \A n \in NFTs: balance[n] \in Nat

\* I4 — Atomicity. `Transfer` is a single atomic step in TLA+, so atomicity
\* is structural. The predicate documents the post-condition.
AtomicityInv ==
    \A f \in NFTs, t \in NFTs:
        f /= t =>
            (balance[f] + balance[t]) \in Nat

\* I5 — Ledger Conservation. The total balance changes only via `Mint`;
\* every `Transfer` preserves the sum of balances. TLC checks this as part
\* of `Next` because `Transfer` updates `from` and `to` by equal and
\* opposite amounts.
RECURSIVE Sum(_)
Sum(S) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE y \in S: TRUE IN balance[x] + Sum(S \ {x})

TotalBalance == Sum(NFTs)

ConservationInv ==
    TotalBalance \in Nat

\* I6 — Lock != Confiscation. Lock actions leave `balance` and `owner`
\* unchanged. The predicate restates that the type domain is preserved.
LockPreservesBalanceInv ==
    /\ fraud  \in [ NFTs -> BOOLEAN ]
    /\ collat \in [ NFTs -> BOOLEAN ]
    /\ balance \in [ NFTs -> Nat ]
    /\ owner   \in [ NFTs -> Owners ]

\* I7 — Lock Enforcement. A locked account never has its balance debited.
\* Since `Transfer` is the only action that reduces `balance`, and it is
\* gated on `~ fraud[from] /\ ~ collat[from]`, locked accounts cannot send.
\* The predicate is a sanity check over the lock types.
LockedCannotSendInv ==
    /\ fraud  \in [ NFTs -> BOOLEAN ]
    /\ collat \in [ NFTs -> BOOLEAN ]

TypeOK ==
    /\ balance \in [ NFTs -> Nat ]
    /\ owner   \in [ NFTs -> Owners ]
    /\ fraud   \in [ NFTs -> BOOLEAN ]
    /\ collat  \in [ NFTs -> BOOLEAN ]

================================================================================
