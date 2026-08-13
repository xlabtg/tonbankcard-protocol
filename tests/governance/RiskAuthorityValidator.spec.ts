/**
 * Unit tests for scripts/governance/check-risk-authority.ts (Issue #134, E3).
 *
 * The validator is the off-chain CI gate that enforces structural drift checks
 * between the four E3 governance artifacts:
 *   - docs/governance/RISK_AUTHORITY.md             (composition, FC criteria, AC map)
 *   - docs/governance/FRAUD_LOCK_APPEAL.md          (7-business-day / 48-hour SLAs)
 *   - docs/security/KEY_MANAGEMENT.md §5.4, §7.2    (3-of-5 target, rotation procedure)
 *   - contracts/payments/account-locks.fc           (sender_address guards, two-phase rotation)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported check
 * functions with both well-formed and tampered content. They do NOT require a
 * compiled contract and therefore run in any environment with ts-jest.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    classifyAcceptanceCriterion,
    checkRiskAuthorityDoc,
    checkAppealDoc,
    checkKeyManagementDoc,
    checkAccountLocksContract,
    checkAccountLocksDoc,
    checkTransparencyRegistry,
    runAllChecks,
} from '../../scripts/governance/check-risk-authority';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #134 §8)', () => {
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

    it('uses only the seven documented evidenceCheck kinds', () => {
        const allowed = new Set([
            'risk-authority',
            'fraud-lock-appeal',
            'key-management',
            'transparency-registry',
            'account-locks',
            'prerequisite',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('routes AC-3 to the account-locks evidence path (FunC guard inspection)', () => {
        const ac3 = classifyAcceptanceCriterion('AC-3');
        expect(ac3?.evidenceCheck).toBe('account-locks');
    });

    it('routes AC-5 to the appeal-document evidence path', () => {
        const ac5 = classifyAcceptanceCriterion('AC-5');
        expect(ac5?.evidenceCheck).toBe('fraud-lock-appeal');
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== checkRiskAuthorityDoc ====================

describe('checkRiskAuthorityDoc', () => {
    const realDoc = readRepoFile('docs/governance/RISK_AUTHORITY.md');

    it('passes every check against the committed RISK_AUTHORITY.md', () => {
        const results = checkRiskAuthorityDoc(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkRiskAuthorityDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('RA.doc');
    });

    it('flags the FR-1 threshold drift when "3-of-5" wording is removed', () => {
        const tampered = realDoc.replace(/3[-‑–—\s]of[-‑–—\s]5/g, '2-of-3');
        const results = checkRiskAuthorityDoc(tampered);
        expect(failures(results)).toContain('RA.threshold.3of5');
    });

    it('flags the SR-3 no-double-mandate omission', () => {
        const tampered = realDoc
            .replace(/No double[-‑]mandate/g, '')
            .replace(/No individual may simultaneously hold more than one Risk Authority seat/g, '');
        const results = checkRiskAuthorityDoc(tampered);
        expect(failures(results)).toContain('RA.no-double-mandate');
    });

    it('flags the SR-1 hardware-backed omission', () => {
        const tampered = realDoc
            .replace(/Hardware-backed keys/g, 'Software keys')
            .replace(/Ledger or Trezor/g, 'plain mnemonic');
        const results = checkRiskAuthorityDoc(tampered);
        expect(failures(results)).toContain('RA.hw-backed');
    });

    it.each(['FC-1', 'FC-2', 'FC-3', 'FC-4', 'FC-5'])(
        'flags removal of fraud criterion %s',
        (code) => {
            const tampered = realDoc.replace(new RegExp(`\\| ${code} \\|`, 'g'), '| FC-X |');
            const results = checkRiskAuthorityDoc(tampered);
            expect(failures(results)).toContain(`RA.${code}`);
        },
    );

    it.each(['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7'])(
        'flags removal of acceptance-criterion mapping row %s',
        (code) => {
            const tampered = realDoc.replace(new RegExp(`\\| ${code} \\|`, 'g'), '| AC-X |');
            const results = checkRiskAuthorityDoc(tampered);
            expect(failures(results)).toContain(`RA.map.${code}`);
        },
    );

    it('flags removal of the TransparencyRegistry.RecordSnapshot anchor reference', () => {
        const tampered = realDoc.replace(/TransparencyRegistry\.RecordSnapshot/g, 'TransparencyRegistry.X');
        const results = checkRiskAuthorityDoc(tampered);
        expect(failures(results)).toContain('RA.tr-anchor');
    });
});

// ==================== checkAppealDoc ====================

describe('checkAppealDoc', () => {
    const realDoc = readRepoFile('docs/governance/FRAUD_LOCK_APPEAL.md');

    it('passes every check against the committed FRAUD_LOCK_APPEAL.md', () => {
        const results = checkAppealDoc(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkAppealDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('AP.doc');
    });

    it('flags the NFR-2 SLA drift when "7 business days" wording is removed', () => {
        const tampered = realDoc
            .replace(/7[-‑\s]business[-‑\s]day/gi, '14 calendar-day')
            .replace(/7 business days/gi, '14 calendar days');
        const results = checkAppealDoc(tampered);
        expect(failures(results)).toContain('AP.sla.7bd');
    });

    it('flags the fast-track SLA drift when "48 hour" wording is removed', () => {
        const tampered = realDoc
            .replace(/48[-‑\s]hour/gi, '72-hour')
            .replace(/48 hours/gi, '72 hours');
        const results = checkAppealDoc(tampered);
        expect(failures(results)).toContain('AP.fast.48h');
    });

    it('flags removal of the "free to file" accessibility guarantee', () => {
        const tampered = realDoc
            .replace(/Filing an appeal is \*\*free\*\*/gi, 'Filing an appeal costs 1 TON')
            .replace(/appeal is \*\*free\*\*/gi, 'appeal costs 1 TON')
            .replace(/Filing an appeal is free/gi, 'Filing an appeal costs 1 TON');
        const results = checkAppealDoc(tampered);
        expect(failures(results)).toContain('AP.free');
    });
});

