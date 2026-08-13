/**
 * Recurring Payments Production-Readiness Validator (Issue #139, F4)
 *
 * Purpose: Validate that the eight recurring-payments production-readiness
 *   documents — SPECIFICATION.md, DASHBOARD_INTEGRATION.md, WALLET_UX.md,
 *   NOTIFICATIONS.md, MONITORING.md, CONTRACT_HARDENING.md,
 *   TESTNET_DEPLOYMENT.md, and BUG_BOUNTY.md — stay consistent with each
 *   other, with the contract source `contracts/RecurringPayments.tact`,
 *   and with the engagement's acceptance criteria from Issue #139 §8.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / Tact sources from the repository working tree.
 *
 * Usage:
 *   npx ts-node scripts/recurring-payments/check-recurring-payments-readiness.ts
 *   npx ts-node scripts/recurring-payments/check-recurring-payments-readiness.ts --classify AC-4
 *   npx ts-node scripts/recurring-payments/check-recurring-payments-readiness.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the F3 validator at
 *   scripts/bridge/check-bridge-readiness.ts.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #139 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and
// the linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'prerequisite'
        | 'specification'
        | 'testnet-deployment'
        | 'dashboard-integration'
        | 'wallet-ux'
        | 'notifications'
        | 'monitoring'
        | 'contract-hardening'
        | 'bug-bounty'
        | 'tests';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'A2 audit complete (prerequisite)',                          artifact: 'docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'docs/recurring-payments/SPECIFICATION.md written',          artifact: 'docs/recurring-payments/SPECIFICATION.md',                evidenceCheck: 'specification' },
    { id: 'AC-3', description: 'RecurringPayments.tact deployed to testnet',                artifact: 'docs/recurring-payments/TESTNET_DEPLOYMENT.md',           evidenceCheck: 'testnet-deployment' },
    { id: 'AC-4', description: 'Merchant dashboard subscription section',                   artifact: 'docs/recurring-payments/DASHBOARD_INTEGRATION.md',        evidenceCheck: 'dashboard-integration' },
    { id: 'AC-5', description: 'Wallet cancel/pause/resume UX',                             artifact: 'docs/recurring-payments/WALLET_UX.md',                    evidenceCheck: 'wallet-ux' },
    { id: 'AC-6', description: 'User notifications: 3 days before billing',                 artifact: 'docs/recurring-payments/NOTIFICATIONS.md',                evidenceCheck: 'notifications' },
    { id: 'AC-7', description: 'End-to-end subscription tested on testnet',                 artifact: 'docs/recurring-payments/TESTNET_DEPLOYMENT.md',           evidenceCheck: 'testnet-deployment' },
    { id: 'AC-8', description: 'Dashboard (47) and wallet-ui (28) tests pass',              artifact: 'docs/recurring-payments/TESTNET_DEPLOYMENT.md',           evidenceCheck: 'tests' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    specification:        resolve(REPO_ROOT, 'docs/recurring-payments/SPECIFICATION.md'),
    dashboardIntegration: resolve(REPO_ROOT, 'docs/recurring-payments/DASHBOARD_INTEGRATION.md'),
    walletUx:             resolve(REPO_ROOT, 'docs/recurring-payments/WALLET_UX.md'),
    notifications:        resolve(REPO_ROOT, 'docs/recurring-payments/NOTIFICATIONS.md'),
    monitoring:           resolve(REPO_ROOT, 'docs/recurring-payments/MONITORING.md'),
    contractHardening:    resolve(REPO_ROOT, 'docs/recurring-payments/CONTRACT_HARDENING.md'),
    testnetDeployment:    resolve(REPO_ROOT, 'docs/recurring-payments/TESTNET_DEPLOYMENT.md'),
    bugBounty:            resolve(REPO_ROOT, 'docs/recurring-payments/BUG_BOUNTY.md'),
    contract:             resolve(REPO_ROOT, 'contracts/RecurringPayments.tact'),
    parameters:           resolve(REPO_ROOT, 'docs/governance/PARAMETERS.md'),
    a2Engagement:         resolve(REPO_ROOT, 'docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md'),
    a2Status:             resolve(REPO_ROOT, 'docs/security/audits/A2-phase4-contracts/STATUS.md'),
    a5ProgramBrief:       resolve(REPO_ROOT, 'docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md'),
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

// Billing-period seconds (SPECIFICATION.md §4.2 — verbatim contract).
export const BILLING_PERIOD_SECONDS = [
    { name: 'daily',   seconds: 86400 },
    { name: 'weekly',  seconds: 604800 },
    { name: 'monthly', seconds: 2592000 },   // 30 × 86400, calendar-agnostic
    { name: 'annual',  seconds: 31536000 },  // 365 × 86400, no leap-year adjustment
] as const;

// Error codes 0..9 published in contracts/RecurringPayments.tact lines 98–107.
export const ERROR_RP_CODES = [
    { name: 'ERROR_RP_NONE',                value: 0 },
    { name: 'ERROR_RP_NOT_OWNER',           value: 1 },
    { name: 'ERROR_RP_INVALID_AMOUNT',      value: 2 },
    { name: 'ERROR_RP_INVALID_PERIOD',      value: 3 },
    { name: 'ERROR_RP_MANDATE_NOT_FOUND',   value: 4 },
    { name: 'ERROR_RP_MANDATE_NOT_ACTIVE',  value: 5 },
    { name: 'ERROR_RP_TOO_EARLY',           value: 6 },
    { name: 'ERROR_RP_MAX_REACHED',         value: 7 },
    { name: 'ERROR_RP_NFT_NOT_REGISTERED',  value: 8 },
    { name: 'ERROR_RP_NOT_AUTHORIZED',      value: 9 },
] as const;

export const T_RP_THREATS = [
    'T-RP-1', 'T-RP-2', 'T-RP-3', 'T-RP-4', 'T-RP-5', 'T-RP-6',
] as const;

export const RP_CH_ITEMS = [
    'RP-CH-1', 'RP-CH-2', 'RP-CH-3', 'RP-CH-4', 'RP-CH-5',
] as const;

export const R_RP_CH_RULES = [
    'R-RP-CH-1', 'R-RP-CH-2', 'R-RP-CH-3', 'R-RP-CH-4', 'R-RP-CH-5',
] as const;

// 18 alert IDs SUB-M01 .. SUB-M18 — MONITORING.md §3.
export const SUB_M_IDS = Array.from(
    { length: 18 },
    (_, i) => `SUB-M${String(i + 1).padStart(2, '0')}`,
);

// 8 notification IDs RP-N01 .. RP-N08 — NOTIFICATIONS.md §3.
export const RP_N_IDS = Array.from(
    { length: 8 },
    (_, i) => `RP-N${String(i + 1).padStart(2, '0')}`,
);

// Test bar breakdown — TESTNET_DEPLOYMENT.md §6 — pins the 47/28 ratio
// from Issue #139 §8 AC-8.
export const DASHBOARD_TEST_BAR = 47;
export const WALLET_UI_TEST_BAR = 28;

// ==================== DOCUMENT CHECKS ====================

export function checkSpecificationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'SP.doc', name: 'SPECIFICATION.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'SP.doc', name: 'SPECIFICATION.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'SP.sec.3',   pattern: /## 3\. On-chain mandate format/ },
        { id: 'SP.sec.3_1', pattern: /### 3\.1 `MandateInfo` struct/ },
        { id: 'SP.sec.3_2', pattern: /### 3\.2 Composite-key collision posture/ },
        { id: 'SP.sec.4',   pattern: /## 4\. Subscription tier formats/ },
        { id: 'SP.sec.4_1', pattern: /### 4\.1 Plan format/ },
        { id: 'SP.sec.4_2', pattern: /### 4\.2 Billing-period seconds/ },
        { id: 'SP.sec.4_3', pattern: /### 4\.3 Currency/ },
        { id: 'SP.sec.5',   pattern: /## 5\. Payment schedule/ },
        { id: 'SP.sec.5_2', pattern: /### 5\.2 Schedule enforcement/ },
        { id: 'SP.sec.6',   pattern: /## 6\. Grace period and missed-payment behaviour/ },
        { id: 'SP.sec.6_1', pattern: /### 6\.1 Default grace period/ },
        { id: 'SP.sec.7',   pattern: /## 7\. Security model/ },
        { id: 'SP.sec.9',   pattern: /## 9\. Threat catalogue/ },
        { id: 'SP.sec.10',  pattern: /## 10\. Hardening backlog/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `SPECIFICATION.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-2',
        });
    }

    // §4.2 must list the four billing periods with their on-chain seconds.
    for (const period of BILLING_PERIOD_SECONDS) {
        results.push({
            id: `SP.period.${period.name}`,
            name: `SPECIFICATION.md §4.2 binds ${period.name} → ${period.seconds} s`,
            passed: new RegExp(
                `\\|\\s*\`${period.name}\`\\s*\\|\\s*\`${period.seconds}\`\\s*\\|`,
            ).test(content),
            detail: 'Off-chain ↔ on-chain period contract',
        });
    }

    // §6.1 default grace period must be 7 days = 604800 s.
    results.push({
        id: 'SP.grace.default',
        name: 'SPECIFICATION.md §6.1 anchors default grace at 604800 s (7 days)',
        passed: /grace_seconds\s*=\s*604800/.test(content) && /\*\*7 days\*\*/.test(content),
        detail: 'Issue #139 §3 grace-period default',
    });

    // §9 threat catalogue must list every T-RP-N.
    for (const threat of T_RP_THREATS) {
        results.push({
            id: `SP.threat.${threat}`,
            name: `SPECIFICATION.md §9 lists ${threat}`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'Subscription-specific threat catalogue',
        });
    }

    // §10 hardening backlog must list every RP-CH-N.
    for (const ch of RP_CH_ITEMS) {
        results.push({
            id: `SP.hardening.${ch}`,
            name: `SPECIFICATION.md §10 lists ${ch}`,
            passed: new RegExp(`\\*\\*${ch}\\*\\*`).test(content),
            detail: 'Post-A2 hardening backlog',
        });
    }

    return results;
}

