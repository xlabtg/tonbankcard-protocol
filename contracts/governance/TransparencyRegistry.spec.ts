/**
 * TransparencyRegistry — Sender authentication regression tests
 * Issue #365 (HIGH, blocks mainnet) / THREAT_MODEL §4.1.5 / Audit access-control.
 *
 * Background:
 *   The original TransparencyRegistry accepted all six data-ingestion messages
 *   (RecordProposal, RecordVotingResult, RecordSnapshot, RecordProtocolMetrics,
 *   RecordLockActivity, RecordParameterChange) WITHOUT any sender check. Any
 *   address could therefore inject fabricated transparency data — fake
 *   proposals, fake voting outcomes, fake snapshots and fake monthly reports.
 *
 * Fix (Issue #365 recommended fix):
 *   Each data domain has a dedicated authorized writer address stored in
 *   contract state:
 *     - proposal_registry -> RecordProposal, RecordVotingResult
 *     - snapshot_verifier -> RecordSnapshot
 *     - report_writer     -> RecordProtocolMetrics, RecordLockActivity,
 *                            RecordParameterChange
 *   Writers are configured by the deployer (the governance multi-sig in
 *   production) via SetProposalRegistry / SetSnapshotVerifier / SetReportWriter.
 *   Until a writer is configured the matching handler fails closed, so fake
 *   data can never be injected — not even before the writers are wired up.
 *
 * These tests exercise the acceptance criteria:
 *   (a) Every record handler verifies the sender is the authorized contract.
 *   (b) Authorized sender addresses are stored in contract state (getters).
 *   (c) The deployer (and only the deployer) can set / update authorized senders.
 *   (d) Unauthorized senders are rejected (including cross-domain writers).
 *   (e) Authorized contracts can still write data and the data is recorded.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { TransparencyRegistry } from './dist/TransparencyRegistry_TransparencyRegistry';

// Quorum threshold passed to fromInit (mirrors the >50% of 222 default).
const QUORUM = 112n;
// Generous gas budget for the record handlers (they emit an event each).
const GAS = toNano('0.2');

// Mirror of the Tact category / outcome constants (TransparencyTypes.tact).
const CATEGORY_ROADMAP_SIGNAL = 0n;
const OUTCOME_ACCEPTED = 1n;

// Generated exit codes (TransparencyRegistry_errors in the compiled wrapper).
// Asserting these proves the *correct* guard fired, not some unrelated failure.
const ERR_PROPOSAL_WRITER_UNCONFIGURED = 3077;
const ERR_SNAPSHOT_WRITER_UNCONFIGURED = 10356;
const ERR_ONLY_DEPLOYER = 12763;
const ERR_ONLY_PROPOSAL_REGISTRY = 29508;
const ERR_ONLY_REPORT_WRITER = 36183;
const ERR_REPORT_WRITER_UNCONFIGURED = 42799;
const ERR_ONLY_SNAPSHOT_VERIFIER = 54064;

// ---------------------------------------------------------------------------
// Message factories. `$$type` is pinned with `as const` so the literal type
// survives and the object satisfies the generated send() union exactly.
// ---------------------------------------------------------------------------

function proposalMsg(id: bigint = 1n, category: bigint = CATEGORY_ROADMAP_SIGNAL) {
    return {
        $$type: 'RecordProposal' as const,
        proposal_id: id,
        proposal_hash: 0x1234567890abcdefn,
        category,
        voting_window_start: 1000n,
        voting_window_end: 2000n,
    };
}

function votingResultMsg(id: bigint = 1n, outcome: bigint = OUTCOME_ACCEPTED, totalVotes: bigint = 150n) {
    return {
        $$type: 'RecordVotingResult' as const,
        proposal_id: id,
        outcome,
        total_votes: totalVotes,
    };
}

function snapshotMsg(blockHeight: bigint = 5000n, hash: bigint = 0xdeadbeefn) {
    return {
        $$type: 'RecordSnapshot' as const,
        block_height: blockHeight,
        snapshot_hash: hash,
    };
}

function protocolMetricsMsg() {
    return {
        $$type: 'RecordProtocolMetrics' as const,
        period_start: 1000n,
        period_end: 2000n,
        active_accounts: 42n,
        tbc_volume_transferred: toNano('1000'),
        transfer_count: 99n,
    };
}

function lockActivityMsg() {
    return {
        $$type: 'RecordLockActivity' as const,
        period_start: 1000n,
        period_end: 2000n,
        locks_set: 10n,
        locks_cleared: 4n,
        locks_active: 6n,
        appeals_filed: 3n,
        appeals_overturned: 1n,
        appeals_upheld: 1n,
    };
}

function parameterChangeMsg() {
    return {
        $$type: 'RecordParameterChange' as const,
        parameter_id: 7n,
        proposal_id: 1n,
        old_value_hash: 0x1111n,
        new_value_hash: 0x2222n,
        effective_block: 5000n,
    };
}

describe('TransparencyRegistry — аутентификация отправителя (Issue #365)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let proposalRegistry: SandboxContract<TreasuryContract>;
    let snapshotVerifier: SandboxContract<TreasuryContract>;
    let reportWriter: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<TransparencyRegistry>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        // Stand-ins for the trusted sibling contracts (each a distinct address).
        proposalRegistry = await blockchain.treasury('proposalRegistry');
        snapshotVerifier = await blockchain.treasury('snapshotVerifier');
        reportWriter = await blockchain.treasury('reportWriter');
        attacker = await blockchain.treasury('attacker');

        // Deploy UNCONFIGURED: every writer slot starts null so the fail-closed
        // behaviour can be exercised before any writer is wired up.
        registry = blockchain.openContract(await TransparencyRegistry.fromInit(QUORUM));
        await registry.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'Deploy', queryId: 0n },
        );
    });

    // Configure all three writers to the canonical sibling treasuries.
    async function configureAllWriters() {
        await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
            $$type: 'SetProposalRegistry', registry: proposalRegistry.address,
        });
        await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
            $$type: 'SetSnapshotVerifier', verifier: snapshotVerifier.address,
        });
        await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
            $$type: 'SetReportWriter', writer: reportWriter.address,
        });
    }

    // -----------------------------------------------------------------------
    // (b)+(c) Authorized senders stored in state; deployer-only configuration.
    // -----------------------------------------------------------------------
    describe('Конфигурация авторизованных писателей (только deployer)', () => {
        it('запоминает deployer как конфигурационную власть; слоты писателей пусты при инициализации', async () => {
            expect((await registry.getGetDeployer()).toString()).toBe(deployer.address.toString());
            expect(await registry.getGetProposalRegistry()).toBeNull();
            expect(await registry.getGetSnapshotVerifier()).toBeNull();
            expect(await registry.getGetReportWriter()).toBeNull();
        });

        it('deployer может назначить все три слота писателей (сохраняются в состоянии)', async () => {
            await configureAllWriters();
            expect((await registry.getGetProposalRegistry())!.toString()).toBe(proposalRegistry.address.toString());
            expect((await registry.getGetSnapshotVerifier())!.toString()).toBe(snapshotVerifier.address.toString());
            expect((await registry.getGetReportWriter())!.toString()).toBe(reportWriter.address.toString());
        });

        it('deployer может ОБНОВИТЬ (ротировать) писателя — второе назначение побеждает', async () => {
            await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetProposalRegistry', registry: proposalRegistry.address,
            });
            // Rotate to a freshly redeployed sibling.
            const rotated = await blockchain.treasury('proposalRegistryV2');
            const res = await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetProposalRegistry', registry: rotated.address,
            });
            expect(res.transactions).toHaveTransaction({
                from: deployer.address, to: registry.address, success: true,
            });
            expect((await registry.getGetProposalRegistry())!.toString()).toBe(rotated.address.toString());
        });

        it('не-deployer НЕ может назначить ни один слот писателя (exit 12763); слот остаётся пустым', async () => {
            const r1 = await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetProposalRegistry', registry: attacker.address,
            });
            expect(r1.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address, success: false, exitCode: ERR_ONLY_DEPLOYER,
            });
            expect(await registry.getGetProposalRegistry()).toBeNull();

            const r2 = await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetSnapshotVerifier', verifier: attacker.address,
            });
            expect(r2.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address, success: false, exitCode: ERR_ONLY_DEPLOYER,
            });
            expect(await registry.getGetSnapshotVerifier()).toBeNull();

            const r3 = await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetReportWriter', writer: attacker.address,
            });
            expect(r3.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address, success: false, exitCode: ERR_ONLY_DEPLOYER,
            });
            expect(await registry.getGetReportWriter()).toBeNull();
        });

        it('даже авторизованный писатель данных НЕ может перенастраивать слоты (это право только deployer)', async () => {
            await configureAllWriters();
            // proposalRegistry is a legit data writer, but NOT the config authority.
            const res = await registry.send(proposalRegistry.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetReportWriter', writer: proposalRegistry.address,
            });
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address, success: false, exitCode: ERR_ONLY_DEPLOYER,
            });
            // report_writer slot unchanged.
            expect((await registry.getGetReportWriter())!.toString()).toBe(reportWriter.address.toString());
        });
    });

    // -----------------------------------------------------------------------
    // (a)+(d) Fail-closed: before any writer is configured, every record
    // handler rejects the write — no data can be injected in the deploy window.
    // -----------------------------------------------------------------------
    describe('Fail-closed: запись отклоняется до конфигурации писателя', () => {
        it('RecordProposal отклонён (exit 3077); proposalCount остаётся 0', async () => {
            const res = await registry.send(proposalRegistry.getSender(), { value: GAS }, proposalMsg());
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address,
                success: false, exitCode: ERR_PROPOSAL_WRITER_UNCONFIGURED,
            });
            expect(await registry.getGetProposalCount()).toBe(0n);
        });

        it('RecordVotingResult отклонён (exit 3077)', async () => {
            const res = await registry.send(proposalRegistry.getSender(), { value: GAS }, votingResultMsg());
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address,
                success: false, exitCode: ERR_PROPOSAL_WRITER_UNCONFIGURED,
            });
        });

        it('RecordSnapshot отклонён (exit 10356); latest block остаётся 0', async () => {
            const res = await registry.send(snapshotVerifier.getSender(), { value: GAS }, snapshotMsg());
            expect(res.transactions).toHaveTransaction({
                from: snapshotVerifier.address, to: registry.address,
                success: false, exitCode: ERR_SNAPSHOT_WRITER_UNCONFIGURED,
            });
            expect(await registry.getGetLatestSnapshotBlock()).toBe(0n);
        });

        it('RecordProtocolMetrics отклонён (exit 42799); счётчик периодов остаётся 0', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, protocolMetricsMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address,
                success: false, exitCode: ERR_REPORT_WRITER_UNCONFIGURED,
            });
            expect(await registry.getGetMetricPeriodsCount()).toBe(0n);
        });

        it('RecordLockActivity отклонён (exit 42799); счётчик lock-периодов остаётся 0', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, lockActivityMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address,
                success: false, exitCode: ERR_REPORT_WRITER_UNCONFIGURED,
            });
            expect(await registry.getGetLockPeriodsCount()).toBe(0n);
        });

        it('RecordParameterChange отклонён (exit 42799); счётчик изменений остаётся 0', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, parameterChangeMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address,
                success: false, exitCode: ERR_REPORT_WRITER_UNCONFIGURED,
            });
            expect((await registry.getGetParameterChangeSummary()).total_parameter_changes).toBe(0n);
        });
    });

    // -----------------------------------------------------------------------
    // (d) After configuration, unauthorized senders (and cross-domain writers)
    // are still rejected with the precise "only X" exit code.
    // -----------------------------------------------------------------------
    describe('Отклонение неавторизованных отправителей (после конфигурации)', () => {
        beforeEach(async () => {
            await configureAllWriters();
        });

        it('случайный атакующий не может вызвать RecordProposal (exit 29508)', async () => {
            const res = await registry.send(attacker.getSender(), { value: GAS }, proposalMsg());
            expect(res.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_PROPOSAL_REGISTRY,
            });
            expect(await registry.getGetProposalCount()).toBe(0n);
        });

        it('случайный атакующий не может вызвать RecordSnapshot (exit 54064)', async () => {
            const res = await registry.send(attacker.getSender(), { value: GAS }, snapshotMsg());
            expect(res.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_SNAPSHOT_VERIFIER,
            });
            expect(await registry.getGetLatestSnapshotBlock()).toBe(0n);
        });

        it('случайный атакующий не может вызвать RecordProtocolMetrics (exit 36183)', async () => {
            const res = await registry.send(attacker.getSender(), { value: GAS }, protocolMetricsMsg());
            expect(res.transactions).toHaveTransaction({
                from: attacker.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_REPORT_WRITER,
            });
            expect(await registry.getGetMetricPeriodsCount()).toBe(0n);
        });

        it('перекрёстная авторизация: SnapshotVerifier НЕ может писать предложения (exit 29508)', async () => {
            // snapshotVerifier is a legit writer, but only for snapshots.
            const res = await registry.send(snapshotVerifier.getSender(), { value: GAS }, proposalMsg());
            expect(res.transactions).toHaveTransaction({
                from: snapshotVerifier.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_PROPOSAL_REGISTRY,
            });
            expect(await registry.getGetProposalCount()).toBe(0n);
        });

        it('перекрёстная авторизация: ProposalRegistry НЕ может писать снапшоты (exit 54064)', async () => {
            const res = await registry.send(proposalRegistry.getSender(), { value: GAS }, snapshotMsg());
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_SNAPSHOT_VERIFIER,
            });
            expect(await registry.getGetLatestSnapshotBlock()).toBe(0n);
        });

        it('перекрёстная авторизация: report_writer НЕ может писать предложения (exit 29508)', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, proposalMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_PROPOSAL_REGISTRY,
            });
            expect(await registry.getGetProposalCount()).toBe(0n);
        });
    });

    // -----------------------------------------------------------------------
    // (e) Authorized writers can still write — and the data lands correctly.
    // -----------------------------------------------------------------------
    describe('Авторизованные писатели успешно записывают данные', () => {
        beforeEach(async () => {
            await configureAllWriters();
        });

        it('ProposalRegistry записывает предложение; данные сохранены и приватность соблюдена', async () => {
            const res = await registry.send(proposalRegistry.getSender(), { value: GAS }, proposalMsg(1n));
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address, success: true,
            });
            expect(await registry.getGetProposalCount()).toBe(1n);

            const summary = await registry.getGetProposalSummary(1n);
            expect(summary).not.toBeNull();
            expect(summary!.proposal_id).toBe(1n);
            expect(summary!.category).toBe(CATEGORY_ROADMAP_SIGNAL);
            // Outcome starts PENDING until a voting result is recorded.
            expect(await registry.getGetProposalOutcome(1n)).toBe(0n);
            // Category counter updated.
            expect(await registry.getGetProposalsByCategory(CATEGORY_ROADMAP_SIGNAL)).toBe(1n);
        });

        it('ProposalRegistry записывает результат голосования; агрегаты обновлены', async () => {
            await registry.send(proposalRegistry.getSender(), { value: GAS }, proposalMsg(1n));
            const res = await registry.send(proposalRegistry.getSender(), { value: GAS }, votingResultMsg(1n, OUTCOME_ACCEPTED, 150n));
            expect(res.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address, success: true,
            });
            expect(await registry.getGetProposalOutcome(1n)).toBe(OUTCOME_ACCEPTED);
            expect(await registry.getGetTotalVotesCast(1n)).toBe(150n);

            const voting = await registry.getGetVotingSummary(1n);
            expect(voting).not.toBeNull();
            expect(voting!.total_votes_cast).toBe(150n);
            expect(voting!.quorum_met).toBe(true); // 150 >= 112
            expect(voting!.passed).toBe(true);

            const stats = await registry.getGetGovernanceStats();
            expect(stats.total_proposals).toBe(1n);
            expect(stats.proposals_accepted).toBe(1n);
        });

        it('SnapshotVerifier записывает снапшот; block/hash обновлены', async () => {
            const res = await registry.send(snapshotVerifier.getSender(), { value: GAS }, snapshotMsg(5000n, 0xdeadbeefn));
            expect(res.transactions).toHaveTransaction({
                from: snapshotVerifier.address, to: registry.address, success: true,
            });
            expect(await registry.getGetLatestSnapshotBlock()).toBe(5000n);
            expect(await registry.getGetSnapshotHash()).toBe(0xdeadbeefn);

            const snap = await registry.getGetGovernanceAssetSnapshot();
            expect(snap.snapshot_block_height).toBe(5000n);
            expect(snap.snapshot_hash).toBe(0xdeadbeefn);
            // Total supply remains the fixed governance constant (222).
            expect(snap.total_supply).toBe(222n);
        });

        it('report_writer записывает протокольные метрики; checkpoint и счётчик обновлены', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, protocolMetricsMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address, success: true,
            });
            expect(await registry.getGetMetricPeriodsCount()).toBe(1n);

            const metrics = await registry.getGetLatestProtocolMetrics();
            expect(metrics.period_start).toBe(1000n);
            expect(metrics.period_end).toBe(2000n);
            expect(metrics.active_accounts).toBe(42n);
            expect(metrics.transfer_count).toBe(99n);
        });

        it('report_writer записывает активность блокировок; checkpoint и счётчик обновлены', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, lockActivityMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address, success: true,
            });
            expect(await registry.getGetLockPeriodsCount()).toBe(1n);

            const lock = await registry.getGetLatestLockActivity();
            expect(lock.locks_set).toBe(10n);
            expect(lock.locks_active).toBe(6n);
            expect(lock.appeals_filed).toBe(3n);
        });

        it('report_writer записывает изменение параметра; аудит-сводка обновлена', async () => {
            const res = await registry.send(reportWriter.getSender(), { value: GAS }, parameterChangeMsg());
            expect(res.transactions).toHaveTransaction({
                from: reportWriter.address, to: registry.address, success: true,
            });
            const summary = await registry.getGetParameterChangeSummary();
            expect(summary.total_parameter_changes).toBe(1n);
            expect(summary.latest_effective_block).toBe(5000n);
        });

        it('ротация писателя: старый адрес теряет доступ, новый получает', async () => {
            // proposalRegistry writes successfully first.
            await registry.send(proposalRegistry.getSender(), { value: GAS }, proposalMsg(1n));
            expect(await registry.getGetProposalCount()).toBe(1n);

            // Rotate the proposal writer to a new sibling address.
            const newWriter = await blockchain.treasury('proposalRegistryRotated');
            await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
                $$type: 'SetProposalRegistry', registry: newWriter.address,
            });

            // Old writer is now rejected.
            const oldRes = await registry.send(proposalRegistry.getSender(), { value: GAS }, proposalMsg(2n));
            expect(oldRes.transactions).toHaveTransaction({
                from: proposalRegistry.address, to: registry.address,
                success: false, exitCode: ERR_ONLY_PROPOSAL_REGISTRY,
            });
            expect(await registry.getGetProposalCount()).toBe(1n);

            // New writer succeeds.
            const newRes = await registry.send(newWriter.getSender(), { value: GAS }, proposalMsg(2n));
            expect(newRes.transactions).toHaveTransaction({
                from: newWriter.address, to: registry.address, success: true,
            });
            expect(await registry.getGetProposalCount()).toBe(2n);
        });
    });
});
