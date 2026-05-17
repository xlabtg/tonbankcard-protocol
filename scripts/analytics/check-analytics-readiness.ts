/**
 * Analytics & Reporting Production-Readiness Validator (Issue #142, F7)
 *
 * Purpose: Validate that the nine analytics production-readiness
 *   documents — SPECIFICATION.md, MERCHANT_ANALYTICS.md,
 *   PROTOCOL_ANALYTICS.md, PUBLIC_DASHBOARD.md, PRIVACY.md,
 *   MONITORING.md, ENDPOINT_HARDENING.md, TESTNET_INTEGRATION.md,
 *   and BUG_BOUNTY.md — stay consistent with each other, with the
 *   planned off-chain aggregator sources, and with the engagement's
 *   acceptance criteria from Issue #142 §8.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown sources from the repository working tree. The aggregator
 *   sources (`backend/analytics/{merchantAggregator,protocolAggregator}.ts`)
 *   land in a follow-up PR after B3 verdict READY (per
 *   ENDPOINT_HARDENING.md §4); this validator therefore omits an
 *   `checkAggregatorEvidence` step until aggregator sources exist.
 *
 * Usage:
 *   npx ts-node scripts/analytics/check-analytics-readiness.ts
 *   npx ts-node scripts/analytics/check-analytics-readiness.ts --classify AC-4
 *   npx ts-node scripts/analytics/check-analytics-readiness.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the F3 validator at
 *   scripts/bridge/check-bridge-readiness.ts, the F4 validator at
 *   scripts/recurring-payments/check-recurring-payments-readiness.ts,
 *   the F5 validator at
 *   scripts/multisig/check-multisig-readiness.ts, and the F6 validator
 *   at scripts/dex/check-dex-readiness.ts.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #142 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and
// the linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'specification'
        | 'merchant-analytics'
        | 'protocol-analytics'
        | 'public-dashboard'
        | 'privacy'
        | 'monitoring'
        | 'endpoint-hardening'
        | 'testnet-integration'
        | 'bug-bounty'
        | 'tests';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'docs/analytics/SPECIFICATION.md written',                                  artifact: 'docs/analytics/SPECIFICATION.md',         evidenceCheck: 'specification' },
    { id: 'AC-2', description: 'Merchant analytics endpoint implemented (GET /v1/analytics/merchant)',     artifact: 'docs/analytics/MERCHANT_ANALYTICS.md',    evidenceCheck: 'merchant-analytics' },
    { id: 'AC-3', description: 'Protocol analytics endpoint implemented (GET /v1/analytics/protocol)',    artifact: 'docs/analytics/PROTOCOL_ANALYTICS.md',    evidenceCheck: 'protocol-analytics' },
    { id: 'AC-4', description: 'Merchant analytics section added to dashboard/',                           artifact: 'docs/analytics/MERCHANT_ANALYTICS.md',    evidenceCheck: 'merchant-analytics' },
    { id: 'AC-5', description: 'Public dashboard at stats.tonbankcard.com shows accurate protocol stats', artifact: 'docs/analytics/PUBLIC_DASHBOARD.md',      evidenceCheck: 'public-dashboard' },
    { id: 'AC-6', description: 'All analytics sourced from indexer (no direct RPC calls to blockchain)',  artifact: 'docs/analytics/PROTOCOL_ANALYTICS.md',    evidenceCheck: 'protocol-analytics' },
    { id: 'AC-7', description: 'IDOR protection tested (six distinct cases in staging drill)',            artifact: 'docs/analytics/TESTNET_INTEGRATION.md',   evidenceCheck: 'testnet-integration' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    specification:        resolve(REPO_ROOT, 'docs/analytics/SPECIFICATION.md'),
    merchantAnalytics:    resolve(REPO_ROOT, 'docs/analytics/MERCHANT_ANALYTICS.md'),
    protocolAnalytics:    resolve(REPO_ROOT, 'docs/analytics/PROTOCOL_ANALYTICS.md'),
    publicDashboard:      resolve(REPO_ROOT, 'docs/analytics/PUBLIC_DASHBOARD.md'),
    privacy:              resolve(REPO_ROOT, 'docs/analytics/PRIVACY.md'),
    monitoring:           resolve(REPO_ROOT, 'docs/analytics/MONITORING.md'),
    endpointHardening:    resolve(REPO_ROOT, 'docs/analytics/ENDPOINT_HARDENING.md'),
    testnetIntegration:   resolve(REPO_ROOT, 'docs/analytics/TESTNET_INTEGRATION.md'),
    bugBounty:            resolve(REPO_ROOT, 'docs/analytics/BUG_BOUNTY.md'),
    b3Engagement:         resolve(REPO_ROOT, 'docs/production/B3-monitoring/ENGAGEMENT.md'),
    b3Status:             resolve(REPO_ROOT, 'docs/production/B3-monitoring/STATUS.md'),
    a5ProgramBrief:       resolve(REPO_ROOT, 'docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md'),
    errorCodes:           resolve(REPO_ROOT, 'docs/error-codes.md'),
    auditScope:           resolve(REPO_ROOT, 'docs/audit-scope.md'),
    docsIndex:            resolve(REPO_ROOT, 'docs/INDEX.md'),
};

// ==================== CHECK RESULT TYPES ====================

export interface CheckResult {
    id: string;
    name: string;
    passed: boolean;
    detail: string;
}

export function readSafe(path: string): string | null {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
}

// ==================== EXPECTED CONSTANTS ====================
// Centralised so a single edit propagates to every consistency check.

// Error codes 0..9 published in SPECIFICATION.md §7.2.
export const ERROR_AN_CODES = [
    { name: 'ERROR_AN_NONE',                value: 0 },
    { name: 'ERROR_AN_TIMEOUT',             value: 1 },
    { name: 'ERROR_AN_UNAUTHORIZED',        value: 2 },
    { name: 'ERROR_AN_FORBIDDEN_SCOPE',     value: 3 },
    { name: 'ERROR_AN_INVALID_RANGE',       value: 4 },
    { name: 'ERROR_AN_INDEXER_LAG',         value: 5 },
    { name: 'ERROR_AN_RATE_LIMITED',        value: 6 },
    { name: 'ERROR_AN_CACHE_MISS_STORM',    value: 7 },
    { name: 'ERROR_AN_PRIVACY_THRESHOLD',   value: 8 },
    { name: 'ERROR_AN_BACKEND_DOWN',        value: 9 },
] as const;

// Threat catalogue T-AN-1..T-AN-7 from SPECIFICATION.md §7.1, mirrored
// in BUG_BOUNTY.md and ENDPOINT_HARDENING.md §3 (AN-AH-N closures).
export const T_AN_THREATS = [
    'T-AN-1',
    'T-AN-2',
    'T-AN-3',
    'T-AN-4',
    'T-AN-5',
    'T-AN-6',
    'T-AN-7',
] as const;

// Hardening backlog AN-AH-1..AN-AH-7 from ENDPOINT_HARDENING.md §3.
export const AN_AH_ITEMS = [
    'AN-AH-1',
    'AN-AH-2',
    'AN-AH-3',
    'AN-AH-4',
    'AN-AH-5',
    'AN-AH-6',
    'AN-AH-7',
] as const;

// AH → T closures fixed in ENDPOINT_HARDENING.md §3, §6 cross-ref table.
// AH-1→T-1, AH-2→T-2, AH-3→T-3, AH-4→T-5, AH-5→T-6, AH-6→T-7, AH-7→T-4.
export const AH_THREAT_CLOSURES: ReadonlyArray<{ ah: string; threat: string }> = [
    { ah: 'AN-AH-1', threat: 'T-AN-1' },
    { ah: 'AN-AH-2', threat: 'T-AN-2' },
    { ah: 'AN-AH-3', threat: 'T-AN-3' },
    { ah: 'AN-AH-4', threat: 'T-AN-5' },
    { ah: 'AN-AH-5', threat: 'T-AN-6' },
    { ah: 'AN-AH-6', threat: 'T-AN-7' },
    { ah: 'AN-AH-7', threat: 'T-AN-4' },
];

// CI guardrail rules R-AN-AH-1..R-AN-AH-5 from ENDPOINT_HARDENING.md §5.
export const R_AN_AH_RULES = [
    'R-AN-AH-1',
    'R-AN-AH-2',
    'R-AN-AH-3',
    'R-AN-AH-4',
    'R-AN-AH-5',
] as const;

// Alert catalogue AN-M01..AN-M12 from MONITORING.md §3.
export const AN_M_IDS = [
    'AN-M01', 'AN-M02', 'AN-M03', 'AN-M04',
    'AN-M05', 'AN-M06', 'AN-M07', 'AN-M08',
    'AN-M09', 'AN-M10', 'AN-M11', 'AN-M12',
] as const;

// Data sources DS-1..DS-6 from MONITORING.md §4.
export const DS_IDS = ['DS-1', 'DS-2', 'DS-3', 'DS-4', 'DS-5', 'DS-6'] as const;

// Disaster-recovery drills DR-1..DR-6 from MONITORING.md §5.
export const DR_IDS = ['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5', 'DR-6'] as const;

// Pager severity tiers from MONITORING.md §3.5.
export const SEVERITY_TIERS = ['P0', 'P1', 'P2', 'P3'] as const;

// Test-bar counts for TESTNET_INTEGRATION.md §5.3 IDOR drill (six cases).
export const IDOR_DRILL_CASE_COUNT = 6;

// Numeric constants from SPECIFICATION.md and sibling documents. Each
// appears verbatim in the docs and in the aggregator sources once they
// land in a follow-up PR.
export const K_ANONYMITY_FLOOR = 5;
export const QUERY_TIMEOUT_MS = 5000;
export const ANALYTICS_REFRESH_INTERVAL_SECONDS = 600;
export const INDEXER_DISCONNECT_GRACE_SECONDS = 180;
export const REPLICA_LAG_BUDGET_SECONDS = 60;
export const CACHE_TTL_SECONDS = 600;
export const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 120;
export const HEALTH_PROBE_INTERVAL_SECONDS = 60;
export const HEALTH_PROBE_FAILURE_THRESHOLD = 3;
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;
export const DASHBOARD_LOAD_BUDGET_MS = 2000;
export const ANALYTICS_QUERY_P95_BUDGET_MS = 2000;
export const ANALYTICS_RETENTION_YEARS = 3;
export const IDEMPOTENCY_WINDOW_SECONDS = 600;

// ==================== SPECIFICATION.MD CHECK ====================

export function checkSpecificationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'SP.exists',
            name: 'docs/analytics/SPECIFICATION.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.specification}`,
        });
        return results;
    }
    results.push({
        id: 'SP.exists',
        name: 'docs/analytics/SPECIFICATION.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 shared AnalyticsAdapter interface — four methods.
    const methods = ['getMerchantAnalytics', 'getProtocolAnalytics', 'refresh', 'healthCheck'];
    for (const m of methods) {
        results.push({
            id: `SP.method.${m}`,
            name: `SPECIFICATION.md §3 names AnalyticsAdapter method ${m}`,
            passed: new RegExp(`\\b${m}\\b`).test(content),
            detail: 'Shared AnalyticsAdapter interface contract',
        });
    }

    // §3.1 INDEXER_DISCONNECT_GRACE_SECONDS = 180 s.
    results.push({
        id: 'SP.const.INDEXER_DISCONNECT_GRACE_SECONDS',
        name: `SPECIFICATION.md §3.1 anchors INDEXER_DISCONNECT_GRACE_SECONDS = ${INDEXER_DISCONNECT_GRACE_SECONDS} s`,
        passed: new RegExp(`INDEXER_DISCONNECT_GRACE_SECONDS\\s*=\\s*${INDEXER_DISCONNECT_GRACE_SECONDS}`).test(content),
        detail: 'Indexer disconnect grace anchor',
    });

    // §3.2 ProtocolAnalytics envelope fields.
    const protocolAnalyticsFields = [
        'range', 'totalValueTransferred', 'activeAccounts', 'fraudLockEvents',
        'collateralLockEvents', 'invoicesCreated', 'invoicesSettled',
        'dexSwapVolume', 'computedAt', 'nextRefreshAt',
    ];
    for (const f of protocolAnalyticsFields) {
        results.push({
            id: `SP.protocolAnalytics.${f}`,
            name: `SPECIFICATION.md §3.2 ProtocolAnalytics names \`${f}\``,
            passed: new RegExp(`\\b${f}\\b`).test(content),
            detail: 'Protocol envelope field',
        });
    }

    // §3.2 QUERY_TIMEOUT_MS = 5000 ms.
    results.push({
        id: 'SP.const.QUERY_TIMEOUT_MS',
        name: `SPECIFICATION.md anchors QUERY_TIMEOUT_MS = ${QUERY_TIMEOUT_MS} ms`,
        passed: new RegExp(`QUERY_TIMEOUT_MS\\s*=\\s*${QUERY_TIMEOUT_MS}`).test(content),
        detail: 'Read-replica budget anchor (Issue #142 §6)',
    });

    // §3.3 ANALYTICS_REFRESH_INTERVAL_SECONDS = 600 s.
    results.push({
        id: 'SP.const.ANALYTICS_REFRESH_INTERVAL_SECONDS',
        name: `SPECIFICATION.md §3.3 anchors ANALYTICS_REFRESH_INTERVAL_SECONDS = ${ANALYTICS_REFRESH_INTERVAL_SECONDS}`,
        passed: new RegExp(`ANALYTICS_REFRESH_INTERVAL_SECONDS\\s*=\\s*${ANALYTICS_REFRESH_INTERVAL_SECONDS}`).test(content),
        detail: 'Refresh cadence anchor',
    });

    // §3.4 health probe constants.
    results.push({
        id: 'SP.const.HEALTH_PROBE_INTERVAL_SECONDS',
        name: `SPECIFICATION.md §3.4 anchors HEALTH_PROBE_INTERVAL_SECONDS = ${HEALTH_PROBE_INTERVAL_SECONDS}`,
        passed: new RegExp(`HEALTH_PROBE_INTERVAL_SECONDS\\s*=\\s*${HEALTH_PROBE_INTERVAL_SECONDS}`).test(content),
        detail: 'Health probe cadence',
    });
    results.push({
        id: 'SP.const.HEALTH_PROBE_FAILURE_THRESHOLD',
        name: `SPECIFICATION.md §3.4 anchors HEALTH_PROBE_FAILURE_THRESHOLD = ${HEALTH_PROBE_FAILURE_THRESHOLD}`,
        passed: new RegExp(`HEALTH_PROBE_FAILURE_THRESHOLD\\s*=\\s*${HEALTH_PROBE_FAILURE_THRESHOLD}`).test(content),
        detail: 'Auto-pause threshold',
    });

    // §4.1 cache constants.
    results.push({
        id: 'SP.const.CACHE_TTL_SECONDS',
        name: `SPECIFICATION.md §4.1 anchors CACHE_TTL_SECONDS = ${CACHE_TTL_SECONDS}`,
        passed: new RegExp(`CACHE_TTL_SECONDS\\s*=\\s*${CACHE_TTL_SECONDS}`).test(content),
        detail: 'Cache TTL anchor',
    });
    results.push({
        id: 'SP.const.CACHE_STALE_WHILE_REVALIDATE_SECONDS',
        name: `SPECIFICATION.md §4.1 anchors CACHE_STALE_WHILE_REVALIDATE_SECONDS = ${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
        passed: new RegExp(`CACHE_STALE_WHILE_REVALIDATE_SECONDS\\s*=\\s*${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`).test(content),
        detail: 'Stale-while-revalidate window',
    });

    // §4.2 replica lag budget.
    results.push({
        id: 'SP.const.REPLICA_LAG_BUDGET_SECONDS',
        name: `SPECIFICATION.md §4.2 anchors REPLICA_LAG_BUDGET_SECONDS = ${REPLICA_LAG_BUDGET_SECONDS}`,
        passed: new RegExp(`REPLICA_LAG_BUDGET_SECONDS\\s*=\\s*${REPLICA_LAG_BUDGET_SECONDS}`).test(content),
        detail: 'Replica lag anchor',
    });

    // §4.3 rate-limit anchor.
    results.push({
        id: 'SP.const.RATE_LIMIT_REQUESTS_PER_MINUTE',
        name: `SPECIFICATION.md §4.3 anchors RATE_LIMIT_REQUESTS_PER_MINUTE = ${RATE_LIMIT_REQUESTS_PER_MINUTE}`,
        passed: new RegExp(`RATE_LIMIT_REQUESTS_PER_MINUTE\\s*=\\s*${RATE_LIMIT_REQUESTS_PER_MINUTE}`).test(content),
        detail: 'Per-merchant / per-IP rate limit',
    });

    // §4.4 privacy floor.
    results.push({
        id: 'SP.const.K_ANONYMITY_FLOOR',
        name: `SPECIFICATION.md §4.4 anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
        passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(content),
        detail: 'Privacy floor (T-AN-2 closure)',
    });

    // §4.5 retention.
    results.push({
        id: 'SP.const.ANALYTICS_RETENTION_YEARS',
        name: `SPECIFICATION.md §4.5 anchors ANALYTICS_RETENTION_YEARS = ${ANALYTICS_RETENTION_YEARS}`,
        passed: new RegExp(`ANALYTICS_RETENTION_YEARS\\s*=\\s*${ANALYTICS_RETENTION_YEARS}`).test(content),
        detail: 'Aggregate retention window',
    });

    // §5 performance budgets.
    results.push({
        id: 'SP.const.ANALYTICS_QUERY_P95_BUDGET_MS',
        name: `SPECIFICATION.md §5 anchors ANALYTICS_QUERY_P95_BUDGET_MS = ${ANALYTICS_QUERY_P95_BUDGET_MS} ms`,
        passed: new RegExp(`ANALYTICS_QUERY_P95_BUDGET_MS\\s*=\\s*${ANALYTICS_QUERY_P95_BUDGET_MS}`).test(content),
        detail: 'Aggregator query P95 budget (Issue #142 §6)',
    });
    results.push({
        id: 'SP.const.DASHBOARD_LOAD_BUDGET_MS',
        name: `SPECIFICATION.md §5 anchors DASHBOARD_LOAD_BUDGET_MS = ${DASHBOARD_LOAD_BUDGET_MS} ms`,
        passed: new RegExp(`DASHBOARD_LOAD_BUDGET_MS\\s*=\\s*${DASHBOARD_LOAD_BUDGET_MS}`).test(content),
        detail: 'Dashboard load budget anchor',
    });

    // §7.1 — every T-AN-N appears bolded in the threat catalogue.
    for (const threat of T_AN_THREATS) {
        results.push({
            id: `SP.threat.${threat}`,
            name: `SPECIFICATION.md §7.1 lists threat **${threat}**`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'Threat catalogue entry',
        });
    }

    // §7.2 — every ERROR_AN_* name appears.
    for (const code of ERROR_AN_CODES) {
        results.push({
            id: `SP.err.${code.name}`,
            name: `SPECIFICATION.md §7.2 declares ${code.name} (${code.value})`,
            passed: new RegExp(`\\b${code.name}\\b`).test(content),
            detail: 'Error registry entry',
        });
    }

    // §7.3 — authentication binding from session `sub` only.
    results.push({
        id: 'SP.auth.subClaim',
        name: 'SPECIFICATION.md §7.3 binds merchantId to bearer token `sub` claim',
        passed: /bearer\s+token[\s\S]{0,80}sub/i.test(content) && /ERROR_AN_FORBIDDEN_SCOPE/.test(content),
        detail: 'AN-AH-1 anchor (IDOR closure)',
    });

    // §7.4 idempotency window for refresh probes.
    results.push({
        id: 'SP.const.IDEMPOTENCY_WINDOW_SECONDS',
        name: `SPECIFICATION.md §7.4 anchors IDEMPOTENCY_WINDOW_SECONDS = ${IDEMPOTENCY_WINDOW_SECONDS}`,
        passed: new RegExp(`IDEMPOTENCY_WINDOW_SECONDS\\s*=\\s*${IDEMPOTENCY_WINDOW_SECONDS}`).test(content),
        detail: 'Refresh-probe idempotency window',
    });

    // §7.5 PII posture — truncated hash for merchant top-customers only.
    results.push({
        id: 'SP.privacy.truncatedHash',
        name: 'SPECIFICATION.md §7.5 documents first-4 / last-4 truncated-hash form',
        passed: /first\s*4/.test(content) && /last\s*4/.test(content),
        detail: 'Address truncation rule (T-AN-6 closure)',
    });

    // §8 hardening backlog — every AN-AH-N enumerated.
    for (const item of AN_AH_ITEMS) {
        results.push({
            id: `SP.hardening.${item}`,
            name: `SPECIFICATION.md §8 enumerates ${item}`,
            passed: new RegExp(`\\b${item}\\b`).test(content),
            detail: 'Hardening backlog cross-reference',
        });
    }

    // Cross-link to ENDPOINT_HARDENING.md and MERCHANT_ANALYTICS.md.
    results.push({
        id: 'SP.link.ENDPOINT_HARDENING',
        name: 'SPECIFICATION.md links to ENDPOINT_HARDENING.md',
        passed: /ENDPOINT_HARDENING\.md/.test(content),
        detail: 'Cross-reference',
    });
    results.push({
        id: 'SP.link.MERCHANT_ANALYTICS',
        name: 'SPECIFICATION.md links to MERCHANT_ANALYTICS.md',
        passed: /MERCHANT_ANALYTICS\.md/.test(content),
        detail: 'Cross-reference',
    });
    results.push({
        id: 'SP.link.PROTOCOL_ANALYTICS',
        name: 'SPECIFICATION.md links to PROTOCOL_ANALYTICS.md',
        passed: /PROTOCOL_ANALYTICS\.md/.test(content),
        detail: 'Cross-reference',
    });
    results.push({
        id: 'SP.link.PRIVACY',
        name: 'SPECIFICATION.md links to PRIVACY.md',
        passed: /PRIVACY\.md/.test(content),
        detail: 'Cross-reference',
    });

    return results;
}

// ==================== MERCHANT_ANALYTICS.MD CHECK ====================

export function checkMerchantAnalyticsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'MA.exists',
            name: 'docs/analytics/MERCHANT_ANALYTICS.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.merchantAnalytics}`,
        });
        return results;
    }
    results.push({
        id: 'MA.exists',
        name: 'docs/analytics/MERCHANT_ANALYTICS.md exists',
        passed: true,
        detail: 'Found',
    });

    // §2 endpoint surface — GET /v1/analytics/merchant, four ranges.
    results.push({
        id: 'MA.endpoint.path',
        name: 'MERCHANT_ANALYTICS.md §2 names `GET /v1/analytics/merchant`',
        passed: /GET\s+\/v1\/analytics\/merchant/.test(content),
        detail: 'Endpoint surface',
    });
    for (const r of ['7d', '30d', '90d', '365d']) {
        results.push({
            id: `MA.range.${r}`,
            name: `MERCHANT_ANALYTICS.md §2 supports range \`${r}\``,
            passed: new RegExp(`\\b${r}\\b`).test(content),
            detail: 'Supported range value',
        });
    }

    // §2 envelope fields — MerchantAnalytics interface.
    const merchantAnalyticsFields = [
        'merchantId', 'range', 'paymentVolumeTbc', 'paymentCount',
        'averagePaymentTbc', 'invoicesCreated', 'invoicesSettled',
        'conversionRate', 'chargebackCount', 'chargebackRate',
        'topCustomers', 'revenueTrend', 'computedAt', 'nextRefreshAt',
    ];
    for (const f of merchantAnalyticsFields) {
        results.push({
            id: `MA.envelope.${f}`,
            name: `MERCHANT_ANALYTICS.md §2 MerchantAnalytics names \`${f}\``,
            passed: new RegExp(`\\b${f}\\b`).test(content),
            detail: 'Envelope field',
        });
    }

    // §2 TopCustomer and TrendBucket nested types.
    for (const f of ['truncatedHash', 'bucketStart']) {
        results.push({
            id: `MA.nested.${f}`,
            name: `MERCHANT_ANALYTICS.md §2 nested type names \`${f}\``,
            passed: new RegExp(`\\b${f}\\b`).test(content),
            detail: 'Nested envelope type',
        });
    }

    // §3 IDOR posture — three defense-in-depth rules.
    results.push({
        id: 'MA.idor.subClaim',
        name: 'MERCHANT_ANALYTICS.md §3 binds merchantId to session `sub` claim only',
        passed: /sub.*claim/i.test(content) || /session\.sub/.test(content),
        detail: 'AN-AH-1 anchor',
    });
    results.push({
        id: 'MA.idor.rejectQuery',
        name: 'MERCHANT_ANALYTICS.md §3 rejects supplied merchantId (path/query/body)',
        passed: /ERROR_AN_FORBIDDEN_SCOPE/.test(content),
        detail: 'Defense-in-depth IDOR rule',
    });
    results.push({
        id: 'MA.idor.auditLog',
        name: 'MERCHANT_ANALYTICS.md §3 names access audit log `analytics.merchant.access`',
        passed: /analytics\.merchant\.access/.test(content),
        detail: 'Audit-log line',
    });
    results.push({
        id: 'MA.idor.hashedSub',
        name: 'MERCHANT_ANALYTICS.md §3 redacts logged identifiers via `hashedSub`',
        passed: /hashedSub/.test(content),
        detail: 'Redaction primitive',
    });

    // §4 privacy floor — empty topCustomers when count < K.
    results.push({
        id: 'MA.privacy.K_FLOOR',
        name: `MERCHANT_ANALYTICS.md §4 anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
        passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(content),
        detail: 'Privacy-floor anchor',
    });
    results.push({
        id: 'MA.privacy.emptyArray',
        name: 'MERCHANT_ANALYTICS.md §4 returns topCustomers empty (not partial) under floor',
        passed: /empty/i.test(content) && /topCustomers/.test(content),
        detail: 'Privacy-safe fallback',
    });

    // §5 performance budget — P50/P95/P99.
    results.push({
        id: 'MA.perf.p50',
        name: 'MERCHANT_ANALYTICS.md §5 anchors P50 ≤ 200 ms',
        passed: /P50[\s\S]{0,80}200/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'MA.perf.p95',
        name: 'MERCHANT_ANALYTICS.md §5 anchors P95 ≤ 1000 ms',
        passed: /P95[\s\S]{0,80}1000/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'MA.perf.p99',
        name: 'MERCHANT_ANALYTICS.md §5 anchors P99 ≤ 2000 ms',
        passed: /P99[\s\S]{0,80}2000/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'MA.perf.queryTimeout',
        name: `MERCHANT_ANALYTICS.md §5 anchors QUERY_TIMEOUT_MS = ${QUERY_TIMEOUT_MS} ms`,
        passed: new RegExp(`QUERY_TIMEOUT_MS\\s*=\\s*${QUERY_TIMEOUT_MS}`).test(content),
        detail: 'Aggregator timeout binding',
    });

    // §6 error-mapping table — every merchant-relevant code.
    const merchantCodes = [
        'ERROR_AN_NONE', 'ERROR_AN_INVALID_RANGE', 'ERROR_AN_UNAUTHORIZED',
        'ERROR_AN_FORBIDDEN_SCOPE', 'ERROR_AN_RATE_LIMITED',
        'ERROR_AN_TIMEOUT', 'ERROR_AN_INDEXER_LAG', 'ERROR_AN_BACKEND_DOWN',
    ];
    for (const code of merchantCodes) {
        results.push({
            id: `MA.err.${code}`,
            name: `MERCHANT_ANALYTICS.md §6 surfaces ${code}`,
            passed: new RegExp(`\\b${code}\\b`).test(content),
            detail: 'Error mapping row',
        });
    }

    // §7 dashboard widgets — six widget bindings.
    const widgets = [
        'Volume card', 'Conversion card', 'Chargeback card',
        'Top customers list', 'Revenue trend', 'Freshness banner',
    ];
    for (const w of widgets) {
        results.push({
            id: `MA.widget.${w.replace(/\s+/g, '-')}`,
            name: `MERCHANT_ANALYTICS.md §7 binds the dashboard widget "${w}"`,
            passed: new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(content),
            detail: 'AC-4 dashboard widget',
        });
    }

    // §3 IDOR drill cross-reference to TESTNET_INTEGRATION §5.3.
    results.push({
        id: 'MA.link.TESTNET',
        name: 'MERCHANT_ANALYTICS.md cross-references TESTNET_INTEGRATION.md',
        passed: /TESTNET_INTEGRATION\.md/.test(content),
        detail: 'Cross-reference',
    });

    return results;
}

// ==================== PROTOCOL_ANALYTICS.MD CHECK ====================

export function checkProtocolAnalyticsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'PA.exists',
            name: 'docs/analytics/PROTOCOL_ANALYTICS.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.protocolAnalytics}`,
        });
        return results;
    }
    results.push({
        id: 'PA.exists',
        name: 'docs/analytics/PROTOCOL_ANALYTICS.md exists',
        passed: true,
        detail: 'Found',
    });

    // §2 endpoint surface — GET /v1/analytics/protocol, three ranges.
    results.push({
        id: 'PA.endpoint.path',
        name: 'PROTOCOL_ANALYTICS.md §2 names `GET /v1/analytics/protocol`',
        passed: /GET\s+\/v1\/analytics\/protocol/.test(content),
        detail: 'Endpoint surface',
    });
    for (const r of ['7d', '30d', 'all-time']) {
        results.push({
            id: `PA.range.${r}`,
            name: `PROTOCOL_ANALYTICS.md §2 supports range \`${r}\``,
            passed: new RegExp(`\\b${r}\\b`).test(content),
            detail: 'Supported range value',
        });
    }

    // §2 ProtocolAnalytics envelope fields.
    const protocolFields = [
        'totalValueTransferred', 'activeAccounts', 'fraudLockEvents',
        'collateralLockEvents', 'invoicesCreated', 'invoicesSettled',
        'dexSwapVolume', 'computedAt', 'nextRefreshAt',
    ];
    for (const f of protocolFields) {
        results.push({
            id: `PA.envelope.${f}`,
            name: `PROTOCOL_ANALYTICS.md §2 ProtocolAnalytics names \`${f}\``,
            passed: new RegExp(`\\b${f}\\b`).test(content),
            detail: 'Envelope field',
        });
    }

    // §3 indexer provenance — every aggregate from indexer events.
    const indexerEvents = [
        'MerchantPayment', 'InternalTransferEvent', 'AccountLocked',
        'InvoiceCreated', 'InvoiceSettled', 'SwapExecuted',
    ];
    for (const ev of indexerEvents) {
        results.push({
            id: `PA.indexer.${ev}`,
            name: `PROTOCOL_ANALYTICS.md §3 sources aggregates from \`${ev}\` events`,
            passed: new RegExp(`\\b${ev}\\b`).test(content),
            detail: 'Indexer provenance row (AC-6)',
        });
    }
    results.push({
        id: 'PA.indexer.noRpc',
        name: 'PROTOCOL_ANALYTICS.md §3 forbids direct TON RPC calls (AC-6)',
        passed: /RPC/.test(content) && /MUST NOT/.test(content),
        detail: 'AC-6 closure',
    });
    results.push({
        id: 'PA.indexer.AN-AH-4',
        name: 'PROTOCOL_ANALYTICS.md §3 cites AN-AH-4 (read-replica isolation)',
        passed: /AN-AH-4/.test(content),
        detail: 'Read-replica gate',
    });

    // §4 privacy floor — K = 5, fraud/collateral exempt, null-substitution.
    results.push({
        id: 'PA.privacy.K_FLOOR',
        name: `PROTOCOL_ANALYTICS.md §4 anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
        passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(content),
        detail: 'Privacy-floor anchor',
    });
    results.push({
        id: 'PA.privacy.nullField',
        name: 'PROTOCOL_ANALYTICS.md §4 substitutes `null` (not `0`) for sub-floor fields',
        passed: /returns\s*`null`/.test(content),
        detail: 'Null-vs-zero load-bearing distinction',
    });
    results.push({
        id: 'PA.privacy.exemptFields',
        name: 'PROTOCOL_ANALYTICS.md §4 exempts fraudLockEvents / collateralLockEvents from floor',
        passed: /fraudLockEvents/.test(content) && /exempt/i.test(content),
        detail: 'Protocol-safety exemption',
    });
    results.push({
        id: 'PA.privacy.AN-M08',
        name: 'PROTOCOL_ANALYTICS.md §4 emits AN-M08 when floor suppresses a field',
        passed: /AN-M08/.test(content),
        detail: 'Privacy-alert wiring',
    });

    // §5 cache strategy headers.
    results.push({
        id: 'PA.cache.Cache-Control',
        name: 'PROTOCOL_ANALYTICS.md §5 anchors Cache-Control: public, max-age=600, stale-while-revalidate=120',
        passed: /public,\s*max-age=600,\s*stale-while-revalidate=120/.test(content),
        detail: 'CDN cache directive',
    });
    results.push({
        id: 'PA.cache.Vary',
        name: 'PROTOCOL_ANALYTICS.md §5 pins Vary header to `Accept-Encoding` only',
        passed: /Vary[\s\S]{0,80}Accept-Encoding/.test(content) && /Cookie/.test(content),
        detail: 'T-AN-7 closure',
    });
    results.push({
        id: 'PA.cache.ETag',
        name: 'PROTOCOL_ANALYTICS.md §5 derives ETag from range + computedAt + body',
        passed: /sha256\(`?range`?\s*\+\s*`?computedAt`?\s*\+\s*serialisedAggregate\)/.test(content)
            || /sha256\(range[\s\S]{0,40}computedAt[\s\S]{0,40}serialisedAggregate\)/.test(content),
        detail: 'AN-AH-6 ETag derivation',
    });

    // §6 performance budget.
    results.push({
        id: 'PA.perf.p50',
        name: 'PROTOCOL_ANALYTICS.md §6 anchors P50 ≤ 100 ms',
        passed: /P50[\s\S]{0,80}100/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'PA.perf.p95',
        name: 'PROTOCOL_ANALYTICS.md §6 anchors P95 ≤ 500 ms',
        passed: /P95[\s\S]{0,80}500/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'PA.perf.p99',
        name: 'PROTOCOL_ANALYTICS.md §6 anchors P99 ≤ 1000 ms',
        passed: /P99[\s\S]{0,80}1000/.test(content),
        detail: 'Issue #142 §6 budget',
    });
    results.push({
        id: 'PA.perf.AN-M02',
        name: 'PROTOCOL_ANALYTICS.md §6 fires AN-M02 on P95 drift',
        passed: /AN-M02/.test(content),
        detail: 'Latency-alert tie-in',
    });

    // §7 error-mapping table.
    const protocolCodes = [
        'ERROR_AN_NONE', 'ERROR_AN_INVALID_RANGE', 'ERROR_AN_RATE_LIMITED',
        'ERROR_AN_TIMEOUT', 'ERROR_AN_INDEXER_LAG', 'ERROR_AN_BACKEND_DOWN',
    ];
    for (const code of protocolCodes) {
        results.push({
            id: `PA.err.${code}`,
            name: `PROTOCOL_ANALYTICS.md §7 surfaces ${code}`,
            passed: new RegExp(`\\b${code}\\b`).test(content),
            detail: 'Error mapping row',
        });
    }
    results.push({
        id: 'PA.err.PRIVACY_THRESHOLD-not-surfaced',
        name: 'PROTOCOL_ANALYTICS.md §7 explicitly states ERROR_AN_PRIVACY_THRESHOLD is NOT surfaced here',
        passed: /ERROR_AN_PRIVACY_THRESHOLD[\s\S]{0,200}not/.test(content),
        detail: 'Privacy-floor 200 + null contract',
    });

    return results;
}

// ==================== PUBLIC_DASHBOARD.MD CHECK ====================

export function checkPublicDashboardDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'PD.exists',
            name: 'docs/analytics/PUBLIC_DASHBOARD.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.publicDashboard}`,
        });
        return results;
    }
    results.push({
        id: 'PD.exists',
        name: 'docs/analytics/PUBLIC_DASHBOARD.md exists',
        passed: true,
        detail: 'Found',
    });

    // §2 hosting and CDN.
    results.push({
        id: 'PD.host.statsHost',
        name: 'PUBLIC_DASHBOARD.md §2 names hostname `stats.tonbankcard.com`',
        passed: /stats\.tonbankcard\.com/.test(content),
        detail: 'AC-5 hostname anchor',
    });
    results.push({
        id: 'PD.host.cacheControl',
        name: 'PUBLIC_DASHBOARD.md §2 anchors HTML Cache-Control `public, max-age=60, stale-while-revalidate=300`',
        passed: /public,\s*max-age=60,\s*stale-while-revalidate=300/.test(content),
        detail: 'HTML shell cache header',
    });
    results.push({
        id: 'PD.host.immutable',
        name: 'PUBLIC_DASHBOARD.md §2 anchors long-cache hashes `max-age=31536000, immutable`',
        passed: /max-age=31536000,\s*immutable/.test(content),
        detail: 'Versioned asset cache header',
    });

    // §3 data contract — only /v1/analytics/protocol.
    results.push({
        id: 'PD.contract.endpoint',
        name: 'PUBLIC_DASHBOARD.md §3 fetches only `GET /v1/analytics/protocol`',
        passed: /GET\s+\/v1\/analytics\/protocol/.test(content),
        detail: 'AC-6 anchor (single source)',
    });
    results.push({
        id: 'PD.contract.noOther',
        name: 'PUBLIC_DASHBOARD.md §3 forbids other API / RPC / indexer calls (MUST NOT)',
        passed: /MUST NOT/.test(content),
        detail: 'AC-6 closure',
    });

    // §4 refresh cadence — interval, grace, four triggers.
    results.push({
        id: 'PD.refresh.interval',
        name: `PUBLIC_DASHBOARD.md §4 anchors ANALYTICS_REFRESH_INTERVAL_SECONDS = ${ANALYTICS_REFRESH_INTERVAL_SECONDS}`,
        passed: new RegExp(`ANALYTICS_REFRESH_INTERVAL_SECONDS\\s*=\\s*${ANALYTICS_REFRESH_INTERVAL_SECONDS}`).test(content),
        detail: 'Background poll cadence',
    });
    results.push({
        id: 'PD.refresh.grace',
        name: `PUBLIC_DASHBOARD.md §4 anchors INDEXER_DISCONNECT_GRACE_SECONDS = ${INDEXER_DISCONNECT_GRACE_SECONDS}`,
        passed: new RegExp(`INDEXER_DISCONNECT_GRACE_SECONDS\\s*=\\s*${INDEXER_DISCONNECT_GRACE_SECONDS}`).test(content),
        detail: 'Degraded-banner threshold',
    });
    results.push({
        id: 'PD.refresh.AN-M04',
        name: 'PUBLIC_DASHBOARD.md §4 fires AN-M04 on degraded banner',
        passed: /AN-M04/.test(content),
        detail: 'Degraded-banner alert tie-in',
    });

    // §5 layout — six panels enumerated.
    const panels = [
        'Total Value Transferred', 'Active Accounts', 'Lock Events',
        'Invoices', 'DEX Volume', 'Freshness Banner',
    ];
    for (const p of panels) {
        results.push({
            id: `PD.panel.${p.replace(/\s+/g, '-')}`,
            name: `PUBLIC_DASHBOARD.md §5 renders panel "${p}"`,
            passed: new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(content),
            detail: 'AC-5 dashboard panel',
        });
    }
    results.push({
        id: 'PD.panel.nullPlaceholder',
        name: 'PUBLIC_DASHBOARD.md §5 renders `null` field as "—" with privacy tooltip',
        passed: /—/.test(content) && /privacy/i.test(content),
        detail: 'Privacy-threshold UI binding',
    });

    // §6 performance budget — DASHBOARD_LOAD_BUDGET_MS, AN-M07.
    results.push({
        id: 'PD.perf.loadBudget',
        name: `PUBLIC_DASHBOARD.md §6 anchors DASHBOARD_LOAD_BUDGET_MS = ${DASHBOARD_LOAD_BUDGET_MS} ms`,
        passed: new RegExp(`DASHBOARD_LOAD_BUDGET_MS\\s*=\\s*${DASHBOARD_LOAD_BUDGET_MS}`).test(content),
        detail: 'Public-load budget anchor',
    });
    results.push({
        id: 'PD.perf.AN-M07',
        name: 'PUBLIC_DASHBOARD.md §6 fires AN-M07 on load drift',
        passed: /AN-M07/.test(content),
        detail: 'Dashboard-load alert tie-in',
    });

    // §7 error handling — 200 with null, 429, 503 degraded.
    results.push({
        id: 'PD.err.nullFields',
        name: 'PUBLIC_DASHBOARD.md §7 renders "—" for 200 with `null` fields',
        passed: /200[\s\S]{0,40}null[\s\S]{0,200}—/.test(content)
            || /null[\s\S]{0,200}—[\s\S]{0,200}privacy/i.test(content),
        detail: 'Privacy-aware rendering',
    });
    results.push({
        id: 'PD.err.degraded',
        name: 'PUBLIC_DASHBOARD.md §7 degrades freshness banner on 503',
        passed: /503/.test(content) && /[Dd]egraded/.test(content),
        detail: 'Stale-data UX path',
    });

    // §8 accessibility & i18n.
    results.push({
        id: 'PD.a11y.wcag',
        name: 'PUBLIC_DASHBOARD.md §8 commits to WCAG AA contrast',
        passed: /WCAG\s*AA/i.test(content),
        detail: 'Accessibility commitment',
    });
    results.push({
        id: 'PD.a11y.ariaLive',
        name: 'PUBLIC_DASHBOARD.md §8 marks freshness banner `aria-live="polite"`',
        passed: /aria-live\s*=\s*"polite"/.test(content),
        detail: 'Screen-reader-friendly refresh',
    });

    return results;
}

// ==================== PRIVACY.MD CHECK ====================

export function checkPrivacyDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'PR.exists',
            name: 'docs/analytics/PRIVACY.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.privacy}`,
        });
        return results;
    }
    results.push({
        id: 'PR.exists',
        name: 'docs/analytics/PRIVACY.md exists',
        passed: true,
        detail: 'Found',
    });

    // §2 K-anonymity floor.
    results.push({
        id: 'PR.K.anchor',
        name: `PRIVACY.md §2 anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
        passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(content),
        detail: 'Single source of truth for K',
    });
    results.push({
        id: 'PR.K.nullNotZero',
        name: 'PRIVACY.md §2 distinguishes `null` (privacy floor) from `0` (legitimate aggregate)',
        passed: /load-bearing/i.test(content) && /null/.test(content) && /\bzero\b/i.test(content),
        detail: 'Null vs zero rationale',
    });
    results.push({
        id: 'PR.K.AN-M08',
        name: 'PRIVACY.md §2 emits AN-M08 informational alert on suppression',
        passed: /AN-M08/.test(content),
        detail: 'Floor-alert wiring',
    });

    // §2.2 — three enforcement points (aggregator + endpoint + CI guardrail).
    results.push({
        id: 'PR.enforce.aggregator',
        name: 'PRIVACY.md §2.2 names aggregator (`protocolAggregator.ts`) as enforcement point',
        passed: /protocolAggregator\.ts/.test(content),
        detail: 'Layer 1 enforcement',
    });
    results.push({
        id: 'PR.enforce.endpoint',
        name: 'PRIVACY.md §2.2 names endpoint as enforcement point (defense-in-depth)',
        passed: /\/v1\/analytics\/protocol/.test(content),
        detail: 'Layer 2 enforcement',
    });
    results.push({
        id: 'PR.enforce.ci',
        name: 'PRIVACY.md §2.2 names CI guardrail R-AN-AH-2',
        passed: /R-AN-AH-2/.test(content),
        detail: 'Layer 3 enforcement',
    });

    // §3 address truncation — first 4 / last 4.
    results.push({
        id: 'PR.trunc.first4last4',
        name: 'PRIVACY.md §3 truncates hash to first 4 / last 4 hex characters',
        passed: /first\s+(?:4|four)/i.test(content) && /last\s+(?:4|four)/i.test(content),
        detail: 'truncatedHash derivation rule',
    });
    results.push({
        id: 'PR.trunc.sha256',
        name: 'PRIVACY.md §3 derives truncatedHash from sha256(nft_address)',
        passed: /sha256\(nft_address\)/.test(content) || /sha256.*nft_address/.test(content),
        detail: 'Hash primitive',
    });
    results.push({
        id: 'PR.trunc.notReversible',
        name: 'PRIVACY.md §3 declares the hash one-way / not reversible',
        passed: /one-way/i.test(content) && /not\s+reversible/i.test(content),
        detail: 'One-way commitment',
    });

    // §3 topCustomers empty under floor.
    results.push({
        id: 'PR.trunc.emptyTopCustomers',
        name: 'PRIVACY.md §3 returns empty `topCustomers` when count < K',
        passed: /topCustomers/.test(content) && /empty/i.test(content),
        detail: 'Avoid elimination re-identification',
    });

    // §4 opt-out.
    results.push({
        id: 'PR.optout.attestation',
        name: 'PRIVACY.md §4 names opt-out attestation (F4 primitive)',
        passed: /attestation/i.test(content) && /opt-out/i.test(content),
        detail: 'Merchant opt-out path',
    });
    results.push({
        id: 'PR.optout.notEnumerable',
        name: 'PRIVACY.md §4 declares opt-out list NOT publicly enumerable',
        passed: /\*{0,2}NOT\*{0,2}\s+publicly\s+enumerable/.test(content),
        detail: 'Avoid opt-out list leak',
    });

    // §5 retention.
    results.push({
        id: 'PR.retention.years',
        name: `PRIVACY.md §5 anchors ANALYTICS_RETENTION_YEARS = ${ANALYTICS_RETENTION_YEARS}`,
        passed: new RegExp(`ANALYTICS_RETENTION_YEARS\\s*=\\s*${ANALYTICS_RETENTION_YEARS}`).test(content),
        detail: 'Aggregate retention window',
    });
    results.push({
        id: 'PR.retention.guardrail',
        name: 'PRIVACY.md §5 cites R-AN-AH-3 retention truncation rule',
        passed: /R-AN-AH-3/.test(content),
        detail: 'Retention CI binding',
    });

    // §6 logging — hashedSub + ipHash + R-AN-AH-4.
    results.push({
        id: 'PR.log.hashedSub',
        name: 'PRIVACY.md §6 redacts merchant audit log via `hashedSub`',
        passed: /hashedSub\s*=\s*sha256/.test(content) || /hashedSub/.test(content),
        detail: 'Merchant audit-log redaction',
    });
    results.push({
        id: 'PR.log.ipHash',
        name: 'PRIVACY.md §6 redacts public IP via `ipHash` with daily salt rotation',
        passed: /ipHash/.test(content) && /salt/.test(content),
        detail: 'Public access-log redaction',
    });
    results.push({
        id: 'PR.log.R-AN-AH-4',
        name: 'PRIVACY.md §6 cites R-AN-AH-4 schema linter',
        passed: /R-AN-AH-4/.test(content),
        detail: 'Log-schema CI binding',
    });

    return results;
}

// ==================== MONITORING.MD CHECK ====================

export function checkMonitoringDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'MO.exists',
            name: 'docs/analytics/MONITORING.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.monitoring}`,
        });
        return results;
    }
    results.push({
        id: 'MO.exists',
        name: 'docs/analytics/MONITORING.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3.1–3.4 — every AN-M0X enumerated, bolded with `**AN-M0X**`.
    for (const m of AN_M_IDS) {
        results.push({
            id: `MO.alert.${m}`,
            name: `MONITORING.md §3 enumerates alert **${m}**`,
            passed: new RegExp(`\\*\\*${m}\\*\\*`).test(content),
            detail: 'Alert catalogue entry',
        });
    }

    // §3.5 — severity matrix routes every AN-M0X exactly once.
    for (const tier of SEVERITY_TIERS) {
        results.push({
            id: `MO.severity.${tier}`,
            name: `MONITORING.md §3.5 enumerates severity tier ${tier}`,
            passed: new RegExp(`\\*\\*${tier}\\*\\*`).test(content),
            detail: 'Severity-matrix tier header',
        });
    }

    // §3.5 fixed routing rules.
    results.push({
        id: 'MO.severity.P0.routing',
        name: 'MONITORING.md §3.5 P0 row includes AN-M11 and AN-M12',
        passed: /\*\*P0\*\*[\s\S]{0,400}AN-M11[\s\S]{0,80}AN-M12/.test(content)
            || /\*\*P0\*\*[\s\S]{0,400}AN-M12[\s\S]{0,80}AN-M11/.test(content),
        detail: 'P0 wake-on-call routing',
    });
    results.push({
        id: 'MO.severity.P3.routing',
        name: 'MONITORING.md §3.5 P3 row includes AN-M08 (privacy informational)',
        passed: /\*\*P3\*\*[\s\S]{0,200}AN-M08/.test(content),
        detail: 'P3 digest routing',
    });

    // §3.1 anchors numeric thresholds referenced from spec.
    results.push({
        id: 'MO.const.AN-M02-budget',
        name: `MONITORING.md §3 anchors merchant P95 budget ANALYTICS_QUERY_P95_BUDGET_MS = ${ANALYTICS_QUERY_P95_BUDGET_MS} ms`,
        passed: new RegExp(`ANALYTICS_QUERY_P95_BUDGET_MS\\s*=\\s*${ANALYTICS_QUERY_P95_BUDGET_MS}`).test(content),
        detail: 'AN-M02 budget anchor',
    });
    results.push({
        id: 'MO.const.AN-M04-grace',
        name: `MONITORING.md §3 anchors INDEXER_DISCONNECT_GRACE_SECONDS = ${INDEXER_DISCONNECT_GRACE_SECONDS} s`,
        passed: new RegExp(`INDEXER_DISCONNECT_GRACE_SECONDS\\s*=\\s*${INDEXER_DISCONNECT_GRACE_SECONDS}`).test(content),
        detail: 'AN-M04 trigger anchor',
    });
    results.push({
        id: 'MO.const.AN-M06-refresh',
        name: `MONITORING.md §3 anchors ANALYTICS_REFRESH_INTERVAL_SECONDS = ${ANALYTICS_REFRESH_INTERVAL_SECONDS} s`,
        passed: new RegExp(`ANALYTICS_REFRESH_INTERVAL_SECONDS\\s*=\\s*${ANALYTICS_REFRESH_INTERVAL_SECONDS}`).test(content),
        detail: 'AN-M06 cadence anchor',
    });
    results.push({
        id: 'MO.const.AN-M07-loadBudget',
        name: `MONITORING.md §3 anchors DASHBOARD_LOAD_BUDGET_MS = ${DASHBOARD_LOAD_BUDGET_MS} ms`,
        passed: new RegExp(`DASHBOARD_LOAD_BUDGET_MS\\s*=\\s*${DASHBOARD_LOAD_BUDGET_MS}`).test(content),
        detail: 'AN-M07 load-budget anchor',
    });
    results.push({
        id: 'MO.const.AN-M09-rateLimit',
        name: `MONITORING.md §3 anchors RATE_LIMIT_REQUESTS_PER_MINUTE = ${RATE_LIMIT_REQUESTS_PER_MINUTE}`,
        passed: new RegExp(`RATE_LIMIT_REQUESTS_PER_MINUTE\\s*=\\s*${RATE_LIMIT_REQUESTS_PER_MINUTE}`).test(content),
        detail: 'AN-M09 rate-limit anchor',
    });
    results.push({
        id: 'MO.const.AN-M10-lag',
        name: `MONITORING.md §3 anchors REPLICA_LAG_BUDGET_SECONDS = ${REPLICA_LAG_BUDGET_SECONDS} s`,
        passed: new RegExp(`REPLICA_LAG_BUDGET_SECONDS\\s*=\\s*${REPLICA_LAG_BUDGET_SECONDS}`).test(content),
        detail: 'AN-M10 replica-lag anchor',
    });
    results.push({
        id: 'MO.const.AN-M12-threshold',
        name: `MONITORING.md §3 anchors HEALTH_PROBE_FAILURE_THRESHOLD = ${HEALTH_PROBE_FAILURE_THRESHOLD}`,
        passed: new RegExp(`HEALTH_PROBE_FAILURE_THRESHOLD\\s*=\\s*${HEALTH_PROBE_FAILURE_THRESHOLD}`).test(content),
        detail: 'AN-M12 threshold anchor',
    });
    results.push({
        id: 'MO.const.AN-M08-K',
        name: `MONITORING.md §3 anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
        passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(content),
        detail: 'AN-M08 floor anchor',
    });

    // §4 — every DS-N data source listed.
    for (const ds of DS_IDS) {
        results.push({
            id: `MO.source.${ds}`,
            name: `MONITORING.md §4 lists data source **${ds}**`,
            passed: new RegExp(`\\*\\*${ds}\\*\\*`).test(content),
            detail: 'Data-source row',
        });
    }
    results.push({
        id: 'MO.source.HEALTH_PROBE',
        name: `MONITORING.md §4 DS-5 anchors HEALTH_PROBE_INTERVAL_SECONDS = ${HEALTH_PROBE_INTERVAL_SECONDS} s`,
        passed: new RegExp(`HEALTH_PROBE_INTERVAL_SECONDS\\s*=\\s*${HEALTH_PROBE_INTERVAL_SECONDS}`).test(content),
        detail: 'Health-probe cadence anchor',
    });

    // §5 — DR-1..DR-6 drills.
    for (const dr of DR_IDS) {
        results.push({
            id: `MO.drill.${dr}`,
            name: `MONITORING.md §5 lists drill **${dr}**`,
            passed: new RegExp(`\\*\\*${dr}\\*\\*`).test(content),
            detail: 'DR drill row',
        });
    }

    // §6 reporting — quarterly summary path.
    results.push({
        id: 'MO.reporting.quarterly',
        name: 'MONITORING.md §6 commits to quarterly summary `audit/analytics-drill-summary-{YYYY-Qn}.md`',
        passed: /analytics-drill-summary/.test(content),
        detail: 'Audit reporting cadence',
    });

    return results;
}

// ==================== ENDPOINT_HARDENING.MD CHECK ====================

export function checkEndpointHardeningDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'EH.exists',
            name: 'docs/analytics/ENDPOINT_HARDENING.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.endpointHardening}`,
        });
        return results;
    }
    results.push({
        id: 'EH.exists',
        name: 'docs/analytics/ENDPOINT_HARDENING.md exists',
        passed: true,
        detail: 'Found',
    });

    // §1 references the B3 monitoring engagement.
    results.push({
        id: 'EH.preq.B3',
        name: 'ENDPOINT_HARDENING.md cites B3 production-monitoring engagement prerequisite',
        passed: /B3.*[Mm]onitoring/.test(content) || /production\/MONITORING\.md/.test(content),
        detail: 'B3 prerequisite anchor',
    });

    // §2 references the F3-F6 pattern (PR #206..#209).
    for (const pr of ['#206', '#207', '#208', '#209']) {
        results.push({
            id: `EH.pattern.${pr}`,
            name: `ENDPOINT_HARDENING.md §2 cites sibling PR ${pr}`,
            passed: new RegExp(`PR\\s*${pr}`).test(content) || new RegExp(`\\b${pr}\\b`).test(content),
            detail: 'F3-F6 hardening pattern citation',
        });
    }

    // §3 — every AN-AH-N appears as a `### AN-AH-N — ...` heading.
    for (const ah of AN_AH_ITEMS) {
        results.push({
            id: `EH.heading.${ah}`,
            name: `ENDPOINT_HARDENING.md §3 contains heading "### ${ah} — ..."`,
            passed: new RegExp(`###\\s+${ah}\\s+—`).test(content),
            detail: 'Hardening row heading',
        });
    }

    // §3 — each AH item declares its threat closure with the bold pairing.
    for (const closure of AH_THREAT_CLOSURES) {
        const pattern = new RegExp(
            `###\\s+${closure.ah}\\s+—[\\s\\S]{0,400}?\\*\\*Closes threat:\\*\\*\\s*${closure.threat}\\b`,
        );
        results.push({
            id: `EH.closure.${closure.ah}`,
            name: `ENDPOINT_HARDENING.md §3 ${closure.ah} closes threat ${closure.threat}`,
            passed: pattern.test(content),
            detail: 'AH→T closure (bold)',
        });
    }

    // §4 — five sign-off gating conditions.
    const signoffAnchors = [
        /B3\s+verdict/i,
        /No\s+critical\s*\/\s*high/i,
        /[Ss]taging\s+ceremony/,
        /[Aa]nalytics\s+readiness\s+validator/,
        /PR\s+scope/,
    ];
    signoffAnchors.forEach((rx, idx) => {
        results.push({
            id: `EH.signoff.${idx + 1}`,
            name: `ENDPOINT_HARDENING.md §4 sign-off condition #${idx + 1} present`,
            passed: rx.test(content),
            detail: 'Gating condition row',
        });
    });

    // §5 — every R-AN-AH-N rule listed.
    for (const rule of R_AN_AH_RULES) {
        results.push({
            id: `EH.rule.${rule}`,
            name: `ENDPOINT_HARDENING.md §5 enumerates rule **${rule}**`,
            passed: new RegExp(`\\*\\*${rule}\\*\\*`).test(content),
            detail: 'CI guardrail row',
        });
    }

    // §5 — cross-references to F3/F4/F5/F6 sibling validators.
    const siblingValidators = [
        'scripts/dex/check-dex-readiness.ts',
        'scripts/multisig/check-multisig-readiness.ts',
        'scripts/recurring-payments/check-recurring-payments-readiness.ts',
        'scripts/bridge/check-bridge-readiness.ts',
    ];
    for (const sv of siblingValidators) {
        results.push({
            id: `EH.sibling.${sv.replace(/[\/\.-]/g, '_')}`,
            name: `ENDPOINT_HARDENING.md §5 cites sibling validator \`${sv}\``,
            passed: content.includes(sv),
            detail: 'Pattern-sibling reference',
        });
    }

    // §6 — cross-ref summary table covers every AN-AH-N.
    for (const ah of AN_AH_ITEMS) {
        const pattern = new RegExp(
            `\\|\\s*\\*\\*${ah}\\*\\*\\s*\\|\\s*T-AN-[1-9]`,
        );
        results.push({
            id: `EH.crossref.${ah}`,
            name: `ENDPOINT_HARDENING.md §6 cross-ref table row for ${ah}`,
            passed: pattern.test(content),
            detail: 'Cross-ref summary row',
        });
    }

    // §7 — AC mapping table covers AC-1..AC-7.
    for (const ac of ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7']) {
        results.push({
            id: `EH.ac.${ac}`,
            name: `ENDPOINT_HARDENING.md §7 AC-mapping table covers ${ac}`,
            passed: new RegExp(`\\|\\s*${ac}\\s*\\|`).test(content),
            detail: 'AC-mapping row',
        });
    }

    return results;
}

// ==================== TESTNET_INTEGRATION.MD CHECK ====================

export function checkTestnetIntegrationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'TI.exists',
            name: 'docs/analytics/TESTNET_INTEGRATION.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.testnetIntegration}`,
        });
        return results;
    }
    results.push({
        id: 'TI.exists',
        name: 'docs/analytics/TESTNET_INTEGRATION.md exists',
        passed: true,
        detail: 'Found',
    });

    // §2 acceptance-criteria mapping (this doc places AC table in §2).
    for (const ac of ['AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-7']) {
        results.push({
            id: `TI.ac.${ac}`,
            name: `TESTNET_INTEGRATION.md §2 AC-mapping row for ${ac}`,
            passed: new RegExp(`\\|\\s*${ac}\\s*\\|`).test(content),
            detail: 'AC-mapping row',
        });
    }

    // §3.1 gating preconditions — at least the named anchors.
    const preconditions = [
        /B3\s+verdict/i,
        /Aggregator\s+bundle/,
        /Dashboard\s+build/,
        /[Mm]onitoring/,
        /[Ii]ndexer\s+schema/,
        /[Rr]ead-replica\s+isolation/,
        /[Oo]perator\s+credentials/,
        /CI\s+green/,
    ];
    preconditions.forEach((rx, idx) => {
        results.push({
            id: `TI.preq.${idx + 1}`,
            name: `TESTNET_INTEGRATION.md §3.1 precondition #${idx + 1} present`,
            passed: rx.test(content),
            detail: 'Gating precondition',
        });
    });

    // §3.2 deployment artefacts — every named log.
    const artefacts = [
        'manifest.json', 'bundle.txt', 'dashboard-build.txt',
        'protocol-flow.log', 'merchant-flow.log', 'idor-drill.log',
        'privacy-drill.log', 'dashboard-drill.log', 'monitoring-drill.log',
    ];
    for (const art of artefacts) {
        results.push({
            id: `TI.artefact.${art}`,
            name: `TESTNET_INTEGRATION.md §3.2 commits artefact \`${art}\``,
            passed: new RegExp(art.replace(/\./g, '\\.')).test(content),
            detail: 'Deployment artefact',
        });
    }

    // §3.3 staging hosts.
    for (const host of ['api.staging.tonbankcard.com', 'stats.staging.tonbankcard.com']) {
        results.push({
            id: `TI.host.${host}`,
            name: `TESTNET_INTEGRATION.md §3.3 routes through \`${host}\``,
            passed: content.includes(host),
            detail: 'Staging host anchor',
        });
    }

    // §4 deployment steps — eight numbered steps.
    for (let i = 1; i <= 8; i++) {
        results.push({
            id: `TI.step.${i}`,
            name: `TESTNET_INTEGRATION.md §4 enumerates step ${i}`,
            passed: new RegExp(`^${i}\\.\\s+\\*\\*`, 'm').test(content),
            detail: 'Deployment step',
        });
    }

    // §5.3 — exactly six IDOR cases.
    const idorCaseRows = (content.match(/\|\s*[1-6]\s*\|\s*`GET\s+\/v1\/analytics\/merchant/g) || []).length;
    results.push({
        id: 'TI.idor.count',
        name: `TESTNET_INTEGRATION.md §5.3 enumerates ${IDOR_DRILL_CASE_COUNT} distinct IDOR cases`,
        passed: idorCaseRows >= IDOR_DRILL_CASE_COUNT,
        detail: `Found ${idorCaseRows} numbered case rows (need ≥ ${IDOR_DRILL_CASE_COUNT})`,
    });
    results.push({
        id: 'TI.idor.errorCode',
        name: 'TESTNET_INTEGRATION.md §5.3 expects `403 ERROR_AN_FORBIDDEN_SCOPE` and AN-M03',
        passed: /ERROR_AN_FORBIDDEN_SCOPE/.test(content) && /AN-M03/.test(content),
        detail: 'IDOR drill error contract',
    });

    // §5.4 — privacy floor drill (4 distinct accounts → null fields).
    results.push({
        id: 'TI.privacy.seed4',
        name: 'TESTNET_INTEGRATION.md §5.4 seeds 4 distinct `nft_address` to trigger floor',
        passed: /4\s+distinct/.test(content) && /nft_address/.test(content),
        detail: 'Privacy-floor seed',
    });
    results.push({
        id: 'TI.privacy.AN-M08',
        name: 'TESTNET_INTEGRATION.md §5.4 asserts AN-M08 fires exactly once',
        passed: /AN-M08/.test(content),
        detail: 'Privacy-alert binding',
    });

    // §5.5 dashboard load drill anchors DASHBOARD_LOAD_BUDGET_MS.
    results.push({
        id: 'TI.dashboard.loadBudget',
        name: `TESTNET_INTEGRATION.md §5.5 anchors DASHBOARD_LOAD_BUDGET_MS = ${DASHBOARD_LOAD_BUDGET_MS} ms`,
        passed: new RegExp(`DASHBOARD_LOAD_BUDGET_MS\\s*=\\s*${DASHBOARD_LOAD_BUDGET_MS}`).test(content),
        detail: 'AC-5 budget anchor',
    });
    results.push({
        id: 'TI.dashboard.grace',
        name: `TESTNET_INTEGRATION.md §5.5 anchors INDEXER_DISCONNECT_GRACE_SECONDS = ${INDEXER_DISCONNECT_GRACE_SECONDS} s`,
        passed: new RegExp(`INDEXER_DISCONNECT_GRACE_SECONDS\\s*=\\s*${INDEXER_DISCONNECT_GRACE_SECONDS}`).test(content),
        detail: 'Degraded-banner anchor',
    });

    // §6 perf-budget verification — 5 rows.
    results.push({
        id: 'TI.perf.protocol',
        name: 'TESTNET_INTEGRATION.md §6 verifies Protocol endpoint P95 ≤ 500 ms',
        passed: /Protocol\s+endpoint\s+P95[\s\S]{0,80}500/.test(content),
        detail: 'P95 verification row',
    });
    results.push({
        id: 'TI.perf.merchant',
        name: 'TESTNET_INTEGRATION.md §6 verifies Merchant endpoint P95 ≤ 1000 ms',
        passed: /Merchant\s+endpoint\s+P95[\s\S]{0,80}1000/.test(content),
        detail: 'P95 verification row',
    });
    results.push({
        id: 'TI.perf.cacheHit',
        name: 'TESTNET_INTEGRATION.md §6 verifies cache hit ratio ≥ 80 %',
        passed: /[Cc]ache\s+hit[\s\S]{0,40}80/.test(content),
        detail: 'Cache hit verification',
    });
    results.push({
        id: 'TI.perf.indexerOverhead',
        name: 'TESTNET_INTEGRATION.md §6 verifies indexer overhead ≤ 10 %',
        passed: /10\s*%/.test(content) && /[Ii]ndexer\s+(host\s+)?metrics/.test(content),
        detail: 'AC-6 budget verification',
    });

    return results;
}

// ==================== BUG_BOUNTY.MD CHECK ====================

export function checkBugBountyDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'BB.exists',
            name: 'docs/analytics/BUG_BOUNTY.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.bugBounty}`,
        });
        return results;
    }
    results.push({
        id: 'BB.exists',
        name: 'docs/analytics/BUG_BOUNTY.md exists',
        passed: true,
        detail: 'Found',
    });

    // §1 — A5 program brief link.
    results.push({
        id: 'BB.link.A5',
        name: 'BUG_BOUNTY.md links to A5 PROGRAM_BRIEF.md',
        passed: /A5-bug-bounty\/PROGRAM_BRIEF\.md/.test(content),
        detail: 'Program-brief anchor',
    });
    results.push({
        id: 'BB.link.SEVERITY_RUBRIC',
        name: 'BUG_BOUNTY.md links to A5 SEVERITY_RUBRIC.md',
        passed: /SEVERITY_RUBRIC\.md/.test(content),
        detail: 'Severity-rubric anchor',
    });

    // §2 activation conditions (a)–(d).
    for (const cond of ['(a)', '(b)', '(c)', '(d)']) {
        results.push({
            id: `BB.activation.${cond}`,
            name: `BUG_BOUNTY.md §2 lists activation condition ${cond}`,
            passed: content.includes(cond),
            detail: 'Activation precondition',
        });
    }

    // §3 in-scope assets — 9 rows.
    const assets = [
        'backend/analytics/merchantAggregator.ts',
        'backend/analytics/protocolAggregator.ts',
        'backend/analytics/types.ts',
        'backend/analytics/replica-pool.ts',
        'api/middleware/analytics-scope.ts',
        'dashboard/',
        'dashboard/public/',
        'scripts/analytics/check-analytics-readiness.ts',
    ];
    for (const a of assets) {
        results.push({
            id: `BB.asset.${a.replace(/[\/\.]/g, '_')}`,
            name: `BUG_BOUNTY.md §3 lists in-scope asset \`${a}\``,
            passed: content.includes(a),
            detail: 'In-scope assets table',
        });
    }
    results.push({
        id: 'BB.asset.indexerSubset',
        name: 'BUG_BOUNTY.md §3 lists indexer subset (`MerchantPayment` + siblings)',
        passed: /MerchantPayment/.test(content) && /SwapExecuted/.test(content),
        detail: 'Indexer materialisation subset',
    });

    // §3 severity ceilings — Critical / High / Medium.
    results.push({
        id: 'BB.ceiling.critical',
        name: 'BUG_BOUNTY.md §3 ceilings — at least one **Critical** asset',
        passed: /\*\*Critical\*\*/.test(content),
        detail: 'Critical ceiling marker',
    });
    results.push({
        id: 'BB.ceiling.high',
        name: 'BUG_BOUNTY.md §3 ceilings — at least one **High** asset',
        passed: /\*\*High\*\*/.test(content),
        detail: 'High ceiling marker',
    });
    results.push({
        id: 'BB.ceiling.medium',
        name: 'BUG_BOUNTY.md §3 ceilings — at least one **Medium** asset',
        passed: /\*\*Medium\*\*/.test(content),
        detail: 'Medium ceiling marker',
    });

    // §4 severity sub-sections — §4.1, §4.2, §4.3, §4.4, §4.5.
    for (const sub of ['4.1', '4.2', '4.3', '4.4', '4.5']) {
        results.push({
            id: `BB.section.${sub}`,
            name: `BUG_BOUNTY.md §${sub} present`,
            passed: new RegExp(`###\\s*${sub.replace('.', '\\.')}\\s+`).test(content),
            detail: 'Severity sub-section header',
        });
    }

    // §4.1 critical — every T-AN closure that maps to Critical reward.
    for (const t of ['T-AN-1', 'T-AN-2', 'T-AN-6']) {
        results.push({
            id: `BB.critical.${t}`,
            name: `BUG_BOUNTY.md §4.1 enumerates ${t} break as Critical`,
            passed: new RegExp(`${t}\\s+break`).test(content),
            detail: 'Critical band trigger',
        });
    }

    // §4.2 high — replay/freshness/monitoring/cache anchors.
    results.push({
        id: 'BB.high.T-AN-4',
        name: 'BUG_BOUNTY.md §4.2 enumerates T-AN-4 (stale-data) as High',
        passed: /T-AN-4/.test(content),
        detail: 'Freshness band trigger',
    });
    results.push({
        id: 'BB.high.T-AN-7',
        name: 'BUG_BOUNTY.md §4.2 enumerates T-AN-7 (cache poisoning) as High → Critical',
        passed: /T-AN-7/.test(content),
        detail: 'Cache-poisoning band trigger',
    });
    results.push({
        id: 'BB.high.rateLimit',
        name: `BUG_BOUNTY.md §4.2 anchors rate-limit ${RATE_LIMIT_REQUESTS_PER_MINUTE} req/min bypass band`,
        passed: new RegExp(`${RATE_LIMIT_REQUESTS_PER_MINUTE}\\s*req`).test(content),
        detail: 'Rate-limit band',
    });
    results.push({
        id: 'BB.high.indexerLag',
        name: `BUG_BOUNTY.md §4.2 anchors REPLICA_LAG_BUDGET_SECONDS = ${REPLICA_LAG_BUDGET_SECONDS} s`,
        passed: new RegExp(`REPLICA_LAG_BUDGET_SECONDS\\s*=\\s*${REPLICA_LAG_BUDGET_SECONDS}`).test(content),
        detail: 'Replica-lag band',
    });

    // §4.4 medium — Vary drift + ETag drift.
    results.push({
        id: 'BB.medium.Vary',
        name: 'BUG_BOUNTY.md §4.4 catalogues Vary-header drift as Medium',
        passed: /Vary[\s\S]{0,200}Medium/.test(content) || /Vary[\s\S]{0,200}drift/.test(content),
        detail: 'Header-drift Medium band',
    });
    results.push({
        id: 'BB.medium.ETag',
        name: 'BUG_BOUNTY.md §4.4 catalogues ETag drift as Medium',
        passed: /ETag\s+drift/.test(content),
        detail: 'ETag-drift Medium band',
    });

    // §5 — out-of-scope clarifications.
    results.push({
        id: 'BB.oos.rateLimitAbuse',
        name: 'BUG_BOUNTY.md §5 excludes legitimate-merchant rate-limit abuse',
        passed: /[Aa]ccount\s+abuse[\s\S]{0,200}rate\s+limit/.test(content)
            || /rate\s+limit[\s\S]{0,200}not\s+a\s+security/i.test(content),
        detail: 'Out-of-scope rate-limit abuse',
    });
    results.push({
        id: 'BB.oos.preB3',
        name: 'BUG_BOUNTY.md §5 reroutes pre-B3 submissions to B3 intake',
        passed: /[Pp]re-B3/.test(content) || /Pending B3/.test(content),
        detail: 'Out-of-scope pre-B3 routing',
    });

    // §6 reporting & disclosure.
    results.push({
        id: 'BB.disclosure.90days',
        name: 'BUG_BOUNTY.md §6 commits to 90-day coordinated-disclosure window',
        passed: /90\s+days/.test(content) && /disclosure/i.test(content),
        detail: 'Disclosure cadence anchor',
    });

    return results;
}

