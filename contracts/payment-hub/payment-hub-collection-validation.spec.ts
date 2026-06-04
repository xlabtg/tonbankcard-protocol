/**
 * PaymentHub NFT collection validation regression tests.
 *
 * PaymentHub.tact lives outside this package root, so the Tact compiler cannot
 * generate a sandbox wrapper from contracts/payment-hub. This source-level guard
 * still runs in the contract CI job and prevents the original L-1 bug from
 * returning: looking up nft_address directly in whitelisted_collections.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PAYMENT_HUB = 'contracts/payments/PaymentHub.tact';

function readPaymentHub(): string {
    return fs.readFileSync(path.join(REPO_ROOT, PAYMENT_HUB), 'utf8');
}

function extractFunction(source: string, signature: string): string {
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThanOrEqual(0);
    const open = source.indexOf('{', start);
    expect(open).toBeGreaterThanOrEqual(0);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(open, i + 1);
        }
    }
    throw new Error(`Unterminated function ${signature}`);
}

describe('PaymentHub collection-based NFT validation', () => {
    it('tracks each NFT item collection separately from the collection whitelist', () => {
        const source = readPaymentHub();
        expect(source).toContain('nft_collections: map<Address, Address>');
        expect(source).toContain('message RegisterAccountNFT');
        expect(source).toContain('receive(msg: RegisterAccountNFT)');
    });

    it('only registers NFT items for already-whitelisted collections', () => {
        const source = readPaymentHub();
        const registerAccountNFT = extractFunction(source, 'receive(msg: RegisterAccountNFT)');

        expect(registerAccountNFT).toContain('require(sender() == self.admin');
        expect(registerAccountNFT).toContain('self.isCollectionWhitelisted(msg.collection_address)');
        expect(registerAccountNFT).toContain('self.nft_collections.set(msg.nft_address, msg.collection_address)');
    });

    it('validates new account NFTs by registered collection, not by NFT item address', () => {
        const source = readPaymentHub();
        const isValidAccountNFT = extractFunction(source, 'get fun isValidAccountNFT');

        expect(isValidAccountNFT).toContain('self.nft_collections.get(nft_address)');
        expect(isValidAccountNFT).toContain('self.whitelisted_collections.get(collection');
        expect(isValidAccountNFT).not.toContain('self.whitelisted_collections.get(nft_address)');
    });
});
