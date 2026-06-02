# Composite map-key collision regression harness (CONTRACTS-H1)

Regression coverage for audit finding **CONTRACTS-H1** — _Additive composite map
keys can collide across NFT accounts_ ([issue #258](https://github.com/xlabtg/tonbankcard-protocol/issues/258)).

## What the finding was

Several contracts built composite map keys by integer-**adding** an unbounded,
user-controlled ID to a 256-bit address hash:

| Contract | Function | Original (vulnerable) key |
| --- | --- | --- |
| `MultiSigCard.tact` | `proposalKey` | `sha256(addr) + proposal_id` |
| `MultiSigCard.tact` | `approvalKey` | `sha256(addr) + proposal_id * 1000 + sha256(signer)` |
| `RecurringPayments.tact` | `mandateKey` | `sha256(addr) + mandate_id` |
| `CrossChainBridge.tact` | `intentKey` | `sha256(addr) + intent_id` |

Integer addition is not injective: distinct `(address, id)` pairs can collide to
the same key, letting one NFT account read or overwrite another account's
mandate / proposal / approval / bridge-intent slot.

## The fix

Keys are now derived from the hash of a **serialized cell** that pins each field
to a fixed position, so distinct tuples produce distinct cells (and therefore
distinct 256-bit cell hashes):

```tact
fun proposalKey(nft_address: Address, proposal_id: Int): Int {
    return beginCell()
        .storeAddress(nft_address)
        .storeInt(proposal_id, 257)
        .endCell()
        .hash();
}
```

`approvalKey` additionally appends `storeAddress(signer)`.

## This harness

`KeyDerivation.tact` is a **test-only** contract that exposes both the original
additive constructions and the fixed serialized-cell-hash constructions as
on-chain getters. `KeyCollision.spec.ts` uses them to assert:

1. Two distinct `(address, id)` pairs that produced an **equal** additive sum now
   map to **distinct** fixed keys (proposal / mandate / intent), and the
   swapped-`(account, signer)` approval collision is removed.
2. Legitimate per-account lookups still resolve deterministically and stay
   isolated across accounts, ids and signers.
3. Each on-chain key matches an independent off-chain `@ton/core` reconstruction,
   so indexers can reproduce the same key.

## Run

```bash
npm install
npm run build   # tact --config tact.config.json
npm test        # jest
```
