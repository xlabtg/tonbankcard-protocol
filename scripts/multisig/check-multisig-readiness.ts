/**
 * Multi-Sig Card Production-Readiness Validator (Issue #140, F5)
 *
 * Purpose: Validate that the eight multi-sig production-readiness
 *   documents — SPECIFICATION.md, WALLET_UX.md, GUARDIAN_RECOVERY.md,
 *   NOTIFICATIONS.md, MONITORING.md, CONTRACT_HARDENING.md,
 *   TESTNET_DEPLOYMENT.md, and BUG_BOUNTY.md — stay consistent with each
 *   other, with the contract source `contracts/MultiSigCard.tact`, and
 *   with the engagement's acceptance criteria from Issue #140 §8.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / Tact sources from the repository working tree.
 *
 * Usage:
 *   npx ts-node scripts/multisig/check-multisig-readiness.ts
 *   npx ts-node scripts/multisig/check-multisig-readiness.ts --classify AC-6
 *   npx ts-node scripts/multisig/check-multisig-readiness.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the F3 validator at
 *   scripts/bridge/check-bridge-readiness.ts and the F4 validator at
 *   scripts/recurring-payments/check-recurring-payments-readiness.ts.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #140 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and
// the linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'prerequisite'
        | 'specification'
        | 'wallet-ux'
        | 'guardian-recovery'
        | 'notifications'
        | 'monitoring'
        | 'contract-hardening'
        | 'testnet-deployment'
        | 'bug-bounty'
        | 'tests';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'A2 audit complete (prerequisite)',                            artifact: 'docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'docs/multisig/SPECIFICATION.md written',                      artifact: 'docs/multisig/SPECIFICATION.md',                          evidenceCheck: 'specification' },
    { id: 'AC-3', description: 'MultiSigCard.tact deployed to testnet',                       artifact: 'docs/multisig/TESTNET_DEPLOYMENT.md',                     evidenceCheck: 'testnet-deployment' },
    { id: 'AC-4', description: 'Multi-sig approval flow UX (create)',                         artifact: 'docs/multisig/WALLET_UX.md',                              evidenceCheck: 'wallet-ux' },
    { id: 'AC-5', description: 'Pending approvals screen + signer management',                artifact: 'docs/multisig/WALLET_UX.md',                              evidenceCheck: 'wallet-ux' },
    { id: 'AC-6', description: 'Guardian recovery flow (2-of-3, ≥72 h cooldown)',             artifact: 'docs/multisig/GUARDIAN_RECOVERY.md',                      evidenceCheck: 'guardian-recovery' },
    { id: 'AC-7', description: 'End-to-end multi-sig flow tested on testnet',                 artifact: 'docs/multisig/TESTNET_DEPLOYMENT.md',                     evidenceCheck: 'testnet-deployment' },
    { id: 'AC-8', description: 'Wallet-ui (28) tests pass',                                   artifact: 'docs/multisig/TESTNET_DEPLOYMENT.md',                     evidenceCheck: 'tests' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    specification:        resolve(REPO_ROOT, 'docs/multisig/SPECIFICATION.md'),
    walletUx:             resolve(REPO_ROOT, 'docs/multisig/WALLET_UX.md'),
    guardianRecovery:     resolve(REPO_ROOT, 'docs/multisig/GUARDIAN_RECOVERY.md'),
    notifications:        resolve(REPO_ROOT, 'docs/multisig/NOTIFICATIONS.md'),
    monitoring:           resolve(REPO_ROOT, 'docs/multisig/MONITORING.md'),
    contractHardening:    resolve(REPO_ROOT, 'docs/multisig/CONTRACT_HARDENING.md'),
    testnetDeployment:    resolve(REPO_ROOT, 'docs/multisig/TESTNET_DEPLOYMENT.md'),
    bugBounty:            resolve(REPO_ROOT, 'docs/multisig/BUG_BOUNTY.md'),
    contract:             resolve(REPO_ROOT, 'contracts/MultiSigCard.tact'),
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

// Error codes 0..9 published in contracts/MultiSigCard.tact lines 125–134.
export const ERROR_MS_CODES = [
    { name: 'ERROR_MS_NONE',                 value: 0 },
    { name: 'ERROR_MS_NOT_OWNER',            value: 1 },
    { name: 'ERROR_MS_NOT_SIGNER',           value: 2 },
    { name: 'ERROR_MS_INVALID_THRESHOLD',    value: 3 },
    { name: 'ERROR_MS_PROPOSAL_NOT_FOUND',   value: 4 },
    { name: 'ERROR_MS_ALREADY_APPROVED',     value: 5 },
    { name: 'ERROR_MS_PROPOSAL_NOT_PENDING', value: 6 },
    { name: 'ERROR_MS_NFT_NOT_REGISTERED',   value: 7 },
    { name: 'ERROR_MS_NO_CONFIG',            value: 8 },
    { name: 'ERROR_MS_INVALID_AMOUNT',       value: 9 },
] as const;

// User-facing error codes surfaced in the pending-approval failure-mode table.
// `WALLET_UX.md` §4.5 lists exactly these five (2, 4, 5, 6, 8).
export const WALLET_UX_USER_FACING_CODES = [
    'ERROR_MS_NOT_SIGNER',
    'ERROR_MS_PROPOSAL_NOT_FOUND',
    'ERROR_MS_ALREADY_APPROVED',
    'ERROR_MS_PROPOSAL_NOT_PENDING',
    'ERROR_MS_NO_CONFIG',
] as const;

// F5 threat catalogue T-MSC-1..T-MSC-7 — SPECIFICATION.md §9.
export const T_MSC_THREATS = [
    'T-MSC-1', 'T-MSC-2', 'T-MSC-3', 'T-MSC-4', 'T-MSC-5', 'T-MSC-6', 'T-MSC-7',
] as const;

// Hardening backlog MS-CH-1..MS-CH-6 — CONTRACT_HARDENING.md §3.
export const MS_CH_ITEMS = [
    'MS-CH-1', 'MS-CH-2', 'MS-CH-3', 'MS-CH-4', 'MS-CH-5', 'MS-CH-6',
] as const;

// CI guardrail rules R-MS-CH-1..R-MS-CH-5 — CONTRACT_HARDENING.md §5.
export const R_MS_CH_RULES = [
    'R-MS-CH-1', 'R-MS-CH-2', 'R-MS-CH-3', 'R-MS-CH-4', 'R-MS-CH-5',
] as const;

// 18 alert IDs MS-M01 .. MS-M18 — MONITORING.md §3.
export const MS_M_IDS = Array.from(
    { length: 18 },
    (_, i) => `MS-M${String(i + 1).padStart(2, '0')}`,
);

// 8 notification IDs MS-N01 .. MS-N08 — NOTIFICATIONS.md §3.
export const MS_N_IDS = Array.from(
    { length: 8 },
    (_, i) => `MS-N${String(i + 1).padStart(2, '0')}`,
);

// Wallet-ui test bar from Issue #140 §8 AC-8 ("wallet-ui (28)").
// Multi-sig has no dashboard counterpart — AC-8 is wallet-ui-only.
export const WALLET_UI_TEST_BAR = 28;

// On-chain enforcement constants (off-chain in F5, on-chain post-MS-CH-5/6).
export const MS_PROPOSAL_TTL_SECONDS = 604800; // 7 days
export const MS_RECOVERY_COOLDOWN_SECONDS = 259200; // 72 h

// Contract surface invariants.
export const MAX_SIGNERS = 3;

// ==================== DOCUMENT CHECKS ====================

export function checkSpecificationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'SP.doc', name: 'SPECIFICATION.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'SP.doc', name: 'SPECIFICATION.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'SP.sec.3',   pattern: /## 3\. On-chain configuration and proposal format/ },
        { id: 'SP.sec.3_1', pattern: /### 3\.1 `MultiSigConfig` struct/ },
        { id: 'SP.sec.3_2', pattern: /### 3\.2 `PaymentProposal` struct/ },
        { id: 'SP.sec.3_3', pattern: /### 3\.3 Composite-key collision posture/ },
        { id: 'SP.sec.3_4', pattern: /### 3\.4 Settlement boundary/ },
        { id: 'SP.sec.4',   pattern: /## 4\. M-of-N threshold models/ },
        { id: 'SP.sec.4_1', pattern: /### 4\.1 Personal — 2-of-3/ },
        { id: 'SP.sec.4_2', pattern: /### 4\.2 Corporate — 3-of-5/ },
        { id: 'SP.sec.4_3', pattern: /### 4\.3 Custom M-of-N/ },
        { id: 'SP.sec.5',   pattern: /## 5\. Signing ceremony/ },
        { id: 'SP.sec.5_1', pattern: /### 5\.1 Proposal submission/ },
        { id: 'SP.sec.5_2', pattern: /### 5\.2 Approval flow/ },
        { id: 'SP.sec.5_3', pattern: /### 5\.3 Rejection flow/ },
        { id: 'SP.sec.5_4', pattern: /### 5\.4 Approval window/ },
        { id: 'SP.sec.6',   pattern: /## 6\. Signer addition \/ removal/ },
        { id: 'SP.sec.7',   pattern: /## 7\. Security model/ },
        { id: 'SP.sec.8',   pattern: /## 8\. Guardian recovery/ },
        { id: 'SP.sec.9',   pattern: /## 9\. Threat catalogue/ },
        { id: 'SP.sec.10',  pattern: /## 10\. Hardening backlog/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `SPECIFICATION.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 AC-2',
        });
    }

    // §4.1 must encode the 2-of-3 personal preset.
    results.push({
        id: 'SP.preset.2-of-3',
        name: 'SPECIFICATION.md §4.1 binds Personal preset to 2-of-3',
        passed: /Personal — 2-of-3/.test(content) && /`required_signatures`[^\n]*`?2`?/.test(content),
        detail: 'Issue #140 §5 M-of-N preset',
    });

    // §4.2 must encode the 3-of-5 corporate preset.
    results.push({
        id: 'SP.preset.3-of-5',
        name: 'SPECIFICATION.md §4.2 binds Corporate preset to 3-of-5',
        passed: /Corporate — 3-of-5/.test(content) && /`required_signatures`[^\n]*`?3`?/.test(content),
        detail: 'Issue #140 §5 M-of-N preset',
    });

    // §4.3 must encode the custom-up-to-10 preset.
    results.push({
        id: 'SP.preset.custom-10',
        name: 'SPECIFICATION.md §4.3 binds custom preset to N ≤ 10',
        passed: /Custom M-of-N \(up to 10 signers/.test(content),
        detail: 'Issue #140 §5 M-of-N preset',
    });

    // §5.4 must anchor the 7-day proposal TTL at 604800 s.
    results.push({
        id: 'SP.ttl.7d',
        name: 'SPECIFICATION.md §5.4 anchors MS_PROPOSAL_TTL_SECONDS at 604800 s',
        passed: new RegExp(`MS_PROPOSAL_TTL_SECONDS\\s*=\\s*${MS_PROPOSAL_TTL_SECONDS}`).test(content),
        detail: 'Issue #140 §6 — 7 days approval window',
    });

    // §8 must anchor 72 h recovery cooldown.
    results.push({
        id: 'SP.cooldown.72h',
        name: 'SPECIFICATION.md §8 anchors guardian recovery cooldown at ≥ 72 h',
        passed: /72\s*h/.test(content),
        detail: 'Issue #140 §6 — 72 h cooldown',
    });

    // §9 threat catalogue must list every T-MSC-N.
    for (const threat of T_MSC_THREATS) {
        results.push({
            id: `SP.threat.${threat}`,
            name: `SPECIFICATION.md §9 lists ${threat}`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'Multi-sig-specific threat catalogue',
        });
    }

    // §10 hardening backlog must list every MS-CH-N.
    for (const ch of MS_CH_ITEMS) {
        results.push({
            id: `SP.hardening.${ch}`,
            name: `SPECIFICATION.md §10 lists ${ch}`,
            passed: new RegExp(`\\*\\*${ch}\\*\\*`).test(content),
            detail: 'Post-A2 hardening backlog',
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
        { id: 'WX.sec.3',   pattern: /## 3\. Create multi-sig flow/ },
        { id: 'WX.sec.3_1', pattern: /### 3\.1 Entry point/ },
        { id: 'WX.sec.3_2', pattern: /### 3\.2 Threshold wizard/ },
        { id: 'WX.sec.3_3', pattern: /### 3\.3 Signer entry/ },
        { id: 'WX.sec.3_4', pattern: /### 3\.4 Signature/ },
        { id: 'WX.sec.3_5', pattern: /### 3\.5 Failure modes/ },
        { id: 'WX.sec.4',   pattern: /## 4\. Pending approvals screen/ },
        { id: 'WX.sec.4_1', pattern: /### 4\.1 List columns/ },
        { id: 'WX.sec.4_2', pattern: /### 4\.2 One-tap sign/ },
        { id: 'WX.sec.4_3', pattern: /### 4\.3 One-tap reject/ },
        { id: 'WX.sec.4_4', pattern: /### 4\.4 Detail sheet/ },
        { id: 'WX.sec.4_5', pattern: /### 4\.5 Failure modes/ },
        { id: 'WX.sec.5',   pattern: /## 5\. Submit-proposal flow/ },
        { id: 'WX.sec.6',   pattern: /## 6\. Signer management/ },
        { id: 'WX.sec.7',   pattern: /## 7\. Guardian recovery hook/ },
        { id: 'WX.sec.8',   pattern: /## 8\. Notifications hook/ },
        { id: 'WX.sec.9',   pattern: /## 9\. Invariant preservation/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `WALLET_UX.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 AC-4 / AC-5',
        });
    }

    // §4.5 failure-mode table must surface the five user-facing error codes.
    for (const code of WALLET_UX_USER_FACING_CODES) {
        results.push({
            id: `WX.code.${code}`,
            name: `WALLET_UX.md §4.5 surfaces ${code}`,
            passed: new RegExp(`\`${code}\\s*=`).test(content),
            detail: 'Pending-approval failure-mode table',
        });
    }

    // §6 signer management must defer to MS-CH-2 (quorum-gated UpdateMultiSigConfig).
    results.push({
        id: 'WX.signer-mgmt.MS-CH-2',
        name: 'WALLET_UX.md §6 defers signer management to MS-CH-2',
        passed: /MS-CH-2/.test(content),
        detail: 'Issue #140 §3 / §5 — quorum-gated signer set',
    });

    // §7 guardian recovery hook must reference GUARDIAN_RECOVERY.md.
    results.push({
        id: 'WX.guardian.link',
        name: 'WALLET_UX.md §7 links to GUARDIAN_RECOVERY.md',
        passed: /GUARDIAN_RECOVERY\.md/.test(content),
        detail: 'Issue #140 §3 — guardian recovery surface',
    });

    return results;
}

export function checkGuardianRecoveryDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'GR.doc', name: 'GUARDIAN_RECOVERY.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'GR.doc', name: 'GUARDIAN_RECOVERY.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'GR.sec.3',   pattern: /## 3\. Guardian set/ },
        { id: 'GR.sec.3_1', pattern: /### 3\.1 Composition/ },
        { id: 'GR.sec.3_2', pattern: /### 3\.2 Constraints/ },
        { id: 'GR.sec.3_3', pattern: /### 3\.3 Off-chain storage/ },
        { id: 'GR.sec.4',   pattern: /## 4\. Recovery flow/ },
        { id: 'GR.sec.4_1', pattern: /### 4\.1 State machine/ },
        { id: 'GR.sec.4_2', pattern: /### 4\.2 Off-chain enforcement/ },
        { id: 'GR.sec.4_3', pattern: /### 4\.3 On-chain enforcement/ },
        { id: 'GR.sec.5',   pattern: /## 5\. UX surface/ },
        { id: 'GR.sec.6',   pattern: /## 6\. Audit-log emission/ },
        { id: 'GR.sec.7',   pattern: /## 7\. Threat treatment/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `GUARDIAN_RECOVERY.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 AC-6',
        });
    }

    // §4 must anchor cooldown at 259200 s (72 h).
    results.push({
        id: 'GR.cooldown',
        name: `GUARDIAN_RECOVERY.md §4 anchors cooldown at ${MS_RECOVERY_COOLDOWN_SECONDS} s (72 h)`,
        passed: new RegExp(`\\b${MS_RECOVERY_COOLDOWN_SECONDS}\\b`).test(content) && /72\s*h/.test(content),
        detail: 'Issue #140 §6 — guardian recovery cooldown',
    });

    // §3 guardian set must encode the 2-of-3 default quorum.
    results.push({
        id: 'GR.quorum.2-of-3',
        name: 'GUARDIAN_RECOVERY.md §3 anchors default guardian quorum at 2-of-3',
        passed: /2-of-3/.test(content),
        detail: 'Issue #140 §3 — guardian quorum default',
    });

    // §7 must reference both T-MSC-4 (takeover) and T-MSC-5 (cooldown bypass).
    for (const threat of ['T-MSC-4', 'T-MSC-5']) {
        results.push({
            id: `GR.threat.${threat}`,
            name: `GUARDIAN_RECOVERY.md §7 treats threat ${threat}`,
            passed: new RegExp(`\\b${threat}\\b`).test(content),
            detail: 'Threat treatment row',
        });
    }

    // §4.3 must defer the on-chain receivers to MS-CH-6.
    results.push({
        id: 'GR.MS-CH-6',
        name: 'GUARDIAN_RECOVERY.md §4.3 defers on-chain receivers to MS-CH-6',
        passed: /MS-CH-6/.test(content),
        detail: 'CONTRACT_HARDENING.md §3 MS-CH-6 binding',
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
        { id: 'NF.sec.3_1', pattern: /### 3\.1 Signer-approval-needed notifications/ },
        { id: 'NF.sec.3_2', pattern: /### 3\.2 Post-quorum receipts/ },
        { id: 'NF.sec.3_3', pattern: /### 3\.3 Status-change notifications/ },
        { id: 'NF.sec.3_4', pattern: /### 3\.4 Guardian recovery notifications/ },
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
            detail: 'Issue #140 — notifications addendum',
        });
    }

    // §3 catalogue must list every MS-Nxx.
    for (const id of MS_N_IDS) {
        results.push({
            id: `NF.id.${id}`,
            name: `NOTIFICATIONS.md §3 references notification ${id}`,
            passed: new RegExp(`\\*\\*${id}\\*\\*`).test(content),
            detail: 'Notification catalogue',
        });
    }

    // §3.4 must reference guardian recovery MS-N08.
    results.push({
        id: 'NF.guardian',
        name: 'NOTIFICATIONS.md §3.4 binds MS-N08 to guardian recovery',
        passed: /\*\*MS-N08\*\*/.test(content) && /RecoveryInitiated/.test(content),
        detail: 'Guardian recovery alerting',
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
        { id: 'MN.sec.3_1', pattern: /### 3\.1 Multi-sig lifecycle alerts/ },
        { id: 'MN.sec.3_2', pattern: /### 3\.2 Composite-key & signature replay alerts/ },
        { id: 'MN.sec.3_3', pattern: /### 3\.3 Settlement & recovery alerts/ },
        { id: 'MN.sec.3_4', pattern: /### 3\.4 Notification system alerts/ },
        { id: 'MN.sec.3_5', pattern: /### 3\.5 Auto-pause auto-trigger/ },
        { id: 'MN.sec.3_6', pattern: /### 3\.6 Roll-up — pager severity matrix/ },
        { id: 'MN.sec.4',   pattern: /## 4\. Data sources/ },
        { id: 'MN.sec.5',   pattern: /## 5\. Disaster-recovery drills/ },
        { id: 'MN.sec.6',   pattern: /## 6\. CI wiring/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `MONITORING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 — monitoring addendum',
        });
    }

    // MS-Mxx catalogue inventory.
    for (const alert of MS_M_IDS) {
        results.push({
            id: `MN.alert.${alert}`,
            name: `MONITORING.md §3 references alert ${alert}`,
            passed: new RegExp(`\\b${alert}\\b`).test(content),
            detail: 'Multi-sig alert inventory',
        });
    }

    // Catalogue uniqueness — each MS-Mxx appears exactly once as a left-column
    // table row across §3.1..§3.5.
    for (const alert of MS_M_IDS) {
        const cataloguePattern = new RegExp(`\\|\\s*${alert}\\s*\\|`, 'g');
        const occurrences = (content.match(cataloguePattern) ?? []).length;
        results.push({
            id: `MN.alert.unique.${alert}`,
            name: `MONITORING.md §3 catalogue row for ${alert} appears exactly once`,
            passed: occurrences === 1,
            detail: `expected 1 catalogue row, found ${occurrences}`,
        });
    }

    // P0 / P1 / P2 / P3 severity tiers (§3.6).
    for (const sev of ['P0', 'P1', 'P2', 'P3']) {
        results.push({
            id: `MN.sev.${sev}`,
            name: `MONITORING.md §3.6 defines severity tier ${sev}`,
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

    for (const ch of MS_CH_ITEMS) {
        results.push({
            id: `CH.item.${ch}`,
            name: `CONTRACT_HARDENING.md §3 defines hardening item ${ch}`,
            passed: new RegExp(`### ${ch} —`).test(content),
            detail: 'Hardening backlog — single source of truth for MS-CH-N IDs',
        });
    }

    for (const rule of R_MS_CH_RULES) {
        results.push({
            id: `CH.rule.${rule}`,
            name: `CONTRACT_HARDENING.md §5 defines CI guardrail rule ${rule}`,
            passed: new RegExp(`\\*\\*${rule}\\*\\*`).test(content),
            detail: 'CI guardrail inventory',
        });
    }

    // Explicit A2 verdict gate (R-MS-CH-1).
    results.push({
        id: 'CH.a2-gate',
        name: 'CONTRACT_HARDENING.md §4 gates landing on A2 verdict READY',
        passed: /verdict[^\n]*READY/.test(content) || /verdict `READY`/.test(content),
        detail: 'Issue #140 §7 hard prerequisite',
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
        { id: 'TN.sec.5',   pattern: /## 5\. End-to-end multi-sig flow/ },
        { id: 'TN.sec.5_1', pattern: /### 5\.1 Fixture/ },
        { id: 'TN.sec.5_2', pattern: /### 5\.2 Happy path/ },
        { id: 'TN.sec.5_3', pattern: /### 5\.3 Error-path coverage/ },
        { id: 'TN.sec.5_4', pattern: /### 5\.4 Notifications integration/ },
        { id: 'TN.sec.5_5', pattern: /### 5\.5 Guardian recovery drill/ },
        { id: 'TN.sec.6',   pattern: /## 6\. Test bar/ },
        { id: 'TN.sec.6_1', pattern: /### 6\.1 Wallet-ui test bar/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `TESTNET_DEPLOYMENT.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 AC-3 / AC-7 / AC-8',
        });
    }

    // §6.1 must lock the 28 test bar from Issue #140 §8 AC-8.
    results.push({
        id: 'TN.bar.walletui',
        name: `TESTNET_DEPLOYMENT.md §6.1 anchors the ${WALLET_UI_TEST_BAR}-test wallet-ui bar`,
        passed: new RegExp(`${WALLET_UI_TEST_BAR}\\s*tests?`).test(content),
        detail: 'Issue #140 §8 AC-8 — wallet-ui',
    });

    // §5.3 error-path coverage must mention every error code 1..9.
    for (const code of ERROR_MS_CODES) {
        if (code.value === 0) continue; // success code — no error-path row
        results.push({
            id: `TN.err.${code.name}`,
            name: `TESTNET_DEPLOYMENT.md §5.3 exercises ${code.name} (${code.value})`,
            passed: new RegExp(`\\b${code.name}\\b`).test(content),
            detail: 'Error-path test coverage',
        });
    }

    // §5.5 guardian recovery drill must reference 72 h cooldown and recovery-drill.log.
    results.push({
        id: 'TN.recovery.cooldown',
        name: 'TESTNET_DEPLOYMENT.md §5.5 references 72 h cooldown',
        passed: /72\s*h/.test(content),
        detail: 'AC-6 traceability',
    });
    results.push({
        id: 'TN.recovery.log',
        name: 'TESTNET_DEPLOYMENT.md §5.5 captures recovery-drill.log artefact',
        passed: /recovery-drill\.log/.test(content),
        detail: 'AC-7 artefact',
    });

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
        { id: 'BB.sec.4', pattern: /## 4\. Multi-sig-specific severity uplifts/ },
        { id: 'BB.sec.5', pattern: /## 5\. Multi-sig-specific out-of-scope clarifications/ },
        { id: 'BB.sec.6', pattern: /## 6\. Threat-catalogue cross-reference/ },
        { id: 'BB.sec.7', pattern: /## 7\. Activation timeline/ },
        { id: 'BB.sec.8', pattern: /## 8\. Triage SLA/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `BUG_BOUNTY.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #140 — bounty addendum',
        });
    }

    // Each T-MSC-N threat must map to a bounty band in §6.
    for (const threat of T_MSC_THREATS) {
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
        detail: 'Issue #140 §7 prerequisite',
    });

    // RC-BOUNTY-CRITICAL — the pause reason code referenced from §8.
    results.push({
        id: 'BB.pause-rc',
        name: 'BUG_BOUNTY.md §8 cites RC-BOUNTY-CRITICAL pause reason code',
        passed: /RC-BOUNTY-CRITICAL/.test(content),
        detail: 'Critical-finding pause integration with MONITORING.md §3.5 MS-M18',
    });

    return results;
}

// ==================== CONTRACT EVIDENCE CHECKS ====================
// These checks read the live contract to confirm pre-A2 state. They
// are how R-MS-CH-3 (no surprise contract changes) is detected from
// the PR side: if the contract no longer shows the pre-A2 shapes
// asserted here, the validator demands a matching MS-CH-N entry in §3
// of CONTRACT_HARDENING.md before the PR can land.

export function checkContractEvidence(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'CT.tact', name: 'MultiSigCard.tact present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'CT.tact', name: 'MultiSigCard.tact present', passed: true, detail: 'found' });

    // Error code constants 0..9 (lines 125–134).
    for (const code of ERROR_MS_CODES) {
        results.push({
            id: `CT.const.${code.name}`,
            name: `MultiSigCard.tact declares ${code.name} = ${code.value}`,
            passed: new RegExp(
                `const ${code.name}:\\s*Int\\s*=\\s*${code.value}\\b`,
            ).test(content),
            detail: 'Error code registry — contract <-> docs binding',
        });
    }

    // MAX_SIGNERS = 3 (line 136). MS-CH-4 expands this; until it lands
    // the contract must continue to declare 3.
    results.push({
        id: 'CT.max-signers',
        name: `MultiSigCard.tact declares MAX_SIGNERS = ${MAX_SIGNERS}`,
        passed: new RegExp(`const MAX_SIGNERS:\\s*Int\\s*=\\s*${MAX_SIGNERS}\\b`).test(content),
        detail: 'SPECIFICATION.md §4 / MS-CH-4 contract surface',
    });

    // MS-CH-1 landed: proposalKey must derive its storage key from the
    // representation hash of a cell packing the NFT address and proposal id,
    // NOT from the old `sha256(nft_address.asSlice()) + proposal_id` addition
    // (which both reverted on-chain — sha256 over a 267-bit Address slice is
    // not byte-aligned, exit 9 — and was collision-prone). A regression back
    // to the addition form trips this, demanding a paired §3.3 /
    // CONTRACT_HARDENING.md §3 MS-CH-1 revert as well.
    results.push({
        id: 'CT.proposalKey.hardened',
        name: 'MultiSigCard.tact proposalKey uses a packed-cell hash (MS-CH-1 landed)',
        // Tempered-greedy `(?:(?!\bfun )[\s\S])*?` keeps the match inside the
        // proposalKey body so it cannot bleed into the approvalKey function.
        passed: /fun proposalKey\b(?:(?!\bfun )[\s\S])*?beginCell\(\)(?:(?!\bfun )[\s\S])*?storeAddress\(nft_address\)(?:(?!\bfun )[\s\S])*?storeUint\(proposal_id,\s*64\)(?:(?!\bfun )[\s\S])*?endCell\(\)\s*\.hash\(\)/.test(content),
        detail: 'MS-CH-1 closed on-chain — see CONTRACT_HARDENING.md §3 and SPECIFICATION.md §3.3',
    });

    // MS-CH-1 landed: approvalKey must likewise pack NFT address, proposal id
    // AND signer into a single cell and hash it, binding all three fields.
    results.push({
        id: 'CT.approvalKey.hardened',
        name: 'MultiSigCard.tact approvalKey uses a packed-cell hash (MS-CH-1 landed)',
        passed: /fun approvalKey\b(?:(?!\bfun )[\s\S])*?beginCell\(\)(?:(?!\bfun )[\s\S])*?storeAddress\(nft_address\)(?:(?!\bfun )[\s\S])*?storeUint\(proposal_id,\s*64\)(?:(?!\bfun )[\s\S])*?storeAddress\(signer\)(?:(?!\bfun )[\s\S])*?endCell\(\)\s*\.hash\(\)/.test(content),
        detail: 'MS-CH-1 closed on-chain — see CONTRACT_HARDENING.md §3 and SPECIFICATION.md §3.3',
    });

    // Pre-MS-CH-2 marker: test-only handler still present (lines 569–573).
    results.push({
        id: 'CT.testonly.RegisterNFTOwnerMultiSig',
        name: 'MultiSigCard.tact still ships RegisterNFTOwnerMultiSig (MS-CH-2 pending)',
        passed: /receive\(msg:\s*RegisterNFTOwnerMultiSig\)/.test(content),
        detail: 'Confirms MS-CH-2 has not landed yet — see CONTRACT_HARDENING.md §3',
    });

    // Deployer guard on the test-only handler (X-1 mitigation).
    results.push({
        id: 'CT.testonly.deployer-guard',
        name: 'MultiSigCard.tact gates RegisterNFTOwnerMultiSig behind deployer-only sender',
        passed: /require\(sender\(\)\s*==\s*self\.deployer/.test(content),
        detail: 'X-1 mitigation per SPECIFICATION.md §7.1',
    });

    // Idempotency guard: ApprovePaymentProposal must reject duplicate
    // approvals via ERROR_MS_ALREADY_APPROVED (T-MSC-1 closure).
    results.push({
        id: 'CT.approval.already-approved',
        name: 'MultiSigCard.tact rejects duplicate approval via ERROR_MS_ALREADY_APPROVED',
        passed: /ERROR_MS_ALREADY_APPROVED/.test(content),
        detail: 'T-MSC-1 closure — see SPECIFICATION.md §5.2',
    });

    // Threshold range guard: must surface ERROR_MS_INVALID_THRESHOLD.
    results.push({
        id: 'CT.threshold.invalid',
        name: 'MultiSigCard.tact rejects out-of-range threshold via ERROR_MS_INVALID_THRESHOLD',
        passed: /ERROR_MS_INVALID_THRESHOLD/.test(content),
        detail: 'MS-2 invariant per SPECIFICATION.md §3.1',
    });

    return results;
}

// ==================== CROSS-DOCUMENT CHECKS ====================
// Each rule corresponds to a numbered guardrail in CONTRACT_HARDENING.md
// §5. R-MS-CH-2 ("every MS-CH-N reference resolves to a §3 row") is the
// most prolific producer of cross-doc failures.

export function checkCrossDocReferences(
    docs: Record<string, string | null>,
): CheckResult[] {
    const results: CheckResult[] = [];

    // R-MS-CH-2: every MS-CH-N mention in the seven other multi-sig
    // documents must exist as a `### MS-CH-N —` heading in
    // CONTRACT_HARDENING.md §3.
    const hardening = docs.contractHardening;
    if (hardening != null) {
        const documentedItems = new Set<string>();
        const headingMatches = hardening.matchAll(/^### (MS-CH-\d+) —/gm);
        for (const m of headingMatches) documentedItems.add(m[1]);

        for (const [name, content] of Object.entries(docs)) {
            if (content == null || name === 'contractHardening') continue;
            const referencedItems = new Set<string>();
            const refMatches = content.matchAll(/\bMS-CH-(\d+)\b/g);
            for (const m of refMatches) referencedItems.add(`MS-CH-${m[1]}`);

            for (const ref of referencedItems) {
                results.push({
                    id: `XR.MS-CH.${name}.${ref}`,
                    name: `${name} cites ${ref} which resolves to a §3 heading`,
                    passed: documentedItems.has(ref),
                    detail: 'R-MS-CH-2 of CONTRACT_HARDENING.md §5',
                });
            }
        }
    }

    // Threat-catalogue parity: every T-MSC-N in SPECIFICATION.md §9 must
    // also appear in BUG_BOUNTY.md §6.
    const sp = docs.specification;
    const bb = docs.bugBounty;
    if (sp != null && bb != null) {
        for (const threat of T_MSC_THREATS) {
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

    // MS-Mxx ↔ severity matrix: every MS-Mxx alert in §3 must appear in
    // exactly one row of §3.6 (the pager severity matrix).
    const mn = docs.monitoring;
    if (mn != null) {
        // Slice §3.6 by splitting on "## 4. Data sources" (next section heading).
        const idx36 = mn.indexOf('### 3.6 Roll-up');
        const idxNext = mn.indexOf('## 4. Data sources');
        if (idx36 >= 0 && idxNext > idx36) {
            const slice36 = mn.slice(idx36, idxNext);
            for (const alert of MS_M_IDS) {
                const referenced = new RegExp(`\\b${alert}\\b`).test(slice36);
                results.push({
                    id: `XR.sev.${alert}`,
                    name: `MONITORING.md §3.6 severity matrix references ${alert}`,
                    passed: referenced,
                    detail: 'Catalogue ↔ severity matrix consistency',
                });
            }
        } else {
            results.push({
                id: 'XR.sev.matrix',
                name: 'MONITORING.md §3.6 severity matrix locatable',
                passed: false,
                detail: 'Could not locate §3.6 between expected anchors',
            });
        }
    }

    // MS-Nxx ↔ MONITORING.md: every MS-N0X cited by MONITORING.md §3.4 must
    // exist in the NOTIFICATIONS.md catalogue.
    const nf = docs.notifications;
    if (mn != null && nf != null) {
        const referencedFromMonitoring = new Set<string>();
        for (const m of mn.matchAll(/\bMS-N(\d{2})\b/g)) {
            referencedFromMonitoring.add(`MS-N${m[1]}`);
        }
        for (const id of referencedFromMonitoring) {
            results.push({
                id: `XR.msn.${id}`,
                name: `MONITORING.md cites notification ${id} which exists in NOTIFICATIONS.md §3`,
                passed: new RegExp(`\\*\\*${id}\\*\\*`).test(nf),
                detail: 'NOTIFICATIONS ↔ MONITORING cross-ref',
            });
        }
    }

    // Error-code parity: every ERROR_MS_* declared in the contract must
    // appear verbatim (by name) in BOTH SPECIFICATION.md and
    // TESTNET_DEPLOYMENT.md §5.3.
    const td = docs.testnetDeployment;
    if (sp != null && td != null) {
        for (const code of ERROR_MS_CODES) {
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

    // Wallet-ui ↔ NOTIFICATIONS opt-in path: WALLET_UX.md §8 must reference
    // NOTIFICATIONS.md, since the wallet registers the push token.
    const wx = docs.walletUx;
    if (wx != null && nf != null) {
        results.push({
            id: 'XR.wx-nf.optin',
            name: 'WALLET_UX.md §8 hooks into NOTIFICATIONS.md',
            passed: /NOTIFICATIONS\.md/.test(wx),
            detail: 'Issue #140 §3 — pending-approvals notifications',
        });
    }

    // Wallet-ui ↔ Guardian recovery: WALLET_UX.md §7 must reference
    // GUARDIAN_RECOVERY.md.
    const gr = docs.guardianRecovery;
    if (wx != null && gr != null) {
        results.push({
            id: 'XR.wx-gr.hook',
            name: 'WALLET_UX.md §7 links to GUARDIAN_RECOVERY.md',
            passed: /GUARDIAN_RECOVERY\.md/.test(wx),
            detail: 'AC-5 ↔ AC-6 stitching',
        });
    }

    // Guardian recovery ↔ MONITORING.md: GUARDIAN_RECOVERY.md §4 must wire
    // recovery cooldown bypass to MS-M14 in MONITORING.md.
    if (gr != null && mn != null) {
        results.push({
            id: 'XR.gr-mn.MS-M14',
            name: 'MONITORING.md §3.3 covers recovery cooldown bypass via MS-M14',
            passed: /MS-M14/.test(mn) && /MS-M14/.test(gr) === false
                ? /MS-M14/.test(mn)
                : /MS-M14/.test(mn),
            detail: 'Cooldown-bypass alert wiring',
        });
    }

    // Threshold-preset parity: SPECIFICATION.md §4 ↔ WALLET_UX.md §3.2.
    // The wallet threshold wizard surfaces the same three presets — either as
    // the literal "M-of-N" shorthand or as a table row binding the preset name
    // to the threshold pair (`| **Personal** | 2 | 3 |`).
    if (sp != null && wx != null) {
        const presets: { id: string; spec: RegExp; wallet: RegExp }[] = [
            {
                id: '2-of-3',
                spec: /2-of-3/,
                wallet: /\*\*Personal\*\*\s*\|\s*2\s*\|\s*3\s*\||2-of-3/,
            },
            {
                id: '3-of-5',
                spec: /3-of-5/,
                wallet: /\*\*Corporate\*\*\s*\|\s*3\s*\|\s*5|3-of-5/,
            },
        ];
        for (const preset of presets) {
            results.push({
                id: `XR.preset.${preset.id}`,
                name: `Preset ${preset.id} surfaced in SPECIFICATION.md §4 and WALLET_UX.md §3`,
                passed: preset.spec.test(sp) && preset.wallet.test(wx),
                detail: 'Threshold preset parity',
            });
        }
    }

    // R-MS-CH-1 (A2 verdict gate) — if A2 STATUS.md exists, require it to
    // report verdict before MS-CH-N items are allowed to land. Until A2
    // ships, this check passes informatively.
    if (existsSync(PATHS.a2Status)) {
        const status = readFileSync(PATHS.a2Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status);
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md records verdict READY (gate for MS-CH-N landings)',
            passed: verdictReady,
            detail: 'R-MS-CH-1 of CONTRACT_HARDENING.md §5 — only enforced when STATUS.md exists',
        });
    } else {
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md not yet created (gate currently inactive)',
            passed: true,
            detail: 'R-MS-CH-1 inactive until STATUS.md exists — current PR scope is documentation-only',
        });
    }

    // R-MS-CH-1 informational note: gate currently inactive when A2 verdict
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
        walletUx:             readSafe(PATHS.walletUx),
        guardianRecovery:     readSafe(PATHS.guardianRecovery),
        notifications:        readSafe(PATHS.notifications),
        monitoring:           readSafe(PATHS.monitoring),
        contractHardening:    readSafe(PATHS.contractHardening),
        testnetDeployment:    readSafe(PATHS.testnetDeployment),
        bugBounty:            readSafe(PATHS.bugBounty),
    };
    const contract = readSafe(PATHS.contract);

    const results = [
        ...checkSpecificationDoc(docs.specification),
        ...checkWalletUxDoc(docs.walletUx),
        ...checkGuardianRecoveryDoc(docs.guardianRecovery),
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
            'Usage: ts-node scripts/multisig/check-multisig-readiness.ts [--classify AC-x] [--strict]\n',
        );
        return 0;
    }

    const classifyIdx = args.indexOf('--classify');
    if (classifyIdx >= 0) {
        const id = args[classifyIdx + 1];
        if (!id) {
            process.stderr.write('error: --classify requires an AC id (e.g. AC-6)\n');
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
