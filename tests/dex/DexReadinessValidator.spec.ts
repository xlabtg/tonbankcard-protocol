/**
 * Unit tests for scripts/dex/check-dex-readiness.ts
 * (Issue #141, F6 — Additional DEX Integrations).
 *
 * The validator is the off-chain CI gate that enforces structural drift
 * checks between the nine F6 DEX integration artifacts and the
 * upstream Issue #141 acceptance criteria:
 *   - docs/dex/SPECIFICATION.md              (AC-2 shared interface)
 *   - docs/dex/PRICE_AGGREGATOR.md           (AC-3 aggregator)
 *   - docs/dex/SLIPPAGE_PROTECTION.md        (AC-5 slippage UX)
 *   - docs/dex/LIQUIDITY_MONITORING.md       (AC-6 monitoring)
 *   - docs/dex/NOTIFICATIONS.md              (AC-5 / AC-6 addendum)
 *   - docs/dex/WALLET_UX.md                  (AC-2 / AC-5 toasts)
 *   - docs/dex/ADAPTER_HARDENING.md          (DEX-AH-1..DEX-AH-7 backlog)
 *   - docs/dex/TESTNET_INTEGRATION.md        (AC-4 / AC-7 evidence)
 *   - docs/dex/BUG_BOUNTY.md                 (A5-gated, A4-prerequisite)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported
 * check functions with both well-formed and tampered content. They do
 * NOT require compiled adapters; adapter sources land in a follow-up
 * PR after A4 verdict READY. The pattern mirrors
 * tests/multisig/MultiSigReadinessValidator.spec.ts (F5, PR #208).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    ERROR_DEX_CODES,
    WALLET_UX_USER_FACING_CODES,
    T_DEX_THREATS,
    DEX_AH_ITEMS,
    R_DEX_AH_RULES,
    DEX_M_IDS,
    DEX_N_IDS,
    DS_IDS,
    DR_IDS,
    SEVERITY_TIERS,
    ADAPTER_UNIT_TEST_BAR,
    AGGREGATOR_INTEGRATION_TEST_BAR,
    DEFAULT_SLIPPAGE_BPS,
    MIN_SLIPPAGE_BPS,
    MAX_SLIPPAGE_BPS,
    LIQUIDITY_WARN_THRESHOLD_BPS,
    MAX_EFFECTIVE_PRICE_DEVIATION_BPS,
    TIE_BREAK_BPS,
    PRICE_AGGREGATOR_TIMEOUT_MS,
    FALLBACK_REQUOTE_WINDOW_SECONDS,
    VENUE_DEMOTION_COOLDOWN_SECONDS,
    HEALTH_PROBE_INTERVAL_SECONDS,
    HEALTH_PROBE_FAILURE_THRESHOLD,
    PRICE_STALENESS_SECONDS,
    MIN_POOL_DEPTH_TON,
    IDEMPOTENCY_WINDOW_SECONDS,
    SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT,
    MAX_WEBHOOK_RETRIES,
    classifyAcceptanceCriterion,
    checkSpecificationDoc,
    checkPriceAggregatorDoc,
    checkSlippageProtectionDoc,
    checkLiquidityMonitoringDoc,
    checkNotificationsDoc,
    checkWalletUxDoc,
    checkAdapterHardeningDoc,
    checkTestnetIntegrationDoc,
    checkBugBountyDoc,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/dex/check-dex-readiness';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #141 §8)', () => {
        expect(ACCEPTANCE_CRITERIA.map((c) => c.id)).toEqual([
            'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7',
        ]);
    });

    it('every entry references a concrete artifact path', () => {
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(typeof c.artifact).toBe('string');
            expect(c.artifact.length).toBeGreaterThan(0);
        }
    });

    it('uses only the eleven documented evidenceCheck kinds', () => {
        const allowed = new Set([
            'prerequisite',
            'specification',
            'price-aggregator',
            'slippage-protection',
            'liquidity-monitoring',
            'notifications',
            'wallet-ux',
            'adapter-hardening',
            'testnet-integration',
            'bug-bounty',
            'tests',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('routes AC-1 to the A4 audit prerequisite gate', () => {
        const ac1 = classifyAcceptanceCriterion('AC-1');
        expect(ac1?.evidenceCheck).toBe('prerequisite');
        expect(ac1?.artifact).toMatch(/A4-offchain-services/);
    });

    it('routes AC-2 to the specification evidence path', () => {
        const ac2 = classifyAcceptanceCriterion('AC-2');
        expect(ac2?.evidenceCheck).toBe('specification');
        expect(ac2?.artifact).toMatch(/SPECIFICATION\.md/);
    });

    it('routes AC-3 to the price-aggregator evidence path', () => {
        const ac3 = classifyAcceptanceCriterion('AC-3');
        expect(ac3?.evidenceCheck).toBe('price-aggregator');
        expect(ac3?.artifact).toMatch(/PRICE_AGGREGATOR\.md/);
    });

    it('routes AC-4 to the testnet-integration evidence path', () => {
        expect(classifyAcceptanceCriterion('AC-4')?.evidenceCheck).toBe('testnet-integration');
    });

    it('routes AC-5 to the slippage-protection evidence path', () => {
        const ac5 = classifyAcceptanceCriterion('AC-5');
        expect(ac5?.evidenceCheck).toBe('slippage-protection');
        expect(ac5?.artifact).toMatch(/SLIPPAGE_PROTECTION\.md/);
    });

    it('routes AC-6 to the liquidity-monitoring evidence path', () => {
        const ac6 = classifyAcceptanceCriterion('AC-6');
        expect(ac6?.evidenceCheck).toBe('liquidity-monitoring');
        expect(ac6?.artifact).toMatch(/LIQUIDITY_MONITORING\.md/);
    });

    it('routes AC-7 to the tests evidence path', () => {
        const ac7 = classifyAcceptanceCriterion('AC-7');
        expect(ac7?.evidenceCheck).toBe('tests');
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== Centralised expected constants ====================

describe('Centralised expected constants', () => {
    it('ERROR_DEX_CODES enumerates exactly codes 0..9', () => {
        expect(ERROR_DEX_CODES.map((c) => c.value)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
        const byName = Object.fromEntries(
            ERROR_DEX_CODES.map((c) => [c.name, c.value]),
        );
        expect(byName.ERROR_DEX_NONE).toBe(0);
        expect(byName.ERROR_DEX_TIMEOUT).toBe(1);
        expect(byName.ERROR_DEX_VENUE_DOWN).toBe(2);
        expect(byName.ERROR_DEX_INVALID_TOKEN).toBe(3);
        expect(byName.ERROR_DEX_INVALID_AMOUNT).toBe(4);
        expect(byName.ERROR_DEX_INSUFFICIENT_LIQUIDITY).toBe(5);
        expect(byName.ERROR_DEX_STALE_PRICE).toBe(6);
        expect(byName.ERROR_DEX_SLIPPAGE_EXCEEDED).toBe(7);
        expect(byName.ERROR_DEX_FLOOR_REJECT).toBe(8);
        expect(byName.ERROR_DEX_QUOTE_EXPIRED).toBe(9);
    });

    it('WALLET_UX_USER_FACING_CODES surfaces the nine swap-failure codes', () => {
        expect([...WALLET_UX_USER_FACING_CODES]).toEqual([
            'ERROR_DEX_TIMEOUT',
            'ERROR_DEX_VENUE_DOWN',
            'ERROR_DEX_INVALID_TOKEN',
            'ERROR_DEX_INVALID_AMOUNT',
            'ERROR_DEX_INSUFFICIENT_LIQUIDITY',
            'ERROR_DEX_STALE_PRICE',
            'ERROR_DEX_SLIPPAGE_EXCEEDED',
            'ERROR_DEX_FLOOR_REJECT',
            'ERROR_DEX_QUOTE_EXPIRED',
        ]);
    });

    it('T_DEX_THREATS enumerates seven DEX threats (T-DEX-1..T-DEX-7)', () => {
        expect(T_DEX_THREATS).toHaveLength(7);
        expect(T_DEX_THREATS[0]).toBe('T-DEX-1');
        expect(T_DEX_THREATS[6]).toBe('T-DEX-7');
    });

    it('DEX_AH_ITEMS enumerates seven hardening items (DEX-AH-1..DEX-AH-7)', () => {
        expect(DEX_AH_ITEMS).toHaveLength(7);
        expect(DEX_AH_ITEMS[0]).toBe('DEX-AH-1');
        expect(DEX_AH_ITEMS[6]).toBe('DEX-AH-7');
    });

    it('R_DEX_AH_RULES enumerates five CI guardrail rules (R-DEX-AH-1..R-DEX-AH-5)', () => {
        expect(R_DEX_AH_RULES).toHaveLength(5);
        expect(R_DEX_AH_RULES[0]).toBe('R-DEX-AH-1');
        expect(R_DEX_AH_RULES[4]).toBe('R-DEX-AH-5');
    });

    it('DEX_M_IDS enumerates eighteen alerts in zero-padded form', () => {
        expect(DEX_M_IDS).toHaveLength(18);
        expect(DEX_M_IDS[0]).toBe('DEX-M01');
        expect(DEX_M_IDS[17]).toBe('DEX-M18');
    });

    it('DEX_N_IDS enumerates eight notifications in zero-padded form', () => {
        expect(DEX_N_IDS).toHaveLength(8);
        expect(DEX_N_IDS[0]).toBe('DEX-N01');
        expect(DEX_N_IDS[7]).toBe('DEX-N08');
    });

    it('DS_IDS enumerates four data sources (DS-1..DS-4)', () => {
        expect(DS_IDS).toEqual(['DS-1', 'DS-2', 'DS-3', 'DS-4']);
    });

    it('DR_IDS enumerates five disaster-recovery drills (DR-1..DR-5)', () => {
        expect(DR_IDS).toEqual(['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5']);
    });

    it('SEVERITY_TIERS enumerates exactly P0..P3', () => {
        expect(SEVERITY_TIERS).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('Test bar constants pin Issue #141 §8 AC-7: 24 adapter + 12 aggregator', () => {
        expect(ADAPTER_UNIT_TEST_BAR).toBe(24);
        expect(AGGREGATOR_INTEGRATION_TEST_BAR).toBe(12);
    });

    it('Slippage BPS triplet matches SPECIFICATION.md §5 (10/50/500)', () => {
        expect(MIN_SLIPPAGE_BPS).toBe(10);
        expect(DEFAULT_SLIPPAGE_BPS).toBe(50);
        expect(MAX_SLIPPAGE_BPS).toBe(500);
    });

    it('LIQUIDITY_WARN_THRESHOLD_BPS pins SLIPPAGE_PROTECTION.md §3 at 100', () => {
        expect(LIQUIDITY_WARN_THRESHOLD_BPS).toBe(100);
    });

    it('MAX_EFFECTIVE_PRICE_DEVIATION_BPS pins the §4.3 floor guard at 500', () => {
        expect(MAX_EFFECTIVE_PRICE_DEVIATION_BPS).toBe(500);
    });

    it('TIE_BREAK_BPS pins the §4.2 tie-break window at 5 bps', () => {
        expect(TIE_BREAK_BPS).toBe(5);
    });

    it('PRICE_AGGREGATOR_TIMEOUT_MS pins the §6 P95 budget anchor at 500 ms', () => {
        expect(PRICE_AGGREGATOR_TIMEOUT_MS).toBe(500);
    });

    it('FALLBACK_REQUOTE_WINDOW_SECONDS pins the §5.2 re-quote window at 5 s', () => {
        expect(FALLBACK_REQUOTE_WINDOW_SECONDS).toBe(5);
    });

    it('VENUE_DEMOTION_COOLDOWN_SECONDS anchors the §3.4 cool-down at 120 s', () => {
        expect(VENUE_DEMOTION_COOLDOWN_SECONDS).toBe(120);
    });

    it('HEALTH_PROBE_INTERVAL_SECONDS anchors the §3.4 cadence at 60 s', () => {
        expect(HEALTH_PROBE_INTERVAL_SECONDS).toBe(60);
    });

    it('HEALTH_PROBE_FAILURE_THRESHOLD pins the §3.4 demotion threshold at 3', () => {
        expect(HEALTH_PROBE_FAILURE_THRESHOLD).toBe(3);
    });

    it('PRICE_STALENESS_SECONDS anchors the §3.1 stale-price reject at 30 s', () => {
        expect(PRICE_STALENESS_SECONDS).toBe(30);
    });

    it('MIN_POOL_DEPTH_TON anchors LIQUIDITY_MONITORING.md DEX-M01 at 50 000 TON', () => {
        expect(MIN_POOL_DEPTH_TON).toBe(50_000);
    });

    it('IDEMPOTENCY_WINDOW_SECONDS anchors PRICE_AGGREGATOR.md §5.4 at 600 s', () => {
        expect(IDEMPOTENCY_WINDOW_SECONDS).toBe(600);
    });

    it('SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT anchors §5 auto-revert at 10 %', () => {
        expect(SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT).toBe(10);
    });

    it('MAX_WEBHOOK_RETRIES anchors NOTIFICATIONS.md §5.2 at 5', () => {
        expect(MAX_WEBHOOK_RETRIES).toBe(5);
    });
});

// ==================== checkSpecificationDoc ====================

describe('checkSpecificationDoc', () => {
    const realDoc = readRepoFile('docs/dex/SPECIFICATION.md');

    it('passes every check against the committed SPECIFICATION.md', () => {
        expect(failures(checkSpecificationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSpecificationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SP.exists');
    });

    it('flags drift of the §3.1 30 s PRICE_STALENESS_SECONDS anchor', () => {
        const tampered = realDoc.replace(
            /PRICE_STALENESS_SECONDS\s*=\s*30/g,
            'PRICE_STALENESS_SECONDS = 1',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.PRICE_STALENESS_SECONDS');
    });

    it('flags drift of the §3.2 500 ms PRICE_AGGREGATOR_TIMEOUT_MS anchor', () => {
        const tampered = realDoc.replace(
            /PRICE_AGGREGATOR_TIMEOUT_MS\s*=\s*500/g,
            'PRICE_AGGREGATOR_TIMEOUT_MS = 9999',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.PRICE_AGGREGATOR_TIMEOUT_MS');
    });

    it('flags drift of the §4.3 MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500 anchor', () => {
        const tampered = realDoc.replace(
            /MAX_EFFECTIVE_PRICE_DEVIATION_BPS\s*=\s*500/g,
            'MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 0',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.MAX_EFFECTIVE_PRICE_DEVIATION_BPS');
    });

    it.each([...T_DEX_THREATS])(
        'flags removal of DEX threat %s from §7.1',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-DEX-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.threat.${threat}`,
            );
        },
    );

    it.each([...DEX_AH_ITEMS])(
        'flags removal of hardening item %s from §8',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`\\b${item}\\b`, 'g'),
                'DEX-AH-X',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.hardening.${item}`,
            );
        },
    );

    it.each(ERROR_DEX_CODES.filter((c) => c.value > 0))(
        'flags removal of error code $name from §7.2',
        ({ name }) => {
            const tampered = realDoc.replace(
                new RegExp(`\\b${name}\\b`, 'g'),
                'ERROR_DEX_X',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.err.${name}`,
            );
        },
    );
});

// ==================== checkPriceAggregatorDoc ====================

describe('checkPriceAggregatorDoc', () => {
    const realDoc = readRepoFile('docs/dex/PRICE_AGGREGATOR.md');

    it('passes every check against the committed PRICE_AGGREGATOR.md', () => {
        expect(failures(checkPriceAggregatorDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkPriceAggregatorDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('PA.exists');
    });

    it('flags drift of the §6 P95 budget anchor (500 ms)', () => {
        const tampered = realDoc.replace(
            /PRICE_AGGREGATOR_TIMEOUT_MS\s*=\s*500/g,
            'PRICE_AGGREGATOR_TIMEOUT_MS = 9999',
        );
        expect(failures(checkPriceAggregatorDoc(tampered))).toContain('PA.const.PRICE_AGGREGATOR_TIMEOUT_MS');
    });

    it('flags drift of the §4.3 floor-price ceiling (500 bps)', () => {
        const tampered = realDoc.replace(
            /MAX_EFFECTIVE_PRICE_DEVIATION_BPS\s*=\s*500/g,
            'MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 0',
        );
        expect(failures(checkPriceAggregatorDoc(tampered))).toContain('PA.floor.MAX_EFFECTIVE_PRICE_DEVIATION_BPS');
    });

    it('flags drift of the §5.2 fallback re-quote window (5 s)', () => {
        const tampered = realDoc.replace(
            /FALLBACK_REQUOTE_WINDOW_SECONDS\s*=\s*5/g,
            'FALLBACK_REQUOTE_WINDOW_SECONDS = 0',
        );
        expect(failures(checkPriceAggregatorDoc(tampered))).toContain('PA.fallback.window');
    });

    it('flags drift of the §5.4 idempotency window (600 s)', () => {
        const tampered = realDoc.replace(
            /IDEMPOTENCY_WINDOW_SECONDS\s*=\s*600/g,
            'IDEMPOTENCY_WINDOW_SECONDS = 0',
        );
        expect(failures(checkPriceAggregatorDoc(tampered))).toContain('PA.idempotency.window');
    });
});

// ==================== checkSlippageProtectionDoc ====================

describe('checkSlippageProtectionDoc', () => {
    const realDoc = readRepoFile('docs/dex/SLIPPAGE_PROTECTION.md');

    it('passes every check against the committed SLIPPAGE_PROTECTION.md', () => {
        expect(failures(checkSlippageProtectionDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSlippageProtectionDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SL.exists');
    });

    it('flags drift of the DEFAULT_SLIPPAGE_BPS = 50 anchor', () => {
        // The doc renders constants in table-cell form
        // `| \`DEFAULT_SLIPPAGE_BPS\` | \`50\` |` rather than the `=` form,
        // so the tampered replace targets the backticked value cell.
        const tampered = realDoc.replace(
            /\| `DEFAULT_SLIPPAGE_BPS` \| `50`/g,
            '| `DEFAULT_SLIPPAGE_BPS` | `9999`',
        );
        expect(failures(checkSlippageProtectionDoc(tampered))).toContain('SL.const.DEFAULT_SLIPPAGE_BPS');
    });

    it('flags drift of the MIN_SLIPPAGE_BPS = 10 anchor', () => {
        const tampered = realDoc.replace(
            /\| `MIN_SLIPPAGE_BPS` \| `10`/g,
            '| `MIN_SLIPPAGE_BPS` | `9999`',
        );
        expect(failures(checkSlippageProtectionDoc(tampered))).toContain('SL.const.MIN_SLIPPAGE_BPS');
    });

    it('flags drift of the MAX_SLIPPAGE_BPS = 500 anchor', () => {
        const tampered = realDoc.replace(
            /\| `MAX_SLIPPAGE_BPS` \| `500`/g,
            '| `MAX_SLIPPAGE_BPS` | `0`',
        );
        expect(failures(checkSlippageProtectionDoc(tampered))).toContain('SL.const.MAX_SLIPPAGE_BPS');
    });

    it('flags drift of the LIQUIDITY_WARN_THRESHOLD_BPS = 100 anchor', () => {
        const tampered = realDoc.replace(
            /\| `LIQUIDITY_WARN_THRESHOLD_BPS` \| `100`/g,
            '| `LIQUIDITY_WARN_THRESHOLD_BPS` | `0`',
        );
        expect(failures(checkSlippageProtectionDoc(tampered))).toContain('SL.const.LIQUIDITY_WARN_THRESHOLD_BPS');
    });
});

// ==================== checkLiquidityMonitoringDoc ====================

describe('checkLiquidityMonitoringDoc', () => {
    const realDoc = readRepoFile('docs/dex/LIQUIDITY_MONITORING.md');

    it('passes every check against the committed LIQUIDITY_MONITORING.md', () => {
        expect(failures(checkLiquidityMonitoringDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkLiquidityMonitoringDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('LM.exists');
    });

    it.each([...DEX_M_IDS])(
        'flags removal of alert %s from §3 catalogue',
        (alert) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${alert}\\*\\*`, 'g'),
                '**DEX-MXX**',
            );
            expect(failures(checkLiquidityMonitoringDoc(tampered))).toContain(
                `LM.alert.${alert}`,
            );
        },
    );

    it.each([...DS_IDS])(
        'flags removal of data source %s from §4',
        (ds) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${ds}\\*\\*`, 'g'),
                '**DS-X**',
            );
            expect(failures(checkLiquidityMonitoringDoc(tampered))).toContain(
                `LM.ds.${ds}`,
            );
        },
    );

    it.each([...DR_IDS])(
        'flags removal of drill %s from §5',
        (dr) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${dr}\\*\\*`, 'g'),
                '**DR-X**',
            );
            expect(failures(checkLiquidityMonitoringDoc(tampered))).toContain(
                `LM.dr.${dr}`,
            );
        },
    );

    it.each([...SEVERITY_TIERS])(
        'flags removal of pager tier %s from §3.6 severity matrix',
        (tier) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${tier}\\*\\*`, 'g'),
                '**PX**',
            );
            expect(failures(checkLiquidityMonitoringDoc(tampered))).toContain(
                `LM.sev.tier.${tier}`,
            );
        },
    );
});

// ==================== checkNotificationsDoc ====================

describe('checkNotificationsDoc', () => {
    const realDoc = readRepoFile('docs/dex/NOTIFICATIONS.md');

    it('passes every check against the committed NOTIFICATIONS.md', () => {
        expect(failures(checkNotificationsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkNotificationsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('NF.exists');
    });

    it.each([...DEX_N_IDS])(
        'flags removal of notification %s from §3 catalogue',
        (n) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${n}\\*\\*`, 'g'),
                '**DEX-NXX**',
            );
            expect(failures(checkNotificationsDoc(tampered))).toContain(
                `NF.note.${n}`,
            );
        },
    );

    it('flags drift of the MAX_WEBHOOK_RETRIES = 5 anchor (§5.2)', () => {
        const tampered = realDoc.replace(
            /MAX_WEBHOOK_RETRIES\s*=\s*5/g,
            'MAX_WEBHOOK_RETRIES = 0',
        );
        expect(failures(checkNotificationsDoc(tampered))).toContain('NF.backoff.MAX_WEBHOOK_RETRIES');
    });
});

// ==================== checkWalletUxDoc ====================

describe('checkWalletUxDoc', () => {
    const realDoc = readRepoFile('docs/dex/WALLET_UX.md');

    it('passes every check against the committed WALLET_UX.md', () => {
        expect(failures(checkWalletUxDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkWalletUxDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('WX.exists');
    });

    it.each([...WALLET_UX_USER_FACING_CODES])(
        'flags removal of user-facing error code %s from §3.4',
        (code) => {
            const tampered = realDoc.replace(
                new RegExp(`\\b${code}\\b`, 'g'),
                'ERROR_DEX_X',
            );
            expect(failures(checkWalletUxDoc(tampered))).toContain(`WX.toast.${code}`);
        },
    );
});

// ==================== checkAdapterHardeningDoc ====================

describe('checkAdapterHardeningDoc', () => {
    const realDoc = readRepoFile('docs/dex/ADAPTER_HARDENING.md');

    it('passes every check against the committed ADAPTER_HARDENING.md', () => {
        expect(failures(checkAdapterHardeningDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkAdapterHardeningDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('AH.exists');
    });

    it.each([...DEX_AH_ITEMS])(
        'flags removal of §3 heading for %s',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`###\\s+${item}\\s+—`, 'g'),
                `### DEX-AH-X — `,
            );
            expect(failures(checkAdapterHardeningDoc(tampered))).toContain(
                `AH.item.${item}`,
            );
        },
    );

    it.each([...R_DEX_AH_RULES])(
        'flags removal of CI guardrail %s from §5',
        (rule) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${rule}\\*\\*`, 'g'),
                '**R-DEX-AH-X**',
            );
            expect(failures(checkAdapterHardeningDoc(tampered))).toContain(
                `AH.rule.${rule}`,
            );
        },
    );
});

// ==================== checkTestnetIntegrationDoc ====================

describe('checkTestnetIntegrationDoc', () => {
    const realDoc = readRepoFile('docs/dex/TESTNET_INTEGRATION.md');

    it('passes every check against the committed TESTNET_INTEGRATION.md', () => {
        expect(failures(checkTestnetIntegrationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkTestnetIntegrationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TI.exists');
    });

    it('flags drift of the §6.1 adapter unit-test bar (24)', () => {
        // The validator accepts either `**24**` or `24 tests` — drop both.
        const tampered = realDoc
            .replace(/\*\*24\*\*/g, '**0**')
            .replace(/24\s+tests/g, '0 tests');
        expect(failures(checkTestnetIntegrationDoc(tampered))).toContain('TI.bar.adapter');
    });

    it('flags drift of the §6.2 aggregator integration-test bar (12)', () => {
        const tampered = realDoc
            .replace(/\*\*12\*\*/g, '**0**')
            .replace(/12\s+tests/g, '0 tests');
        expect(failures(checkTestnetIntegrationDoc(tampered))).toContain('TI.bar.aggregator');
    });

    it('flags removal of the §6.3 readiness validator spec pointer', () => {
        const tampered = realDoc.replace(
            /tests\/dex\/DexReadinessValidator\.spec\.ts/g,
            'tests/dex/somethingelse.spec.ts',
        );
        expect(failures(checkTestnetIntegrationDoc(tampered))).toContain('TI.bar.validator');
    });

    it.each(ACCEPTANCE_CRITERIA)(
        'flags removal of $id row from §8 AC mapping',
        (ac) => {
            const tampered = realDoc.replace(
                new RegExp(`\\|\\s*${ac.id}\\s*\\|`, 'g'),
                `| AC-X |`,
            );
            expect(failures(checkTestnetIntegrationDoc(tampered))).toContain(
                `TI.ac.${ac.id}`,
            );
        },
    );
});

