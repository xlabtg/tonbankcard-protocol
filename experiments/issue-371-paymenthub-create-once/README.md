# Issue #371 / PC-02 — PaymentHub.InitializeAccount must be create-once

Minimal, self-contained reproduction of the **PC-02** finding:
`contracts/payments/PaymentHub.tact`'s `receive(msg: InitializeAccount)` handler
checked only `sender() == self.admin` and then **unconditionally** wrote
`balance`/`owner` for the target slot — with **no "account already exists"
guard**. A malicious or compromised admin could therefore re-initialize an
already-funded account, reassign `owner` to an attacker-controlled address, and
drain it via `TransferInternalRequest` (which authorizes on
`sender() == from_account.owner`). That breaks invariant **I1 (Non-Custodial)**
and **I3 (No Admin Control over user funds)**.

## What `create-once.repro.spec.ts` proves

Four tests split into two groups:

- **tests 1 & 2 — the attack:** the admin initializes + funds account X (owner
  X), then attempts to re-`InitializeAccount` the same slot to attacker Y and
  drain it.
- **tests 3 & 4 — the lifecycle that must keep working:** the first (one-time)
  init of a fresh account still succeeds (test 3), and a free read-only query
  (`GetAccountStateRequest`, callable by anyone) must **not** squat a slot and
  block that slot's legitimate first init (test 4).

The two groups together pin down the *full* fix — not just the guard, but also
the read path having to stay side-effect free:

| Contract state | tests 1 & 2 (overwrite / drain) | tests 3 & 4 (lifecycle) |
| --- | --- | --- |
| **Before the fix** (no existence guard) | **FAIL** — the re-init succeeds, owner flips to Y | pass |
| **Naive guard only** (guard added, but read still persists a placeholder) | pass | **test 4 FAILS** — a query squats the slot → DoS blocks first init |
| **After the full fix** (guard + read-only `getAccountOrDefault`) | pass | pass |

The middle row is why the issue's literal suggested fix is insufficient on its
own: adding `require(accounts.get(...) == null, ...)` while the read helper still
calls `self.accounts.set(...)` turns a free, unauthenticated
`GetAccountStateRequest` into a permanent denial-of-service — anyone can persist
an empty slot for an `nft_address` and thereby block its legitimate first
initialization forever. Test 4 catches exactly this, so the fix also makes the
helper (renamed `getOrCreateAccount` → `getAccountOrDefault`) read-only.

The fix itself:

```tact
// in receive(msg: InitializeAccount), after the admin check:
require(self.accounts.get(msg.nft_address) == null, "Account already initialized");
```

(The Tact compiler hashes that `require` string to a deterministic exit code —
`18265` for `"Account already initialized"` — so consumers must map by **message**,
not by a hand-assigned numeric constant.)

## How to run

This experiment is fully self-contained. `npm run build` copies the live
production source (`../../contracts/payments/PaymentHub.tact`) into this folder
and compiles it with Tact, so the test always runs against the real contract:

```sh
cd experiments/issue-371-paymenthub-create-once
npm install
npm run build            # syncs + compiles PaymentHub.tact into ./dist
npm test
```

Expected against the fixed contract: **4 passed**.

> `npm run sync` (run automatically by `build`) copies the production
> `PaymentHub.tact` into this directory; the copy is `.gitignore`d so the source
> is never duplicated in git and a rebuild always reflects the live contract.
> Tact 1.4.4 refuses to compile a source file outside its config directory, which
> is why the copy-at-build approach is used instead of pointing the compiler at
> `../../contracts/...` directly.

To witness the original vulnerability, check out `PaymentHub.tact` prior to the
Issue #371 fix (or delete the `require(... == null, ...)` line), rebuild, and
re-run — tests 1 & 2 then fail because the re-init is accepted and Y seizes the
account.

## Permanent regression coverage

`contracts/payments/` is not part of the CI build/test matrix, so the
CI-enforced lock for this source is a **grep gate** in
`contracts/payment-hub/non-production-stubs.spec.ts` (the
`Issue #371 (PC-02): PaymentHub.InitializeAccount is create-once` suite). It
asserts the guard string and condition are present inside `InitializeAccount`
*after* the admin authentication, and that the account read path stays
`self.accounts.set(...)`-free so a query cannot squat a slot. This standalone
experiment is kept only as the behavioural reproduction.