// ==================== CROSS-DOC REFERENCE CHECK ====================

export interface DocsBundle {
    specification: string | null;
    merchantAnalytics: string | null;
    protocolAnalytics: string | null;
    publicDashboard: string | null;
    privacy: string | null;
    monitoring: string | null;
    endpointHardening: string | null;
    testnetIntegration: string | null;
    bugBounty: string | null;
}

export function checkCrossDocReferences(docs: DocsBundle): CheckResult[] {
    const results: CheckResult[] = [];

    // Every doc that exists must reference SPECIFICATION.md anchor.
    const others = [
        { name: 'MERCHANT_ANALYTICS.md',  content: docs.merchantAnalytics },
        { name: 'PROTOCOL_ANALYTICS.md',  content: docs.protocolAnalytics },
        { name: 'PUBLIC_DASHBOARD.md',    content: docs.publicDashboard },
        { name: 'PRIVACY.md',             content: docs.privacy },
        { name: 'MONITORING.md',          content: docs.monitoring },
        { name: 'ENDPOINT_HARDENING.md',  content: docs.endpointHardening },
        { name: 'TESTNET_INTEGRATION.md', content: docs.testnetIntegration },
        { name: 'BUG_BOUNTY.md',          content: docs.bugBounty },
    ];
    for (const o of others) {
        if (o.content == null) continue;
        results.push({
            id: `XR.spec.${o.name}`,
            name: `${o.name} references SPECIFICATION.md`,
            passed: /SPECIFICATION\.md/.test(o.content),
            detail: 'Spec anchor cross-reference',
        });
    }

    // Every AN-AH-N referenced from a doc must resolve to a row in
    // ENDPOINT_HARDENING.md §3.
    const eh = docs.endpointHardening;
    if (eh != null) {
        for (const ah of AN_AH_ITEMS) {
            for (const o of others) {
                if (o.content == null) continue;
                if (o.name === 'ENDPOINT_HARDENING.md') continue;
                if (!new RegExp(`\\b${ah}\\b`).test(o.content)) continue;
                results.push({
                    id: `XR.AH.${ah}.in.${o.name}`,
                    name: `${o.name} ${ah} reference resolves to ENDPOINT_HARDENING.md §3 heading`,
                    passed: new RegExp(`###\\s+${ah}\\s+—`).test(eh),
                    detail: 'AH cross-doc resolution',
                });
            }
        }
    }

    // Every T-AN-N referenced from any doc must appear bolded in
    // SPECIFICATION.md §7.1.
    const spec = docs.specification;
    if (spec != null) {
        for (const threat of T_AN_THREATS) {
            for (const o of others) {
                if (o.content == null) continue;
                if (!new RegExp(`\\b${threat}\\b`).test(o.content)) continue;
                results.push({
                    id: `XR.T.${threat}.in.${o.name}`,
                    name: `${o.name} ${threat} reference resolves to SPECIFICATION.md §7.1`,
                    passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(spec),
                    detail: 'Threat cross-doc resolution',
                });
            }
        }
    }

    // Every AN-M0X referenced from any doc must appear in MONITORING.md.
    const mo = docs.monitoring;
    if (mo != null) {
        for (const m of AN_M_IDS) {
            for (const o of others) {
                if (o.content == null) continue;
                if (o.name === 'MONITORING.md') continue;
                if (!new RegExp(`\\b${m}\\b`).test(o.content)) continue;
                results.push({
                    id: `XR.M.${m}.in.${o.name}`,
                    name: `${o.name} ${m} reference resolves to MONITORING.md`,
                    passed: new RegExp(`\\*\\*${m}\\*\\*`).test(mo),
                    detail: 'Alert cross-doc resolution',
                });
            }
        }
    }

    // K_ANONYMITY_FLOOR = 5 must be consistent across SPECIFICATION,
    // PRIVACY, MERCHANT_ANALYTICS, PROTOCOL_ANALYTICS (R-AN-AH-2).
    const floorConsistency: { name: string; content: string | null }[] = [
        { name: 'SPECIFICATION.md',       content: docs.specification },
        { name: 'PRIVACY.md',             content: docs.privacy },
        { name: 'MERCHANT_ANALYTICS.md',  content: docs.merchantAnalytics },
        { name: 'PROTOCOL_ANALYTICS.md',  content: docs.protocolAnalytics },
    ];
    for (const f of floorConsistency) {
        if (f.content == null) continue;
        results.push({
            id: `XR.K.${f.name}`,
            name: `${f.name} anchors K_ANONYMITY_FLOOR = ${K_ANONYMITY_FLOOR}`,
            passed: new RegExp(`K_ANONYMITY_FLOOR\\s*=\\s*${K_ANONYMITY_FLOOR}`).test(f.content),
            detail: 'R-AN-AH-2 anchor parity',
        });
    }

    // B3 verdict gate — STATUS.md (if present) records verdict state.
    // Issue #142 is documentation-only (aggregator code lands later);
    // therefore B3 verdict PENDING is acceptable for this PR. The gate
    // becomes ARMED only when adapter-source PRs propose code changes.
    if (existsSync(PATHS.b3Status)) {
        const status = readFileSync(PATHS.b3Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status)
            && !/Gating verdict[^\n]*Pending/.test(status);
        results.push({
            id: 'XR.b3.verdict',
            name: verdictReady
                ? 'B3 STATUS.md records verdict READY (gate ARMED for aggregator-source landings)'
                : 'B3 STATUS.md records verdict PENDING (gate inactive for docs-only issue #142 scope)',
            passed: true,
            detail: 'R-AN-AH-1 of ENDPOINT_HARDENING.md §5 — only enforced when aggregator-source PRs are open',
        });
        if (!verdictReady) {
            results.push({
                id: 'XR.b3.gate-state',
                name: 'B3 gate state: PENDING (documentation-only PRs land; aggregator diffs blocked)',
                passed: true,
                detail: 'Informational — B3 verdict not yet READY; current PR scope is documentation-only',
            });
        }
    } else {
        results.push({
            id: 'XR.b3.verdict',
            name: 'B3 STATUS.md not yet created (gate currently inactive)',
            passed: true,
            detail: 'R-AN-AH-1 inactive until STATUS.md exists',
        });
    }

    // A5 program-brief cross-link — BUG_BOUNTY.md activation depends on
    // the A5 PROGRAM_BRIEF.md page. The validator does not enforce the
    // brief's exact wording; it checks that BUG_BOUNTY.md references
    // PROGRAM_BRIEF.md by path.
    const bb = docs.bugBounty;
    if (bb != null) {
        results.push({
            id: 'XR.bb.a5-brief',
            name: 'BUG_BOUNTY.md cross-references A5 PROGRAM_BRIEF.md',
            passed: /A5-bug-bounty\/PROGRAM_BRIEF\.md/.test(bb),
            detail: 'Program-brief anchor',
        });
    }

    // Error-codes registry parity — docs/error-codes.md must include
    // every ERROR_AN_* code by name once the wiring step lands.
    const errReg = readSafe(PATHS.errorCodes);
    if (errReg != null) {
        for (const code of ERROR_AN_CODES) {
            if (code.value === 0) continue;
            results.push({
                id: `XR.errReg.${code.name}`,
                name: `docs/error-codes.md catalogues ${code.name}`,
                passed: new RegExp(`\\b${code.name}\\b`).test(errReg),
                detail: 'Error-code registry parity',
            });
        }
    } else {
        results.push({
            id: 'XR.errReg.exists',
            name: 'docs/error-codes.md exists',
            passed: false,
            detail: 'Error-code registry must exist for cross-doc parity',
        });
    }

    // Audit-scope cross-link — docs/audit-scope.md must reference
    // docs/analytics/ once the F7 wiring step is complete.
    const auditScope = readSafe(PATHS.auditScope);
    if (auditScope != null) {
        results.push({
            id: 'XR.audit-scope.analytics',
            name: 'docs/audit-scope.md references docs/analytics/ artefacts',
            passed: /docs\/analytics\//.test(auditScope),
            detail: 'Audit scope inclusion',
        });
    }

    // docs/INDEX.md must surface the analytics documents in its F7
    // section. Links inside docs/INDEX.md are relative (e.g.
    // `analytics/SPECIFICATION.md`) because the index itself lives at
    // `docs/INDEX.md`, so we accept either form.
    const docsIndex = readSafe(PATHS.docsIndex);
    if (docsIndex != null) {
        results.push({
            id: 'XR.index.analytics',
            name: 'docs/INDEX.md surfaces docs/analytics/ documents',
            passed: /\]\(analytics\//.test(docsIndex) || /docs\/analytics\//.test(docsIndex),
            detail: 'INDEX wiring',
        });
    }

    return results;
}

