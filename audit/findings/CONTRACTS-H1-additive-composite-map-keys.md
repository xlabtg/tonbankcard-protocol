---
title: "[CONTRACTS-H1] Additive composite map keys can collide across NFT accounts"
severity: high
area: contracts
priority: high
stage: 2
labels: ["bug","audit","type:contract","type:security","priority:high","stage:2-high"]
---

## Summary

Several contracts build composite map keys by integer-adding an unbounded, user-controlled ID to a 256-bit address hash. Integer addition is not injective, so distinct `(address, id)` pairs can collide to the same key, allowing one NFT account to read or overwrite another account's mandate, proposal, approval, or bridge-intent state.

## Severity & Category

- Severity: High
- Category: Data integrity / State isolation (key collision)

## Affected Code

- `contracts/MultiSigCard.tact` lines `536-544` (`proposalKey = sha256(nft_address.asSlice()) + proposal_id`; `approvalKey = sha256(...) + proposal_id * 1000 + sha256(signer.asSlice())`)
- `contracts/RecurringPayments.tact` line `402` (`mandateKey = sha256(...) + mandate_id`)
- `contracts/CrossChainBridge.tact` lines `384-386` (`intentKey = sha256(...) + intent_id`)

## Description

The composite keys are formed by adding identifiers, for example in `MultiSigCard.tact`:

```tact
fun proposalKey(nft_address: Address, proposal_id: Int): Int {
    // Create composite key from NFT address hash and proposal ID
    return sha256(nft_address.asSlice()) + proposal_id;
}

fun approvalKey(nft_address: Address, proposal_id: Int, signer: Address): Int {
    // Create composite key from NFT address, proposal ID, and signer
    return sha256(nft_address.asSlice()) + proposal_id * 1000 + sha256(signer.asSlice());
}
```

Because `proposal_id` / `mandate_id` / `intent_id` are unbounded user-supplied integers and addition is associative and commutative, many different inputs produce the same sum. For instance `sha256(A) + id1 == sha256(B) + id2` whenever `id2 - id1 == sha256(A) - sha256(B)`. An attacker who controls one account's ID can deliberately choose an ID that collides with another account's key, since hashes are public and the offset is computable.

## Impact

A colliding key lets one NFT account's record (mandate, proposal, approval, or cross-chain intent) alias another account's storage slot. This enables reading another account's state, overwriting/forging approvals, or hijacking mandates/bridge intents across accounts, breaking the per-account isolation the protocol relies on. The user-controlled, unbounded ID makes intentional collisions feasible rather than merely theoretical.

## Suggested Fix

- Build collision-resistant composite keys by hashing the serialized tuple, e.g. `sha256(beginCell().storeAddress(nft_address).storeUint(id, 64).endCell())` (include the signer where relevant).
- Alternatively, use nested maps such as `map<Address, map<Int, T>>` so identifiers are never combined arithmetically.
- Apply the same fix consistently to `proposalKey`, `approvalKey`, `mandateKey`, and `intentKey`.

## Acceptance Criteria

- [ ] No composite map key is produced by integer addition of an ID to an address hash anywhere in the affected contracts.
- [ ] Keys are derived via a collision-resistant construction (serialized-cell hash) or nested maps.
- [ ] Regression test: two distinct `(address, id)` pairs that previously produced an equal sum now map to distinct storage entries and cannot read/overwrite each other.
- [ ] Regression test: legitimate per-account lookups (mandate/proposal/approval/intent) still resolve correctly after the change.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#258](https://github.com/xlabtg/tonbankcard-protocol/issues/258)