export function checkDashboardIntegrationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'DI.doc', name: 'DASHBOARD_INTEGRATION.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'DI.doc', name: 'DASHBOARD_INTEGRATION.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'DI.sec.3',   pattern: /## 3\. Plan creation flow/ },
        { id: 'DI.sec.3_1', pattern: /### 3\.1 Latency budget/ },
        { id: 'DI.sec.4',   pattern: /## 4\. Subscriber list view/ },
        { id: 'DI.sec.4_1', pattern: /### 4\.1 Status derivation/ },
        { id: 'DI.sec.5',   pattern: /## 5\. Executor pattern/ },
        { id: 'DI.sec.5_1', pattern: /### 5\.1 Failure modes/ },
        { id: 'DI.sec.6',   pattern: /## 6\. Cancellation visibility/ },
        { id: 'DI.sec.7',   pattern: /## 7\. Subscription analytics/ },
        { id: 'DI.sec.7_1', pattern: /### 7\.1 MRR conversion table/ },
        { id: 'DI.sec.8',   pattern: /## 8\. Invariant matrix/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `DASHBOARD_INTEGRATION.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-4',
        });
    }

    // §4.1 must derive status values active/cancelled/expired/lapsed.
    for (const status of ['active', 'cancelled', 'expired', 'lapsed']) {
        results.push({
            id: `DI.status.${status}`,
            name: `DASHBOARD_INTEGRATION.md §4.1 derives status ${status}`,
            passed: new RegExp(`\\*\\*${status}\\*\\*`).test(content),
            detail: 'Subscriber status registry',
        });
    }

    // §7.1 MRR conversion must include the four billing periods.
    for (const period of BILLING_PERIOD_SECONDS) {
        results.push({
            id: `DI.mrr.${period.name}`,
            name: `DASHBOARD_INTEGRATION.md §7.1 MRR table lists ${period.name}`,
            passed: new RegExp(`\\|\\s*\`?${period.name}\`?\\s*\\|`).test(content),
            detail: 'MRR conversion row',
        });
    }

    return results;
}

export function checkWalletUxDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'WX.doc', name: 'WALLET_UX.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'WX.doc', name: 'WALLET_UX.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'WX.sec.3',   pattern: /## 3\. Subscribe flow/ },
        { id: 'WX.sec.3_1', pattern: /### 3\.1 Entry point/ },
        { id: 'WX.sec.3_2', pattern: /### 3\.2 Authorization sheet/ },
        { id: 'WX.sec.3_3', pattern: /### 3\.3 Signature/ },
        { id: 'WX.sec.3_4', pattern: /### 3\.4 Failure modes/ },
        { id: 'WX.sec.4',   pattern: /## 4\. Subscription list view/ },
        { id: 'WX.sec.4_2', pattern: /### 4\.2 One-tap cancel/ },
        { id: 'WX.sec.4_3', pattern: /### 4\.3 Detail sheet/ },
        { id: 'WX.sec.5',   pattern: /## 5\. Pause \/ resume/ },
        { id: 'WX.sec.6',   pattern: /## 6\. Notifications hook/ },
        { id: 'WX.sec.7',   pattern: /## 7\. Invariant preservation/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `WALLET_UX.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-5',
        });
    }

    // Failure-mode table must surface the four user-facing error codes (1, 2, 3, 8).
    const userFacingCodes = ['ERROR_RP_NFT_NOT_REGISTERED', 'ERROR_RP_NOT_OWNER',
                             'ERROR_RP_INVALID_AMOUNT', 'ERROR_RP_INVALID_PERIOD'];
    for (const code of userFacingCodes) {
        results.push({
            id: `WX.code.${code}`,
            name: `WALLET_UX.md §3.4 surfaces ${code}`,
            passed: new RegExp(`\`${code}\``).test(content),
            detail: 'Subscribe failure-mode table',
        });
    }

    // §5 pause/resume must defer to RP-CH-3.
    results.push({
        id: 'WX.pause.RP-CH-3',
        name: 'WALLET_UX.md §5 defers pause/resume to RP-CH-3',
        passed: /RP-CH-3/.test(content),
        detail: 'Issue #139 §8 AC-5 / CONTRACT_HARDENING.md §3',
    });

    return results;
}

export function checkNotificationsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'NF.doc', name: 'NOTIFICATIONS.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'NF.doc', name: 'NOTIFICATIONS.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'NF.sec.3',   pattern: /## 3\. Notification catalogue/ },
        { id: 'NF.sec.3_1', pattern: /### 3\.1 Upcoming-payment notifications/ },
        { id: 'NF.sec.3_2', pattern: /### 3\.2 Post-billing receipts/ },
        { id: 'NF.sec.3_3', pattern: /### 3\.3 Status-change notifications/ },
        { id: 'NF.sec.4',   pattern: /## 4\. Channels/ },
        { id: 'NF.sec.4_1', pattern: /### 4\.1 Push notifications/ },
        { id: 'NF.sec.4_2', pattern: /### 4\.2 Email/ },
        { id: 'NF.sec.4_3', pattern: /### 4\.3 Webhook/ },
        { id: 'NF.sec.5',   pattern: /## 5\. Scheduling/ },
        { id: 'NF.sec.5_1', pattern: /### 5\.1 Idempotency/ },
        { id: 'NF.sec.6',   pattern: /## 6\. Opt-in/ },
        { id: 'NF.sec.7',   pattern: /## 7\. Privacy posture/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `NOTIFICATIONS.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-6',
        });
    }

    // §3 catalogue must list every RP-Nxx.
    for (const id of RP_N_IDS) {
        results.push({
            id: `NF.id.${id}`,
            name: `NOTIFICATIONS.md §3 references notification ${id}`,
            passed: new RegExp(`\\*\\*${id}\\*\\*`).test(content),
            detail: 'Notification catalogue',
        });
    }

    // §5 scheduler must encode T-3d = 259200 s and the 30-min granularity.
    results.push({
        id: 'NF.t3d',
        name: 'NOTIFICATIONS.md §3.1 anchors T-3d at 259200 s',
        passed: /\b259200\b/.test(content),
        detail: 'Issue #139 §3 — _"3 days before next billing"_',
    });

    return results;
}

export function checkMonitoringDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'MN.doc', name: 'MONITORING.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'MN.doc', name: 'MONITORING.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'MN.sec.3',   pattern: /## 3\. Alert catalogue/ },
        { id: 'MN.sec.3_1', pattern: /### 3\.1 Mandate lifecycle alerts/ },
        { id: 'MN.sec.3_2', pattern: /### 3\.2 Replay \/ over-execution alerts/ },
        { id: 'MN.sec.3_3', pattern: /### 3\.3 Grace-period & lapsed alerts/ },
        { id: 'MN.sec.3_4', pattern: /### 3\.4 Notification-system alerts/ },
        { id: 'MN.sec.3_5', pattern: /### 3\.5 Indexer & executor alerts/ },
        { id: 'MN.sec.3_6', pattern: /### 3\.6 Auto-pause auto-trigger/ },
        { id: 'MN.sec.3_7', pattern: /### 3\.7 Roll-up — pager severity matrix/ },
        { id: 'MN.sec.4',   pattern: /## 4\. Data sources/ },
        { id: 'MN.sec.5',   pattern: /## 5\. Disaster-recovery drills/ },
        { id: 'MN.sec.6',   pattern: /## 6\. CI wiring/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `MONITORING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-6 (monitoring addendum)',
        });
    }

    // SUB-Mxx catalogue inventory.
    for (const alert of SUB_M_IDS) {
        results.push({
            id: `MN.alert.${alert}`,
            name: `MONITORING.md §3 references alert ${alert}`,
            passed: new RegExp(`\\b${alert}\\b`).test(content),
            detail: 'Recurring-payments alert inventory',
        });
    }

    // Catalogue uniqueness — each SUB-Mxx appears exactly once as a left-column
    // table row across §3.1..§3.6.
    for (const alert of SUB_M_IDS) {
        const cataloguePattern = new RegExp(`\\|\\s*${alert}\\s*\\|`, 'g');
        const occurrences = (content.match(cataloguePattern) ?? []).length;
        results.push({
            id: `MN.alert.unique.${alert}`,
            name: `MONITORING.md §3 catalogue row for ${alert} appears exactly once`,
            passed: occurrences === 1,
            detail: `expected 1 catalogue row, found ${occurrences}`,
        });
    }

    // P0 / P1 / P2 / P3 severity tiers (§3.7).
    for (const sev of ['P0', 'P1', 'P2', 'P3']) {
        results.push({
            id: `MN.sev.${sev}`,
            name: `MONITORING.md §3.7 defines severity tier ${sev}`,
            passed: new RegExp(`\\*\\*${sev}\\*\\*`).test(content),
            detail: 'Pager routing',
        });
    }

    // DS-1..DS-4 data sources.
    for (const ds of ['DS-1', 'DS-2', 'DS-3', 'DS-4']) {
        results.push({
            id: `MN.ds.${ds}`,
            name: `MONITORING.md §4 defines data source ${ds}`,
            passed: new RegExp(`\\*\\*${ds}\\*\\*`).test(content),
            detail: 'Data-source inventory',
        });
    }

    // DR-1..DR-5 disaster-recovery drills.
    for (const drill of ['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5']) {
        results.push({
            id: `MN.drill.${drill}`,
            name: `MONITORING.md §5 defines DR drill ${drill}`,
            passed: new RegExp(`\\*\\*${drill}\\*\\*`).test(content),
            detail: 'Quarterly DR drill schedule',
        });
    }

    return results;
}

export function checkContractHardeningDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'CH.doc', name: 'CONTRACT_HARDENING.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'CH.doc', name: 'CONTRACT_HARDENING.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'CH.sec.2', pattern: /## 2\. Why deferred/ },
        { id: 'CH.sec.3', pattern: /## 3\. Hardening Backlog/ },
        { id: 'CH.sec.4', pattern: /## 4\. Sign-off Gating/ },
        { id: 'CH.sec.5', pattern: /## 5\. CI Guardrail/ },
        { id: 'CH.sec.6', pattern: /## 6\. Cross-reference summary/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `CONTRACT_HARDENING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Post-A2 hardening track',
        });
    }

    for (const ch of RP_CH_ITEMS) {
        results.push({
            id: `CH.item.${ch}`,
            name: `CONTRACT_HARDENING.md §3 defines hardening item ${ch}`,
            passed: new RegExp(`### ${ch} —`).test(content),
            detail: 'Hardening backlog — single source of truth for RP-CH-N IDs',
        });
    }

    for (const rule of R_RP_CH_RULES) {
        results.push({
            id: `CH.rule.${rule}`,
            name: `CONTRACT_HARDENING.md §5 defines CI guardrail rule ${rule}`,
            passed: new RegExp(`\\*\\*${rule}\\*\\*`).test(content),
            detail: 'CI guardrail inventory',
        });
    }

    // Explicit A2 verdict gate (R-RP-CH-1).
    results.push({
        id: 'CH.a2-gate',
        name: 'CONTRACT_HARDENING.md §4 gates landing on A2 verdict READY',
        passed: /verdict[^\n]*READY/.test(content) || /verdict `READY`/.test(content),
        detail: 'Issue #139 §3 hard prerequisite',
    });

    return results;
}

export function checkTestnetDeploymentDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'TN.doc', name: 'TESTNET_DEPLOYMENT.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'TN.doc', name: 'TESTNET_DEPLOYMENT.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'TN.sec.3',   pattern: /## 3\. Deployment manifest/ },
        { id: 'TN.sec.3_1', pattern: /### 3\.1 Gating preconditions/ },
        { id: 'TN.sec.3_2', pattern: /### 3\.2 Deployment artefacts/ },
        { id: 'TN.sec.3_3', pattern: /### 3\.3 Network selection/ },
        { id: 'TN.sec.4',   pattern: /## 4\. Deployment steps/ },
        { id: 'TN.sec.5',   pattern: /## 5\. End-to-end subscription flow/ },
        { id: 'TN.sec.5_1', pattern: /### 5\.1 Fixture/ },
        { id: 'TN.sec.5_2', pattern: /### 5\.2 Happy path/ },
        { id: 'TN.sec.5_3', pattern: /### 5\.3 Error-path coverage/ },
        { id: 'TN.sec.6',   pattern: /## 6\. Test bar/ },
        { id: 'TN.sec.6_1', pattern: /### 6\.1 Dashboard test bar/ },
        { id: 'TN.sec.6_2', pattern: /### 6\.2 Wallet-ui test bar/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `TESTNET_DEPLOYMENT.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 AC-3 / AC-7 / AC-8',
        });
    }

    // §6.1 / §6.2 must lock the 47 / 28 test bar from Issue #139 §8 AC-8.
    results.push({
        id: 'TN.bar.dashboard',
        name: `TESTNET_DEPLOYMENT.md §6.1 anchors the ${DASHBOARD_TEST_BAR}-test dashboard bar`,
        passed: new RegExp(`${DASHBOARD_TEST_BAR}\\s*tests?`).test(content),
        detail: 'Issue #139 §8 AC-8 — dashboard',
    });
    results.push({
        id: 'TN.bar.walletui',
        name: `TESTNET_DEPLOYMENT.md §6.2 anchors the ${WALLET_UI_TEST_BAR}-test wallet-ui bar`,
        passed: new RegExp(`${WALLET_UI_TEST_BAR}\\s*tests?`).test(content),
        detail: 'Issue #139 §8 AC-8 — wallet-ui',
    });

    // §5.3 error-path coverage must mention every error code 1..9.
    for (const code of ERROR_RP_CODES) {
        if (code.value === 0) continue; // success code — no error-path row
        results.push({
            id: `TN.err.${code.name}`,
            name: `TESTNET_DEPLOYMENT.md §5.3 exercises ${code.name} (${code.value})`,
            passed: new RegExp(`\\b${code.name}\\b`).test(content),
            detail: 'Error-path test coverage',
        });
    }

    return results;
}

export function checkBugBountyDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'BB.doc', name: 'BUG_BOUNTY.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'BB.doc', name: 'BUG_BOUNTY.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'BB.sec.3', pattern: /## 3\. In-scope assets/ },
        { id: 'BB.sec.4', pattern: /## 4\. Recurring-payments-specific severity uplifts/ },
        { id: 'BB.sec.5', pattern: /## 5\. Recurring-payments-specific out-of-scope clarifications/ },
        { id: 'BB.sec.6', pattern: /## 6\. Threat-catalogue cross-reference/ },
        { id: 'BB.sec.7', pattern: /## 7\. Activation timeline/ },
        { id: 'BB.sec.8', pattern: /## 8\. Triage SLA/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `BUG_BOUNTY.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #139 — bounty addendum',
        });
    }

    // Each T-RP-N threat must map to a bounty band in §6.
    for (const threat of T_RP_THREATS) {
        results.push({
            id: `BB.threat.${threat}`,
            name: `BUG_BOUNTY.md §6 maps A2 threat ${threat} to a bounty band`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'A2 ↔ A5 traceability',
        });
    }

    // Activation must be gated on A2 verdict READY.
    results.push({
        id: 'BB.a2-gate',
        name: 'BUG_BOUNTY.md states activation requires A2 verdict READY',
        passed: /A2 verdict `READY`/.test(content) || /verdict `READY`/.test(content),
        detail: 'Issue #139 §3 prerequisite',
    });

    // RC-BOUNTY-CRITICAL — the pause reason code referenced from §8.
    results.push({
        id: 'BB.pause-rc',
        name: 'BUG_BOUNTY.md §8 cites RC-BOUNTY-CRITICAL pause reason code',
        passed: /RC-BOUNTY-CRITICAL/.test(content),
        detail: 'Critical-finding pause integration with MONITORING.md §3.6 SUB-M18',
    });

    return results;
}

// ==================== CONTRACT EVIDENCE CHECKS ====================
// These checks read the live contract to confirm pre-A2 state. They
// are how R-RP-CH-3 (no surprise contract changes) is detected from
// the PR side: if the contract no longer shows the pre-A2 shapes
// asserted here, the validator demands a matching RP-CH-N entry in §3
// of CONTRACT_HARDENING.md before the PR can land.

export function checkContractEvidence(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'CT.tact', name: 'RecurringPayments.tact present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'CT.tact', name: 'RecurringPayments.tact present', passed: true, detail: 'found' });

    // Error code constants 0..9 (lines 98–107).
    for (const code of ERROR_RP_CODES) {
        results.push({
            id: `CT.const.${code.name}`,
            name: `RecurringPayments.tact declares ${code.name} = ${code.value}`,
            passed: new RegExp(
                `const ${code.name}:\\s*Int\\s*=\\s*${code.value}\\b`,
            ).test(content),
            detail: 'Error code registry — contract <-> docs binding',
        });
    }

    // MIN_PERIOD_SECONDS = 3600 (line 109).
    results.push({
        id: 'CT.min-period',
        name: 'RecurringPayments.tact declares MIN_PERIOD_SECONDS = 3600',
        passed: /const MIN_PERIOD_SECONDS:\s*Int\s*=\s*3600\b/.test(content),
        detail: 'SPECIFICATION.md §4.2 floor',
    });

    // Pre-RP-CH-1 marker: mandateKey still uses integer addition.
    // If a PR replaces the combinator without ALSO updating §3.2 of
    // SPECIFICATION.md and CONTRACT_HARDENING.md §3 RP-CH-1, this trips.
    results.push({
        id: 'CT.mandateKey.addition',
        name: 'RecurringPayments.tact mandateKey still uses integer addition (RP-CH-1 pending)',
        passed: /fun mandateKey[\s\S]{0,200}sha256\(nft_address\.asSlice\(\)\)\s*\+\s*mandate_id/.test(content),
        detail: 'Confirms RP-CH-1 has not landed yet — see CONTRACT_HARDENING.md §3',
    });

    // RP-CH-2 / Issue #432: test-only authority seeding is absent from production.
    results.push({
        id: 'CT.testonly.RegisterNFTOwnerRecurring',
        name: 'RecurringPayments.tact excludes RegisterNFTOwnerRecurring (RP-CH-2 landed)',
        passed: !/RegisterNFTOwnerRecurring/.test(content),
        detail: 'Issue #432: authority seeding exists only in the non-deployable harness',
    });

    // Schedule enforcement still uses ERROR_RP_TOO_EARLY (T-RP-2 closure).
    results.push({
        id: 'CT.schedule.too-early',
        name: 'RecurringPayments.tact rejects double-execution via ERROR_RP_TOO_EARLY',
        passed: /ERROR_RP_TOO_EARLY/.test(content),
        detail: 'T-RP-2 closure — see SPECIFICATION.md §5.2',
    });

    return results;
}

// ==================== CROSS-DOCUMENT CHECKS ====================
// Each rule corresponds to a numbered guardrail in CONTRACT_HARDENING.md
// §5. R-RP-CH-2 ("every RP-CH-N reference resolves to a §3 row") is the
// most prolific producer of cross-doc failures.

export function checkCrossDocReferences(
    docs: Record<string, string | null>,
): CheckResult[] {
    const results: CheckResult[] = [];

    // R-RP-CH-2: every RP-CH-N mention in the seven other recurring-payments
    // documents must exist as a `### RP-CH-N —` heading in
    // CONTRACT_HARDENING.md §3.
    const hardening = docs.contractHardening;
    if (hardening != null) {
        const documentedItems = new Set<string>();
        const headingMatches = hardening.matchAll(/^### (RP-CH-\d+) —/gm);
        for (const m of headingMatches) documentedItems.add(m[1]);

        for (const [name, content] of Object.entries(docs)) {
            if (content == null || name === 'contractHardening') continue;
            const referencedItems = new Set<string>();
            const refMatches = content.matchAll(/\bRP-CH-(\d+)\b/g);
            for (const m of refMatches) referencedItems.add(`RP-CH-${m[1]}`);

            for (const ref of referencedItems) {
                results.push({
                    id: `XR.RP-CH.${name}.${ref}`,
                    name: `${name} cites ${ref} which resolves to a §3 heading`,
                    passed: documentedItems.has(ref),
                    detail: 'R-RP-CH-2 of CONTRACT_HARDENING.md §5',
                });
            }
        }
    }

    // Threat-catalogue parity: every T-RP-N in SPECIFICATION.md §9 must also
    // appear in BUG_BOUNTY.md §6.
    const sp = docs.specification;
    const bb = docs.bugBounty;
    if (sp != null && bb != null) {
        for (const threat of T_RP_THREATS) {
            results.push({
                id: `XR.threat.${threat}`,
                name: `Threat ${threat} present in both SPECIFICATION.md §9 and BUG_BOUNTY.md §6`,
                passed:
                    new RegExp(`\\*\\*${threat}\\*\\*`).test(sp) &&
                    new RegExp(`\\*\\*${threat}\\*\\*`).test(bb),
                detail: 'A2 ↔ A5 catalogue parity',
            });
        }
    }

    // SUB-Mxx ↔ severity matrix: every SUB-Mxx alert in §3 must appear in
    // exactly one row of §3.7 (the pager severity matrix).
    const mn = docs.monitoring;
    if (mn != null) {
        // Slice §3.7 by splitting on "## 4. Data sources" (next section heading).
        const idx37 = mn.indexOf('### 3.7 Roll-up');
        const idxNext = mn.indexOf('## 4. Data sources');
        if (idx37 >= 0 && idxNext > idx37) {
            const slice37 = mn.slice(idx37, idxNext);
            for (const alert of SUB_M_IDS) {
                const referenced = new RegExp(`\\b${alert}\\b`).test(slice37);
                results.push({
                    id: `XR.sev.${alert}`,
                    name: `MONITORING.md §3.7 severity matrix references ${alert}`,
                    passed: referenced,
                    detail: 'Catalogue ↔ severity matrix consistency',
                });
            }
        } else {
            results.push({
                id: 'XR.sev.matrix',
                name: 'MONITORING.md §3.7 severity matrix locatable',
                passed: false,
                detail: 'Could not locate §3.7 between expected anchors',
            });
        }
    }

    // RP-Nxx ↔ MONITORING.md: every RP-N0X cited by MONITORING.md §3.4 must
    // exist in the NOTIFICATIONS.md catalogue.
    const nf = docs.notifications;
    if (mn != null && nf != null) {
        const referencedFromMonitoring = new Set<string>();
        for (const m of mn.matchAll(/\bRP-N(\d{2})\b/g)) {
            referencedFromMonitoring.add(`RP-N${m[1]}`);
        }
        for (const id of referencedFromMonitoring) {
            results.push({
                id: `XR.rpn.${id}`,
                name: `MONITORING.md cites notification ${id} which exists in NOTIFICATIONS.md §3`,
                passed: new RegExp(`\\*\\*${id}\\*\\*`).test(nf),
                detail: 'NOTIFICATIONS ↔ MONITORING cross-ref',
            });
        }
    }

    // Error-code parity: every ERROR_RP_* declared in the contract must appear
    // verbatim (by name) in BOTH SPECIFICATION.md §7 and TESTNET_DEPLOYMENT.md §5.3.
    const td = docs.testnetDeployment;
    if (sp != null && td != null) {
        for (const code of ERROR_RP_CODES) {
            if (code.value === 0) continue; // success code stays implicit
            const inSpec = new RegExp(`\\b${code.name}\\b`).test(sp);
            const inTestnet = new RegExp(`\\b${code.name}\\b`).test(td);
            results.push({
                id: `XR.err.${code.name}`,
                name: `${code.name} (${code.value}) named in SPECIFICATION.md and TESTNET_DEPLOYMENT.md`,
                passed: inSpec && inTestnet,
                detail: 'Error-code traceability',
            });
        }
    }

    // Period seconds parity: SPECIFICATION.md §4.2 ↔ DASHBOARD_INTEGRATION.md.
    const di = docs.dashboardIntegration;
    if (sp != null && di != null) {
        for (const period of BILLING_PERIOD_SECONDS) {
            const inSpec = new RegExp(
                `\\|\\s*\`${period.name}\`\\s*\\|\\s*\`${period.seconds}\``,
            ).test(sp);
            const inDashboard = new RegExp(`\\b${period.name}\\b`).test(di);
            results.push({
                id: `XR.period.${period.name}`,
                name: `Billing period ${period.name} (${period.seconds}s) anchored in SPECIFICATION.md §4.2 and surfaced in DASHBOARD_INTEGRATION.md`,
                passed: inSpec && inDashboard,
                detail: 'Off-chain ↔ on-chain period contract',
            });
        }
    }

    // Wallet-ui ↔ NOTIFICATIONS opt-in path: WALLET_UX.md §6 must reference
    // NOTIFICATIONS.md, since the wallet registers the push token.
    const wx = docs.walletUx;
    if (wx != null && nf != null) {
        results.push({
            id: 'XR.wx-nf.optin',
            name: 'WALLET_UX.md §6 hooks into NOTIFICATIONS.md',
            passed: /NOTIFICATIONS\.md/.test(wx),
            detail: 'Issue #139 §8 AC-5 ↔ AC-6 stitching',
        });
    }

    // R-RP-CH-1 (A2 verdict gate) — if A2 STATUS.md exists, require it to
    // report verdict before RP-CH-N items are allowed to land. Until A2
    // ships, this check passes informatively.
    if (existsSync(PATHS.a2Status)) {
        const status = readFileSync(PATHS.a2Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status);
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md records verdict READY (gate for RP-CH-N landings)',
            passed: verdictReady,
            detail: 'R-RP-CH-1 of CONTRACT_HARDENING.md §5 — only enforced when STATUS.md exists',
        });
    } else {
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md not yet created (gate currently inactive)',
            passed: true,
            detail: 'R-RP-CH-1 inactive until STATUS.md exists — current PR scope is documentation-only',
        });
    }

    // R-RP-CH-1 informational note: gate currently inactive when A2 verdict
    // is not yet READY. The gate is informational — documentation-only PRs
    // (this one) still land, but any contract diff must be paired with a
    // verdict-READY STATUS.md.
    if (existsSync(PATHS.a2Status)) {
        const status = readFileSync(PATHS.a2Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status);
        if (!verdictReady) {
            results.push({
                id: 'XR.a2.gate-state',
                name: 'A2 gate state: PENDING (documentation-only PRs land; contract diffs blocked)',
                passed: true,
                detail: 'Informational — A2 verdict not yet READY',
            });
        }
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
    const docs = {
        specification:        readSafe(PATHS.specification),
        dashboardIntegration: readSafe(PATHS.dashboardIntegration),
        walletUx:             readSafe(PATHS.walletUx),
        notifications:        readSafe(PATHS.notifications),
        monitoring:           readSafe(PATHS.monitoring),
        contractHardening:    readSafe(PATHS.contractHardening),
        testnetDeployment:    readSafe(PATHS.testnetDeployment),
        bugBounty:            readSafe(PATHS.bugBounty),
    };
    const contract = readSafe(PATHS.contract);

    const results = [
        ...checkSpecificationDoc(docs.specification),
        ...checkDashboardIntegrationDoc(docs.dashboardIntegration),
        ...checkWalletUxDoc(docs.walletUx),
        ...checkNotificationsDoc(docs.notifications),
        ...checkMonitoringDoc(docs.monitoring),
        ...checkContractHardeningDoc(docs.contractHardening),
        ...checkTestnetDeploymentDoc(docs.testnetDeployment),
        ...checkBugBountyDoc(docs.bugBounty),
        ...checkContractEvidence(contract),
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
            'Usage: ts-node scripts/recurring-payments/check-recurring-payments-readiness.ts [--classify AC-x] [--strict]\n',
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