// ==================== ORCHESTRATION ====================

export interface ValidationReport {
    results: CheckResult[];
    passed: number;
    failed: number;
    failures: CheckResult[];
}

export function runAllChecks(): ValidationReport {
    const docs: DocsBundle = {
        specification:        readSafe(PATHS.specification),
        merchantAnalytics:    readSafe(PATHS.merchantAnalytics),
        protocolAnalytics:    readSafe(PATHS.protocolAnalytics),
        publicDashboard:      readSafe(PATHS.publicDashboard),
        privacy:              readSafe(PATHS.privacy),
        monitoring:           readSafe(PATHS.monitoring),
        endpointHardening:    readSafe(PATHS.endpointHardening),
        testnetIntegration:   readSafe(PATHS.testnetIntegration),
        bugBounty:            readSafe(PATHS.bugBounty),
    };

    const results = [
        ...checkSpecificationDoc(docs.specification),
        ...checkMerchantAnalyticsDoc(docs.merchantAnalytics),
        ...checkProtocolAnalyticsDoc(docs.protocolAnalytics),
        ...checkPublicDashboardDoc(docs.publicDashboard),
        ...checkPrivacyDoc(docs.privacy),
        ...checkMonitoringDoc(docs.monitoring),
        ...checkEndpointHardeningDoc(docs.endpointHardening),
        ...checkTestnetIntegrationDoc(docs.testnetIntegration),
        ...checkBugBountyDoc(docs.bugBounty),
        ...checkCrossDocReferences(docs),
    ];

    const failures = results.filter((r) => !r.passed);
    return {
        results,
        passed: results.length - failures.length,
        failed: failures.length,
        failures,
    };
}