// ==================== checkKeyManagementDoc ====================

describe('checkKeyManagementDoc', () => {
    const realDoc = readRepoFile('docs/security/KEY_MANAGEMENT.md');

    it('passes every check against the committed KEY_MANAGEMENT.md', () => {
        const results = checkKeyManagementDoc(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkKeyManagementDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('KM.doc');
    });

    it('flags downgrade of the Risk Authority target below 3-of-5', () => {
        const tampered = realDoc
            .replace(/3[-‑–—\s]of[-‑–—\s]5/g, '2-of-3')
            .replace(/Target: 3-of-5 Multi-Sig/g, 'Target: 2-of-3 Multi-Sig');
        const results = checkKeyManagementDoc(tampered);
        expect(failures(results)).toContain('KM.target.3of5');
    });

    it('flags removal of the §5.4 rotation procedure heading', () => {
        const tampered = realDoc.replace(
            /### 5\.4 Risk Authority Multi-Sig Rotation Procedure/g,
            '### 5.4 (removed)',
        );
        const results = checkKeyManagementDoc(tampered);
        expect(failures(results)).toContain('KM.rotation.5_4');
    });

    it('flags removal of the §6.2 post-E3 blast-radius update', () => {
        const tampered = realDoc.replace(
            /Post-E3 \(3-of-5 multi-sig\) blast radius/g,
            'Single-key blast radius',
        );
        const results = checkKeyManagementDoc(tampered);
        expect(failures(results)).toContain('KM.compromise.6_2');
    });
});

// ==================== checkAccountLocksContract ====================

describe('checkAccountLocksContract', () => {
    const realContract = readRepoFile('contracts/payments/account-locks.fc');

    it('passes every check against the committed account-locks.fc', () => {
        const results = checkAccountLocksContract(realContract);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing contract', () => {
        const results = checkAccountLocksContract(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('AL.fc');
    });

    it('flags removal of the equal_slice_bits(sender_address, risk_authority) guard on op::set_fraud_lock', () => {
        const tampered = realContract.replace(
            /if \(op == op::set_fraud_lock\) \{([\s\S]*?)equal_slice_bits\(sender_address, risk_authority\)/,
            'if (op == op::set_fraud_lock) {$1equal_slice_bits(sender_address, anyone)',
        );
        const results = checkAccountLocksContract(tampered);
        expect(failures(results)).toContain('AL.guard.set');
    });

    it('flags removal of the equal_slice_bits(sender_address, risk_authority) guard on op::clear_fraud_lock', () => {
        const tampered = realContract.replace(
            /if \(op == op::clear_fraud_lock\) \{([\s\S]*?)equal_slice_bits\(sender_address, risk_authority\)/,
            'if (op == op::clear_fraud_lock) {$1equal_slice_bits(sender_address, anyone)',
        );
        const results = checkAccountLocksContract(tampered);
        expect(failures(results)).toContain('AL.guard.clear');
    });

    it.each([
        'op::propose_risk_authority',
        'op::execute_risk_authority',
        'op::cancel_risk_authority',
    ])('flags removal of two-phase handler %s', (op) => {
        const escaped = op.replace(/::/g, '::');
        const tampered = realContract.replace(new RegExp(`if \\(op == ${escaped}\\)`, 'g'), 'if (op == op::noop)');
        const results = checkAccountLocksContract(tampered);
        expect(failures(results)).toContain(`AL.role.${op}`);
    });

    it('flags downgrade of the 7-day ROLE_TRANSFER_DELAY constant', () => {
        const tampered = realContract.replace(
            /ROLE_TRANSFER_DELAY = 7 \* 24 \* 60 \* 60/,
            'ROLE_TRANSFER_DELAY = 1 * 24 * 60 * 60',
        );
        const results = checkAccountLocksContract(tampered);
        expect(failures(results)).toContain('AL.timelock.7d');
    });
});

// ==================== checkAccountLocksDoc ====================

describe('checkAccountLocksDoc', () => {
    const realDoc = readRepoFile('contracts/payments/ACCOUNT_LOCKS.md');

    it('passes every check against the committed ACCOUNT_LOCKS.md', () => {
        const results = checkAccountLocksDoc(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags removal of the RISK_AUTHORITY.md cross-link and 3-of-5 note', () => {
        const tampered = realDoc
            .replace(/RISK_AUTHORITY\.md/g, 'OTHER.md')
            .replace(/3[-‑–—\s]of[-‑–—\s]5/g, '2-of-3');
        const results = checkAccountLocksDoc(tampered);
        expect(failures(results)).toContain('AL.doc.multisig');
    });
});

// ==================== checkTransparencyRegistry ====================

describe('checkTransparencyRegistry', () => {
    const realContract = readRepoFile('contracts/governance/TransparencyRegistry.tact');

    it('passes the RecordSnapshot presence check', () => {
        const results = checkTransparencyRegistry(realContract);
        expect(failures(results)).toEqual([]);
    });

    it('flags removal of RecordSnapshot (AC-6 / AC-7 anchoring path)', () => {
        const tampered = realContract.replace(/RecordSnapshot/g, 'RecordNothing');
        const results = checkTransparencyRegistry(tampered);
        expect(failures(results)).toContain('TR.RecordSnapshot');
    });
});

// ==================== runAllChecks integration ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed E3 artifacts', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Surface the failing checks so CI logs are immediately diagnostic.
            // eslint-disable-next-line no-console
            console.error(
                'Risk Authority validator failures:\n' +
                    report.failures.map((f) => `  ✗ ${f.id} — ${f.name} (${f.detail})`).join('\n'),
            );
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });
});
