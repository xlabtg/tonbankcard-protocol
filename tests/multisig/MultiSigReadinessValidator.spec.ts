/**
 * Unit tests for scripts/multisig/check-multisig-readiness.ts
 * (Issue #140, F5).
 *
 * The validator is the off-chain CI gate that enforces structural drift checks
 * between the eight F5 multi-sig artifacts and the production contract:
 *   - docs/multisig/SPECIFICATION.md          (AC-2)
 *   - docs/multisig/WALLET_UX.md              (AC-4 / AC-5)
 *   - docs/multisig/GUARDIAN_RECOVERY.md      (AC-6)
 *   - docs/multisig/NOTIFICATIONS.md          (AC-5 addendum)
 *   - docs/multisig/MONITORING.md             (AC-5 / AC-6 addendum)
 *   - docs/multisig/CONTRACT_HARDENING.md     (MS-CH-1..MS-CH-6
 *                                              backlog, A2-gated)
 *   - docs/multisig/TESTNET_DEPLOYMENT.md     (AC-3 / AC-7 / AC-8)
 *   - docs/multisig/BUG_BOUNTY.md             (A5-gated)
 *   - contracts/MultiSigCard.tact             (pre-A2 shapes,
 *                                              evidence anchors)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported check
 * functions with both well-formed and tampered content. They do NOT require a
 * compiled contract and therefore run in any environment with ts-jest. The
 * pattern mirrors tests/recurring-payments/RecurringPaymentsReadinessValidator.spec.ts
 * (F4, PR #207).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    ERROR_MS_CODES,
    WALLET_UX_USER_FACING_CODES,
    T_MSC_THREATS,
    MS_CH_ITEMS,
    R_MS_CH_RULES,
    MS_M_IDS,
    MS_N_IDS,
    WALLET_UI_TEST_BAR,
    MS_PROPOSAL_TTL_SECONDS,
    MS_RECOVERY_COOLDOWN_SECONDS,
    MAX_SIGNERS,
    classifyAcceptanceCriterion,
    checkSpecificationDoc,
    checkWalletUxDoc,
    checkGuardianRecoveryDoc,
    checkNotificationsDoc,
    checkMonitoringDoc,
    checkContractHardeningDoc,
    checkTestnetDeploymentDoc,
    checkBugBountyDoc,
    checkContractEvidence,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/multisig/check-multisig-readiness';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-8 in order (Issue #140 §8)', () => {
        expect(ACCEPTANCE_CRITERIA.map((c) => c.id)).toEqual([
            'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8',
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
            'prerequisite',
            'specification',
            'wallet-ux',
            'guardian-recovery',
            'notifications',
            'monitoring',
            'contract-hardening',
            'testnet-deployment',
            'bug-bounty',
            'tests',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('routes AC-1 to the A2 audit prerequisite gate', () => {
        const ac1 = classifyAcceptanceCriterion('AC-1');
        expect(ac1?.evidenceCheck).toBe('prerequisite');
        expect(ac1?.artifact).toMatch(/A2-phase4-contracts/);
    });

    it('routes AC-2 to the specification evidence path', () => {
        const ac2 = classifyAcceptanceCriterion('AC-2');
        expect(ac2?.evidenceCheck).toBe('specification');
        expect(ac2?.artifact).toMatch(/SPECIFICATION\.md/);
    });

    it('routes AC-3 and AC-7 to the testnet-deployment evidence path', () => {
        expect(classifyAcceptanceCriterion('AC-3')?.evidenceCheck).toBe('testnet-deployment');
        expect(classifyAcceptanceCriterion('AC-7')?.evidenceCheck).toBe('testnet-deployment');
    });

    it('routes AC-4 and AC-5 to the wallet-ux evidence path', () => {
        expect(classifyAcceptanceCriterion('AC-4')?.evidenceCheck).toBe('wallet-ux');
        expect(classifyAcceptanceCriterion('AC-5')?.evidenceCheck).toBe('wallet-ux');
    });

    it('routes AC-6 to the guardian-recovery evidence path', () => {
        const ac6 = classifyAcceptanceCriterion('AC-6');
        expect(ac6?.evidenceCheck).toBe('guardian-recovery');
        expect(ac6?.artifact).toMatch(/GUARDIAN_RECOVERY\.md/);
    });

    it('routes AC-8 to the tests evidence path', () => {
        const ac8 = classifyAcceptanceCriterion('AC-8');
        expect(ac8?.evidenceCheck).toBe('tests');
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== Centralised expected constants ====================

describe('Centralised expected constants', () => {
    it('ERROR_MS_CODES enumerates exactly codes 0..9', () => {
        expect(ERROR_MS_CODES.map((c) => c.value)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
        const byName = Object.fromEntries(
            ERROR_MS_CODES.map((c) => [c.name, c.value]),
        );
        expect(byName.ERROR_MS_NONE).toBe(0);
        expect(byName.ERROR_MS_NOT_OWNER).toBe(1);
        expect(byName.ERROR_MS_NOT_SIGNER).toBe(2);
        expect(byName.ERROR_MS_INVALID_THRESHOLD).toBe(3);
        expect(byName.ERROR_MS_PROPOSAL_NOT_FOUND).toBe(4);
        expect(byName.ERROR_MS_ALREADY_APPROVED).toBe(5);
        expect(byName.ERROR_MS_PROPOSAL_NOT_PENDING).toBe(6);
        expect(byName.ERROR_MS_NFT_NOT_REGISTERED).toBe(7);
        expect(byName.ERROR_MS_NO_CONFIG).toBe(8);
        expect(byName.ERROR_MS_INVALID_AMOUNT).toBe(9);
    });

    it('WALLET_UX_USER_FACING_CODES surfaces exactly the five wallet-facing codes (§4.5)', () => {
        expect([...WALLET_UX_USER_FACING_CODES]).toEqual([
            'ERROR_MS_NOT_SIGNER',
            'ERROR_MS_PROPOSAL_NOT_FOUND',
            'ERROR_MS_ALREADY_APPROVED',
            'ERROR_MS_PROPOSAL_NOT_PENDING',
            'ERROR_MS_NO_CONFIG',
        ]);
    });

    it('T_MSC_THREATS enumerates seven multi-sig threats (T-MSC-1..T-MSC-7)', () => {
        expect(T_MSC_THREATS).toHaveLength(7);
        expect(T_MSC_THREATS[0]).toBe('T-MSC-1');
        expect(T_MSC_THREATS[6]).toBe('T-MSC-7');
    });

    it('MS_CH_ITEMS enumerates six hardening items (MS-CH-1..MS-CH-6)', () => {
        expect(MS_CH_ITEMS).toHaveLength(6);
        expect(MS_CH_ITEMS[0]).toBe('MS-CH-1');
        expect(MS_CH_ITEMS[5]).toBe('MS-CH-6');
    });

    it('R_MS_CH_RULES enumerates five CI guardrail rules (R-MS-CH-1..R-MS-CH-5)', () => {
        expect(R_MS_CH_RULES).toHaveLength(5);
        expect(R_MS_CH_RULES[0]).toBe('R-MS-CH-1');
        expect(R_MS_CH_RULES[4]).toBe('R-MS-CH-5');
    });

    it('MS_M_IDS enumerates eighteen alerts in zero-padded form', () => {
        expect(MS_M_IDS).toHaveLength(18);
        expect(MS_M_IDS[0]).toBe('MS-M01');
        expect(MS_M_IDS[17]).toBe('MS-M18');
    });

    it('MS_N_IDS enumerates eight notifications in zero-padded form', () => {
        expect(MS_N_IDS).toHaveLength(8);
        expect(MS_N_IDS[0]).toBe('MS-N01');
        expect(MS_N_IDS[7]).toBe('MS-N08');
    });

    it('Test bar constant pins Issue #140 §8 AC-8: 28 wallet-ui tests', () => {
        expect(WALLET_UI_TEST_BAR).toBe(28);
    });

    it('MS_PROPOSAL_TTL_SECONDS anchors the 7-day approval window', () => {
        expect(MS_PROPOSAL_TTL_SECONDS).toBe(604800);
    });

    it('MS_RECOVERY_COOLDOWN_SECONDS anchors the 72 h guardian cooldown', () => {
        expect(MS_RECOVERY_COOLDOWN_SECONDS).toBe(259200);
    });

    it('MAX_SIGNERS pins the pre-MS-CH-4 cap at 3', () => {
        expect(MAX_SIGNERS).toBe(3);
    });
});

// ==================== checkSpecificationDoc ====================

describe('checkSpecificationDoc', () => {
    const realDoc = readRepoFile('docs/multisig/SPECIFICATION.md');

    it('passes every check against the committed SPECIFICATION.md', () => {
        expect(failures(checkSpecificationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSpecificationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SP.doc');
    });

    it('flags drift of the §5.4 7-day proposal TTL (604800 s)', () => {
        const tampered = realDoc.replace(
            /MS_PROPOSAL_TTL_SECONDS\s*=\s*604800/g,
            'MS_PROPOSAL_TTL_SECONDS = 1',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.ttl.7d');
    });

    it('flags removal of the §4.1 Personal 2-of-3 preset binding', () => {
        const tampered = realDoc.replace(/Personal — 2-of-3/g, 'Personal — N-of-M');
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.preset.2-of-3');
    });

    it('flags removal of the §4.2 Corporate 3-of-5 preset binding', () => {
        const tampered = realDoc.replace(/Corporate — 3-of-5/g, 'Corporate — N-of-M');
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.preset.3-of-5');
    });

    it('flags removal of the §4.3 custom preset cap (≤10)', () => {
        const tampered = realDoc.replace(
            /Custom M-of-N \(up to 10 signers/g,
            'Custom M-of-N (unbounded',
        );
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.preset.custom-10');
    });

    it('flags removal of the §8 72 h cooldown anchor', () => {
        const tampered = realDoc.replace(/72\s*h/g, '12 h');
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.cooldown.72h');
    });

    it.each([...T_MSC_THREATS])(
        'flags removal of multi-sig threat %s from §9',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-MSC-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.threat.${threat}`,
            );
        },
    );

    it.each([...MS_CH_ITEMS])(
        'flags removal of hardening item %s from §10',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${item}\\*\\*`, 'g'),
                '**MS-CH-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.hardening.${item}`,
            );
        },
    );
});

// ==================== checkWalletUxDoc ====================

describe('checkWalletUxDoc', () => {
    const realDoc = readRepoFile('docs/multisig/WALLET_UX.md');

    it('passes every check against the committed WALLET_UX.md', () => {
        expect(failures(checkWalletUxDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkWalletUxDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('WX.doc');
    });

    it.each([...WALLET_UX_USER_FACING_CODES])(
        'flags removal of user-facing error code %s from §4.5',
        (code) => {
            const tampered = realDoc.replace(
                new RegExp(`\`${code}\\s*=`, 'g'),
                '`ERROR_MS_X =',
            );
            expect(failures(checkWalletUxDoc(tampered))).toContain(`WX.code.${code}`);
        },
    );

    it('flags removal of the MS-CH-2 quorum-gated signer-management note in §6', () => {
        const tampered = realDoc.replace(/MS-CH-2/g, 'MS-CH-X');
        expect(failures(checkWalletUxDoc(tampered))).toContain('WX.signer-mgmt.MS-CH-2');
    });

    it('flags removal of the GUARDIAN_RECOVERY.md hook from §7', () => {
        const tampered = realDoc.replace(/GUARDIAN_RECOVERY\.md/g, 'OTHER_DOC.md');
        expect(failures(checkWalletUxDoc(tampered))).toContain('WX.guardian.link');
    });
});

// ==================== checkGuardianRecoveryDoc ====================

describe('checkGuardianRecoveryDoc', () => {
    const realDoc = readRepoFile('docs/multisig/GUARDIAN_RECOVERY.md');

    it('passes every check against the committed GUARDIAN_RECOVERY.md', () => {
        expect(failures(checkGuardianRecoveryDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkGuardianRecoveryDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('GR.doc');
    });

    it('flags drift of the §4 cooldown anchor (259200 s = 72 h)', () => {
        const tampered = realDoc.replace(/\b259200\b/g, '999');
        expect(failures(checkGuardianRecoveryDoc(tampered))).toContain('GR.cooldown');
    });

    it('flags removal of the §3 2-of-3 default guardian quorum', () => {
        const tampered = realDoc.replace(/2-of-3/g, 'N-of-M');
        expect(failures(checkGuardianRecoveryDoc(tampered))).toContain('GR.quorum.2-of-3');
    });

    it.each(['T-MSC-4', 'T-MSC-5'])(
        'flags removal of guardian threat treatment for %s from §7',
        (threat) => {
            const tampered = realDoc.replace(new RegExp(`\\b${threat}\\b`, 'g'), 'T-MSC-X');
            expect(failures(checkGuardianRecoveryDoc(tampered))).toContain(
                `GR.threat.${threat}`,
            );
        },
    );

    it('flags removal of the §4.3 MS-CH-6 on-chain deferral note', () => {
        const tampered = realDoc.replace(/MS-CH-6/g, 'MS-CH-X');
        expect(failures(checkGuardianRecoveryDoc(tampered))).toContain('GR.MS-CH-6');
    });
});

// ==================== checkNotificationsDoc ====================

describe('checkNotificationsDoc', () => {
    const realDoc = readRepoFile('docs/multisig/NOTIFICATIONS.md');

    it('passes every check against the committed NOTIFICATIONS.md', () => {
        expect(failures(checkNotificationsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkNotificationsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('NF.doc');
    });

    it.each(MS_N_IDS)('flags removal of notification %s from §3 catalogue', (id) => {
        const tampered = realDoc.replace(
            new RegExp(`\\*\\*${id}\\*\\*`, 'g'),
            '**MS-NXX**',
        );
        expect(failures(checkNotificationsDoc(tampered))).toContain(`NF.id.${id}`);
    });

    it('flags removal of the MS-N08 ↔ RecoveryInitiated guardian binding from §3.4', () => {
        const tampered = realDoc.replace(/RecoveryInitiated/g, 'OtherEvent');
        expect(failures(checkNotificationsDoc(tampered))).toContain('NF.guardian');
    });
});

// ==================== checkMonitoringDoc ====================

describe('checkMonitoringDoc', () => {
    const realDoc = readRepoFile('docs/multisig/MONITORING.md');

    it('passes every check against the committed MONITORING.md', () => {
        expect(failures(checkMonitoringDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkMonitoringDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('MN.doc');
    });

    it.each(MS_M_IDS)('flags removal of alert %s from §3', (alert) => {
        const tampered = realDoc.replace(new RegExp(`\\b${alert}\\b`, 'g'), 'MS-MXX');
        expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.alert.${alert}`);
    });

    it('flags duplicate alert rows in §3 catalogue', () => {
        const duplicateRow = realDoc.match(/\|\s*MS-M01\s*\|[^\n]*/);
        if (!duplicateRow) {
            throw new Error('Could not locate MS-M01 catalogue row in MONITORING.md');
        }
        const tampered = realDoc.replace(
            duplicateRow[0],
            `${duplicateRow[0]}\n${duplicateRow[0]}`,
        );
        expect(failures(checkMonitoringDoc(tampered))).toContain('MN.alert.unique.MS-M01');
    });

    it.each(['P0', 'P1', 'P2', 'P3'])(
        'flags removal of severity tier %s from §3.6',
        (tier) => {
            const tampered = realDoc.replace(new RegExp(`\\*\\*${tier}\\*\\*`, 'g'), '**PX**');
            expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.sev.${tier}`);
        },
    );

    it.each(['DS-1', 'DS-2', 'DS-3', 'DS-4'])(
        'flags removal of data source %s from §4',
        (ds) => {
            const tampered = realDoc.replace(new RegExp(`\\*\\*${ds}\\*\\*`, 'g'), '**DS-X**');
            expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.ds.${ds}`);
        },
    );

    it.each(['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5'])(
        'flags removal of DR drill %s from §5',
        (drill) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${drill}\\*\\*`, 'g'),
                '**DR-X**',
            );
            expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.drill.${drill}`);
        },
    );
});

