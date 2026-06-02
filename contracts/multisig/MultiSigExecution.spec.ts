/**
 * MultiSigCard — payment execution path regression tests.
 * Issue #259 / Audit finding CONTRACTS-H2.
 *
 * Background:
 *   The original MultiSigCard marked a proposal APPROVED once the signature
 *   threshold was reached but had NO handler to carry the approved payment out.
 *   The `PaymentProposalExecuted` event was therefore unreachable dead code and
 *   the multi-sig state machine terminated without ever moving funds.
 *
 * Fix (suggested-fix bullet 1):
 *   A dedicated, owner-gated `ExecutePaymentProposal` handler consumes an
 *   APPROVED proposal, forwards exactly `amount` to the recipient (funds are
 *   supplied by the owner with the message — INVARIANT I1 non-custodial),
 *   emits `PaymentProposalExecuted`, and transitions the proposal to the
 *   terminal PROPOSAL_EXECUTED state.
 *
 * These tests exercise the acceptance criteria:
 *   (a) An approved proposal can be executed; the event is emitted exactly once
 *       and the proposal moves to a distinct executed state; the recipient is
 *       paid exactly `amount`.
 *   (b) A proposal cannot be executed twice.
 *   (c) Execution rejects proposals that are not in APPROVED status.
 *   (d) Execution rejects unauthorized senders (co-signer / stranger).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano, Address } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { MultiSigCard, loadPaymentProposalExecuted } from './dist/MultiSigCard_MultiSigCard';

// Mirror of the Tact status constants.
const PROPOSAL_PENDING = 0n;
const PROPOSAL_APPROVED = 1n;
const PROPOSAL_EXECUTED = 3n;

const GAS = toNano('0.2');
const AMOUNT = toNano('1');

describe('MultiSigCard — payment execution path (CONTRACTS-H2)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let signer1: SandboxContract<TreasuryContract>;
    let signer2: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let card: SandboxContract<MultiSigCard>;

    // A stand-in NFT card address (the contract only uses it as a map key).
    let nft: Address;

    const ZERO = new Address(0, Buffer.alloc(32));

    function countExecutedEvents(externals: { body: import('@ton/core').Cell }[]): number {
        let n = 0;
        for (const ext of externals) {
            try {
                loadPaymentProposalExecuted(ext.body.beginParse());
                n += 1;
            } catch {
                // not a PaymentProposalExecuted event — ignore
            }
        }
        return n;
    }

    async function configure(required: bigint) {
        await card.send(
            owner.getSender(),
            { value: GAS },
            {
                $$type: 'ConfigureMultiSig',
                nft_address: nft,
                required_signatures: required,
                signer_1: signer1.address,
                signer_2: signer2.address,
                signer_3: ZERO,
            }
        );
    }

    async function submit(proposalId: bigint, amount: bigint = AMOUNT) {
        await card.send(
            owner.getSender(),
            { value: GAS },
            {
                $$type: 'SubmitPaymentProposal',
                nft_address: nft,
                proposal_id: proposalId,
                recipient: recipient.address,
                amount,
            }
        );
    }

    async function approve(signer: SandboxContract<TreasuryContract>, proposalId: bigint) {
        await card.send(
            signer.getSender(),
            { value: GAS },
            { $$type: 'ApprovePaymentProposal', nft_address: nft, proposal_id: proposalId }
        );
    }

    async function execute(
        sender: SandboxContract<TreasuryContract>,
        proposalId: bigint,
        value: bigint = AMOUNT + GAS
    ) {
        return card.send(
            sender.getSender(),
            { value },
            { $$type: 'ExecutePaymentProposal', nft_address: nft, proposal_id: proposalId }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        signer1 = await blockchain.treasury('signer1');
        signer2 = await blockchain.treasury('signer2');
        recipient = await blockchain.treasury('recipient');
        attacker = await blockchain.treasury('attacker');
        nft = (await blockchain.treasury('nft-card')).address;

        card = blockchain.openContract(await MultiSigCard.fromInit());

        // The very first message both deploys the contract (init records the
        // deployer = sender) and registers the NFT owner via the test-only
        // handler, which is gated on the deployer.
        await card.send(
            deployer.getSender(),
            { value: toNano('0.5') },
            { $$type: 'RegisterNFTOwnerMultiSig', nft_address: nft, owner: owner.address }
        );

        // 2-of-2 multi-sig, one pending proposal (id = 1).
        await configure(2n);
        await submit(1n);
    });

    it('reaches APPROVED once the threshold of approvals is met', async () => {
        await approve(signer1, 1n);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_PENDING);

        await approve(signer2, 1n);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_APPROVED);
    });

    it('executes an APPROVED proposal: pays the recipient, emits the event once, moves to EXECUTED', async () => {
        await approve(signer1, 1n);
        await approve(signer2, 1n);

        const before = await recipient.getBalance();
        const result = await execute(owner, 1n);

        // The card forwards an out-message carrying exactly the approved amount.
        expect(result.transactions).toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
            success: true,
        });
        // The recipient's balance grows by ~AMOUNT. The tiny shortfall is the
        // gas the receiving wallet itself pays to process the incoming message;
        // the forwarded message value is exactly AMOUNT (asserted above).
        const after = await recipient.getBalance();
        expect(after - before).toBeGreaterThan(AMOUNT - toNano('0.01'));
        expect(after - before).toBeLessThanOrEqual(AMOUNT);

        // PaymentProposalExecuted emitted exactly once.
        expect(countExecutedEvents(result.externals)).toBe(1);

        // Proposal is now in the distinct terminal EXECUTED state.
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_EXECUTED);
    });

    it('cannot execute the same proposal twice (no double spend, no second event)', async () => {
        await approve(signer1, 1n);
        await approve(signer2, 1n);
        await execute(owner, 1n);

        const before = await recipient.getBalance();
        const result = await execute(owner, 1n);

        // No second payment to the recipient.
        expect(result.transactions).not.toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
        });
        expect(await recipient.getBalance()).toBe(before);

        // No second event, status unchanged.
        expect(countExecutedEvents(result.externals)).toBe(0);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_EXECUTED);
    });

    it('rejects execution of a proposal that is not APPROVED (still PENDING)', async () => {
        // Only one of two required approvals → proposal stays PENDING.
        await approve(signer1, 1n);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_PENDING);

        const before = await recipient.getBalance();
        const result = await execute(owner, 1n);

        expect(result.transactions).not.toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
        });
        expect(countExecutedEvents(result.externals)).toBe(0);
        expect(await recipient.getBalance()).toBe(before);
        // Status untouched by the rejected execution.
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_PENDING);
    });

    it('rejects execution by an unauthorized sender (registered co-signer is not the owner)', async () => {
        await approve(signer1, 1n);
        await approve(signer2, 1n);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_APPROVED);

        const before = await recipient.getBalance();
        // A co-signer is authorized to approve but NOT to move funds (I1).
        const result = await execute(signer1, 1n);

        expect(result.transactions).not.toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
        });
        expect(countExecutedEvents(result.externals)).toBe(0);
        expect(await recipient.getBalance()).toBe(before);
        // Proposal remains APPROVED and can still be executed by the owner.
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_APPROVED);
    });

    it('rejects execution by a complete stranger', async () => {
        await approve(signer1, 1n);
        await approve(signer2, 1n);

        const result = await execute(attacker, 1n);

        expect(result.transactions).not.toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
        });
        expect(countExecutedEvents(result.externals)).toBe(0);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_APPROVED);
    });

    it('keeps distinct proposal ids in distinct storage slots (MS-CH-1 composite-key hardening)', async () => {
        // A second proposal is submitted under a different id. The packed-cell
        // proposalKey hash must give it a slot independent of proposal #1, so
        // executing #1 leaves #2 untouched (the old additive combinator could
        // collide two proposals into one slot).
        await submit(2n);
        await approve(signer1, 1n);
        await approve(signer2, 1n);
        await execute(owner, 1n);

        // #1 is EXECUTED, #2 is unaffected and still PENDING.
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_EXECUTED);
        expect(await card.getGetProposalStatus(nft, 2n)).toBe(PROPOSAL_PENDING);

        // #2 follows its own independent lifecycle to APPROVED.
        await approve(signer1, 2n);
        await approve(signer2, 2n);
        expect(await card.getGetProposalStatus(nft, 2n)).toBe(PROPOSAL_APPROVED);
    });

    it('still lets the owner execute after an unauthorized attempt was rejected', async () => {
        await approve(signer1, 1n);
        await approve(signer2, 1n);
        await execute(attacker, 1n); // rejected

        const before = await recipient.getBalance();
        const result = await execute(owner, 1n);

        expect(result.transactions).toHaveTransaction({
            from: card.address,
            to: recipient.address,
            value: AMOUNT,
            success: true,
        });
        const delta = (await recipient.getBalance()) - before;
        expect(delta).toBeGreaterThan(AMOUNT - toNano('0.01'));
        expect(delta).toBeLessThanOrEqual(AMOUNT);
        expect(countExecutedEvents(result.externals)).toBe(1);
        expect(await card.getGetProposalStatus(nft, 1n)).toBe(PROPOSAL_EXECUTED);
    });
});
