/**
 * Gas profiler for the Tonbankcard payment-hub contracts.
 *
 * Issue: #128 (D2 — Contract Gas Optimization)
 *
 * The script spins up an @ton/sandbox blockchain, deploys the compiled
 * AccountStateMachine (which is the on-chain ledger backing PaymentHub.tact),
 * and executes every operation that the protocol performs in production:
 *
 *   - Deposit TBC (cold and warm)
 *   - Withdraw TBC
 *   - Internal transfer (cold and warm)
 *   - Lock set (FROZEN, COLLATERAL_LOCKED)
 *   - Read getters (balance, state, canSend, canReceive)
 *
 * For every operation the compute-phase gas of the contract transaction is
 * recorded. Results are aggregated into a JSON report and a Markdown table
 * suitable for docs/gas-costs.md.
 *
 * Usage:
 *   npx ts-node profile.ts [--label baseline] [--out results.json]
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
// All three packages MUST resolve to the same instance the Tact wrapper was
// compiled against. The wrapper hard-binds to the @ton/core inside
// contracts/payment-hub/node_modules, so we import from there too — otherwise
// Address objects created by the sandbox treasury are rejected as "Invalid
// address" by the wrapper's own @ton/core (different module instance, no
// shared internal symbol).
import { Blockchain, SandboxContract, TreasuryContract } from '../../contracts/payment-hub/node_modules/@ton/sandbox';
import { Address, toNano } from '../../contracts/payment-hub/node_modules/@ton/core';
import { AccountStateMachine } from '../../contracts/payment-hub/dist/account-state_AccountStateMachine';
import '../../contracts/payment-hub/node_modules/@ton/test-utils';

interface CliArgs {
    label: string;
    out: string;
}

interface OperationResult {
    name: string;
    description: string;
    gasUsed: number;
    txExitCode: number;
    txSuccess: boolean;
    runs: number;
    minGas: number;
    maxGas: number;
    avgGas: number;
}

interface ProfileReport {
    label: string;
    generatedAt: string;
    contract: string;
    sandbox: string;
    operations: OperationResult[];
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = { label: 'profile', out: 'results.json' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--label' && i + 1 < argv.length) args.label = argv[++i];
        else if (a === '--out' && i + 1 < argv.length) args.out = argv[++i];
    }
    return args;
}

// Extract compute-phase gas used from the contract-handling transaction.
// The "interesting" transaction is the one delivered TO the PaymentHub —
// not the wallet's outbound message — so we filter by destination.
function extractGasUsed(
    transactions: any[],
    contractAddress: Address,
): { gas: number; exitCode: number; success: boolean } {
    for (const tx of transactions) {
        const inMsgDest = tx.inMessage?.info?.dest;
        if (!inMsgDest || !inMsgDest.equals?.(contractAddress)) continue;
        const cp = tx.description?.computePhase;
        if (!cp || cp.type !== 'vm') continue;
        return {
            gas: Number(cp.gasUsed ?? 0n),
            exitCode: Number(cp.exitCode ?? 0),
            success: cp.success === true,
        };
    }
    return { gas: 0, exitCode: -1, success: false };
}

async function setupSandbox(): Promise<{
    blockchain: Blockchain;
    deployer: SandboxContract<TreasuryContract>;
    payer: SandboxContract<TreasuryContract>;
    contract: SandboxContract<AccountStateMachine>;
    nftA: Address;
    nftB: Address;
}> {
    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('deployer');
    const payer = await blockchain.treasury('payer');

    const contract = blockchain.openContract(
        await AccountStateMachine.fromInit(deployer.address),
    );

    await contract.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        { $$type: 'Deploy', queryId: 0n },
    );

    const nftA = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
    const nftB = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7');

    return { blockchain, deployer, payer, contract, nftA, nftB };
}

// Sample a single operation N times against a fresh sandbox so that
// cold/warm path differences are not muddled across operations.
//
// `expectSuccess` controls whether the contract transaction is expected to
// succeed. Some operations are explicitly profiled in their failure path
// (e.g. "transfer with insufficient balance") because optimizations that
// reorder validation/lookup primarily show up on the rejected path.
async function profileOperation(
    name: string,
    description: string,
    runs: number,
    runOnce: () => Promise<{ gas: number; exitCode: number; success: boolean }>,
    expectSuccess: boolean = true,
): Promise<OperationResult> {
    let totalGas = 0;
    let minGas = Number.POSITIVE_INFINITY;
    let maxGas = 0;
    let lastSnapshot = { gas: 0, exitCode: 0, success: false };

    for (let i = 0; i < runs; i++) {
        const r = await runOnce();
        if (expectSuccess && !r.success) {
            // surface unexpected failures immediately so the report doesn't
            // lie about a failing operation having a low gas cost
            throw new Error(
                `Operation "${name}" failed during profiling (run ${i + 1}/${runs}): ` +
                    `exitCode=${r.exitCode}`,
            );
        }
        if (!expectSuccess && r.success) {
            throw new Error(
                `Operation "${name}" was expected to fail but succeeded (run ${i + 1}/${runs}).`,
            );
        }
        totalGas += r.gas;
        if (r.gas < minGas) minGas = r.gas;
        if (r.gas > maxGas) maxGas = r.gas;
        lastSnapshot = r;
    }

    const avgGas = Math.round(totalGas / runs);

    return {
        name,
        description,
        gasUsed: lastSnapshot.gas,
        txExitCode: lastSnapshot.exitCode,
        txSuccess: lastSnapshot.success,
        runs,
        minGas: minGas === Number.POSITIVE_INFINITY ? 0 : minGas,
        maxGas,
        avgGas,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const operations: OperationResult[] = [];

    // ------------------------------------------------------------------
    // 1. DepositTBC (cold) — first deposit to a fresh account.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'deposit_cold',
            'DepositTBC into an account that has never been touched (cold map insert).',
            3,
            async () => {
                const sb = await setupSandbox();
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('100'),
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 2. DepositTBC (warm) — second deposit into the same account.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'deposit_warm',
            'DepositTBC into an existing account (dictionary update).',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('100'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('50'),
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 3. WithdrawTBC — withdraw from an active funded account.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'withdraw',
            'WithdrawTBC from an ACTIVE account with sufficient balance.',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('100'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'WithdrawTBC',
                        nft_address: sb.nftA,
                        amount: toNano('30'),
                        destination: sb.deployer.address,
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 4. TransferInternal (cold to-account) — to_nft is brand new.
    //    This represents a first-time payment to a fresh merchant NFT.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'transfer_internal_cold',
            'Internal TBC transfer; to_nft is being touched for the first time.',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('500'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'TransferInternal',
                        from_nft: sb.nftA,
                        to_nft: sb.nftB,
                        amount: toNano('100'),
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 5. TransferInternal (warm) — both accounts already exist.
    //    This is the steady-state high-frequency path.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'transfer_internal_warm',
            'Internal TBC transfer where both accounts already exist (steady state).',
            3,
            async () => {
                const sb = await setupSandbox();
                for (const nft of [sb.nftA, sb.nftB]) {
                    await sb.contract.send(
                        sb.deployer.getSender(),
                        { value: toNano('0.05') },
                        {
                            $$type: 'DepositTBC',
                            nft_address: nft,
                            amount: toNano('500'),
                        },
                    );
                }
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'TransferInternal',
                        from_nft: sb.nftA,
                        to_nft: sb.nftB,
                        amount: toNano('100'),
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 6. Lock set: ACTIVE -> FROZEN. Matches FRAUD_LOCK semantics.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'lock_set_frozen',
            'ChangeAccountState ACTIVE -> FROZEN (FRAUD_LOCK equivalent).',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('100'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'ChangeAccountState',
                        nft_address: sb.nftA,
                        new_state: 2n, // STATE_FROZEN
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 7. Lock set: ACTIVE -> COLLATERAL_LOCKED. Matches COLLATERAL_LOCK.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'lock_set_collateral',
            'ChangeAccountState ACTIVE -> COLLATERAL_LOCKED (COLLATERAL_LOCK equivalent).',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('100'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'ChangeAccountState',
                        nft_address: sb.nftA,
                        new_state: 3n, // STATE_COLLATERAL_LOCKED
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
        ),
    );

    // ------------------------------------------------------------------
    // 8. TransferInternal — REJECTED because source balance is insufficient.
    //
    //    The reorder optimization exists specifically to drop the
    //    `getOrDefault(to_nft)` dict_get on rejected transfers; on the
    //    happy path it is a wash (just instruction reordering), but on
    //    the failure path one dict load is avoided entirely.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'transfer_reject_insufficient',
            'TransferInternal rejected: source balance is below requested amount.',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('10'),
                    },
                );
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftB,
                        amount: toNano('10'),
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'TransferInternal',
                        from_nft: sb.nftA,
                        to_nft: sb.nftB,
                        amount: toNano('100'), // > balance
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
            false, // expectSuccess
        ),
    );

    // ------------------------------------------------------------------
    // 9. TransferInternal — REJECTED because source is FROZEN.
    // ------------------------------------------------------------------
    operations.push(
        await profileOperation(
            'transfer_reject_frozen_source',
            'TransferInternal rejected: source account is FROZEN.',
            3,
            async () => {
                const sb = await setupSandbox();
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftA,
                        amount: toNano('500'),
                    },
                );
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'DepositTBC',
                        nft_address: sb.nftB,
                        amount: toNano('10'),
                    },
                );
                await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'ChangeAccountState',
                        nft_address: sb.nftA,
                        new_state: 2n, // STATE_FROZEN
                    },
                );
                const r = await sb.contract.send(
                    sb.deployer.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'TransferInternal',
                        from_nft: sb.nftA,
                        to_nft: sb.nftB,
                        amount: toNano('100'),
                    },
                );
                return extractGasUsed(r.transactions, sb.contract.address);
            },
            false, // expectSuccess
        ),
    );

    // ------------------------------------------------------------------
    // Build the final report.
    // ------------------------------------------------------------------
    const report: ProfileReport = {
        label: args.label,
        generatedAt: new Date().toISOString(),
        contract: 'contracts/payment-hub/account-state.tact :: AccountStateMachine',
        sandbox: '@ton/sandbox',
        operations,
    };

    const outPath = resolve(__dirname, args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

    // Pretty-print to stdout: easy to paste into docs/gas-costs.md.
    const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
    console.log(`\n# Gas profile — ${args.label}\n`);
    console.log(`Contract: ${report.contract}`);
    console.log(`Sandbox:  ${report.sandbox}`);
    console.log(`Generated at: ${report.generatedAt}\n`);
    console.log(`| ${pad('Operation', 28)} | ${pad('Avg gas', 10)} | ${pad('Min', 10)} | ${pad('Max', 10)} |`);
    console.log(`| ${'-'.repeat(28)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} |`);
    for (const op of operations) {
        console.log(
            `| ${pad(op.name, 28)} | ${pad(String(op.avgGas), 10)} | ${pad(String(op.minGas), 10)} | ${pad(String(op.maxGas), 10)} |`,
        );
    }
    console.log(`\nReport written to: ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
