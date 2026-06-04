/**
 * AccountStateMachine production-surface regression tests.
 *
 * CONTRACTS-LOW / I-1 requires removing deployer-gated test-only mint, move,
 * withdraw, and state-change handlers from deployable production contracts.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Address, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { AccountStateMachine } from './dist/account-state_AccountStateMachine';
import * as fs from 'fs';
import * as path from 'path';

const STATE_ACTIVE = 1n;
const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('AccountStateMachine production surface', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let accountStateMachine: SandboxContract<AccountStateMachine>;
    let nftAccount: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        nftAccount = (await blockchain.treasury('nftAccount')).address;

        accountStateMachine = blockchain.openContract(
            await AccountStateMachine.fromInit(deployer.address)
        );

        await accountStateMachine.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    it('deploys and exposes read-only default account state', async () => {
        expect(await accountStateMachine.getGetBalance(nftAccount)).toBe(0n);
        expect(await accountStateMachine.getGetState(nftAccount)).toBe(STATE_ACTIVE);
        expect(await accountStateMachine.getCanSend(nftAccount)).toBe(true);
        expect(await accountStateMachine.getCanReceive(nftAccount)).toBe(true);
    });

    it('does not expose deployer-gated test-only balance or state mutation messages', () => {
        const source = fs.readFileSync(
            path.join(REPO_ROOT, 'contracts/payment-hub/account-state.tact'),
            'utf8'
        );

        for (const forbidden of [
            'message DepositTBC',
            'message WithdrawTBC',
            'message TransferInternal',
            'message ChangeAccountState',
            'receive(msg: DepositTBC)',
            'receive(msg: WithdrawTBC)',
            'receive(msg: TransferInternal)',
            'receive(msg: ChangeAccountState)',
            'Unauthorized: only deployer (test-only)',
        ]) {
            expect(source).not.toContain(forbidden);
        }
    });
});
