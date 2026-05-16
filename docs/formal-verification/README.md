# Formal Verification Artifacts

This directory holds the formal-verification material that accompanies the
property-based test suite in `tests/invariants/`. The property tests are the
**authoritative** machine-checked verification of invariants I1–I7. The TLA+
specifications below are a stretch goal called out in
[issue #114](https://github.com/xlabtg/tonbankcard-protocol/issues/114) and
serve as additional documentation of the protocol state machine.

## Files

| File | Purpose |
| ---- | ------- |
| `Protocol.tla` | TLA+ model of the protocol state machine (accounts, balances, locks, ownership). |
| `Protocol.cfg` | TLC configuration: constants, invariants, search bounds. |

## How to check

```
# Requires the TLA+ toolbox or `tla2tools.jar`.
java -jar tla2tools.jar -deadlock -config Protocol.cfg Protocol.tla
```

The expected output is `Model checking completed. No error has been found.`
for the bounded configuration declared in `Protocol.cfg`.

## Mapping to invariants

| Invariant | Encoded as | Enforced by |
| --------- | ---------- | ----------- |
| I1 — Non-custodial ownership | `OwnerOnlyTransferInv` | Structural: `Transfer` action is gated on `u = owner[from]` |
| I3 — No admin fund control   | `AdminCannotMoveFundsInv` | Structural: no admin action debits balances |
| I4 — Atomic transfers        | `AtomicityInv` | Implicit — `Transfer` is a single TLA+ action |
| I5 — Ledger conservation     | `ConservationInv` | Structural: `Transfer` updates `from`/`to` by equal & opposite amounts |
| I6 — Lock ≠ confiscation     | `LockPreservesBalanceInv` | `SetFraud` / `SetCollateral` leave `balance` and `owner` unchanged |
| I7 — Lock enforcement        | `LockedCannotSendInv` | Structural: `Transfer` is gated on `~ fraud[from] /\ ~ collat[from]` |

I2 is omitted from the TLA+ model because TON NFT ownership semantics
(authority follows the NFT) are encoded directly via `owner[nft]` updates
in `TransferNFT`. There is no separate authorization layer to verify.

## Status

- **Authoritative**: TypeScript model + fast-check property tests in
  `tests/invariants/` (run in CI on every PR).
- **Documentation**: `Protocol.tla` — bounded TLC model check.
- **Future work**: extend the TLA+ model with the admin two-phase timelock
  and bridge replay scenarios from Phase 4 contracts.
