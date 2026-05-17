# Gas costs — Tonbankcard payment hub

Tracking issue: [#128 — D2 Contract Gas Optimization](https://github.com/xlabtg/tonbankcard-protocol/issues/128)

This document captures the compute-phase gas consumption of the
high-frequency operations on the buildable on-chain ledger that backs
the Tonbankcard payment hub (`contracts/payment-hub/account-state.tact ::
AccountStateMachine`). Every `PaymentHub.tact` internal transfer, lock
change, and balance read terminates here, so it is the right surface to
optimize first.

The numbers are TVM `gas_used` values reported by `@ton/sandbox` for the
transaction destined for the contract address. They are **not** mainnet
TON fees — see [§ Budget targets](#budget-targets) for how to translate
the sandbox numbers into mainnet bounds.

The harness lives at `scripts/gas-profile/` and is documented in
[`scripts/gas-profile/README.md`](../scripts/gas-profile/README.md).

## Measured operations

| Operation | Description |
| --- | --- |
| `deposit_cold` | `DepositTBC` into an untouched account (first map insert). |
| `deposit_warm` | `DepositTBC` into an account that already exists. |
| `withdraw` | `WithdrawTBC` from an ACTIVE account with sufficient balance. |
| `transfer_internal_cold` | `TransferInternal`; `to_nft` is touched for the first time. |
| `transfer_internal_warm` | `TransferInternal` where both accounts already exist (steady state). |
| `lock_set_frozen` | `ChangeAccountState` ACTIVE → FROZEN (FRAUD_LOCK equivalent). |
| `lock_set_collateral` | `ChangeAccountState` ACTIVE → COLLATERAL_LOCKED. |
| `transfer_reject_insufficient` | `TransferInternal` rejected: source balance below requested amount. |
| `transfer_reject_frozen_source` | `TransferInternal` rejected: source account is FROZEN. |

## Current measurements

Both profiles are reproducible:

```bash
cd contracts/payment-hub && npm install && npm run build
cd ../../scripts/gas-profile && npm install
npm run profile -- --label baseline --out baseline.json   # against original code
npm run profile -- --label optimized --out optimized.json # against optimized code
npx ts-node compare.ts baseline.json optimized.json --out delta.md
```

The committed `baseline.json` was produced from the pre-optimization
contract (the `TransferInternal` receive looked up both accounts before
running any `require()` checks). The committed `optimized.json` was
produced from the current contract.

### Per-operation delta (baseline → optimized)

| Operation | Baseline (avg) | Optimized (avg) | Δ gas | Δ % |
| --- | ---: | ---: | ---: | ---: |
| `deposit_cold` | 6643 | 6643 | +0 | +0.00% |
| `deposit_warm` | 6977 | 6977 | +0 | +0.00% |
| `withdraw` | 7793 | 7793 | +0 | +0.00% |
| `transfer_internal_cold` | 11341 | 11231 | **-110** | **-0.97%** |
| `transfer_internal_warm` | 11725 | 11615 | **-110** | **-0.94%** |
| `lock_set_frozen` | 8035 | 8035 | +0 | +0.00% |
| `lock_set_collateral` | 8061 | 8061 | +0 | +0.00% |
| `transfer_reject_insufficient` | 6435 | 5517 | **-918** | **-14.27%** |
| `transfer_reject_frozen_source` | 6417 | 5424 | **-993** | **-15.47%** |
| **Total** | **73427** | **71296** | **-2131** | **-2.90%** |

Numbers are deterministic across runs (sandbox sets `min == max == avg`
on the operations measured here), so reproducibility checks should
expect bit-exact matches.

## Optimization landed in this revision

### O-1: fail-fast validation in `TransferInternal`

**File:** `contracts/payment-hub/account-state.tact` (receive
`TransferInternal`).

Before, the receive loaded both `from_account` and `to_account` from
the storage map *before* running any `require()` check. Loading
`to_account` is a `dict_get` that costs gas; if the source account is
not ACTIVE or is under-funded the receive aborts anyway, so the second
`dict_get` is wasted work.

After: validate `from_account` fully (state + balance) and only then
load `to_account`. The happy path is functionally a wash (the same two
`dict_get`s, just reordered) but eliminates one `dict_get` per rejected
transfer.

#### Observable behavior is preserved

- All `require()` checks fire in the same priority order as before
  (authorization → amount → from/to inequality → source state → source
  balance), so any external caller sees identical exit codes and
  identical revert messages.
- The order in which the two accounts are written back to the map
  (`from_nft` first, then `to_nft`) is unchanged; the atomicity story
  of the receive is unchanged.
- The full 25-test suite in `contracts/payment-hub/account-state.spec.ts`
  passes against the optimized contract with no test changes.

#### Why the rejected-path savings dominate

Sandbox numbers (`transfer_reject_*` rows above) show that the savings
on the happy path are about 110 gas (≈ 1%) while the rejected path
saves roughly 900–1000 gas (≈ 15%). That asymmetry is intentional and
matches the protocol's threat model: most pathological traffic (replays,
malformed clients, abusive merchants probing balances) is rejected,
not accepted, so making rejections cheap is a defense against
griefing-style spam more than it is a happy-path micro-win.

## Budget targets

The mainnet TON fee for a TVM transaction is approximately
`gas_used × gas_price`, where `gas_price` on the basechain is currently
1000 nanoTON per gas unit (see
[TON gas docs](https://docs.ton.org/develop/howto/fees-low-level)). For
budgeting we adopt the following sandbox-gas targets so that one
payment-hub operation stays well under common per-message TON budgets:

| Operation class | Sandbox-gas budget | Approx. mainnet fee at 1000 nanoTON/gas |
| --- | ---: | ---: |
| Deposit / lock change | ≤ 10 000 | ≤ 0.00001 TON |
| Withdraw | ≤ 12 000 | ≤ 0.000012 TON |
| Internal transfer (cold/warm) | ≤ 15 000 | ≤ 0.000015 TON |
| Rejected transfer (anti-grief target) | ≤ 8 000 | ≤ 0.000008 TON |

Every operation currently profiled comfortably sits inside its budget,
including the rejected-path operations now that O-1 has landed.

These budgets are sandbox numbers, not mainnet fees. The mapping is a
rough proxy — actual mainnet gas can vary with workchain config and
storage/forward-fee components — and is meant to give reviewers a
sanity-check ceiling, not a binding mainnet SLA.

## Methodology

- The sandbox is reset for every measured operation so cold-account and
  warm-account paths are not muddled.
- Each operation is sampled `N = 3` times. Sandbox runs are
  deterministic, so the three samples typically agree exactly; the
  harness still records min/max separately so any future
  non-determinism would be visible.
- Compute-phase `gas_used` is taken from
  `transaction.description.computePhase.gasUsed` on the transaction
  delivered *to* the contract address (the wallet's outbound transaction
  is excluded by destination filter).
- Failing transactions on operations expected to succeed abort the
  profiler — a low gas number from a reverted transaction would be
  misleading. The opposite (success on an expected-failure operation)
  is also rejected loudly so an optimization that accidentally relaxes
  a check cannot pass undetected.

## Follow-up

These items are explicitly out of scope for this revision but tracked
here so the optimization story stays honest:

1. **Direct profiling of `PaymentHub.tact` and `MerchantPaymentHub.tact`.**
   Those Tact sources do not currently ship with a build wrapper
   (no `wrappers/PaymentHub.ts`), so we profile the
   `AccountStateMachine` contract, which is the buildable model of the
   same internal-ledger state machine. Once direct build wrappers exist
   the same harness can be pointed at the production receives.
2. **NFT-resolver gas measurement.** The resolver is a query-only contract
   so it is not on the high-frequency path, but its `get`-method gas
   should be tracked once #4 (NFT Account Resolver integration) lands.
3. **Reverting to map-bucketed accounts vs. per-NFT child contracts.**
   The current `map<Address, AccountState>` storage is the right
   primitive at the present scale; once account counts get larger the
   gas profile of dict operations will degrade and a per-account child
   contract will likely win. That migration is governance-gated and is
   not part of this issue.