// ==================== checkContractHardeningDoc ====================

describe('checkContractHardeningDoc', () => {
    const realDoc = readRepoFile('docs/multisig/CONTRACT_HARDENING.md');

    it('passes every check against the committed CONTRACT_HARDENING.md', () => {
        expect(failures(checkContractHardeningDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkContractHardeningDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CH.doc');
    });

    it.each([...MS_CH_ITEMS])(
        'flags removal of hardening item %s heading from §3',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`### ${item} —`, 'g'),
                '### MS-CH-X —',
            );
            expect(failures(checkContractHardeningDoc(tampered))).toContain(
                `CH.item.${item}`,
            );
        },
    );

    it.each([...R_MS_CH_RULES])(
        'flags removal of CI guardrail rule %s from §5',
        (rule) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${rule}\\*\\*`, 'g'),
                '**R-MS-CH-X**',
            );
            expect(failures(checkContractHardeningDoc(tampered))).toContain(
                `CH.rule.${rule}`,
            );
        },
    );

    it('flags removal of the A2-verdict-READY landing gate', () => {
        const tampered = realDoc.replace(/READY/g, 'PENDING');
        expect(failures(checkContractHardeningDoc(tampered))).toContain('CH.a2-gate');
    });
});

// ==================== checkTestnetDeploymentDoc ====================

describe('checkTestnetDeploymentDoc', () => {
    const realDoc = readRepoFile('docs/multisig/TESTNET_DEPLOYMENT.md');

    it('passes every check against the committed TESTNET_DEPLOYMENT.md', () => {
        expect(failures(checkTestnetDeploymentDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkTestnetDeploymentDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TN.doc');
    });

    it('flags drift of the wallet-ui test bar from §6.1 AC-8 (28 tests)', () => {
        const tampered = realDoc.replace(
            new RegExp(`${WALLET_UI_TEST_BAR}\\s*tests?`, 'g'),
            '1 test',
        );
        expect(failures(checkTestnetDeploymentDoc(tampered))).toContain('TN.bar.walletui');
    });

    it.each(ERROR_MS_CODES.filter((c) => c.value !== 0))(
        'flags removal of error-path coverage row for $name',
        ({ name }) => {
            const tampered = realDoc.replace(new RegExp(name, 'g'), 'ERROR_MS_X');
            expect(failures(checkTestnetDeploymentDoc(tampered))).toContain(`TN.err.${name}`);
        },
    );

    it('flags removal of the §5.5 72 h cooldown reference', () => {
        const tampered = realDoc.replace(/72\s*h/g, '12 h');
        expect(failures(checkTestnetDeploymentDoc(tampered))).toContain('TN.recovery.cooldown');
    });

    it('flags removal of the §5.5 recovery-drill.log artefact name', () => {
        const tampered = realDoc.replace(/recovery-drill\.log/g, 'other.log');
        expect(failures(checkTestnetDeploymentDoc(tampered))).toContain('TN.recovery.log');
    });
});

// ==================== checkBugBountyDoc ====================

describe('checkBugBountyDoc', () => {
    const realDoc = readRepoFile('docs/multisig/BUG_BOUNTY.md');

    it('passes every check against the committed BUG_BOUNTY.md', () => {
        expect(failures(checkBugBountyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkBugBountyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('BB.doc');
    });

    it.each([...T_MSC_THREATS])(
        'flags removal of threat-to-bounty mapping for %s',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-MSC-X**',
            );
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.threat.${threat}`);
        },
    );

    it('flags removal of the A2-READY activation gate', () => {
        const tampered = realDoc.replace(/A2 verdict `READY`/g, 'A2 verdict `PENDING`')
                                .replace(/verdict `READY`/g, 'verdict `PENDING`');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.a2-gate');
    });

    it('flags removal of the RC-BOUNTY-CRITICAL pause reason code', () => {
        const tampered = realDoc.replace(/RC-BOUNTY-CRITICAL/g, 'RC-OTHER');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.pause-rc');
    });
});

