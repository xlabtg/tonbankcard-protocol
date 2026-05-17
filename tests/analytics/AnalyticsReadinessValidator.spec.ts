/**
 * Unit tests for scripts/analytics/check-analytics-readiness.ts
 * (Issue #142, F7 — Analytics & Reporting).
 *
 * The validator is the off-chain CI gate that enforces structural drift
 * checks between the nine F7 analytics production-readiness artefacts
 * and the upstream Issue #142 acceptance criteria:
 *   - docs/analytics/SPECIFICATION.md         (AC-1 shared interface)
 *   - docs/analytics/MERCHANT_ANALYTICS.md    (AC-2 / AC-4 endpoint + dashboard)
 *   - docs/analytics/PROTOCOL_ANALYTICS.md    (AC-3 / AC-6 endpoint + indexer)
 *   - docs/analytics/PUBLIC_DASHBOARD.md      (AC-5 public stats site)
 *   - docs/analytics/PRIVACY.md               (PII / K-anonymity posture)
 *   - docs/analytics/MONITORING.md            (AN-M01..M12 alert catalogue)
 *   - docs/analytics/ENDPOINT_HARDENING.md    (AN-AH-1..AN-AH-7 backlog)
 *   - docs/analytics/TESTNET_INTEGRATION.md   (AC-7 staging drill evidence)
 *   - docs/analytics/BUG_BOUNTY.md            (B3-gated, A5-prerequisite)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported
 * check functions with both well-formed and tampered content. They do
 * NOT require compiled aggregators; aggregator sources land in a
 * follow-up PR after B3 verdict READY. The pattern mirrors
 * tests/dex/DexReadinessValidator.spec.ts (F6, PR #209).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    ERROR_AN_CODES,
    T_AN_THREATS,
    AN_AH_ITEMS,
    AH_THREAT_CLOSURES,
    R_AN_AH_RULES,
    AN_M_IDS,
    DS_IDS,
    DR_IDS,
    SEVERITY_TIERS,
    IDOR_DRILL_CASE_COUNT,
    K_ANONYMITY_FLOOR,
    QUERY_TIMEOUT_MS,
    ANALYTICS_REFRESH_INTERVAL_SECONDS,
    INDEXER_DISCONNECT_GRACE_SECONDS,
    REPLICA_LAG_BUDGET_SECONDS,
    CACHE_TTL_SECONDS,
    CACHE_STALE_WHILE_REVALIDATE_SECONDS,
    HEALTH_PROBE_INTERVAL_SECONDS,
    HEALTH_PROBE_FAILURE_THRESHOLD,
    RATE_LIMIT_REQUESTS_PER_MINUTE,
    DASHBOARD_LOAD_BUDGET_MS,
    ANALYTICS_QUERY_P95_BUDGET_MS,
    ANALYTICS_RETENTION_YEARS,
    IDEMPOTENCY_WINDOW_SECONDS,
    classifyAcceptanceCriterion,
    checkSpecificationDoc,
    checkMerchantAnalyticsDoc,
    checkProtocolAnalyticsDoc,
    checkPublicDashboardDoc,
    checkPrivacyDoc,
    checkMonitoringDoc,
    checkEndpointHardeningDoc,
    checkTestnetIntegrationDoc,
    checkBugBountyDoc,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/analytics/check-analytics-readiness';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #142 §8)', () => {
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

    it('uses only the ten documented evidenceCheck kinds', () => {
        const allowed = new Set([
            'specification',
            'merchant-analytics',
            'protocol-analytics',
            'public-dashboard',
            'privacy',
            'monitoring',
            'endpoint-hardening',
            'testnet-integration',
            'bug-bounty',
            'tests',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('routes AC-1 to the SPECIFICATION evidence path', () => {
        const ac1 = classifyAcceptanceCriterion('AC-1');
        expect(ac1?.evidenceCheck).toBe('specification');
        expect(ac1?.artifact).toMatch(/SPECIFICATION\.md/);
    });

    it('routes AC-2 to the merchant-analytics evidence path', () => {
        const ac2 = classifyAcceptanceCriterion('AC-2');
        expect(ac2?.evidenceCheck).toBe('merchant-analytics');
        expect(ac2?.artifact).toMatch(/MERCHANT_ANALYTICS\.md/);
    });

    it('routes AC-3 to the protocol-analytics evidence path', () => {
        const ac3 = classifyAcceptanceCriterion('AC-3');
        expect(ac3?.evidenceCheck).toBe('protocol-analytics');
        expect(ac3?.artifact).toMatch(/PROTOCOL_ANALYTICS\.md/);
    });

    it('routes AC-4 to the merchant-analytics evidence path (dashboard widgets)', () => {
        expect(classifyAcceptanceCriterion('AC-4')?.evidenceCheck).toBe('merchant-analytics');
    });

    it('routes AC-5 to the public-dashboard evidence path', () => {
        const ac5 = classifyAcceptanceCriterion('AC-5');
        expect(ac5?.evidenceCheck).toBe('public-dashboard');
        expect(ac5?.artifact).toMatch(/PUBLIC_DASHBOARD\.md/);
    });

    it('routes AC-6 to the protocol-analytics evidence path (indexer provenance)', () => {
        const ac6 = classifyAcceptanceCriterion('AC-6');
        expect(ac6?.evidenceCheck).toBe('protocol-analytics');
        expect(ac6?.artifact).toMatch(/PROTOCOL_ANALYTICS\.md/);
    });

    it('routes AC-7 to the testnet-integration evidence path (IDOR drill)', () => {
        const ac7 = classifyAcceptanceCriterion('AC-7');
        expect(ac7?.evidenceCheck).toBe('testnet-integration');
        expect(ac7?.artifact).toMatch(/TESTNET_INTEGRATION\.md/);
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== Centralised expected constants ====================

describe('Centralised expected constants', () => {
    it('ERROR_AN_CODES enumerates exactly codes 0..9', () => {
        expect(ERROR_AN_CODES.map((c) => c.value)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
        const byName = Object.fromEntries(
            ERROR_AN_CODES.map((c) => [c.name, c.value]),
        );
        expect(byName.ERROR_AN_NONE).toBe(0);
        expect(byName.ERROR_AN_TIMEOUT).toBe(1);
        expect(byName.ERROR_AN_UNAUTHORIZED).toBe(2);
        expect(byName.ERROR_AN_FORBIDDEN_SCOPE).toBe(3);
        expect(byName.ERROR_AN_INVALID_RANGE).toBe(4);
        expect(byName.ERROR_AN_INDEXER_LAG).toBe(5);
        expect(byName.ERROR_AN_RATE_LIMITED).toBe(6);
        expect(byName.ERROR_AN_CACHE_MISS_STORM).toBe(7);
        expect(byName.ERROR_AN_PRIVACY_THRESHOLD).toBe(8);
        expect(byName.ERROR_AN_BACKEND_DOWN).toBe(9);
    });

    it('T_AN_THREATS enumerates seven analytics threats (T-AN-1..T-AN-7)', () => {
        expect(T_AN_THREATS).toHaveLength(7);
        expect(T_AN_THREATS[0]).toBe('T-AN-1');
        expect(T_AN_THREATS[6]).toBe('T-AN-7');
    });

    it('AN_AH_ITEMS enumerates seven hardening items (AN-AH-1..AN-AH-7)', () => {
        expect(AN_AH_ITEMS).toHaveLength(7);
        expect(AN_AH_ITEMS[0]).toBe('AN-AH-1');
        expect(AN_AH_ITEMS[6]).toBe('AN-AH-7');
    });

    it('AH_THREAT_CLOSURES locks the AH → T pairing from ENDPOINT_HARDENING.md §3', () => {
        // Closures: AH-1→T-1, AH-2→T-2, AH-3→T-3, AH-4→T-5,
        //           AH-5→T-6, AH-6→T-7, AH-7→T-4.
        const byAh = Object.fromEntries(
            AH_THREAT_CLOSURES.map((c) => [c.ah, c.threat]),
        );
        expect(byAh['AN-AH-1']).toBe('T-AN-1');
        expect(byAh['AN-AH-2']).toBe('T-AN-2');
        expect(byAh['AN-AH-3']).toBe('T-AN-3');
        expect(byAh['AN-AH-4']).toBe('T-AN-5');
        expect(byAh['AN-AH-5']).toBe('T-AN-6');
        expect(byAh['AN-AH-6']).toBe('T-AN-7');
        expect(byAh['AN-AH-7']).toBe('T-AN-4');
        // Every AH item appears exactly once.
        expect(AH_THREAT_CLOSURES).toHaveLength(7);
        const ahSet = new Set(AH_THREAT_CLOSURES.map((c) => c.ah));
        expect(ahSet.size).toBe(7);
    });

    it('R_AN_AH_RULES enumerates five CI guardrail rules (R-AN-AH-1..R-AN-AH-5)', () => {
        expect(R_AN_AH_RULES).toHaveLength(5);
        expect(R_AN_AH_RULES[0]).toBe('R-AN-AH-1');
        expect(R_AN_AH_RULES[4]).toBe('R-AN-AH-5');
    });

    it('AN_M_IDS enumerates twelve alerts in zero-padded form (AN-M01..AN-M12)', () => {
        expect(AN_M_IDS).toHaveLength(12);
        expect(AN_M_IDS[0]).toBe('AN-M01');
        expect(AN_M_IDS[11]).toBe('AN-M12');
    });

    it('DS_IDS enumerates six data sources (DS-1..DS-6)', () => {
        expect(DS_IDS).toEqual(['DS-1', 'DS-2', 'DS-3', 'DS-4', 'DS-5', 'DS-6']);
    });

    it('DR_IDS enumerates six disaster-recovery drills (DR-1..DR-6)', () => {
        expect(DR_IDS).toEqual(['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5', 'DR-6']);
    });

    it('SEVERITY_TIERS enumerates exactly P0..P3', () => {
        expect(SEVERITY_TIERS).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('IDOR_DRILL_CASE_COUNT pins TESTNET_INTEGRATION.md §5.3 at six cases', () => {
        expect(IDOR_DRILL_CASE_COUNT).toBe(6);
    });

    it('K_ANONYMITY_FLOOR pins the privacy floor at 5 (R-AN-AH-2)', () => {
        expect(K_ANONYMITY_FLOOR).toBe(5);
    });

    it('QUERY_TIMEOUT_MS pins the read-replica budget at 5000 ms', () => {
        expect(QUERY_TIMEOUT_MS).toBe(5000);
    });

    it('ANALYTICS_REFRESH_INTERVAL_SECONDS pins the refresh cadence at 600 s', () => {
        expect(ANALYTICS_REFRESH_INTERVAL_SECONDS).toBe(600);
    });

    it('INDEXER_DISCONNECT_GRACE_SECONDS pins the degraded-banner threshold at 180 s', () => {
        expect(INDEXER_DISCONNECT_GRACE_SECONDS).toBe(180);
    });

    it('REPLICA_LAG_BUDGET_SECONDS pins the replica-lag budget at 60 s', () => {
        expect(REPLICA_LAG_BUDGET_SECONDS).toBe(60);
    });

    it('CACHE_TTL_SECONDS pins the public CDN max-age at 600 s', () => {
        expect(CACHE_TTL_SECONDS).toBe(600);
    });

    it('CACHE_STALE_WHILE_REVALIDATE_SECONDS pins the SWR window at 120 s', () => {
        expect(CACHE_STALE_WHILE_REVALIDATE_SECONDS).toBe(120);
    });

    it('HEALTH_PROBE_INTERVAL_SECONDS pins the §3.4 cadence at 60 s', () => {
        expect(HEALTH_PROBE_INTERVAL_SECONDS).toBe(60);
    });

    it('HEALTH_PROBE_FAILURE_THRESHOLD pins the auto-pause threshold at 3', () => {
        expect(HEALTH_PROBE_FAILURE_THRESHOLD).toBe(3);
    });

    it('RATE_LIMIT_REQUESTS_PER_MINUTE pins the per-IP rate limit at 60', () => {
        expect(RATE_LIMIT_REQUESTS_PER_MINUTE).toBe(60);
    });

    it('DASHBOARD_LOAD_BUDGET_MS pins the public-dashboard P95 at 2000 ms', () => {
        expect(DASHBOARD_LOAD_BUDGET_MS).toBe(2000);
    });

    it('ANALYTICS_QUERY_P95_BUDGET_MS pins the merchant-API P95 at 2000 ms', () => {
        expect(ANALYTICS_QUERY_P95_BUDGET_MS).toBe(2000);
    });

    it('ANALYTICS_RETENTION_YEARS pins the aggregate retention at 3 years', () => {
        expect(ANALYTICS_RETENTION_YEARS).toBe(3);
    });

    it('IDEMPOTENCY_WINDOW_SECONDS pins refresh-probe idempotency at 600 s', () => {
        expect(IDEMPOTENCY_WINDOW_SECONDS).toBe(600);
    });
});

// ==================== checkSpecificationDoc ====================

describe('checkSpecificationDoc', () => {
    const realDoc = readRepoFile('docs/analytics/SPECIFICATION.md');

    it('passes every check against the committed SPECIFICATION.md', () => {
        expect(failures(checkSpecificationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSpecificationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SP.exists');
    });

    it('flags drift of the §3.1 180 s INDEXER_DISCONNECT_GRACE_SECONDS anchor', () => {
        const tampered = realDoc.replace(
            /INDEXER_DISCONNECT_GRACE_SECONDS\s*=\s*180/g,
            'INDEXER_DISCONNECT_GRACE_SECONDS = 1',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.INDEXER_DISCONNECT_GRACE_SECONDS');
    });

    it('flags drift of the §3.2 5000 ms QUERY_TIMEOUT_MS anchor', () => {
        const tampered = realDoc.replace(
            /QUERY_TIMEOUT_MS\s*=\s*5000/g,
            'QUERY_TIMEOUT_MS = 9999',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.QUERY_TIMEOUT_MS');
    });

    it('flags drift of the §4.4 K_ANONYMITY_FLOOR = 5 anchor', () => {
        const tampered = realDoc.replace(
            /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
            'K_ANONYMITY_FLOOR = 0',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.K_ANONYMITY_FLOOR');
    });

    it('flags drift of the §5 ANALYTICS_QUERY_P95_BUDGET_MS = 2000 ms anchor', () => {
        const tampered = realDoc.replace(
            /ANALYTICS_QUERY_P95_BUDGET_MS\s*=\s*2000/g,
            'ANALYTICS_QUERY_P95_BUDGET_MS = 9999',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.const.ANALYTICS_QUERY_P95_BUDGET_MS');
    });

    it.each([...T_AN_THREATS])(
        'flags removal of analytics threat %s from §7.1',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-AN-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.threat.${threat}`,
            );
        },
    );

    it.each([...AN_AH_ITEMS])(
        'flags removal of hardening item %s from §8',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`\\b${item}\\b`, 'g'),
                'AN-AH-X',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.hardening.${item}`,
            );
        },
    );

    it.each(ERROR_AN_CODES.filter((c) => c.value > 0))(
        'flags removal of error code $name from §7.2',
        ({ name }) => {
            const tampered = realDoc.replace(
                new RegExp(`\\b${name}\\b`, 'g'),
                'ERROR_AN_X',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.err.${name}`,
            );
        },
    );
});

// ==================== checkMerchantAnalyticsDoc ====================

describe('checkMerchantAnalyticsDoc', () => {
    const realDoc = readRepoFile('docs/analytics/MERCHANT_ANALYTICS.md');

    it('passes every check against the committed MERCHANT_ANALYTICS.md', () => {
        expect(failures(checkMerchantAnalyticsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkMerchantAnalyticsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('MA.exists');
    });

    it('flags drift of the §4 K_ANONYMITY_FLOOR = 5 anchor', () => {
        const tampered = realDoc.replace(
            /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
            'K_ANONYMITY_FLOOR = 0',
        );
        expect(failures(checkMerchantAnalyticsDoc(tampered))).toContain('MA.privacy.K_FLOOR');
    });

    it('flags drift of the §5 QUERY_TIMEOUT_MS = 5000 ms anchor', () => {
        const tampered = realDoc.replace(
            /QUERY_TIMEOUT_MS\s*=\s*5000/g,
            'QUERY_TIMEOUT_MS = 9999',
        );
        expect(failures(checkMerchantAnalyticsDoc(tampered))).toContain('MA.perf.queryTimeout');
    });

    it('flags removal of the §2 endpoint path', () => {
        const tampered = realDoc.replace(
            /GET\s+\/v1\/analytics\/merchant/g,
            'GET /v1/analytics/somethingelse',
        );
        expect(failures(checkMerchantAnalyticsDoc(tampered))).toContain('MA.endpoint.path');
    });

    it('flags removal of the hashedSub redaction primitive (§3)', () => {
        const tampered = realDoc.replace(/hashedSub/g, 'plainSub');
        expect(failures(checkMerchantAnalyticsDoc(tampered))).toContain('MA.idor.hashedSub');
    });
});

// ==================== checkProtocolAnalyticsDoc ====================

describe('checkProtocolAnalyticsDoc', () => {
    const realDoc = readRepoFile('docs/analytics/PROTOCOL_ANALYTICS.md');

    it('passes every check against the committed PROTOCOL_ANALYTICS.md', () => {
        expect(failures(checkProtocolAnalyticsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkProtocolAnalyticsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('PA.exists');
    });

    it('flags drift of the §5 cache directive (max-age=600, swr=120)', () => {
        const tampered = realDoc.replace(
            /public,\s*max-age=600,\s*stale-while-revalidate=120/g,
            'public, max-age=0',
        );
        expect(failures(checkProtocolAnalyticsDoc(tampered))).toContain('PA.cache.Cache-Control');
    });

    it('flags drift of the §6 AN-M02 latency-alert wiring', () => {
        const tampered = realDoc.replace(/AN-M02/g, 'AN-MXX');
        expect(failures(checkProtocolAnalyticsDoc(tampered))).toContain('PA.perf.AN-M02');
    });

    it('flags removal of an indexer provenance event row', () => {
        const tampered = realDoc.replace(/SwapExecuted/g, 'SomethingElseExecuted');
        expect(failures(checkProtocolAnalyticsDoc(tampered))).toContain('PA.indexer.SwapExecuted');
    });

    it('flags drift of the §4 K_ANONYMITY_FLOOR = 5 anchor', () => {
        const tampered = realDoc.replace(
            /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
            'K_ANONYMITY_FLOOR = 0',
        );
        expect(failures(checkProtocolAnalyticsDoc(tampered))).toContain('PA.privacy.K_FLOOR');
    });
});

// ==================== checkPublicDashboardDoc ====================

describe('checkPublicDashboardDoc', () => {
    const realDoc = readRepoFile('docs/analytics/PUBLIC_DASHBOARD.md');

    it('passes every check against the committed PUBLIC_DASHBOARD.md', () => {
        expect(failures(checkPublicDashboardDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkPublicDashboardDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('PD.exists');
    });

    it('flags removal of the stats.tonbankcard.com hostname anchor (§2)', () => {
        const tampered = realDoc.replace(/stats\.tonbankcard\.com/g, 'analytics.example.com');
        expect(failures(checkPublicDashboardDoc(tampered))).toContain('PD.host.statsHost');
    });

    it('flags drift of the §6 DASHBOARD_LOAD_BUDGET_MS = 2000 ms anchor', () => {
        const tampered = realDoc.replace(
            /DASHBOARD_LOAD_BUDGET_MS\s*=\s*2000/g,
            'DASHBOARD_LOAD_BUDGET_MS = 9999',
        );
        expect(failures(checkPublicDashboardDoc(tampered))).toContain('PD.perf.loadBudget');
    });

    it('flags drift of the §4 AN-M04 degraded-banner alert', () => {
        const tampered = realDoc.replace(/AN-M04/g, 'AN-MXX');
        expect(failures(checkPublicDashboardDoc(tampered))).toContain('PD.refresh.AN-M04');
    });
});

// ==================== checkPrivacyDoc ====================

describe('checkPrivacyDoc', () => {
    const realDoc = readRepoFile('docs/analytics/PRIVACY.md');

    it('passes every check against the committed PRIVACY.md', () => {
        expect(failures(checkPrivacyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkPrivacyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('PR.exists');
    });

    it('flags drift of the §2 K_ANONYMITY_FLOOR = 5 anchor', () => {
        const tampered = realDoc.replace(
            /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
            'K_ANONYMITY_FLOOR = 0',
        );
        expect(failures(checkPrivacyDoc(tampered))).toContain('PR.K.anchor');
    });

    it('flags drift of the §5 ANALYTICS_RETENTION_YEARS = 3 anchor', () => {
        const tampered = realDoc.replace(
            /ANALYTICS_RETENTION_YEARS\s*=\s*3\b/g,
            'ANALYTICS_RETENTION_YEARS = 0',
        );
        expect(failures(checkPrivacyDoc(tampered))).toContain('PR.retention.years');
    });

    it('flags removal of the §6 ipHash daily-salt redaction', () => {
        const tampered = realDoc.replace(/ipHash/g, 'plainIp');
        expect(failures(checkPrivacyDoc(tampered))).toContain('PR.log.ipHash');
    });

    it('flags removal of the §6 R-AN-AH-4 log-schema CI binding', () => {
        const tampered = realDoc.replace(/R-AN-AH-4/g, 'R-AN-AH-X');
        expect(failures(checkPrivacyDoc(tampered))).toContain('PR.log.R-AN-AH-4');
    });
});

// ==================== checkMonitoringDoc ====================

describe('checkMonitoringDoc', () => {
    const realDoc = readRepoFile('docs/analytics/MONITORING.md');

    it('passes every check against the committed MONITORING.md', () => {
        expect(failures(checkMonitoringDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkMonitoringDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('MO.exists');
    });

    it.each([...AN_M_IDS])(
        'flags removal of alert %s from §3 catalogue',
        (alert) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${alert}\\*\\*`, 'g'),
                '**AN-MXX**',
            );
            expect(failures(checkMonitoringDoc(tampered))).toContain(
                `MO.alert.${alert}`,
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
            expect(failures(checkMonitoringDoc(tampered))).toContain(
                `MO.source.${ds}`,
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
            expect(failures(checkMonitoringDoc(tampered))).toContain(
                `MO.drill.${dr}`,
            );
        },
    );

    it.each([...SEVERITY_TIERS])(
        'flags removal of pager tier %s from §3.5 severity matrix',
        (tier) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${tier}\\*\\*`, 'g'),
                '**PX**',
            );
            expect(failures(checkMonitoringDoc(tampered))).toContain(
                `MO.severity.${tier}`,
            );
        },
    );
});

// ==================== checkEndpointHardeningDoc ====================

describe('checkEndpointHardeningDoc', () => {
    const realDoc = readRepoFile('docs/analytics/ENDPOINT_HARDENING.md');

    it('passes every check against the committed ENDPOINT_HARDENING.md', () => {
        expect(failures(checkEndpointHardeningDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkEndpointHardeningDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('EH.exists');
    });

    it.each([...AN_AH_ITEMS])(
        'flags removal of §3 heading for %s',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`###\\s+${item}\\s+—`, 'g'),
                `### AN-AH-X — `,
            );
            expect(failures(checkEndpointHardeningDoc(tampered))).toContain(
                `EH.heading.${item}`,
            );
        },
    );

    it.each([...R_AN_AH_RULES])(
        'flags removal of CI guardrail %s from §5',
        (rule) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${rule}\\*\\*`, 'g'),
                '**R-AN-AH-X**',
            );
            expect(failures(checkEndpointHardeningDoc(tampered))).toContain(
                `EH.rule.${rule}`,
            );
        },
    );

    it.each([...AH_THREAT_CLOSURES])(
        'flags removal of $ah → $threat closure (§3 bold pairing)',
        (closure) => {
            const tampered = realDoc.replace(
                new RegExp(
                    `(###\\s+${closure.ah}\\s+—[\\s\\S]{0,400}?\\*\\*Closes threat:\\*\\*\\s*)${closure.threat}\\b`,
                ),
                `$1T-AN-X`,
            );
            expect(failures(checkEndpointHardeningDoc(tampered))).toContain(
                `EH.closure.${closure.ah}`,
            );
        },
    );
});

// ==================== checkTestnetIntegrationDoc ====================

describe('checkTestnetIntegrationDoc', () => {
    const realDoc = readRepoFile('docs/analytics/TESTNET_INTEGRATION.md');

    it('passes every check against the committed TESTNET_INTEGRATION.md', () => {
        expect(failures(checkTestnetIntegrationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkTestnetIntegrationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TI.exists');
    });

    it('flags drift of the §5.3 IDOR case count (six rows required)', () => {
        // Drop every numbered row from the IDOR case table by neutralising
        // the leading | digit | `GET /v1/analytics/merchant pattern.
        const tampered = realDoc.replace(
            /\|\s*[1-6]\s*\|\s*`GET\s+\/v1\/analytics\/merchant/g,
            '| X | `GET /v1/analytics/somethingelse',
        );
        expect(failures(checkTestnetIntegrationDoc(tampered))).toContain('TI.idor.count');
    });

    it('flags removal of the §5.5 DASHBOARD_LOAD_BUDGET_MS = 2000 ms anchor', () => {
        const tampered = realDoc.replace(
            /DASHBOARD_LOAD_BUDGET_MS\s*=\s*2000/g,
            'DASHBOARD_LOAD_BUDGET_MS = 9999',
        );
        expect(failures(checkTestnetIntegrationDoc(tampered))).toContain('TI.dashboard.loadBudget');
    });

    it.each(['api.staging.tonbankcard.com', 'stats.staging.tonbankcard.com'])(
        'flags removal of the §3.3 staging host %s',
        (host) => {
            const tampered = realDoc.replace(
                new RegExp(host.replace(/\./g, '\\.'), 'g'),
                'invalid.example.com',
            );
            expect(failures(checkTestnetIntegrationDoc(tampered))).toContain(
                `TI.host.${host}`,
            );
        },
    );

    it.each(ACCEPTANCE_CRITERIA.filter((c) => c.id !== 'AC-1' && c.id !== 'AC-6'))(
        'flags removal of $id row from §2 AC mapping (AC-1/AC-6 are not surfaced in TESTNET_INTEGRATION)',
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
    const realDoc = readRepoFile('docs/analytics/BUG_BOUNTY.md');

    it('passes every check against the committed BUG_BOUNTY.md', () => {
        expect(failures(checkBugBountyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkBugBountyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('BB.exists');
    });

    it('flags removal of the merchantAggregator.ts in-scope asset row', () => {
        const tampered = realDoc.replace(
            /backend\/analytics\/merchantAggregator\.ts/g,
            'backend/analytics/somethingelse.ts',
        );
        expect(failures(checkBugBountyDoc(tampered))).toContain(
            'BB.asset.backend_analytics_merchantAggregator_ts',
        );
    });

    it('flags removal of the protocolAggregator.ts in-scope asset row', () => {
        const tampered = realDoc.replace(
            /backend\/analytics\/protocolAggregator\.ts/g,
            'backend/analytics/somethingelse.ts',
        );
        expect(failures(checkBugBountyDoc(tampered))).toContain(
            'BB.asset.backend_analytics_protocolAggregator_ts',
        );
    });

    it.each(['(a)', '(b)', '(c)', '(d)'])(
        'flags removal of activation condition %s from §2',
        (cond) => {
            const tampered = realDoc.split(cond).join('(X)');
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.activation.${cond}`);
        },
    );

    it.each(['4.1', '4.2', '4.3', '4.4', '4.5'])(
        'flags removal of severity sub-section §%s',
        (sub) => {
            const tampered = realDoc.replace(
                new RegExp(`###\\s*${sub.replace('.', '\\.')}\\s+`, 'g'),
                `### X.X `,
            );
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.section.${sub}`);
        },
    );

    it('flags removal of the §1 A5 PROGRAM_BRIEF.md anchor', () => {
        const tampered = realDoc.replace(
            /A5-bug-bounty\/PROGRAM_BRIEF\.md/g,
            'A5-bug-bounty/somethingelse.md',
        );
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.link.A5');
    });

    it('flags drift of the §4.2 RATE_LIMIT_REQUESTS_PER_MINUTE = 60 rate-limit band', () => {
        const tampered = realDoc.replace(/\b60\s*req\b/g, '999 req');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.high.rateLimit');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    const docs = {
        specification:      readRepoFile('docs/analytics/SPECIFICATION.md'),
        merchantAnalytics:  readRepoFile('docs/analytics/MERCHANT_ANALYTICS.md'),
        protocolAnalytics:  readRepoFile('docs/analytics/PROTOCOL_ANALYTICS.md'),
        publicDashboard:    readRepoFile('docs/analytics/PUBLIC_DASHBOARD.md'),
        privacy:            readRepoFile('docs/analytics/PRIVACY.md'),
        monitoring:         readRepoFile('docs/analytics/MONITORING.md'),
        endpointHardening:  readRepoFile('docs/analytics/ENDPOINT_HARDENING.md'),
        testnetIntegration: readRepoFile('docs/analytics/TESTNET_INTEGRATION.md'),
        bugBounty:          readRepoFile('docs/analytics/BUG_BOUNTY.md'),
    };

    it('returns zero failures against the committed F7 artefacts', () => {
        const fails = failures(checkCrossDocReferences(docs));
        expect(fails).toEqual([]);
    });

    it.each([...AN_AH_ITEMS])(
        'flags %s reference in MERCHANT_ANALYTICS.md when ENDPOINT_HARDENING.md heading is missing',
        (item) => {
            // Pre-condition: doc references AH item. If not, skip drift assertion.
            if (!new RegExp(`\\b${item}\\b`).test(docs.merchantAnalytics)) {
                return;
            }
            const tampered = {
                ...docs,
                endpointHardening: docs.endpointHardening.replace(
                    new RegExp(`###\\s+${item}\\s+—`, 'g'),
                    '### AN-AH-X —',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.AH.${item}.in.MERCHANT_ANALYTICS.md`,
            );
        },
    );

    it.each([...T_AN_THREATS])(
        'flags threat %s missing from SPECIFICATION.md while still referenced elsewhere',
        (t) => {
            // Build a synthetic ENDPOINT_HARDENING.md that references the
            // threat (the committed doc does so via §6 cross-ref table).
            if (!new RegExp(`\\b${t}\\b`).test(docs.endpointHardening)) return;
            const tampered = {
                ...docs,
                specification: docs.specification.replace(
                    new RegExp(`\\*\\*${t}\\*\\*`, 'g'),
                    '**T-AN-X**',
                ),
            };
            expect(failures(checkCrossDocReferences(tampered))).toContain(
                `XR.T.${t}.in.ENDPOINT_HARDENING.md`,
            );
        },
    );

    it.each([...AN_M_IDS])(
        'flags alert %s referenced from MONITORING.md companions when bold form drops',
        (m) => {
            // Find any sibling doc that references the alert in plain form.
            const siblingDocsThatReference = [
                { name: 'PROTOCOL_ANALYTICS.md',  content: docs.protocolAnalytics },
                { name: 'MERCHANT_ANALYTICS.md',  content: docs.merchantAnalytics },
                { name: 'PUBLIC_DASHBOARD.md',    content: docs.publicDashboard },
                { name: 'PRIVACY.md',             content: docs.privacy },
                { name: 'ENDPOINT_HARDENING.md',  content: docs.endpointHardening },
                { name: 'TESTNET_INTEGRATION.md', content: docs.testnetIntegration },
                { name: 'BUG_BOUNTY.md',          content: docs.bugBounty },
            ].filter((d) => new RegExp(`\\b${m}\\b`).test(d.content));
            if (siblingDocsThatReference.length === 0) return;
            const tampered = {
                ...docs,
                monitoring: docs.monitoring.replace(
                    new RegExp(`\\*\\*${m}\\*\\*`, 'g'),
                    '**AN-MXX**',
                ),
            };
            const fails = failures(checkCrossDocReferences(tampered));
            for (const d of siblingDocsThatReference) {
                expect(fails).toContain(`XR.M.${m}.in.${d.name}`);
            }
        },
    );

    it('flags drift of K_ANONYMITY_FLOOR in PRIVACY.md (cross-doc parity break)', () => {
        const tampered = {
            ...docs,
            privacy: docs.privacy.replace(
                /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
                'K_ANONYMITY_FLOOR = 0',
            ),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.K.PRIVACY.md');
    });

    it('flags drift of K_ANONYMITY_FLOOR in PROTOCOL_ANALYTICS.md', () => {
        const tampered = {
            ...docs,
            protocolAnalytics: docs.protocolAnalytics.replace(
                /K_ANONYMITY_FLOOR\s*=\s*5\b/g,
                'K_ANONYMITY_FLOOR = 0',
            ),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.K.PROTOCOL_ANALYTICS.md');
    });

    it('flags removal of the SPECIFICATION.md link from a downstream doc', () => {
        const tampered = {
            ...docs,
            bugBounty: docs.bugBounty.replace(/SPECIFICATION\.md/g, 'X.md'),
        };
        expect(failures(checkCrossDocReferences(tampered))).toContain('XR.spec.BUG_BOUNTY.md');
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
    it('reports zero failures against the committed F7 analytics artefacts', () => {
        const report = runAllChecks();
        if (report.failed !== 0) {
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
