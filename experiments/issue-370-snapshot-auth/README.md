# Issue #370 / PC-01 — SnapshotVerifier sender authentication

Minimal reproduction of the **PC-01** finding: `SnapshotVerifier.tact`'s
`receive(msg: RegisterSnapshot)` handler performed **no sender authorization
check**, so any external address could register (forge) the governance
eligibility roll that `ProposalRegistry` consults when deciding whether an NFT
may vote.

## What `forge-snapshot.repro.spec.ts` proves

An arbitrary `attacker` treasury sends a `RegisterSnapshot` granting eligibility
to an NFT it controls.

| Contract state | Result |
| --- | --- |
| **Before the fix** (no `sender()` check) | the attacker's `RegisterSnapshot` **succeeds** → forged eligibility leaks into the roll → this test **FAILS** (it asserts the attacker is rejected). |
| **After the fix** (trusted-indexer guard) | the attacker's `RegisterSnapshot` is **rejected** and no forged eligibility is recorded → this test **PASSES**. |

The permanent, authoritative regression coverage lives in
`contracts/governance/SnapshotVerifier.spec.ts` (the
`sender authentication (Issue #370 / PC-01)` suite). This experiment is kept only
as the standalone minimal reproduction.

## How to run

The test imports the compiled wrapper from the governance build output and the
test dependencies live in that workspace, so build the contracts first and run
jest from `contracts/governance`, pointing module resolution at its
`node_modules`:

```sh
cd contracts/governance
npm install
npm run build            # regenerates ./dist/SnapshotVerifier_SnapshotVerifier.ts
npx jest --roots ../../experiments/issue-370-snapshot-auth \
  --config "{\"preset\":\"ts-jest\",\"testEnvironment\":\"node\",\"modulePaths\":[\"$(pwd)/node_modules\"],\"globals\":{\"ts-jest\":{\"isolatedModules\":true}}}"
```

Expected against the fixed contract: `1 passed` (the attacker is rejected).

To witness the original vulnerability, check out the contract prior to the
Issue #370 fix (i.e. before the trusted-indexer guard was added), rebuild, and
re-run — the test then fails because the attacker's forged snapshot is accepted.
