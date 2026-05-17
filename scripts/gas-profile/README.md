# Gas profiling harness

Measures compute-phase gas for the high-frequency Tonbankcard payment-hub
operations on top of `@ton/sandbox`. Profiles the
`AccountStateMachine` contract (`contracts/payment-hub/account-state.tact`),
which is the buildable on-chain ledger backing `PaymentHub.tact` — every
internal TBC transfer, lock change, and balance read in the protocol ends
up here.

Issue: [#128 (D2 — Contract Gas Optimization)](https://github.com/xlabtg/tonbankcard-protocol/issues/128)

## Quick start

```bash
# 1. Build the contract artifacts the profiler imports.
cd contracts/payment-hub
npm install
npm run build

# 2. Install the profiler deps and run a baseline.
cd ../../scripts/gas-profile
npm install
npm run profile:baseline   # writes baseline.json
```

To compare a baseline against a follow-up run:

```bash
# after editing the contract and rebuilding it:
npm run profile:optimized            # writes optimized.json
npx ts-node compare.ts baseline.json optimized.json --out delta.md
```

## What the profiler measures

| Operation | Description |
| --- | --- |
| `deposit_cold`         | `DepositTBC` into an untouched account (first map insert). |
| `deposit_warm`         | `DepositTBC` into an account that already exists. |
| `withdraw`             | `WithdrawTBC` from an ACTIVE account with sufficient balance. |
| `transfer_internal_cold` | `TransferInternal` where `to_nft` is touched for the first time. |
| `transfer_internal_warm` | `TransferInternal` where both accounts already exist (steady state). |
| `lock_set_frozen`      | `ChangeAccountState` ACTIVE → FROZEN (FRAUD_LOCK equivalent). |
| `lock_set_collateral`  | `ChangeAccountState` ACTIVE → COLLATERAL_LOCKED. |
| `transfer_reject_insufficient` | `TransferInternal` rejected because the source balance is below the requested amount. |
| `transfer_reject_frozen_source` | `TransferInternal` rejected because the source account is FROZEN. |

The two `transfer_reject_*` rows exist specifically to keep the
**fail-fast reorder** optimization honest. On the happy path that
optimization is essentially free instruction reordering (~110 gas, ~1%);
on the rejected path it skips one dict_get of `to_nft` entirely and the
savings jump to ~15%.

For each operation the profiler spins up a fresh sandbox, executes the
operation `N` times, extracts the compute-phase `gas_used` from the
transaction destined for the contract address, and reports `avg`, `min`,
`max`. Failing transactions abort the profiler — a low gas number from a
reverted transaction would be misleading and is rejected loudly.

## Output

`results.json` (or whatever `--out` points at):

```json
{
  "label": "baseline",
  "generatedAt": "2025-…",
  "contract": "contracts/payment-hub/account-state.tact :: AccountStateMachine",
  "operations": [
    { "name": "deposit_cold", "avgGas": 5821, "minGas": 5821, "maxGas": 5821, "runs": 3, … },
    …
  ]
}
```

The same data is also pretty-printed to stdout in a Markdown table that
drops cleanly into `docs/gas-costs.md`.

## Notes & caveats

- Sandbox numbers track the trend reliably (a 10% improvement in sandbox
  shows up as a comparable improvement on mainnet) but the absolute
  numbers are **not** mainnet fees. They are TVM `gas_used` from
  `description.computePhase.gasUsed`. See `docs/gas-costs.md` for the
  budget targets that translate sandbox gas into mainnet TON-fee bounds.
- `PaymentHub.tact` and `MerchantPaymentHub.tact` do not yet ship with
  Tact build configs in this repository (no `wrappers/PaymentHub.ts`),
  so they are profiled indirectly through `account-state.tact`, which
  models the same internal-transfer / lock state machine. Adding direct
  build wrappers for the other contracts is tracked as follow-up work
  in `docs/gas-costs.md` § "Follow-up".
