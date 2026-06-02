/**
 * Composite map-key collision — regression tests
 * Issue #258 / Audit finding CONTRACTS-H1.
 *
 * Background:
 *   Several contracts built composite map keys by integer-ADDING an unbounded,
 *   user-controlled ID to a 256-bit address hash, e.g.
 *
 *       proposalKey = sha256(nft_address.asSlice()) + proposal_id          (MultiSigCard)
 *       approvalKey = sha256(addr) + proposal_id * 1000 + sha256(signer)   (MultiSigCard)
 *       mandateKey  = sha256(nft_address.asSlice()) + mandate_id           (RecurringPayments)
 *       intentKey   = sha256(nft_address.asSlice()) + intent_id            (CrossChainBridge)
 *
 *   Integer addition is not injective, so distinct (address, id) pairs can
 *   collide to the same key — letting one NFT account read or overwrite another
 *   account's mandate / proposal / approval / bridge-intent slot.
 *
 * Fix (suggested-fix bullet 1 — serialized-cell hash):
 *   Keys are now derived as
 *       hash( beginCell().storeAddress(addr).storeInt(id, 257)[.storeAddress(signer)].endCell() )
 *   which is collision-resistant: distinct serialized tuples produce distinct
 *   cells and therefore distinct 256-bit cell hashes.
 *
 * These tests exercise the acceptance criteria against the on-chain getters of a
 * test harness that mirrors the production key functions byte-for-byte:
 *   (1) Two distinct (address, id) pairs that produced an EQUAL legacy sum now
 *       map to DISTINCT fixed keys and cannot alias each other.
 *   (2) Legitimate per-account lookups still resolve deterministically and stay
 *       isolated across accounts, ids and signers.
 *   (3) The on-chain fixed key matches an independent off-chain @ton/core
 *       reconstruction (so indexers can reproduce the same key).
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import '@ton/test-utils';
import { Address, beginCell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { KeyDerivation } from './dist/KeyDerivation_KeyDerivation';

// Independent off-chain reconstruction of the FIXED constructions, mirroring the
// Tact `beginCell()...endCell().hash()` calls using @ton/core. A cell's hash()
// is the standard 256-bit cell representation hash — identical to Tact's
// `.hash()` — so these must equal the on-chain getters exactly.
function bufToBig(buf: Buffer): bigint {
    return BigInt('0x' + buf.toString('hex'));
}
function tsSingleIdKey(addr: Address, id: bigint): bigint {
    return bufToBig(
        beginCell().storeAddress(addr).storeInt(id, 257).endCell().hash(),
    );
}
function tsApprovalKey(addr: Address, id: bigint, signer: Address): bigint {
    return bufToBig(
        beginCell()
            .storeAddress(addr)
            .storeInt(id, 257)
            .storeAddress(signer)
            .endCell()
            .hash(),
    );
}

describe('CONTRACTS-H1 — additive composite map keys can collide', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let kd: SandboxContract<KeyDerivation>;

    // Two distinct NFT accounts and a signer.
    let accountA: Address;
    let accountB: Address;
    let signer: Address;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        accountA = (await blockchain.treasury('nft-account-A')).address;
        accountB = (await blockchain.treasury('nft-account-B')).address;
        signer = (await blockchain.treasury('co-signer')).address;

        kd = blockchain.openContract(await KeyDerivation.fromInit());
        await kd.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'Deploy', queryId: 0n },
        );
    });

    // -------------------------------------------------------------------------
    // (1) Crafted collisions across accounts — single-ID keys
    //     (proposalKey / mandateKey / intentKey share the same shape).
    // -------------------------------------------------------------------------
    describe('crafted cross-account collisions are removed', () => {
        // legacy key = sha256(addr) + id. Reading id = 0 yields the raw address
        // hash, so we can compute an offset that forces a collision:
        //   legacy(A, 0) == legacy(B, idB)  whenever  idB == hashA - hashB.
        async function craftCollidingPair(): Promise<{
            addrLow: Address;
            addrHigh: Address;
            idHigh: bigint; // applied to the address with the SMALLER hash
        }> {
            const hashA = await kd.getLegacyProposalKey(accountA, 0n);
            const hashB = await kd.getLegacyProposalKey(accountB, 0n);
            // Pick a NON-NEGATIVE colliding id by offsetting the smaller hash up
            // to the larger one (ids are realistically non-negative).
            if (hashA >= hashB) {
                return { addrLow: accountB, addrHigh: accountA, idHigh: hashA - hashB };
            }
            return { addrLow: accountA, addrHigh: accountB, idHigh: hashB - hashA };
        }

        it('legacy additive proposalKey DID collide (vulnerability is real)', async () => {
            const { addrLow, addrHigh, idHigh } = await craftCollidingPair();
            const keyHigh = await kd.getLegacyProposalKey(addrHigh, 0n);
            const keyLow = await kd.getLegacyProposalKey(addrLow, idHigh);
            // Distinct (address, id) pairs, identical legacy key — cross-account alias.
            expect(keyLow).toBe(keyHigh);
        });

        it('fixed proposalKey maps the same pair to DISTINCT keys', async () => {
            const { addrLow, addrHigh, idHigh } = await craftCollidingPair();
            const keyHigh = await kd.getProposalKey(addrHigh, 0n);
            const keyLow = await kd.getProposalKey(addrLow, idHigh);
            expect(keyLow).not.toBe(keyHigh);
        });

        it('fixed mandateKey maps the same pair to DISTINCT keys', async () => {
            const { addrLow, addrHigh, idHigh } = await craftCollidingPair();
            const keyHigh = await kd.getMandateKey(addrHigh, 0n);
            const keyLow = await kd.getMandateKey(addrLow, idHigh);
            expect(keyLow).not.toBe(keyHigh);
        });

        it('fixed intentKey maps the same pair to DISTINCT keys', async () => {
            const { addrLow, addrHigh, idHigh } = await craftCollidingPair();
            const keyHigh = await kd.getIntentKey(addrHigh, 0n);
            const keyLow = await kd.getIntentKey(addrLow, idHigh);
            expect(keyLow).not.toBe(keyHigh);
        });
    });

    // -------------------------------------------------------------------------
    // (1b) Crafted collision for approvalKey via commutativity of addition.
    //      legacy(A, 0, B) = sha256(A) + sha256(B) = legacy(B, 0, A).
    // -------------------------------------------------------------------------
    describe('approvalKey cross-account collision is removed', () => {
        it('legacy additive approvalKey DID collide when (account, signer) are swapped', async () => {
            // legacy(account, 0, signer) = hash(account) + hash(signer). Read each
            // address hash via legacyProposalKey(addr, 0) and reconstruct the sums.
            const hA = await kd.getLegacyProposalKey(accountA, 0n);
            const hB = await kd.getLegacyProposalKey(accountB, 0n);
            const keyAB = hA + hB; // account A, signer B
            const keyBA = hB + hA; // account B, signer A
            // Account A approved-by B aliases Account B approved-by A.
            expect(keyAB).toBe(keyBA);
        });

        it('fixed approvalKey keeps the swapped tuples DISTINCT', async () => {
            const keyAB = await kd.getApprovalKey(accountA, 0n, accountB);
            const keyBA = await kd.getApprovalKey(accountB, 0n, accountA);
            expect(keyAB).not.toBe(keyBA);
        });
    });

    // -------------------------------------------------------------------------
    // (2) Legitimate per-account lookups still resolve and stay isolated.
    // -------------------------------------------------------------------------
    describe('legitimate lookups remain correct and isolated', () => {
        it('the same (account, id) always derives the same key (deterministic)', async () => {
            const first = await kd.getProposalKey(accountA, 42n);
            const second = await kd.getProposalKey(accountA, 42n);
            expect(first).toBe(second);
        });

        it('different ids on the same account derive different keys', async () => {
            const k1 = await kd.getProposalKey(accountA, 1n);
            const k2 = await kd.getProposalKey(accountA, 2n);
            expect(k1).not.toBe(k2);
        });

        it('the same id on different accounts derives different keys', async () => {
            const kA = await kd.getProposalKey(accountA, 7n);
            const kB = await kd.getProposalKey(accountB, 7n);
            expect(kA).not.toBe(kB);
        });

        it('different signers on the same proposal derive different approval keys', async () => {
            const withA = await kd.getApprovalKey(accountA, 5n, accountA);
            const withB = await kd.getApprovalKey(accountA, 5n, accountB);
            expect(withA).not.toBe(withB);
        });

        it('mandateKey and intentKey stay isolated across accounts and ids', async () => {
            expect(await kd.getMandateKey(accountA, 9n)).not.toBe(
                await kd.getMandateKey(accountB, 9n),
            );
            expect(await kd.getIntentKey(accountA, 9n)).not.toBe(
                await kd.getIntentKey(accountA, 10n),
            );
        });
    });

    // -------------------------------------------------------------------------
    // (3) On-chain keys are reproducible off-chain (indexer parity).
    // -------------------------------------------------------------------------
    describe('on-chain keys match off-chain @ton/core reconstruction', () => {
        it('proposalKey / mandateKey / intentKey match the single-id reconstruction', async () => {
            const id = 12345n;
            const expected = tsSingleIdKey(accountA, id);
            expect(await kd.getProposalKey(accountA, id)).toBe(expected);
            expect(await kd.getMandateKey(accountA, id)).toBe(expected);
            expect(await kd.getIntentKey(accountA, id)).toBe(expected);
        });

        it('approvalKey matches the (address, id, signer) reconstruction', async () => {
            const id = 678n;
            expect(await kd.getApprovalKey(accountA, id, signer)).toBe(
                tsApprovalKey(accountA, id, signer),
            );
        });
    });
});
