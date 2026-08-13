/**
 * Risk Authority Governance Validator (Issue #134, E3)
 *
 * Purpose: Validate that the E3 governance artifacts — RISK_AUTHORITY.md,
 *   FRAUD_LOCK_APPEAL.md, KEY_MANAGEMENT.md §5.4 / §7.2, and the on-chain
 *   guards in contracts/payments/account-locks.fc — remain consistent with
 *   each other and with the engagement's acceptance criteria.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / FunC sources from the repository working tree.
 *
 * Usage:
 *   npx ts-node scripts/governance/check-risk-authority.ts
 *   npx ts-node scripts/governance/check-risk-authority.ts --classify AC-3
 *   npx ts-node scripts/governance/check-risk-authority.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #134 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and the
// linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck: 'risk-authority' | 'fraud-lock-appeal' | 'key-management' | 'transparency-registry' | 'account-locks' | 'prerequisite';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'E1 (DAO governance activation) complete (prerequisite)',                  artifact: 'docs/governance/E1-activation/ENGAGEMENT.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'Risk Authority multi-sig wallet set up and tested',                       artifact: 'docs/governance/RISK_AUTHORITY.md §§ 2, 6',     evidenceCheck: 'risk-authority' },
    { id: 'AC-3', description: 'FRAUD_LOCK access control updated to require multi-sig authorization',    artifact: 'docs/governance/RISK_AUTHORITY.md §§ 6.1–6.3 + contracts/payments/account-locks.fc lines 212, 229, 293–322', evidenceCheck: 'account-locks' },
    { id: 'AC-4', description: 'docs/governance/RISK_AUTHORITY.md written with full governance structure', artifact: 'docs/governance/RISK_AUTHORITY.md',           evidenceCheck: 'risk-authority' },
    { id: 'AC-5', description: 'Appeal process documented and accessible to users',                       artifact: 'docs/governance/FRAUD_LOCK_APPEAL.md',          evidenceCheck: 'fraud-lock-appeal' },
    { id: 'AC-6', description: 'TransparencyRegistry used to log all FRAUD_LOCK events',                  artifact: 'docs/governance/RISK_AUTHORITY.md §7',          evidenceCheck: 'transparency-registry' },
    { id: 'AC-7', description: 'First transparency report published including lock activity',            artifact: 'docs/governance/RISK_AUTHORITY.md §7.4',        evidenceCheck: 'transparency-registry' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    riskAuthority: resolve(REPO_ROOT, 'docs/governance/RISK_AUTHORITY.md'),
    appeal:        resolve(REPO_ROOT, 'docs/governance/FRAUD_LOCK_APPEAL.md'),
    keyManagement: resolve(REPO_ROOT, 'docs/security/KEY_MANAGEMENT.md'),
    accountLocks:  resolve(REPO_ROOT, 'contracts/payments/account-locks.fc'),
    accountLocksDoc: resolve(REPO_ROOT, 'contracts/payments/ACCOUNT_LOCKS.md'),
    transparencyRegistry: resolve(REPO_ROOT, 'contracts/governance/TransparencyRegistry.tact'),
    parameterChanges: resolve(REPO_ROOT, 'docs/governance/PARAMETER_CHANGES.md'),
};

// ==================== CHECK RESULT TYPES ====================

export interface CheckResult {
    id: string;
    name: string;
    passed: boolean;
    detail: string;
}

// ==================== DOCUMENT CHECKS ====================

export function readSafe(path: string): string | null {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
}

export function checkRiskAuthorityDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'RA.doc', name: 'RISK_AUTHORITY.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'RA.doc', name: 'RISK_AUTHORITY.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp; reason: string }[] = [
        { id: 'RA.sec.2',   pattern: /## 2\. Who constitutes the Risk Authority/, reason: 'Composition — Issue #134 FR-1' },
        { id: 'RA.sec.3',   pattern: /## 3\. Fraud detection criteria/,            reason: 'Fraud criteria — Issue #134 FR-3' },
        { id: 'RA.sec.4',   pattern: /## 4\. Lock procedure \(set FRAUD_LOCK\)/,   reason: 'Lock procedure — Issue #134 FR-3' },
        { id: 'RA.sec.5',   pattern: /## 5\. Unlock procedure \(clear FRAUD_LOCK\)/, reason: 'Unlock procedure' },
        { id: 'RA.sec.6',   pattern: /## 6\. Multi-sig deployment & migration plan/, reason: 'Migration plan — Issue #134 §6.3' },
        { id: 'RA.sec.7',   pattern: /## 7\. TransparencyRegistry logging/,         reason: 'AC-6 / AC-7' },
        { id: 'RA.sec.9',   pattern: /## 9\. Acceptance criteria mapping/,          reason: 'Engagement traceability' },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `RISK_AUTHORITY.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: sec.reason,
        });
    }

    // FR-1: 3-of-5 multi-sig
    results.push({
        id: 'RA.threshold.3of5',
        name: 'RISK_AUTHORITY.md states 3-of-5 multi-sig threshold',
        passed: /3[-‑–—\s]of[-‑–—\s]5/.test(content),
        detail: 'Issue #134 FR-1 / NFR-1 require ≥ 3-of-5',
    });

    // SR-3: no double-mandate rule
    results.push({
        id: 'RA.no-double-mandate',
        name: 'RISK_AUTHORITY.md prohibits double-mandate across RA seats',
        passed: /No double[-‑]mandate/.test(content) || /No individual may simultaneously hold more than one Risk Authority seat/.test(content),
        detail: 'Issue #134 SR-3',
    });

    // SR-1: hardware-backed
    results.push({
        id: 'RA.hw-backed',
        name: 'RISK_AUTHORITY.md mandates hardware-backed keys (Ledger / Trezor)',
        passed: /Hardware-backed keys/.test(content) && /Ledger or Trezor/.test(content),
        detail: 'Issue #134 SR-1',
    });

    // FC criteria FC-1..FC-5
    for (const code of ['FC-1', 'FC-2', 'FC-3', 'FC-4', 'FC-5']) {
        results.push({
            id: `RA.${code}`,
            name: `RISK_AUTHORITY.md defines ${code}`,
            passed: new RegExp(`\\| ${code} \\|`).test(content),
            detail: `Issue #134 §3 ("criteria for setting FRAUD_LOCK")`,
        });
    }

    // AC mapping — at least one row per AC-1…AC-7
    for (const code of ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7']) {
        results.push({
            id: `RA.map.${code}`,
            name: `RISK_AUTHORITY.md maps ${code}`,
            passed: new RegExp(`\\| ${code} \\|`).test(content),
            detail: 'Engagement traceability §9',
        });
    }

    // TransparencyRegistry integration
    results.push({
        id: 'RA.tr-anchor',
        name: 'RISK_AUTHORITY.md anchors evidence via TransparencyRegistry.RecordSnapshot',
        passed: /TransparencyRegistry\.RecordSnapshot/.test(content),
        detail: 'AC-6',
    });

    return results;
}

export function checkAppealDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'AP.doc', name: 'FRAUD_LOCK_APPEAL.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'AP.doc', name: 'FRAUD_LOCK_APPEAL.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'AP.sec.2', pattern: /## 2\. How to file an appeal/ },
        { id: 'AP.sec.3', pattern: /## 3\. Standard appeal/ },
        { id: 'AP.sec.4', pattern: /## 4\. Fast-track appeal/ },
        { id: 'AP.sec.5', pattern: /## 5\. Required artifacts/ },
        { id: 'AP.sec.6', pattern: /## 6\. Decision outcomes/ },
        { id: 'AP.sec.7', pattern: /## 7\. Audit trail & TransparencyRegistry logging/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `FRAUD_LOCK_APPEAL.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'AC-5',
        });
    }

    // NFR-2: 7 business-day SLA
    results.push({
        id: 'AP.sla.7bd',
        name: 'FRAUD_LOCK_APPEAL.md states 7-business-day standard SLA',
        passed: /7[-‑\s]business[-‑\s]day/i.test(content) || /7 business days/i.test(content),
        detail: 'Issue #134 NFR-2',
    });

    // Fast-track SLA ≤ 48h
    results.push({
        id: 'AP.fast.48h',
        name: 'FRAUD_LOCK_APPEAL.md states 48-hour fast-track SLA',
        passed: /48[-‑\s]hour/i.test(content) || /48 hours/i.test(content),
        detail: 'Fast-track companion to NFR-2',
    });

    // Free / accessible
    results.push({
        id: 'AP.free',
        name: 'FRAUD_LOCK_APPEAL.md confirms filing an appeal is free',
        passed: /Filing an appeal is \*\*free\*\*/i.test(content) || /appeal is \*\*free\*\*/i.test(content) || /Filing an appeal is free/i.test(content),
        detail: 'AC-5 accessibility',
    });

    return results;
}