// ==================== checkContractEvidence ====================

describe('checkContractEvidence', () => {
    const realContract = readRepoFile('contracts/MultiSigCard.tact');

    it('passes every check against the committed MultiSigCard.tact', () => {
        expect(failures(checkContractEvidence(realContract))).toEqual([]);
    });

    it('flags a missing contract', () => {
        const results = checkContractEvidence(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CT.tact');
    });

    it.each(ERROR_MS_CODES)(
        'flags drift of error code constant $name = $value',
        ({ name, value }) => {
            const tampered = realContract.replace(
                new RegExp(`const ${name}:\\s*Int\\s*=\\s*${value}\\b`, 'g'),
                `const ${name}_RENAMED: Int = ${value}`,
            );
            expect(failures(checkContractEvidence(tampered))).toContain(`CT.const.${name}`);
        },
    );

    it('flags drift of MAX_SIGNERS from 3', () => {
        const tampered = realContract.replace(
            /const MAX_SIGNERS:\s*Int\s*=\s*3\b/g,
            'const MAX_SIGNERS_RENAMED: Int = 3',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.max-signers');
    });

    it('flags a regression of proposalKey back to the broken integer-addition combinator', () => {
        // MS-CH-1 has landed: proposalKey now derives its key from a packed-cell
        // hash. Simulate a regression that reintroduces the old
        // `sha256(nft_address.asSlice()) + proposal_id` combinator (which reverts
        // on-chain with exit 9 and is collision-prone). The validator must trip
        // and demand a paired SPECIFICATION.md §3.3 / CONTRACT_HARDENING.md revert.
        const tampered = realContract.replace(
            /fun proposalKey[\s\S]*?\n    \}/,
            'fun proposalKey(nft_address: Address, proposal_id: Int): Int {\n        return sha256(nft_address.asSlice()) + proposal_id;\n    }',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.proposalKey.hardened');
    });

    it('flags a regression of approvalKey back to the broken integer-addition combinator', () => {
        const tampered = realContract.replace(
            /fun approvalKey[\s\S]*?\n    \}/,
            'fun approvalKey(nft_address: Address, proposal_id: Int, signer: Address): Int {\n        return sha256(nft_address.asSlice()) + proposal_id * 1000 + sha256(signer.asSlice());\n    }',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.approvalKey.hardened');
    });

    it('flags landing of MS-CH-2 (removal of RegisterNFTOwnerMultiSig) without doc update', () => {
        const tampered = realContract.replace(
            /receive\(msg:\s*RegisterNFTOwnerMultiSig\)/g,
            'receive(msg: OTHER_HANDLER_REMOVED)',
        );
        expect(failures(checkContractEvidence(tampered))).toContain(
            'CT.testonly.RegisterNFTOwnerMultiSig',
        );
    });

    it('flags removal of the deployer-only guard on the test handler', () => {
        const tampered = realContract.replace(
            /require\(sender\(\)\s*==\s*self\.deployer/g,
            'require(true',
        );
        expect(failures(checkContractEvidence(tampered))).toContain(
            'CT.testonly.deployer-guard',
        );
    });

    it('flags removal of the ERROR_MS_ALREADY_APPROVED idempotency guard', () => {
        const tampered = realContract.replace(/ERROR_MS_ALREADY_APPROVED/g, 'ERROR_OTHER');
        expect(failures(checkContractEvidence(tampered))).toContain(
            'CT.approval.already-approved',
        );
    });

    it('flags removal of the ERROR_MS_INVALID_THRESHOLD range guard', () => {
        const tampered = realContract.replace(/ERROR_MS_INVALID_THRESHOLD/g, 'ERROR_OTHER');
        expect(failures(checkContractEvidence(tampered))).toContain('CT.threshold.invalid');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    function loadAllDocs(): Record<string, string | null> {
        return {
            specification:     readRepoFile('docs/multisig/SPECIFICATION.md'),
            walletUx:          readRepoFile('docs/multisig/WALLET_UX.md'),
            guardianRecovery:  readRepoFile('docs/multisig/GUARDIAN_RECOVERY.md'),
            notifications:     readRepoFile('docs/multisig/NOTIFICATIONS.md'),
            monitoring:        readRepoFile('docs/multisig/MONITORING.md'),
            contractHardening: readRepoFile('docs/multisig/CONTRACT_HARDENING.md'),
            testnetDeployment: readRepoFile('docs/multisig/TESTNET_DEPLOYMENT.md'),
            bugBounty:         readRepoFile('docs/multisig/BUG_BOUNTY.md'),
        };
    }

    it('passes every cross-doc check against the committed artifacts', () => {
        expect(failures(checkCrossDocReferences(loadAllDocs()))).toEqual([]);
    });

    it('flags an undefined MS-CH-N reference (R-MS-CH-2)', () => {
        const docs = loadAllDocs();
        docs.monitoring = `${docs.monitoring}\n\nSee MS-CH-99 for follow-up.\n`;
        expect(failures(checkCrossDocReferences(docs))).toContain(
            'XR.MS-CH.monitoring.MS-CH-99',
        );
    });

    it('flags removal of T-MSC-N threat from BUG_BOUNTY.md while SPECIFICATION.md still lists it', () => {
        const docs = loadAllDocs();
        if (docs.bugBounty) {
            docs.bugBounty = docs.bugBounty.replace(/\*\*T-MSC-3\*\*/g, '**T-MSC-X**');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.threat.T-MSC-3');
    });

    it.each(MS_M_IDS)(
        'flags missing %s from §3.6 severity matrix while still listed in §3 catalogue',
        (alert) => {
            const docs = loadAllDocs();
            const mn = docs.monitoring;
            if (!mn) throw new Error('MONITORING.md missing');
            const idx36 = mn.indexOf('### 3.6 Roll-up');
            const idxNext = mn.indexOf('## 4. Data sources');
            const slice36 = mn.slice(idx36, idxNext);
            // Strip every mention of the alert from §3.6 only.
            const tamperedSlice = slice36.replace(new RegExp(`\\b${alert}\\b`, 'g'), 'MS-MXX');
            docs.monitoring = mn.slice(0, idx36) + tamperedSlice + mn.slice(idxNext);
            expect(failures(checkCrossDocReferences(docs))).toContain(`XR.sev.${alert}`);
        },
    );

    it('flags MONITORING.md citing a non-existent MS-Nxx notification', () => {
        const docs = loadAllDocs();
        if (docs.monitoring) {
            docs.monitoring = `${docs.monitoring}\n\nSee MS-N99 for follow-up.\n`;
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.msn.MS-N99');
    });

    it.each(ERROR_MS_CODES.filter((c) => c.value !== 0))(
        'flags error code $name missing from SPECIFICATION.md while still in TESTNET_DEPLOYMENT.md',
        ({ name }) => {
            const docs = loadAllDocs();
            if (docs.specification) {
                docs.specification = docs.specification.replace(
                    new RegExp(name, 'g'),
                    'ERROR_MS_X',
                );
            }
            expect(failures(checkCrossDocReferences(docs))).toContain(`XR.err.${name}`);
        },
    );

    it('flags removal of the NOTIFICATIONS.md hookback from WALLET_UX.md §8', () => {
        const docs = loadAllDocs();
        if (docs.walletUx) {
            docs.walletUx = docs.walletUx.replace(/NOTIFICATIONS\.md/g, 'OTHER_DOC.md');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.wx-nf.optin');
    });

    it('flags removal of the GUARDIAN_RECOVERY.md hookback from WALLET_UX.md §7', () => {
        const docs = loadAllDocs();
        if (docs.walletUx) {
            docs.walletUx = docs.walletUx.replace(/GUARDIAN_RECOVERY\.md/g, 'OTHER_DOC.md');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.wx-gr.hook');
    });

    it('flags missing 2-of-3 threshold preset row from WALLET_UX.md', () => {
        const docs = loadAllDocs();
        if (docs.walletUx) {
            docs.walletUx = docs.walletUx
                .replace(/\*\*Personal\*\*\s*\|\s*2\s*\|\s*3\s*\|/g, '**Personal** | X | Y |')
                .replace(/2-of-3/g, 'N-of-M');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.preset.2-of-3');
    });

    it('flags missing 3-of-5 threshold preset row from WALLET_UX.md', () => {
        const docs = loadAllDocs();
        if (docs.walletUx) {
            docs.walletUx = docs.walletUx
                .replace(/\*\*Corporate\*\*\s*\|\s*3\s*\|\s*5/g, '**Corporate** | X | Y')
                .replace(/3-of-5/g, 'N-of-M');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.preset.3-of-5');
    });
});

// ==================== runAllChecks integration ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed F5 multi-sig artifacts', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Surface the failing checks so CI logs are immediately diagnostic.
            // eslint-disable-next-line no-console
            console.error(
                'Multi-sig readiness validator failures:\n' +
                    report.failures
                        .map((f) => `  ✗ ${f.id} — ${f.name} (${f.detail})`)
                        .join('\n'),
            );
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });

    it('counts more than 200 individual checks (sanity)', () => {
        // Guards against accidental gutting of the validator (e.g., empty docs
        // passing because their check functions short-circuit). We set a
        // conservative floor below the current configuration.
        const report = runAllChecks();
        expect(report.results.length).toBeGreaterThanOrEqual(200);
    });
});
