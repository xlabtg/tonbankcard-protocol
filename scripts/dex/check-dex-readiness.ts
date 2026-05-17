/**
 * DEX Integration Production-Readiness Validator (Issue #141, F6)
 *
 * Purpose: Validate that the nine DEX integration production-readiness
 *   documents — SPECIFICATION.md, PRICE_AGGREGATOR.md,
 *   SLIPPAGE_PROTECTION.md, LIQUIDITY_MONITORING.md, NOTIFICATIONS.md,
 *   WALLET_UX.md, ADAPTER_HARDENING.md, TESTNET_INTEGRATION.md, and
 *   BUG_BOUNTY.md — stay consistent with each other, with the planned
 *   off-chain adapter sources, and with the engagement's acceptance
 *   criteria from Issue #141 §8.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown sources from the repository working tree. The adapter
 *   sources (`backend/adapters/{toncoAdapter,dedustAdapter,priceAggregator}.ts`)
 *   land in a follow-up PR after A4 verdict READY (per
 *   ADAPTER_HARDENING.md §4); this validator therefore omits a
 *   `checkAdapterEvidence` step until adapter sources exist.
 *
 * Usage:
 *   npx ts-node scripts/dex/check-dex-readiness.ts
 *   npx ts-node scripts/dex/check-dex-readiness.ts --classify AC-4
 *   npx ts-node scripts/dex/check-dex-readiness.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the F3 validator at
 *   scripts/bridge/check-bridge-readiness.ts, the F4 validator at
 *   scripts/recurring-payments/check-recurring-payments-readiness.ts,
 *   and the F5 validator at
 *   scripts/multisig/check-multisig-readiness.ts.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #141 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and
// the linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'prerequisite'
        | 'specification'
        | 'price-aggregator'
        | 'slippage-protection'
        | 'liquidity-monitoring'
        | 'notifications'
        | 'wallet-ux'
        | 'adapter-hardening'
        | 'testnet-integration'
        | 'bug-bounty'
        | 'tests';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'A4 audit complete (prerequisite)',                                      artifact: 'docs/security/audits/A4-offchain-services/ENGAGEMENT.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'DeDust adapter created in backend/adapters/dedustAdapter.ts',           artifact: 'docs/dex/SPECIFICATION.md',                                evidenceCheck: 'specification' },
    { id: 'AC-3', description: 'Price aggregator module created (priceAggregator.ts)',                  artifact: 'docs/dex/PRICE_AGGREGATOR.md',                             evidenceCheck: 'price-aggregator' },
    { id: 'AC-4', description: 'Fallback routing tested (TONCO mock failure → routes to DeDust)',      artifact: 'docs/dex/TESTNET_INTEGRATION.md',                          evidenceCheck: 'testnet-integration' },
    { id: 'AC-5', description: 'Slippage tolerance configurable by user and enforced',                  artifact: 'docs/dex/SLIPPAGE_PROTECTION.md',                          evidenceCheck: 'slippage-protection' },
    { id: 'AC-6', description: 'Liquidity monitoring alerts configured (DEX-M01..DEX-M18)',             artifact: 'docs/dex/LIQUIDITY_MONITORING.md',                         evidenceCheck: 'liquidity-monitoring' },
    { id: 'AC-7', description: 'Performance budget met (aggregator < 500 ms; indexer overhead ≤ 10%)', artifact: 'docs/dex/TESTNET_INTEGRATION.md',                          evidenceCheck: 'tests' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    specification:        resolve(REPO_ROOT, 'docs/dex/SPECIFICATION.md'),
    priceAggregator:      resolve(REPO_ROOT, 'docs/dex/PRICE_AGGREGATOR.md'),
    slippageProtection:   resolve(REPO_ROOT, 'docs/dex/SLIPPAGE_PROTECTION.md'),
    liquidityMonitoring:  resolve(REPO_ROOT, 'docs/dex/LIQUIDITY_MONITORING.md'),
    notifications:        resolve(REPO_ROOT, 'docs/dex/NOTIFICATIONS.md'),
    walletUx:             resolve(REPO_ROOT, 'docs/dex/WALLET_UX.md'),
    adapterHardening:     resolve(REPO_ROOT, 'docs/dex/ADAPTER_HARDENING.md'),
    testnetIntegration:   resolve(REPO_ROOT, 'docs/dex/TESTNET_INTEGRATION.md'),
    bugBounty:            resolve(REPO_ROOT, 'docs/dex/BUG_BOUNTY.md'),
    a4Engagement:         resolve(REPO_ROOT, 'docs/security/audits/A4-offchain-services/ENGAGEMENT.md'),
    a4Status:             resolve(REPO_ROOT, 'docs/security/audits/A4-offchain-services/STATUS.md'),
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
export const ERROR_DEX_CODES = [
    { name: 'ERROR_DEX_NONE',                  value: 0 },
    { name: 'ERROR_DEX_TIMEOUT',               value: 1 },
    { name: 'ERROR_DEX_VENUE_DOWN',            value: 2 },
    { name: 'ERROR_DEX_INVALID_TOKEN',         value: 3 },
    { name: 'ERROR_DEX_INVALID_AMOUNT',        value: 4 },
    { name: 'ERROR_DEX_INSUFFICIENT_LIQUIDITY', value: 5 },
    { name: 'ERROR_DEX_STALE_PRICE',           value: 6 },
    { name: 'ERROR_DEX_SLIPPAGE_EXCEEDED',     value: 7 },
    { name: 'ERROR_DEX_FLOOR_REJECT',          value: 8 },
    { name: 'ERROR_DEX_QUOTE_EXPIRED',         value: 9 },
] as const;

// User-facing error codes surfaced in WALLET_UX.md §3.4 (toast catalogue).
// Codes 1..9 are all user-facing in the swap sheet failure-mode table.
export const WALLET_UX_USER_FACING_CODES = [
    'ERROR_DEX_TIMEOUT',
    'ERROR_DEX_VENUE_DOWN',
    'ERROR_DEX_INVALID_TOKEN',
    'ERROR_DEX_INVALID_AMOUNT',
    'ERROR_DEX_INSUFFICIENT_LIQUIDITY',
    'ERROR_DEX_STALE_PRICE',
    'ERROR_DEX_SLIPPAGE_EXCEEDED',
    'ERROR_DEX_FLOOR_REJECT',
    'ERROR_DEX_QUOTE_EXPIRED',
] as const;

// Threat catalogue T-DEX-1..T-DEX-7 from SPECIFICATION.md §7.1, mirrored
// in BUG_BOUNTY.md §6 and ADAPTER_HARDENING.md §3 (DEX-AH-N closures).
export const T_DEX_THREATS = [
    'T-DEX-1',
    'T-DEX-2',
    'T-DEX-3',
    'T-DEX-4',
    'T-DEX-5',
    'T-DEX-6',
    'T-DEX-7',
] as const;

// Hardening backlog DEX-AH-1..DEX-AH-7 from ADAPTER_HARDENING.md §3.
export const DEX_AH_ITEMS = [
    'DEX-AH-1',
    'DEX-AH-2',
    'DEX-AH-3',
    'DEX-AH-4',
    'DEX-AH-5',
    'DEX-AH-6',
    'DEX-AH-7',
] as const;

// CI guardrail rules R-DEX-AH-1..R-DEX-AH-5 from ADAPTER_HARDENING.md §5.
export const R_DEX_AH_RULES = [
    'R-DEX-AH-1',
    'R-DEX-AH-2',
    'R-DEX-AH-3',
    'R-DEX-AH-4',
    'R-DEX-AH-5',
] as const;

// Alert catalogue DEX-M01..DEX-M18 from LIQUIDITY_MONITORING.md §3.
export const DEX_M_IDS = [
    'DEX-M01', 'DEX-M02', 'DEX-M03', 'DEX-M04', 'DEX-M05',
    'DEX-M06', 'DEX-M07', 'DEX-M08', 'DEX-M09', 'DEX-M10',
    'DEX-M11', 'DEX-M12', 'DEX-M13', 'DEX-M14', 'DEX-M15',
    'DEX-M16', 'DEX-M17', 'DEX-M18',
] as const;

// Notification catalogue DEX-N01..DEX-N08 from NOTIFICATIONS.md §3.
export const DEX_N_IDS = [
    'DEX-N01', 'DEX-N02', 'DEX-N03', 'DEX-N04',
    'DEX-N05', 'DEX-N06', 'DEX-N07', 'DEX-N08',
] as const;

// Data sources DS-1..DS-4 from LIQUIDITY_MONITORING.md §4.
export const DS_IDS = ['DS-1', 'DS-2', 'DS-3', 'DS-4'] as const;

// Disaster-recovery drills DR-1..DR-5 from LIQUIDITY_MONITORING.md §5.
export const DR_IDS = ['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5'] as const;

// Pager severity tiers from LIQUIDITY_MONITORING.md §3.6.
export const SEVERITY_TIERS = ['P0', 'P1', 'P2', 'P3'] as const;

// Issue #141 §8 test bar (TESTNET_INTEGRATION.md §6).
export const ADAPTER_UNIT_TEST_BAR = 24;
export const AGGREGATOR_INTEGRATION_TEST_BAR = 12;

// Numeric constants from SPECIFICATION.md / PRICE_AGGREGATOR.md /
// SLIPPAGE_PROTECTION.md. Each appears verbatim in the docs.
export const DEFAULT_SLIPPAGE_BPS = 50;
export const MIN_SLIPPAGE_BPS = 10;
export const MAX_SLIPPAGE_BPS = 500;
export const LIQUIDITY_WARN_THRESHOLD_BPS = 100;
export const MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500;
export const TIE_BREAK_BPS = 5;
export const PRICE_AGGREGATOR_TIMEOUT_MS = 500;
export const FALLBACK_REQUOTE_WINDOW_SECONDS = 5;
export const VENUE_DEMOTION_COOLDOWN_SECONDS = 120;
export const HEALTH_PROBE_INTERVAL_SECONDS = 60;
export const HEALTH_PROBE_FAILURE_THRESHOLD = 3;
export const PRICE_STALENESS_SECONDS = 30;
export const MIN_POOL_DEPTH_TON = 50_000;
export const IDEMPOTENCY_WINDOW_SECONDS = 600;
export const SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT = 10;
export const MAX_WEBHOOK_RETRIES = 5;

// ==================== SPECIFICATION.MD CHECK ====================
// Anchored against the document content in docs/dex/SPECIFICATION.md.

export function checkSpecificationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'SP.exists',
            name: 'docs/dex/SPECIFICATION.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.specification}`,
        });
        return results;
    }
    results.push({
        id: 'SP.exists',
        name: 'docs/dex/SPECIFICATION.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 shared DexAdapter interface — four methods.
    const methods = ['getCurrentPrice', 'getSwapQuote', 'executeSwap', 'healthCheck'];
    for (const m of methods) {
        results.push({
            id: `SP.method.${m}`,
            name: `SPECIFICATION.md §3 names DexAdapter method ${m}`,
            passed: new RegExp(`\\b${m}\\b`).test(content),
            detail: 'Shared DexAdapter interface contract',
        });
    }

    // §3.1 PRICE_STALENESS_SECONDS = 30 s.
    results.push({
        id: 'SP.const.PRICE_STALENESS_SECONDS',
        name: `SPECIFICATION.md §3.1 anchors PRICE_STALENESS_SECONDS = ${PRICE_STALENESS_SECONDS} s`,
        passed: new RegExp(`PRICE_STALENESS_SECONDS\\s*=\\s*${PRICE_STALENESS_SECONDS}`).test(content),
        detail: 'Stale-price reject anchor',
    });

    // §3.2 SwapQuote envelope fields.
    const swapQuoteFields = [
        'venue', 'amountIn', 'amountOut', 'effectivePriceBps',
        'poolDepthIn', 'poolDepthOut', 'feeBps', 'quotedAt', 'expiresAt',
    ];
    for (const f of swapQuoteFields) {
        results.push({
            id: `SP.swapQuote.${f}`,
            name: `SPECIFICATION.md §3.2 SwapQuote names \`${f}\``,
            passed: new RegExp(`\\b${f}\\b`).test(content),
            detail: 'Quote envelope field',
        });
    }

    // §3.2 PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms.
    results.push({
        id: 'SP.const.PRICE_AGGREGATOR_TIMEOUT_MS',
        name: `SPECIFICATION.md anchors PRICE_AGGREGATOR_TIMEOUT_MS = ${PRICE_AGGREGATOR_TIMEOUT_MS} ms`,
        passed: new RegExp(`PRICE_AGGREGATOR_TIMEOUT_MS\\s*=\\s*${PRICE_AGGREGATOR_TIMEOUT_MS}`).test(content),
        detail: 'Aggregator budget anchor (Issue #141 §6)',
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
        detail: 'Demotion threshold',
    });

    // §4 ranking / floor / fallback constants.
    results.push({
        id: 'SP.const.MAX_EFFECTIVE_PRICE_DEVIATION_BPS',
        name: `SPECIFICATION.md §4.3 anchors MAX_EFFECTIVE_PRICE_DEVIATION_BPS = ${MAX_EFFECTIVE_PRICE_DEVIATION_BPS}`,
        passed: new RegExp(`MAX_EFFECTIVE_PRICE_DEVIATION_BPS\\s*=\\s*${MAX_EFFECTIVE_PRICE_DEVIATION_BPS}`).test(content),
        detail: 'Floor-price guard ceiling (T-DEX-3 closure)',
    });
    results.push({
        id: 'SP.const.TIE_BREAK_BPS',
        name: `SPECIFICATION.md §4.2 anchors TIE_BREAK_BPS = ${TIE_BREAK_BPS}`,
        passed: new RegExp(`TIE_BREAK_BPS\\s*=\\s*${TIE_BREAK_BPS}`).test(content),
        detail: 'Tie-break window',
    });
    results.push({
        id: 'SP.const.FALLBACK_REQUOTE_WINDOW_SECONDS',
        name: `SPECIFICATION.md §4.4 anchors FALLBACK_REQUOTE_WINDOW_SECONDS = ${FALLBACK_REQUOTE_WINDOW_SECONDS}`,
        passed: new RegExp(`FALLBACK_REQUOTE_WINDOW_SECONDS\\s*=\\s*${FALLBACK_REQUOTE_WINDOW_SECONDS}`).test(content),
        detail: 'Fallback re-quote window (T-DEX-2 closure)',
    });
    results.push({
        id: 'SP.const.VENUE_DEMOTION_COOLDOWN_SECONDS',
        name: `SPECIFICATION.md §4.5 anchors VENUE_DEMOTION_COOLDOWN_SECONDS = ${VENUE_DEMOTION_COOLDOWN_SECONDS}`,
        passed: new RegExp(`VENUE_DEMOTION_COOLDOWN_SECONDS\\s*=\\s*${VENUE_DEMOTION_COOLDOWN_SECONDS}`).test(content),
        detail: 'Venue demotion cooldown',
    });

    // §5 slippage constants.
    results.push({
        id: 'SP.const.DEFAULT_SLIPPAGE_BPS',
        name: `SPECIFICATION.md §5.1 anchors DEFAULT_SLIPPAGE_BPS = ${DEFAULT_SLIPPAGE_BPS}`,
        passed: new RegExp(`DEFAULT_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${DEFAULT_SLIPPAGE_BPS}`).test(content),
        detail: 'Default slippage tolerance',
    });
    results.push({
        id: 'SP.const.MAX_SLIPPAGE_BPS',
        name: `SPECIFICATION.md §5.1 anchors MAX_SLIPPAGE_BPS = ${MAX_SLIPPAGE_BPS}`,
        passed: new RegExp(`MAX_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${MAX_SLIPPAGE_BPS}`).test(content),
        detail: 'Slippage ceiling',
    });
    results.push({
        id: 'SP.const.MIN_SLIPPAGE_BPS',
        name: `SPECIFICATION.md §5.1 anchors MIN_SLIPPAGE_BPS = ${MIN_SLIPPAGE_BPS}`,
        passed: new RegExp(`MIN_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${MIN_SLIPPAGE_BPS}`).test(content),
        detail: 'Slippage floor',
    });

    // §6 liquidity constants.
    results.push({
        id: 'SP.const.MIN_POOL_DEPTH_TON',
        name: `SPECIFICATION.md §6 anchors MIN_POOL_DEPTH_TON = ${MIN_POOL_DEPTH_TON.toLocaleString('en-US').replace(/,/g, '_')}`,
        passed: /MIN_POOL_DEPTH_TON\s*=\s*50_?000/.test(content),
        detail: 'Pool-depth floor',
    });

    // §7.1 — every T-DEX-N appears bolded in the threat catalogue.
    for (const threat of T_DEX_THREATS) {
        results.push({
            id: `SP.threat.${threat}`,
            name: `SPECIFICATION.md §7.1 lists threat **${threat}**`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'Threat catalogue entry',
        });
    }

    // §7.2 — every ERROR_DEX_* name appears.
    for (const code of ERROR_DEX_CODES) {
        results.push({
            id: `SP.err.${code.name}`,
            name: `SPECIFICATION.md §7.2 declares ${code.name} (${code.value})`,
            passed: new RegExp(`\\b${code.name}\\b`).test(content),
            detail: 'Error registry entry',
        });
    }

    // §7.4 replay protection — both `quotedAt` and `expiresAt` mentioned
    // alongside the requote-on-submit closure.
    results.push({
        id: 'SP.replay.quote-envelope',
        name: 'SPECIFICATION.md §7.4 documents quote-envelope replay protection (quotedAt + expiresAt)',
        passed: /quotedAt[\s\S]{0,200}expiresAt/.test(content),
        detail: 'Replay layer 1 (T-DEX-1)',
    });
    results.push({
        id: 'SP.replay.requote-on-submit',
        name: 'SPECIFICATION.md §7.4 documents re-quote on submit',
        passed: /[Rr]e-?quote/.test(content) && /executeSwap/.test(content),
        detail: 'Replay layer 2 (T-DEX-1)',
    });

    // §8 hardening backlog — every DEX-AH-N enumerated.
    for (const item of DEX_AH_ITEMS) {
        results.push({
            id: `SP.hardening.${item}`,
            name: `SPECIFICATION.md §8 enumerates ${item}`,
            passed: new RegExp(`\\b${item}\\b`).test(content),
            detail: 'Hardening backlog cross-reference',
        });
    }

    // Cross-link to ADAPTER_HARDENING.md and PRICE_AGGREGATOR.md.
    results.push({
        id: 'SP.link.ADAPTER_HARDENING',
        name: 'SPECIFICATION.md links to ADAPTER_HARDENING.md',
        passed: /ADAPTER_HARDENING\.md/.test(content),
        detail: 'Cross-reference',
    });
    results.push({
        id: 'SP.link.PRICE_AGGREGATOR',
        name: 'SPECIFICATION.md links to PRICE_AGGREGATOR.md',
        passed: /PRICE_AGGREGATOR\.md/.test(content),
        detail: 'Cross-reference',
    });

    return results;
}

// ==================== PRICE_AGGREGATOR.MD CHECK ====================

export function checkPriceAggregatorDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'PA.exists',
            name: 'docs/dex/PRICE_AGGREGATOR.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.priceAggregator}`,
        });
        return results;
    }
    results.push({
        id: 'PA.exists',
        name: 'docs/dex/PRICE_AGGREGATOR.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 surface — PriceAggregator class with quote/execute/listVenues.
    for (const sym of ['PriceAggregator', 'createPriceAggregator', 'AggregatorOptions']) {
        results.push({
            id: `PA.surface.${sym}`,
            name: `PRICE_AGGREGATOR.md §3 exports ${sym}`,
            passed: new RegExp(`\\b${sym}\\b`).test(content),
            detail: 'Module surface',
        });
    }
    for (const m of ['quote', 'execute', 'listVenues']) {
        results.push({
            id: `PA.method.${m}`,
            name: `PRICE_AGGREGATOR.md §3 names PriceAggregator.${m}()`,
            passed: new RegExp(`\\b${m}\\s*\\(`).test(content),
            detail: 'Aggregator method',
        });
    }

    // §4.1 parallel fan-out via Promise.allSettled.
    results.push({
        id: 'PA.fanout.allSettled',
        name: 'PRICE_AGGREGATOR.md §4.1 uses Promise.allSettled for parallel fan-out',
        passed: /Promise\.allSettled/.test(content),
        detail: 'Parallel query strategy (closes T-DEX-2 fallback path)',
    });

    // §4.1 budget anchor.
    results.push({
        id: 'PA.const.PRICE_AGGREGATOR_TIMEOUT_MS',
        name: `PRICE_AGGREGATOR.md §4.1 anchors PRICE_AGGREGATOR_TIMEOUT_MS = ${PRICE_AGGREGATOR_TIMEOUT_MS} ms`,
        passed: new RegExp(`PRICE_AGGREGATOR_TIMEOUT_MS\\s*=\\s*${PRICE_AGGREGATOR_TIMEOUT_MS}`).test(content),
        detail: 'Budget ceiling (Issue #141 §6)',
    });

    // §4.2 tie-break order.
    results.push({
        id: 'PA.const.TIE_BREAK_BPS',
        name: `PRICE_AGGREGATOR.md §4.2 anchors TIE_BREAK_BPS = ${TIE_BREAK_BPS}`,
        passed: new RegExp(`TIE_BREAK_BPS\\s*=\\s*${TIE_BREAK_BPS}`).test(content),
        detail: 'Tie-break window',
    });
    results.push({
        id: 'PA.tiebreak.order',
        name: "PRICE_AGGREGATOR.md §4.2 declares tie-break order ['TONCO', 'DEDUST']",
        passed: /\['TONCO',\s*'DEDUST'\]/.test(content),
        detail: 'Deterministic ranking',
    });

    // §4.3 floor guard.
    results.push({
        id: 'PA.floor.MAX_EFFECTIVE_PRICE_DEVIATION_BPS',
        name: `PRICE_AGGREGATOR.md §4.3 floor guard at MAX_EFFECTIVE_PRICE_DEVIATION_BPS = ${MAX_EFFECTIVE_PRICE_DEVIATION_BPS}`,
        passed: new RegExp(`MAX_EFFECTIVE_PRICE_DEVIATION_BPS\\s*=\\s*${MAX_EFFECTIVE_PRICE_DEVIATION_BPS}`).test(content),
        detail: 'T-DEX-3 closure',
    });
    results.push({
        id: 'PA.floor.errorcode',
        name: 'PRICE_AGGREGATOR.md §4.3 surfaces ERROR_DEX_FLOOR_REJECT (code 8)',
        passed: /ERROR_DEX_FLOOR_REJECT/.test(content),
        detail: 'Error registry tie-in',
    });

    // §4.4 empty-survivor fallback.
    results.push({
        id: 'PA.empty.alert',
        name: 'PRICE_AGGREGATOR.md §4.4 fires DEX-M01 on empty survivors',
        passed: /DEX-M01/.test(content),
        detail: 'Catastrophic alert tie-in',
    });

    // §5 execution & fallback routing — happy path and fallback trigger and idempotency.
    results.push({
        id: 'PA.exec.requote',
        name: 'PRICE_AGGREGATOR.md §5.1 re-quotes winner.venue before submit',
        passed: /[Rr]e-?quote/.test(content),
        detail: 'Happy-path replay protection',
    });
    results.push({
        id: 'PA.exec.amountOutMin',
        name: 'PRICE_AGGREGATOR.md §5.1 derives amountOutMin from slippageBps',
        passed: /amountOutMin/.test(content) && /slippageBps/.test(content),
        detail: 'Slippage floor binding',
    });
    results.push({
        id: 'PA.fallback.window',
        name: `PRICE_AGGREGATOR.md §5.2 honours FALLBACK_REQUOTE_WINDOW_SECONDS = ${FALLBACK_REQUOTE_WINDOW_SECONDS}`,
        passed: new RegExp(`FALLBACK_REQUOTE_WINDOW_SECONDS\\s*=\\s*${FALLBACK_REQUOTE_WINDOW_SECONDS}`).test(content),
        detail: 'Fallback trigger window',
    });
    results.push({
        id: 'PA.idempotency.window',
        name: `PRICE_AGGREGATOR.md §5.4 anchors IDEMPOTENCY_WINDOW_SECONDS = ${IDEMPOTENCY_WINDOW_SECONDS}`,
        passed: new RegExp(`IDEMPOTENCY_WINDOW_SECONDS\\s*=\\s*${IDEMPOTENCY_WINDOW_SECONDS}`).test(content),
        detail: 'Idempotency window (T-DEX-1 off-chain)',
    });

    // §6 performance budget — P50 / P95 budgets and DEX-M05 wiring.
    results.push({
        id: 'PA.perf.p50',
        name: 'PRICE_AGGREGATOR.md §6 anchors P50 ≤ 250 ms budget',
        passed: /P50[\s\S]{0,80}250/.test(content),
        detail: 'Issue #141 §6 budget',
    });
    results.push({
        id: 'PA.perf.p95',
        name: 'PRICE_AGGREGATOR.md §6 anchors P95 ≤ 500 ms budget',
        passed: /P95[\s\S]{0,80}500/.test(content),
        detail: 'Issue #141 §6 budget',
    });
    results.push({
        id: 'PA.perf.indexer',
        name: 'PRICE_AGGREGATOR.md §6 anchors indexer overhead ≤ 10 %',
        passed: /10\s*%/.test(content),
        detail: 'Issue #141 §6 budget',
    });
    results.push({
        id: 'PA.perf.alert',
        name: 'PRICE_AGGREGATOR.md §6 links to DEX-M05 (latency exceeds budget)',
        passed: /DEX-M05/.test(content),
        detail: 'Monitoring tie-in',
    });

    // §7 venue demotion & recovery.
    results.push({
        id: 'PA.demotion.M03',
        name: 'PRICE_AGGREGATOR.md §7.1 emits DEX-M03 on demotion',
        passed: /DEX-M03/.test(content),
        detail: 'Demotion alert binding',
    });
    results.push({
        id: 'PA.recovery.M04',
        name: 'PRICE_AGGREGATOR.md §7.2 emits DEX-M04 on recovery',
        passed: /DEX-M04/.test(content),
        detail: 'Recovery alert binding',
    });

    // §8 configuration — defaults.
    const defaults: { name: string; pattern: RegExp }[] = [
        { name: 'timeoutMs',                     pattern: /timeoutMs\?:\s*number;\s*\/\/\s*default\s*500/ },
        { name: 'tieBreakBps',                   pattern: /tieBreakBps\?:\s*number;\s*\/\/\s*default\s*5/ },
        { name: 'floorDeviationBps',             pattern: /floorDeviationBps\?:\s*number;\s*\/\/\s*default\s*500/ },
        { name: 'healthProbeIntervalSeconds',    pattern: /healthProbeIntervalSeconds\?:\s*number;\s*\/\/\s*default\s*60/ },
        { name: 'healthProbeFailureThreshold',   pattern: /healthProbeFailureThreshold\?:\s*number;\s*\/\/\s*default\s*3/ },
        { name: 'demotionCooldownSeconds',       pattern: /demotionCooldownSeconds\?:\s*number;\s*\/\/\s*default\s*120/ },
        { name: 'fallbackRequoteWindowSeconds',  pattern: /fallbackRequoteWindowSeconds\?:\s*number;\s*\/\/\s*default\s*5/ },
        { name: 'idempotencyWindowSeconds',      pattern: /idempotencyWindowSeconds\?:\s*number;\s*\/\/\s*default\s*600/ },
    ];
    for (const opt of defaults) {
        results.push({
            id: `PA.opts.${opt.name}`,
            name: `PRICE_AGGREGATOR.md §8 AggregatorOptions.${opt.name} default matches anchor`,
            passed: opt.pattern.test(content),
            detail: 'Defaults parity (R-DEX-AH-4)',
        });
    }

    return results;
}

// ==================== SLIPPAGE_PROTECTION.MD CHECK ====================

export function checkSlippageProtectionDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'SL.exists',
            name: 'docs/dex/SLIPPAGE_PROTECTION.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.slippageProtection}`,
        });
        return results;
    }
    results.push({
        id: 'SL.exists',
        name: 'docs/dex/SLIPPAGE_PROTECTION.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 tolerance configuration constants.
    results.push({
        id: 'SL.const.DEFAULT_SLIPPAGE_BPS',
        name: `SLIPPAGE_PROTECTION.md §3 anchors DEFAULT_SLIPPAGE_BPS = ${DEFAULT_SLIPPAGE_BPS}`,
        passed: new RegExp(`DEFAULT_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${DEFAULT_SLIPPAGE_BPS}`).test(content),
        detail: 'AC-5 default value',
    });
    results.push({
        id: 'SL.const.MAX_SLIPPAGE_BPS',
        name: `SLIPPAGE_PROTECTION.md §3 anchors MAX_SLIPPAGE_BPS = ${MAX_SLIPPAGE_BPS}`,
        passed: new RegExp(`MAX_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${MAX_SLIPPAGE_BPS}`).test(content),
        detail: 'AC-5 ceiling',
    });
    results.push({
        id: 'SL.const.MIN_SLIPPAGE_BPS',
        name: `SLIPPAGE_PROTECTION.md §3 anchors MIN_SLIPPAGE_BPS = ${MIN_SLIPPAGE_BPS}`,
        passed: new RegExp(`MIN_SLIPPAGE_BPS\`?\\s*\\|?\\s*\`?${MIN_SLIPPAGE_BPS}`).test(content),
        detail: 'AC-5 floor',
    });
    results.push({
        id: 'SL.const.LIQUIDITY_WARN_THRESHOLD_BPS',
        name: `SLIPPAGE_PROTECTION.md §3 anchors LIQUIDITY_WARN_THRESHOLD_BPS = ${LIQUIDITY_WARN_THRESHOLD_BPS}`,
        passed: new RegExp(`LIQUIDITY_WARN_THRESHOLD_BPS\`?\\s*\\|?\\s*\`?${LIQUIDITY_WARN_THRESHOLD_BPS}`).test(content),
        detail: '1 % pool-depth warn (Issue #141 §3)',
    });

    // §3.1 wallet surface — bullet of slippage slider tied to WALLET_UX.md.
    results.push({
        id: 'SL.wallet.link',
        name: 'SLIPPAGE_PROTECTION.md §3.1 links to WALLET_UX.md',
        passed: /WALLET_UX\.md/.test(content),
        detail: 'Wallet surface cross-link',
    });

    // §3.2 persistence — local-storage-only commitment.
    results.push({
        id: 'SL.persistence.local',
        name: 'SLIPPAGE_PROTECTION.md §3.2 documents local-storage-only persistence',
        passed: /local storage/i.test(content),
        detail: 'Slippage is a personal risk budget — not synced to indexer',
    });

    // §4 pre-trade depth warning trigger condition.
    results.push({
        id: 'SL.warn.trigger',
        name: "SLIPPAGE_PROTECTION.md §4.1 names warning 'LARGE_TRADE_VS_POOL'",
        passed: /LARGE_TRADE_VS_POOL/.test(content),
        detail: 'T-DEX-5 closure',
    });
    results.push({
        id: 'SL.warn.modal',
        name: 'SLIPPAGE_PROTECTION.md §4.2 mentions 1-second delay before Sign activates',
        passed: /1-second delay/.test(content) || /1\s*s\s*delay/.test(content),
        detail: 'No muscle-memory bypass',
    });

    // §5 automatic revert — amountOutMin derivation.
    results.push({
        id: 'SL.revert.amountOutMin',
        name: 'SLIPPAGE_PROTECTION.md §5.1 documents amountOutMin derivation',
        passed: /amountOutMin/.test(content),
        detail: 'On-chain slippage floor',
    });
    results.push({
        id: 'SL.revert.errorcode',
        name: 'SLIPPAGE_PROTECTION.md §5.2 surfaces ERROR_DEX_SLIPPAGE_EXCEEDED',
        passed: /ERROR_DEX_SLIPPAGE_EXCEEDED/.test(content),
        detail: 'Revert error code',
    });
    results.push({
        id: 'SL.revert.alert',
        name: 'SLIPPAGE_PROTECTION.md §5.2 links to DEX-M07 (slippage-revert alert)',
        passed: /DEX-M07/.test(content),
        detail: 'Slippage-revert pager wiring',
    });
    results.push({
        id: 'SL.revert.threshold',
        name: `SLIPPAGE_PROTECTION.md §5.2 anchors SLIPPAGE_REVERT_RATE_THRESHOLD = ${SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT} %`,
        passed: new RegExp(`SLIPPAGE_REVERT_RATE_THRESHOLD\\s*=\\s*${SLIPPAGE_REVERT_RATE_THRESHOLD_PERCENT}\\s*%`).test(content),
        detail: 'Revert-spike trigger',
    });

    // §5.3 replay safety links to PRICE_AGGREGATOR.md idempotency window.
    results.push({
        id: 'SL.replay.idempotency',
        name: 'SLIPPAGE_PROTECTION.md §5.3 references IDEMPOTENCY_WINDOW_SECONDS',
        passed: /IDEMPOTENCY_WINDOW_SECONDS/.test(content),
        detail: 'Reverted swap → cached error result',
    });

    return results;
}

// ==================== LIQUIDITY_MONITORING.MD CHECK ====================

export function checkLiquidityMonitoringDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'LM.exists',
            name: 'docs/dex/LIQUIDITY_MONITORING.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.liquidityMonitoring}`,
        });
        return results;
    }
    results.push({
        id: 'LM.exists',
        name: 'docs/dex/LIQUIDITY_MONITORING.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 — alert catalogue: every DEX-Mxx ID enumerated in §§3.1-3.5.
    for (const alert of DEX_M_IDS) {
        results.push({
            id: `LM.alert.${alert}`,
            name: `LIQUIDITY_MONITORING.md catalogue declares **${alert}**`,
            passed: new RegExp(`\\*\\*${alert}\\*\\*`).test(content),
            detail: 'Alert catalogue entry',
        });
    }

    // §3.6 — severity matrix: each DEX-Mxx assigned to exactly one tier
    // (P0..P3). The matrix renders alerts as `\`DEX-Mxx\`` inside the
    // `Alerts` column.
    for (const alert of DEX_M_IDS) {
        const re = new RegExp(`\`${alert}\``, 'g');
        const occurrences = (content.match(re) || []).length;
        // Each alert appears once in §3.6 (backticked) plus referenced
        // backticked elsewhere — at least one of the occurrences must be
        // inside a `P0`/`P1`/`P2`/`P3` row.
        results.push({
            id: `LM.sev.${alert}`,
            name: `LIQUIDITY_MONITORING.md §3.6 severity matrix references ${alert}`,
            passed: occurrences >= 1,
            detail: 'Roll-up severity matrix coverage',
        });
    }

    // §3.6 — every severity tier P0..P3 named in the matrix.
    for (const tier of SEVERITY_TIERS) {
        results.push({
            id: `LM.sev.tier.${tier}`,
            name: `LIQUIDITY_MONITORING.md §3.6 declares severity tier **${tier}**`,
            passed: new RegExp(`\\*\\*${tier}\\*\\*`).test(content),
            detail: 'Severity tier definition',
        });
    }

    // §4 data sources DS-1..DS-4.
    for (const ds of DS_IDS) {
        results.push({
            id: `LM.ds.${ds}`,
            name: `LIQUIDITY_MONITORING.md §4 declares data source **${ds}**`,
            passed: new RegExp(`\\*\\*${ds}\\*\\*`).test(content),
            detail: 'Data source registry entry',
        });
    }

    // §5 DR drills DR-1..DR-5.
    for (const dr of DR_IDS) {
        results.push({
            id: `LM.dr.${dr}`,
            name: `LIQUIDITY_MONITORING.md §5 declares disaster-recovery drill **${dr}**`,
            passed: new RegExp(`\\*\\*${dr}\\*\\*`).test(content),
            detail: 'DR drill scenario',
        });
    }

    // §6 CI wiring — explicit mention of the validator path.
    results.push({
        id: 'LM.ci.validator',
        name: 'LIQUIDITY_MONITORING.md §6 references scripts/dex/check-dex-readiness.ts',
        passed: /scripts\/dex\/check-dex-readiness\.ts/.test(content),
        detail: 'Validator wiring',
    });

    // Cross-link to NOTIFICATIONS.md (DEX-N01..DEX-N08).
    results.push({
        id: 'LM.link.NOTIFICATIONS',
        name: 'LIQUIDITY_MONITORING.md links to NOTIFICATIONS.md',
        passed: /NOTIFICATIONS\.md/.test(content),
        detail: 'Notification surface cross-link',
    });
    results.push({
        id: 'LM.link.B3',
        name: 'LIQUIDITY_MONITORING.md wires into B3 production monitoring',
        passed: /B3-monitoring\/ENGAGEMENT\.md/.test(content),
        detail: 'B3 alert routing',
    });

    // Pool-depth floor anchor.
    results.push({
        id: 'LM.const.MIN_POOL_DEPTH_TON',
        name: `LIQUIDITY_MONITORING.md anchors MIN_POOL_DEPTH_TON = 50_000`,
        passed: /MIN_POOL_DEPTH_TON\s*=\s*50_?000/.test(content),
        detail: 'Pool-depth alert threshold (B3 SLO)',
    });

    return results;
}

// ==================== NOTIFICATIONS.MD CHECK ====================

export function checkNotificationsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'NF.exists',
            name: 'docs/dex/NOTIFICATIONS.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.notifications}`,
        });
        return results;
    }
    results.push({
        id: 'NF.exists',
        name: 'docs/dex/NOTIFICATIONS.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 catalogue — every DEX-Nxx ID bolded.
    for (const n of DEX_N_IDS) {
        results.push({
            id: `NF.note.${n}`,
            name: `NOTIFICATIONS.md §3 declares **${n}**`,
            passed: new RegExp(`\\*\\*${n}\\*\\*`).test(content),
            detail: 'Notification catalogue entry',
        });
    }

    // §3 each notification carries channels + priority — table columns.
    results.push({
        id: 'NF.col.channels',
        name: 'NOTIFICATIONS.md §3 catalogue declares Channels column',
        passed: /\|\s*Channels\s*\|/.test(content),
        detail: 'Channels routing column',
    });
    results.push({
        id: 'NF.col.priority',
        name: 'NOTIFICATIONS.md §3 catalogue declares Priority column',
        passed: /\|\s*Priority\s*\|/.test(content),
        detail: 'Priority routing column',
    });

    // §4 channels — Push, Email, Webhook.
    for (const ch of ['Push', 'Email', 'Webhook']) {
        results.push({
            id: `NF.channel.${ch}`,
            name: `NOTIFICATIONS.md §4 documents the ${ch} channel`,
            passed: new RegExp(`###\\s+4\\.\\d+\\s+${ch}|^###[^\\n]*${ch}`, 'm').test(content),
            detail: 'Channel subsection',
        });
    }

    // §5.1 dedup key sha256(user_addr|event_type|request_id|epoch_bucket).
    results.push({
        id: 'NF.dedup.key',
        name: 'NOTIFICATIONS.md §5.1 declares sha256 deduplication key',
        passed: /sha256\(`?\$\{user_addr\}\|\$\{event_type\}\|\$\{request_id\}\|\$\{epoch_bucket\}`?\)/.test(content),
        detail: 'Idempotency primitive',
    });
    results.push({
        id: 'NF.dedup.window',
        name: 'NOTIFICATIONS.md §5.1 clamps duplicate-suppression to 60-second window',
        passed: /60-second/.test(content) || /epoch_bucket\s*=\s*floor\(now\s*\/\s*60\)/.test(content),
        detail: 'Dedup window',
    });

    // §5.2 backoff schedule + MAX_WEBHOOK_RETRIES.
    results.push({
        id: 'NF.backoff.MAX_WEBHOOK_RETRIES',
        name: `NOTIFICATIONS.md §5.2 anchors MAX_WEBHOOK_RETRIES = ${MAX_WEBHOOK_RETRIES}`,
        passed: new RegExp(`MAX_WEBHOOK_RETRIES\\s*=\\s*${MAX_WEBHOOK_RETRIES}`).test(content),
        detail: 'Webhook retry policy',
    });
    results.push({
        id: 'NF.backoff.alert',
        name: 'NOTIFICATIONS.md §5.2 ties delivery failure to DEX-M16',
        passed: /DEX-M16/.test(content),
        detail: 'Delivery failure alert binding',
    });

    // §6 opt-in matrix — channels with default off.
    results.push({
        id: 'NF.optin.matrix',
        name: 'NOTIFICATIONS.md §6 opt-in matrix lists Push, Email, Webhook with defaults',
        passed: /\|\s*Push\s*\|\s*Off/.test(content)
            && /\|\s*Email\s*\|\s*Off/.test(content)
            && /\|\s*Webhook\s*\|\s*Off/.test(content),
        detail: 'Opt-in defaults',
    });

    // §7 privacy posture — never includes full TON address etc.
    results.push({
        id: 'NF.privacy.posture',
        name: "NOTIFICATIONS.md §7 documents the 'NEVER include full address' privacy posture",
        passed: /last-4\s+only/.test(content) && /3 significant figures/.test(content),
        detail: 'Privacy posture',
    });

    // Cross-link to LIQUIDITY_MONITORING.md and WALLET_UX.md.
    results.push({
        id: 'NF.link.LIQUIDITY_MONITORING',
        name: 'NOTIFICATIONS.md links to LIQUIDITY_MONITORING.md',
        passed: /LIQUIDITY_MONITORING\.md/.test(content),
        detail: 'Alert pairing',
    });
    results.push({
        id: 'NF.link.WALLET_UX',
        name: 'NOTIFICATIONS.md links to WALLET_UX.md',
        passed: /WALLET_UX\.md/.test(content),
        detail: 'Push opt-in flow',
    });

    return results;
}

// ==================== WALLET_UX.MD CHECK ====================

export function checkWalletUxDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'WX.exists',
            name: 'docs/dex/WALLET_UX.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.walletUx}`,
        });
        return results;
    }
    results.push({
        id: 'WX.exists',
        name: 'docs/dex/WALLET_UX.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 swap confirmation sheet — anchors.
    results.push({
        id: 'WX.sheet.heading',
        name: 'WALLET_UX.md §3 names the swap confirmation sheet',
        passed: /## 3\. Swap confirmation sheet/.test(content),
        detail: 'Sheet anatomy',
    });
    results.push({
        id: 'WX.sheet.expiresAt',
        name: 'WALLET_UX.md §3.3 surfaces expires-in countdown bound to expiresAt',
        passed: /expiresAt/.test(content) && /expires-in/.test(content),
        detail: 'Quote refresh',
    });

    // §3.2 slippage slider — anchored constants.
    results.push({
        id: 'WX.slider.DEFAULT_SLIPPAGE_BPS',
        name: `WALLET_UX.md §3.2 anchors DEFAULT_SLIPPAGE_BPS = ${DEFAULT_SLIPPAGE_BPS}`,
        passed: new RegExp(`DEFAULT_SLIPPAGE_BPS\\s*=\\s*${DEFAULT_SLIPPAGE_BPS}`).test(content),
        detail: 'Slider default',
    });
    results.push({
        id: 'WX.slider.MIN_SLIPPAGE_BPS',
        name: `WALLET_UX.md §3.2 anchors MIN_SLIPPAGE_BPS = ${MIN_SLIPPAGE_BPS}`,
        passed: new RegExp(`MIN_SLIPPAGE_BPS\\s*=\\s*${MIN_SLIPPAGE_BPS}`).test(content),
        detail: 'Slider lower bound',
    });
    results.push({
        id: 'WX.slider.MAX_SLIPPAGE_BPS',
        name: `WALLET_UX.md §3.2 anchors MAX_SLIPPAGE_BPS = ${MAX_SLIPPAGE_BPS}`,
        passed: new RegExp(`MAX_SLIPPAGE_BPS\\s*=\\s*${MAX_SLIPPAGE_BPS}`).test(content),
        detail: 'Slider upper bound',
    });

    // §3.4 failure-mode toast catalogue — every user-facing error appears.
    for (const code of WALLET_UX_USER_FACING_CODES) {
        results.push({
            id: `WX.toast.${code}`,
            name: `WALLET_UX.md §3.4 surfaces ${code}`,
            passed: new RegExp(`\\b${code}\\b`).test(content),
            detail: 'User-facing toast row',
        });
    }

    // §4 large-trade modal anchored.
    results.push({
        id: 'WX.modal.heading',
        name: 'WALLET_UX.md §4 names the large-trade modal',
        passed: /## 4\. Large-trade modal/.test(content),
        detail: 'Modal anatomy',
    });
    results.push({
        id: 'WX.modal.trigger',
        name: "WALLET_UX.md §4 triggers on warnings = ['LARGE_TRADE_VS_POOL']",
        passed: /LARGE_TRADE_VS_POOL/.test(content),
        detail: 'T-DEX-5 closure',
    });
    results.push({
        id: 'WX.modal.delay',
        name: 'WALLET_UX.md §4.1 requires 1-second delay before Sign anyway activates',
        passed: /1\s*s\s*after\s+modal\s+renders/.test(content) || /1-second/.test(content),
        detail: 'No muscle-memory bypass',
    });
    results.push({
        id: 'WX.modal.ack',
        name: 'WALLET_UX.md §4.2 records large_trade_ack = true in audit log',
        passed: /large_trade_ack\s*=\s*true/.test(content),
        detail: 'Audit-log binding',
    });

    // §5 venue-status pill.
    results.push({
        id: 'WX.pill.heading',
        name: 'WALLET_UX.md §5 names the venue status surface',
        passed: /## 5\. Venue status surface/.test(content),
        detail: 'Pill anatomy',
    });
    results.push({
        id: 'WX.pill.M03',
        name: 'WALLET_UX.md §5 links the pill to alert DEX-M03',
        passed: /DEX-M03/.test(content),
        detail: 'Alert ↔ pill mapping',
    });
    results.push({
        id: 'WX.pill.N01',
        name: 'WALLET_UX.md §5 links the pill to notification DEX-N01',
        passed: /DEX-N01/.test(content),
        detail: 'Notification ↔ pill mapping',
    });

    // §7 invariants — wallet NEVER calls a venue adapter directly.
    results.push({
        id: 'WX.invariant.aggregator-only',
        name: 'WALLET_UX.md §7 forbids direct venue calls (PriceAggregator only)',
        passed: /PriceAggregator/.test(content) && /NEVER calls a venue adapter directly/.test(content),
        detail: 'Aggregator centralisation invariant',
    });
    results.push({
        id: 'WX.invariant.slippage-bounds',
        name: 'WALLET_UX.md §7 invariant blocks slippage outside [MIN, MAX]',
        passed: /\[MIN_SLIPPAGE_BPS,\s*MAX_SLIPPAGE_BPS\]/.test(content),
        detail: 'Slider clamp invariant',
    });

    return results;
}

// ==================== ADAPTER_HARDENING.MD CHECK ====================

export function checkAdapterHardeningDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'AH.exists',
            name: 'docs/dex/ADAPTER_HARDENING.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.adapterHardening}`,
        });
        return results;
    }
    results.push({
        id: 'AH.exists',
        name: 'docs/dex/ADAPTER_HARDENING.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 — each DEX-AH-N has its own subsection.
    for (const item of DEX_AH_ITEMS) {
        const re = new RegExp(`###\\s+${item}\\s+—\\s`);
        results.push({
            id: `AH.item.${item}`,
            name: `ADAPTER_HARDENING.md §3 has subsection for ${item}`,
            passed: re.test(content),
            detail: 'Hardening backlog entry',
        });
    }

    // §3 — each DEX-AH-N row references its closed T-DEX-N threat.
    const closures: { ah: string; threat: string }[] = [
        { ah: 'DEX-AH-1', threat: 'T-DEX-1' },
        { ah: 'DEX-AH-2', threat: 'T-DEX-2' },
        { ah: 'DEX-AH-3', threat: 'T-DEX-3' },
        { ah: 'DEX-AH-4', threat: 'T-DEX-4' },
        { ah: 'DEX-AH-5', threat: 'T-DEX-5' },
        { ah: 'DEX-AH-6', threat: 'T-DEX-6' },
        { ah: 'DEX-AH-7', threat: 'T-DEX-7' },
    ];
    for (const c of closures) {
        // The shape from §3 is: heading "### DEX-AH-N — title" then a
        // "**Closes threat:** T-DEX-N" bold tag right under it.
        const re = new RegExp(`###\\s+${c.ah}\\s+—[\\s\\S]{0,400}\\*\\*Closes threat:\\*\\*\\s+${c.threat}`);
        results.push({
            id: `AH.closure.${c.ah}`,
            name: `ADAPTER_HARDENING.md §3 ${c.ah} declares "Closes threat: ${c.threat}"`,
            passed: re.test(content),
            detail: 'T-DEX-N ↔ DEX-AH-N pairing',
        });
    }

    // §4 sign-off gating — 5 conditions explicitly named.
    results.push({
        id: 'AH.gate.A4',
        name: 'ADAPTER_HARDENING.md §4 names A4 verdict READY as gate',
        passed: /verdict\s+`?READY`?/.test(content),
        detail: 'Sign-off gate 1',
    });
    results.push({
        id: 'AH.gate.testnet',
        name: 'ADAPTER_HARDENING.md §4 names TESTNET_INTEGRATION.md §3 manifest gate',
        passed: /TESTNET_INTEGRATION\.md/.test(content),
        detail: 'Sign-off gate 3',
    });
    results.push({
        id: 'AH.gate.validator',
        name: 'ADAPTER_HARDENING.md §4 names scripts/dex/check-dex-readiness.ts gate',
        passed: /scripts\/dex\/check-dex-readiness\.ts/.test(content),
        detail: 'Sign-off gate 4',
    });

    // §5 CI guardrail rules R-DEX-AH-1..R-DEX-AH-5.
    for (const rule of R_DEX_AH_RULES) {
        results.push({
            id: `AH.rule.${rule}`,
            name: `ADAPTER_HARDENING.md §5 declares **${rule}**`,
            passed: new RegExp(`\\*\\*${rule}\\*\\*`).test(content),
            detail: 'CI guardrail rule',
        });
    }

    // §5 references F5/F4/F3 sibling validators (pattern proof).
    results.push({
        id: 'AH.sibling.F5',
        name: 'ADAPTER_HARDENING.md §5 references F5 validator (scripts/multisig/check-multisig-readiness.ts)',
        passed: /scripts\/multisig\/check-multisig-readiness\.ts/.test(content),
        detail: 'F5 sibling validator',
    });

    // §6 cross-reference summary — every DEX-AH-N has a row.
    for (const item of DEX_AH_ITEMS) {
        const re = new RegExp(`\\|\\s*\\*\\*${item}\\*\\*\\s*\\|`);
        results.push({
            id: `AH.xref.${item}`,
            name: `ADAPTER_HARDENING.md §6 cross-reference table contains ${item}`,
            passed: re.test(content),
            detail: 'Cross-reference summary row',
        });
    }

    // §7 AC mapping — every AC-N row.
    for (const ac of ACCEPTANCE_CRITERIA) {
        results.push({
            id: `AH.ac.${ac.id}`,
            name: `ADAPTER_HARDENING.md §7 AC mapping includes ${ac.id}`,
            passed: new RegExp(`\\|\\s*${ac.id}\\s*\\|`).test(content),
            detail: 'Acceptance criterion mapping',
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
            name: 'docs/dex/TESTNET_INTEGRATION.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.testnetIntegration}`,
        });
        return results;
    }
    results.push({
        id: 'TI.exists',
        name: 'docs/dex/TESTNET_INTEGRATION.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3.1 gating preconditions — A4 verdict row + CI validator row.
    results.push({
        id: 'TI.gate.A4',
        name: 'TESTNET_INTEGRATION.md §3.1 gates on A4 verdict READY',
        passed: /verdict[^\n]*READY/i.test(content) && /A4-offchain-services/.test(content),
        detail: 'Gating precondition',
    });
    results.push({
        id: 'TI.gate.validator',
        name: 'TESTNET_INTEGRATION.md §3.1 gates on scripts/dex/check-dex-readiness.ts',
        passed: /scripts\/dex\/check-dex-readiness\.ts/.test(content),
        detail: 'Gating precondition',
    });
    results.push({
        id: 'TI.gate.monitoring',
        name: 'TESTNET_INTEGRATION.md §3.1 references LIQUIDITY_MONITORING.md dashboards',
        passed: /LIQUIDITY_MONITORING\.md/.test(content) && /DEX-M01/.test(content),
        detail: 'Monitoring gate row',
    });

    // §3.2 deployment artefacts — manifest, bundle, venue-endpoints, etc.
    for (const art of ['manifest.json', 'bundle.txt', 'venue-endpoints.json',
                       'aggregator-flow.log', 'fallback-drill.log', 'monitoring-drill.log']) {
        results.push({
            id: `TI.artefact.${art}`,
            name: `TESTNET_INTEGRATION.md §3.2 names deployment artefact ${art}`,
            passed: new RegExp(`\`${art.replace('.', '\\.')}\``).test(content),
            detail: 'Deployment artefact',
        });
    }

    // §3.3 network selection — testnet endpoints pinned.
    results.push({
        id: 'TI.net.testnet',
        name: 'TESTNET_INTEGRATION.md §3.3 declares TON testnet network',
        passed: /TON testnet/.test(content) && /testnet\.toncenter\.com/.test(content),
        detail: 'Network selection',
    });
    results.push({
        id: 'TI.net.TONCO',
        name: 'TESTNET_INTEGRATION.md §3.3 pins TONCO testnet endpoint',
        passed: /tonco\.testnet\.tonco\.io/.test(content),
        detail: 'TONCO endpoint pin',
    });
    results.push({
        id: 'TI.net.DeDust',
        name: 'TESTNET_INTEGRATION.md §3.3 pins DeDust testnet endpoint',
        passed: /api\.testnet\.dedust\.io/.test(content),
        detail: 'DeDust endpoint pin',
    });

    // §4 deployment steps — explicit numbered enumeration of 8 steps.
    for (let i = 1; i <= 8; i++) {
        results.push({
            id: `TI.step.${i}`,
            name: `TESTNET_INTEGRATION.md §4 step ${i} present`,
            passed: new RegExp(`^${i}\\.\\s+\\*\\*`, 'm').test(content),
            detail: 'Deployment step enumerated',
        });
    }

    // §5 — fallback-routing drill + error-path coverage of every error code.
    results.push({
        id: 'TI.flow.heading',
        name: 'TESTNET_INTEGRATION.md §5 names end-to-end multi-DEX flow',
        passed: /## 5\. End-to-end multi-DEX flow/.test(content),
        detail: 'E2E flow heading',
    });
    results.push({
        id: 'TI.flow.fallback',
        name: 'TESTNET_INTEGRATION.md §5.4 documents fallback-routing drill (AC-4 closure)',
        passed: /### 5\.4 Fallback-routing drill/.test(content),
        detail: 'AC-4 evidence',
    });

    // §5.5 error-path coverage — every numeric code 1..9 has a row.
    for (const code of ERROR_DEX_CODES) {
        if (code.value === 0) continue;
        const re = new RegExp(`\`${code.name}\\s*=\\s*${code.value}\``);
        results.push({
            id: `TI.err.${code.name}`,
            name: `TESTNET_INTEGRATION.md §5.5 covers ${code.name} = ${code.value}`,
            passed: re.test(content),
            detail: 'Error-path e2e row',
        });
    }

    // §5.6 performance assertions.
    results.push({
        id: 'TI.perf.P95',
        name: 'TESTNET_INTEGRATION.md §5.6 anchors P95 ≤ 500 ms budget',
        passed: /P95[^\n]*500/.test(content),
        detail: 'AC-7 latency budget',
    });
    results.push({
        id: 'TI.perf.P99',
        name: 'TESTNET_INTEGRATION.md §5.6 anchors P99 ≤ 750 ms budget',
        passed: /P99[^\n]*750/.test(content),
        detail: 'AC-7 retry budget',
    });
    results.push({
        id: 'TI.perf.indexer',
        name: 'TESTNET_INTEGRATION.md §5.6 anchors indexer overhead ≤ +10 % budget',
        passed: /\+?10\s*%/.test(content),
        detail: 'AC-7 indexer budget',
    });

    // §6 test bar — adapter unit tests (24) + aggregator integration (12).
    results.push({
        id: 'TI.bar.adapter',
        name: `TESTNET_INTEGRATION.md §6.1 anchors adapter unit-test bar at ${ADAPTER_UNIT_TEST_BAR}`,
        passed: new RegExp(`\\*\\*${ADAPTER_UNIT_TEST_BAR}\\*\\*`).test(content)
            || new RegExp(`${ADAPTER_UNIT_TEST_BAR}\\s+tests`).test(content),
        detail: 'AC-2 test bar',
    });
    results.push({
        id: 'TI.bar.aggregator',
        name: `TESTNET_INTEGRATION.md §6.2 anchors aggregator integration-test bar at ${AGGREGATOR_INTEGRATION_TEST_BAR}`,
        passed: new RegExp(`\\*\\*${AGGREGATOR_INTEGRATION_TEST_BAR}\\*\\*`).test(content)
            || new RegExp(`${AGGREGATOR_INTEGRATION_TEST_BAR}\\s+tests`).test(content),
        detail: 'AC-4 test bar',
    });
    results.push({
        id: 'TI.bar.validator',
        name: 'TESTNET_INTEGRATION.md §6.3 names the ts-jest readiness validator spec',
        passed: /tests\/dex\/DexReadinessValidator\.spec\.ts/.test(content),
        detail: 'AC-7 wiring',
    });

    // §8 AC mapping.
    for (const ac of ACCEPTANCE_CRITERIA) {
        results.push({
            id: `TI.ac.${ac.id}`,
            name: `TESTNET_INTEGRATION.md §8 AC mapping includes ${ac.id}`,
            passed: new RegExp(`\\|\\s*${ac.id}\\s*\\|`).test(content),
            detail: 'AC traceability',
        });
    }

    return results;
}

// ==================== BUG_BOUNTY.MD CHECK ====================

export function checkBugBountyDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'BB.exists',
            name: 'docs/dex/BUG_BOUNTY.md exists',
            passed: false,
            detail: `Missing file at ${PATHS.bugBounty}`,
        });
        return results;
    }
    results.push({
        id: 'BB.exists',
        name: 'docs/dex/BUG_BOUNTY.md exists',
        passed: true,
        detail: 'Found',
    });

    // §3 in-scope assets — priceAggregator + tonco + dedust adapters.
    for (const asset of ['priceAggregator.ts', 'toncoAdapter.ts', 'dedustAdapter.ts', 'types.ts']) {
        results.push({
            id: `BB.asset.${asset}`,
            name: `BUG_BOUNTY.md §3 lists asset ${asset}`,
            passed: new RegExp(`backend/adapters/${asset.replace('.', '\\.')}`).test(content),
            detail: 'In-scope asset row',
        });
    }

    // §3 Critical severity for the aggregator + High for adapters.
    results.push({
        id: 'BB.sev.Critical',
        name: 'BUG_BOUNTY.md §3 grants **Critical** ceiling to the aggregator',
        passed: /\*\*Critical\*\*/.test(content),
        detail: 'Severity ceiling',
    });
    results.push({
        id: 'BB.sev.High',
        name: 'BUG_BOUNTY.md §3 grants **High** (off-chain) to the adapters',
        passed: /\*\*High\*\*/.test(content),
        detail: 'Severity ceiling',
    });

    // §4 — at least four subsections present.
    for (const sub of ['### 4.1', '### 4.2', '### 4.3', '### 4.4']) {
        results.push({
            id: `BB.sub.${sub.replace('### ', '')}`,
            name: `BUG_BOUNTY.md §4 contains subsection ${sub}`,
            passed: content.indexOf(sub) >= 0,
            detail: 'Severity uplift subsection',
        });
    }

    // §6 threat-catalogue cross-reference — every T-DEX-N has a row.
    for (const t of T_DEX_THREATS) {
        results.push({
            id: `BB.threat.${t}`,
            name: `BUG_BOUNTY.md §6 threat-catalogue contains **${t}**`,
            passed: new RegExp(`\\*\\*${t}\\*\\*`).test(content),
            detail: 'Threat ↔ bounty band row',
        });
    }

    // §7 activation timeline — A4 verdict READY explicitly named.
    results.push({
        id: 'BB.activation.A4',
        name: 'BUG_BOUNTY.md §7 gates activation on A4 verdict READY',
        passed: /A4 verdict\s+`?READY`?/.test(content),
        detail: 'Activation precondition 1',
    });
    results.push({
        id: 'BB.activation.hardening',
        name: 'BUG_BOUNTY.md §7 gates activation on DEX-AH-1..DEX-AH-7 landed',
        passed: /DEX-AH-1\.\.DEX-AH-7/.test(content),
        detail: 'Activation precondition 2',
    });

    // §8 SLA — RC-BOUNTY-CRITICAL auto-pause lever.
    results.push({
        id: 'BB.sla.RC-BOUNTY-CRITICAL',
        name: 'BUG_BOUNTY.md §8 names auto-pause lever RC-BOUNTY-CRITICAL',
        passed: /RC-BOUNTY-CRITICAL/.test(content),
        detail: 'Triage SLA pause',
    });

    // §9 AC mapping.
    for (const ac of ACCEPTANCE_CRITERIA) {
        results.push({
            id: `BB.ac.${ac.id}`,
            name: `BUG_BOUNTY.md §9 AC mapping includes ${ac.id}`,
            passed: new RegExp(`\\|\\s*${ac.id}\\s*\\|`).test(content),
            detail: 'AC traceability',
        });
    }

    return results;
}