// ==================== checkBugBountyDoc ====================

describe('checkBugBountyDoc', () => {
    const realDoc = readRepoFile('docs/dex/BUG_BOUNTY.md');

    it('passes every check against the committed BUG_BOUNTY.md', () => {
        expect(failures(checkBugBountyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkBugBountyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('BB.exists');
    });

    it('flags removal of the priceAggregator.ts in-scope asset row', () => {
        const tampered = realDoc.replace(
            /backend\/adapters\/priceAggregator\.ts/g,
            'backend/adapters/somethingelse.ts',
        );
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.asset.priceAggregator.ts');
    });

    it('flags removal of the dedustAdapter.ts in-scope asset row', () => {
        const tampered = realDoc.replace(
            /backend\/adapters\/dedustAdapter\.ts/g,
            'backend/adapters/somethingelse.ts',
        );
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.asset.dedustAdapter.ts');
    });

    it.each([...T_DEX_THREATS])(
        'flags removal of threat %s from §6 cross-reference table',
        (t) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${t}\\*\\*`, 'g'),
                '**T-DEX-X**',
            );
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.threat.${t}`);
        },
    );

    it('flags removal of the §7 A4-READY activation precondition', () => {
        const tampered = realDoc.replace(/A4 verdict\s+`?READY`?/g, 'A4 verdict PENDING');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.activation.A4');
    });

    it('flags removal of the §8 RC-BOUNTY-CRITICAL auto-pause lever', () => {
        const tampered = realDoc.replace(/RC-BOUNTY-CRITICAL/g, 'RC-OTHER');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.sla.RC-BOUNTY-CRITICAL');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    const docs = {
        specification:       readRepoFile('docs/dex/SPECIFICATION.md'),
        priceAggregator:     readRepoFile('docs/dex/PRICE_AGGREGATOR.md'),
        slippageProtection:  readRepoFile('docs/dex/SLIPPAGE_PROTECTION.md'),
        liquidityMonitoring: readRepoFile('docs/dex/LIQUIDITY_MONITORING.md'),
        notifications:       readRepoFile('docs/dex/NOTIFICATIONS.md'),
        walletUx:            readRepoFile('docs/dex/WALLET_UX.md'),
        adapterHardening:    readRepoFile('docs/dex/ADAPTER_HARDENING.md'),
        testnetIntegration:  readRepoFile('docs/dex/TESTNET_INTEGRATION.md'),
        bugBounty:           readRepoFile('docs/dex/BUG_BOUNTY.md'),
    };

    it('returns zero failures against the committed F6 artefacts', () => {
        // Cross-doc parity covers SPECIFICATION/PRICE_AGGREGATOR/etc plus
        // the docs/INDEX.md, docs/audit-scope.md, docs/error-codes.md
        // wirings that land in the same PR.
        const fails = failures(checkCrossDocReferences(docs));
        expect(fails).toEqual([]);
    });

    it.each([...DEX_AH_ITEMS])(
        'flags missing §3 heading for %s in ADAPTER_HARDENING.md',
        (item) => {
            const tampered = {
                ...docs,
                adapterHardening: docs.adapterHardening.replace(
                    new RegExp(`###\\s+${item}\\s+—`, 'g'),
                    '### DEX-AH-X —',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.ah.heading.${item}`,
            );
        },
    );

    it.each([...T_DEX_THREATS])(
        'flags threat %s missing from SPECIFICATION.md (cross-ref breaks parity)',
        (t) => {
            const tampered = {
                ...docs,
                specification: docs.specification.replace(
                    new RegExp(`\\*\\*${t}\\*\\*`, 'g'),
                    '**T-DEX-X**',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.threat.${t}`,
            );
        },
    );

    it.each([...DEX_M_IDS])(
        'flags missing %s from §3.6 severity matrix while still listed in §3 catalogue',
        (alert) => {
            const tampered = {
                ...docs,
                liquidityMonitoring: docs.liquidityMonitoring.replace(
                    new RegExp(`\`${alert}\``, 'g'),
                    '`DEX-MXX`',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.alert.${alert}.catalogue-and-matrix`,
            );
        },
    );

    it.each([...DEX_N_IDS])(
        'flags notification %s missing from NOTIFICATIONS.md §3 (cross-ref breaks parity)',
        (n) => {
            const tampered = {
                ...docs,
                notifications: docs.notifications.replace(
                    new RegExp(`\\*\\*${n}\\*\\*`, 'g'),
                    '**DEX-NXX**',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.note.${n}`,
            );
        },
    );

    it.each(ERROR_DEX_CODES.filter((c) => c.value > 0))(
        'flags error code $name missing from WALLET_UX.md while still in SPECIFICATION.md',
        ({ name }) => {
            const tampered = {
                ...docs,
                walletUx: docs.walletUx.replace(
                    new RegExp(`\\b${name}\\b`, 'g'),
                    'ERROR_DEX_X',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.err.${name}`,
            );
        },
    );

    it('flags removal of the SPECIFICATION.md link-back from BUG_BOUNTY.md', () => {
        const tampered = {
            ...docs,
            bugBounty: docs.bugBounty.replace(/SPECIFICATION\.md/g, 'X.md'),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.link.BB.spec');
    });

    it('flags removal of the SLIPPAGE_PROTECTION.md slider link from WALLET_UX.md', () => {
        const tampered = {
            ...docs,
            walletUx: docs.walletUx.replace(/SLIPPAGE_PROTECTION\.md/g, 'X.md'),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.wx-sl.slider');
    });

    it('flags removal of DEX-M07 pairing between SLIPPAGE_PROTECTION.md and LIQUIDITY_MONITORING.md', () => {
        const tampered = {
            ...docs,
            slippageProtection: docs.slippageProtection.replace(/DEX-M07/g, 'DEX-MXX'),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.sl-lm.M07');
    });

    it('flags removal of the DEX-N08 pairing between ADAPTER_HARDENING.md and NOTIFICATIONS.md', () => {
        const tampered = {
            ...docs,
            adapterHardening: docs.adapterHardening.replace(/DEX-N08/g, 'DEX-NXX'),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.ah-nf.DEX-N08');
    });

    it('flags removal of the A5 PROGRAM_BRIEF.md cross-reference from BUG_BOUNTY.md', () => {
        const tampered = {
            ...docs,
            bugBounty: docs.bugBounty.replace(
                /A5-bug-bounty\/PROGRAM_BRIEF\.md/g,
                'A5-bug-bounty/SOMETHING.md',
            ),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.bb.a5-brief');
    });
});

// ==================== runAllChecks ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed F6 DEX artifacts', () => {
        const report = runAllChecks();
        if (report.failed !== 0) {
            // Surface the first few failures for diagnostic purposes.
            const detail = report.failures
                .slice(0, 10)
                .map((f) => `${f.id}: ${f.detail}`)
                .join('\n');
            throw new Error(
                `Expected zero failures but got ${report.failed}:\n${detail}`,
            );
        }
        expect(report.failed).toBe(0);
    });

    it('counts more than 200 individual checks (sanity)', () => {
        const report = runAllChecks();
        expect(report.results.length).toBeGreaterThan(200);
    });

    it('every result has a non-empty id, name, and detail', () => {
        const report = runAllChecks();
        for (const r of report.results) {
            expect(r.id.length).toBeGreaterThan(0);
            expect(r.name.length).toBeGreaterThan(0);
            expect(r.detail.length).toBeGreaterThan(0);
        }
    });
});