export function checkKeyManagementDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'KM.doc', name: 'KEY_MANAGEMENT.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'KM.doc', name: 'KEY_MANAGEMENT.md present', passed: true, detail: 'found' });

    results.push({
        id: 'KM.target.3of5',
        name: 'KEY_MANAGEMENT.md target Risk Authority threshold is 3-of-5',
        passed: /Risk Authority Key.*3[-‑–—\s]of[-‑–—\s]5/s.test(content)
             || /Target: 3-of-5 Multi-Sig/.test(content),
        detail: 'Issue #134 FR-1 + SR-2',
    });

    results.push({
        id: 'KM.rotation.5_4',
        name: 'KEY_MANAGEMENT.md §5.4 Risk Authority Multi-Sig Rotation Procedure exists',
        passed: /### 5\.4 Risk Authority Multi-Sig Rotation Procedure/.test(content),
        detail: 'Issue #134 SR-2',
    });

    results.push({
        id: 'KM.compromise.6_2',
        name: 'KEY_MANAGEMENT.md §6.2 compromise scenario updated for multi-sig era',
        passed: /Post-E3 \(3-of-5 multi-sig\) blast radius/.test(content),
        detail: 'Engagement traceability',
    });

    return results;
}

export function checkAccountLocksContract(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'AL.fc', name: 'account-locks.fc present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'AL.fc', name: 'account-locks.fc present', passed: true, detail: 'found' });

    // Set/clear FRAUD_LOCK guarded by risk_authority — invariant under E3.
    // The negative-lookahead pattern bounds the search to the body of the
    // dispatched handler, so a later guard in a different `if (op == ...)`
    // block cannot mask removal of the FRAUD_LOCK guard.
    results.push({
        id: 'AL.guard.set',
        name: 'op::set_fraud_lock guarded by equal_slice_bits(sender_address, risk_authority)',
        passed: /if \(op == op::set_fraud_lock\) \{(?:(?!\bif \(op ==)[\s\S])*?equal_slice_bits\(sender_address, risk_authority\)/.test(content),
        detail: 'AC-3 — multi-sig wallet contract is whatever is stored in risk_authority',
    });
    results.push({
        id: 'AL.guard.clear',
        name: 'op::clear_fraud_lock guarded by equal_slice_bits(sender_address, risk_authority)',
        passed: /if \(op == op::clear_fraud_lock\) \{(?:(?!\bif \(op ==)[\s\S])*?equal_slice_bits\(sender_address, risk_authority\)/.test(content),
        detail: 'AC-3',
    });

    // Two-phase role transfer (Issue #96) is the migration vehicle (RISK_AUTHORITY.md §6.3)
    for (const op of ['op::propose_risk_authority', 'op::execute_risk_authority', 'op::cancel_risk_authority']) {
        results.push({
            id: `AL.role.${op}`,
            name: `account-locks.fc handles ${op}`,
            passed: new RegExp(`if \\(op == ${op.replace(/::/g, '::')}\\)`).test(content),
            detail: 'Issue #96 two-phase role transfer',
        });
    }

    // ROLE_TRANSFER_DELAY constant = 7 days
    results.push({
        id: 'AL.timelock.7d',
        name: 'account-locks.fc enforces 7-day ROLE_TRANSFER_DELAY',
        passed: /ROLE_TRANSFER_DELAY = 7 \* 24 \* 60 \* 60/.test(content),
        detail: 'RISK_AUTHORITY.md §6.3 / §2.4',
    });

    return results;
}

export function checkAccountLocksDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'AL.doc', name: 'ACCOUNT_LOCKS.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'AL.doc', name: 'ACCOUNT_LOCKS.md present', passed: true, detail: 'found' });

    results.push({
        id: 'AL.doc.multisig',
        name: 'ACCOUNT_LOCKS.md cross-links to RISK_AUTHORITY.md and notes 3-of-5 multi-sig',
        passed: /RISK_AUTHORITY\.md/.test(content) && /3[-‑–—\s]of[-‑–—\s]5/.test(content),
        detail: 'Operator-facing pointer to E3 governance',
    });

    return results;
}

export function checkTransparencyRegistry(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'TR.tact', name: 'TransparencyRegistry.tact present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'TR.tact', name: 'TransparencyRegistry.tact present', passed: true, detail: 'found' });

    // RecordSnapshot is the anchoring path used by RISK_AUTHORITY.md §7
    results.push({
        id: 'TR.RecordSnapshot',
        name: 'TransparencyRegistry.tact exposes RecordSnapshot',
        passed: /RecordSnapshot/.test(content),
        detail: 'AC-6 / AC-7',
    });

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
    const ra  = readSafe(PATHS.riskAuthority);
    const ap  = readSafe(PATHS.appeal);
    const km  = readSafe(PATHS.keyManagement);
    const alc = readSafe(PATHS.accountLocks);
    const ald = readSafe(PATHS.accountLocksDoc);
    const tr  = readSafe(PATHS.transparencyRegistry);

    const results = [
        ...checkRiskAuthorityDoc(ra),
        ...checkAppealDoc(ap),
        ...checkKeyManagementDoc(km),
        ...checkAccountLocksContract(alc),
        ...checkAccountLocksDoc(ald),
        ...checkTransparencyRegistry(tr),
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
            'Usage: ts-node scripts/governance/check-risk-authority.ts [--classify AC-x] [--strict]\n'
        );
        return 0;
    }

    const classifyIdx = args.indexOf('--classify');
    if (classifyIdx >= 0) {
        const id = args[classifyIdx + 1];
        if (!id) {
            process.stderr.write('error: --classify requires an AC id (e.g. AC-3)\n');
            return 1;
        }
        const ac = classifyAcceptanceCriterion(id);
        if (!ac) {
            process.stderr.write(`error: unknown acceptance criterion ${id}\n`);
            return 1;
        }
        process.stdout.write(
            `${ac.id}: ${ac.description}\n  artifact:  ${ac.artifact}\n  evidence:  ${ac.evidenceCheck}\n`
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
        `\n${report.passed}/${report.results.length} checks passed, ${report.failed} failed.\n`
    );

    if (report.failed > 0 || strict) {
        return report.failed > 0 ? 2 : 0;
    }
    return 0;
}

if (require.main === module) {
    process.exit(cli(process.argv));
}