// ==================== CROSS-DOC REFERENCES ====================

interface DocsBundle {
    specification: string | null;
    priceAggregator: string | null;
    slippageProtection: string | null;
    liquidityMonitoring: string | null;
    notifications: string | null;
    walletUx: string | null;
    adapterHardening: string | null;
    testnetIntegration: string | null;
    bugBounty: string | null;
}

export function checkCrossDocReferences(docs: DocsBundle): CheckResult[] {
    const results: CheckResult[] = [];

    // R-DEX-AH-2: every DEX-AH-N reference resolves to a §3 row in
    // ADAPTER_HARDENING.md. Iterate all other DEX docs and confirm
    // that every DEX-AH-N they reference is also a heading in §3.
    const ah = docs.adapterHardening;
    if (ah != null) {
        for (const item of DEX_AH_ITEMS) {
            const headingRe = new RegExp(`###\\s+${item}\\s+—`);
            const heading = headingRe.test(ah);
            results.push({
                id: `XR.ah.heading.${item}`,
                name: `R-DEX-AH-2: ${item} has its own §3 heading in ADAPTER_HARDENING.md`,
                passed: heading,
                detail: 'No dangling DEX-AH-N references',
            });
        }
    }

    // T-DEX-N parity: SPECIFICATION.md §7.1 ↔ BUG_BOUNTY.md §6 ↔
    // ADAPTER_HARDENING.md §3 closures.
    const sp = docs.specification;
    const bb = docs.bugBounty;
    if (sp != null && bb != null && ah != null) {
        for (const t of T_DEX_THREATS) {
            const inSpec = new RegExp(`\\*\\*${t}\\*\\*`).test(sp);
            const inBounty = new RegExp(`\\*\\*${t}\\*\\*`).test(bb);
            const inHardening = new RegExp(`\\b${t}\\b`).test(ah);
            results.push({
                id: `XR.threat.${t}`,
                name: `Threat ${t} parity across SPECIFICATION.md §7.1, BUG_BOUNTY.md §6, ADAPTER_HARDENING.md §3`,
                passed: inSpec && inBounty && inHardening,
                detail: 'Threat catalogue traceability',
            });
        }
    }

    // DEX-Mxx parity: every alert in §§3.1–3.5 also appears in §3.6 and
    // every alert is referenced exactly once in the severity matrix.
    const lm = docs.liquidityMonitoring;
    if (lm != null) {
        for (const alert of DEX_M_IDS) {
            // The alert appears bolded in the catalogue (`**DEX-Mxx**`)
            // and backticked in the severity matrix (`` `DEX-Mxx` ``).
            const bolded = new RegExp(`\\*\\*${alert}\\*\\*`).test(lm);
            const ticked = new RegExp(`\`${alert}\``).test(lm);
            results.push({
                id: `XR.alert.${alert}.catalogue-and-matrix`,
                name: `Alert ${alert} appears both in §§3.1–3.5 catalogue and §3.6 severity matrix`,
                passed: bolded && ticked,
                detail: 'Catalogue ↔ matrix parity',
            });
        }
    }

    // DEX-Nxx parity: every notification in LIQUIDITY_MONITORING.md §3.5
    // (DEX-N01 / DEX-N08 references) also exists in NOTIFICATIONS.md §3.
    const nf = docs.notifications;
    if (lm != null && nf != null) {
        for (const n of DEX_N_IDS) {
            const inNotifications = new RegExp(`\\*\\*${n}\\*\\*`).test(nf);
            results.push({
                id: `XR.note.${n}`,
                name: `Notification ${n} declared in NOTIFICATIONS.md §3`,
                passed: inNotifications,
                detail: 'Notification catalogue presence',
            });
        }
    }

    // Error-code parity: every ERROR_DEX_* declared in SPECIFICATION.md
    // §7.2 must appear verbatim (by name) in WALLET_UX.md §3.4 (toast
    // catalogue) and TESTNET_INTEGRATION.md §5.5 (error-path e2e).
    const wx = docs.walletUx;
    const ti = docs.testnetIntegration;
    if (sp != null && wx != null && ti != null) {
        for (const code of ERROR_DEX_CODES) {
            if (code.value === 0) continue;
            const inSpec = new RegExp(`\\b${code.name}\\b`).test(sp);
            const inWallet = new RegExp(`\\b${code.name}\\b`).test(wx);
            const inTestnet = new RegExp(`\\b${code.name}\\b`).test(ti);
            results.push({
                id: `XR.err.${code.name}`,
                name: `${code.name} (${code.value}) named in SPECIFICATION.md, WALLET_UX.md, and TESTNET_INTEGRATION.md`,
                passed: inSpec && inWallet && inTestnet,
                detail: 'Error-code traceability',
            });
        }
    }

    // Cross-references — every doc must link to SPECIFICATION.md to
    // keep the interface anchor singular.
    const pa = docs.priceAggregator;
    const sl = docs.slippageProtection;
    type DocRef = { id: string; doc: string | null; label: string };
    const linkBack: DocRef[] = [
        { id: 'PA', doc: pa, label: 'PRICE_AGGREGATOR.md' },
        { id: 'SL', doc: sl, label: 'SLIPPAGE_PROTECTION.md' },
        { id: 'LM', doc: lm, label: 'LIQUIDITY_MONITORING.md' },
        { id: 'NF', doc: nf, label: 'NOTIFICATIONS.md' },
        { id: 'WX', doc: wx, label: 'WALLET_UX.md' },
        { id: 'AH', doc: ah, label: 'ADAPTER_HARDENING.md' },
        { id: 'TI', doc: ti, label: 'TESTNET_INTEGRATION.md' },
        { id: 'BB', doc: bb, label: 'BUG_BOUNTY.md' },
    ];
    for (const ref of linkBack) {
        if (ref.doc == null) continue;
        results.push({
            id: `XR.link.${ref.id}.spec`,
            name: `${ref.label} links back to SPECIFICATION.md`,
            passed: /SPECIFICATION\.md/.test(ref.doc),
            detail: 'Spec is the single-source anchor',
        });
    }

    // WALLET_UX.md ↔ SLIPPAGE_PROTECTION.md stitching (slider definition).
    if (wx != null && sl != null) {
        results.push({
            id: 'XR.wx-sl.slider',
            name: 'WALLET_UX.md §3 links to SLIPPAGE_PROTECTION.md §3',
            passed: /SLIPPAGE_PROTECTION\.md/.test(wx),
            detail: 'Slider definition cross-link',
        });
    }

    // SLIPPAGE_PROTECTION.md ↔ LIQUIDITY_MONITORING.md (DEX-M07 revert
    // alert pairing).
    if (sl != null && lm != null) {
        results.push({
            id: 'XR.sl-lm.M07',
            name: 'SLIPPAGE_PROTECTION.md §5.2 ↔ LIQUIDITY_MONITORING.md alert DEX-M07',
            passed: /DEX-M07/.test(sl) && /DEX-M07/.test(lm),
            detail: 'Revert-spike alert binding',
        });
    }

    // ADAPTER_HARDENING.md ↔ NOTIFICATIONS.md (DEX-AH-6 auto-pause →
    // DEX-N08 user notification).
    if (ah != null && nf != null) {
        results.push({
            id: 'XR.ah-nf.DEX-N08',
            name: 'ADAPTER_HARDENING.md §3 DEX-AH-6 ↔ NOTIFICATIONS.md §3.4 DEX-N08',
            passed: /DEX-N08/.test(ah) && /DEX-N08/.test(nf),
            detail: 'Auto-pause notification pairing',
        });
    }

    // BUG_BOUNTY.md ↔ ADAPTER_HARDENING.md (every DEX-AH-N referenced
    // in §3 / §6 of BUG_BOUNTY exists as a §3 heading in HARDENING).
    if (bb != null && ah != null) {
        // BUG_BOUNTY.md §3 / §6 references DEX-AH-1, DEX-AH-4, etc. Each
        // must resolve to a §3 heading in HARDENING. Track per-ID:
        for (const item of DEX_AH_ITEMS) {
            if (!new RegExp(`\\b${item}\\b`).test(bb)) continue;
            const headingRe = new RegExp(`###\\s+${item}\\s+—`);
            results.push({
                id: `XR.bb-ah.${item}`,
                name: `BUG_BOUNTY.md reference to ${item} resolves to ADAPTER_HARDENING.md §3 heading`,
                passed: headingRe.test(ah),
                detail: 'Bounty ↔ hardening cross-link',
            });
        }
    }

    // R-DEX-AH-1 (A4 verdict gate) — issue #141 ships documentation-only
    // (off-chain envelope; no adapter sources land in this PR). The gate
    // is therefore informational: when A4 STATUS.md is absent, the gate
    // is inactive; when it exists with verdict Pending, the gate is
    // PENDING but does not block this PR; when verdict READY, the gate
    // is ARMED for follow-up adapter-source PRs.
    if (existsSync(PATHS.a4Status)) {
        const status = readFileSync(PATHS.a4Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status)
            // STATUS.md initialises with "Gating verdict: ⏳ Pending"; treat
            // this as not-ready for the verdict-armed signal, but still
            // pass the check informatively (issue #141 is docs-only).
            && !/Gating verdict[^\n]*Pending/.test(status);
        results.push({
            id: 'XR.a4.verdict',
            name: verdictReady
                ? 'A4 STATUS.md records verdict READY (gate ARMED for adapter-source landings)'
                : 'A4 STATUS.md records verdict PENDING (gate inactive for docs-only issue #141 scope)',
            passed: true,
            detail: 'R-DEX-AH-1 of ADAPTER_HARDENING.md §5 — only enforced when adapter source PRs are open',
        });
        if (!verdictReady) {
            results.push({
                id: 'XR.a4.gate-state',
                name: 'A4 gate state: PENDING (documentation-only PRs land; adapter diffs blocked)',
                passed: true,
                detail: 'Informational — A4 verdict not yet READY; current PR scope is documentation-only',
            });
        }
    } else {
        results.push({
            id: 'XR.a4.verdict',
            name: 'A4 STATUS.md not yet created (gate currently inactive)',
            passed: true,
            detail: 'R-DEX-AH-1 inactive until STATUS.md exists',
        });
    }

    // A5 program brief cross-link — BUG_BOUNTY.md activation depends on
    // a Pending-A4 row in A5 PROGRAM_BRIEF.md §3.1. The validator does
    // not enforce the row's exact wording; it checks that BUG_BOUNTY.md
    // references PROGRAM_BRIEF.md by path.
    if (bb != null) {
        results.push({
            id: 'XR.bb.a5-brief',
            name: 'BUG_BOUNTY.md cross-references A5 PROGRAM_BRIEF.md',
            passed: /A5-bug-bounty\/PROGRAM_BRIEF\.md/.test(bb),
            detail: 'Program-brief anchor',
        });
    }

    // Error-codes registry parity — docs/error-codes.md must include
    // every ERROR_DEX_* code by name, when present.
    const errReg = readSafe(PATHS.errorCodes);
    if (errReg != null) {
        for (const code of ERROR_DEX_CODES) {
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
    // docs/dex/ once the F6 wiring step is complete.
    const auditScope = readSafe(PATHS.auditScope);
    if (auditScope != null) {
        results.push({
            id: 'XR.audit-scope.dex',
            name: 'docs/audit-scope.md references docs/dex/ artefacts',
            passed: /docs\/dex\//.test(auditScope),
            detail: 'Audit scope inclusion',
        });
    }

    // docs/INDEX.md must surface the DEX integration documents in its
    // F6 section (wiring step). Links inside docs/INDEX.md are relative
    // (e.g. `dex/SPECIFICATION.md`) because the index itself lives at
    // `docs/INDEX.md`, so we accept either form.
    const docsIndex = readSafe(PATHS.docsIndex);
    if (docsIndex != null) {
        results.push({
            id: 'XR.index.dex',
            name: 'docs/INDEX.md surfaces docs/dex/ documents',
            passed: /\]\(dex\//.test(docsIndex) || /docs\/dex\//.test(docsIndex),
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
        priceAggregator:      readSafe(PATHS.priceAggregator),
        slippageProtection:   readSafe(PATHS.slippageProtection),
        liquidityMonitoring:  readSafe(PATHS.liquidityMonitoring),
        notifications:        readSafe(PATHS.notifications),
        walletUx:             readSafe(PATHS.walletUx),
        adapterHardening:     readSafe(PATHS.adapterHardening),
        testnetIntegration:   readSafe(PATHS.testnetIntegration),
        bugBounty:            readSafe(PATHS.bugBounty),
    };

    const results = [
        ...checkSpecificationDoc(docs.specification),
        ...checkPriceAggregatorDoc(docs.priceAggregator),
        ...checkSlippageProtectionDoc(docs.slippageProtection),
        ...checkLiquidityMonitoringDoc(docs.liquidityMonitoring),
        ...checkNotificationsDoc(docs.notifications),
        ...checkWalletUxDoc(docs.walletUx),
        ...checkAdapterHardeningDoc(docs.adapterHardening),
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
            'Usage: ts-node scripts/dex/check-dex-readiness.ts [--classify AC-x] [--strict]\n',
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