export function classifyAcceptanceCriterion(id: string): AcceptanceCriterion | undefined {
    return ACCEPTANCE_CRITERIA.find((c) => c.id === id);
}

// ==================== CLI ====================

function cli(argv: string[]): number {
    const args = argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(
            'Usage: ts-node scripts/analytics/check-analytics-readiness.ts [--classify AC-x] [--strict]\n',
        );
        return 0;
    }

    const classifyIdx = args.indexOf('--classify');
    if (classifyIdx >= 0) {
        const id = args[classifyIdx + 1];
        if (!id) {
            process.stderr.write('error: --classify requires an AC id (e.g. AC-4)\n');
            return 1;
        }
        const ac = classifyAcceptanceCriterion(id);
        if (!ac) {
            process.stderr.write(`error: unknown acceptance criterion ${id}\n`);
            return 1;
        }
        process.stdout.write(
            `${ac.id}: ${ac.description}\n  artifact:  ${ac.artifact}\n  evidence:  ${ac.evidenceCheck}\n`,
        );
        return 0;
    }

    const strict = args.includes('--strict');
    const report = runAllChecks();

    for (const r of report.results) {
        const mark = r.passed ? '✓' : '✗';
        process.stdout.write(`${mark} ${r.id}  ${r.name}\n`);
        if (!r.passed) process.stdout.write(`    reason: ${r.detail}\n`);
    }

    process.stdout.write(
        `\n${report.passed}/${report.results.length} checks passed, ${report.failed} failed.\n`,
    );

    if (report.failed > 0 || strict) {
        return report.failed > 0 ? 2 : 0;
    }
    return 0;
}

if (require.main === module) {
    process.exit(cli(process.argv));
}
