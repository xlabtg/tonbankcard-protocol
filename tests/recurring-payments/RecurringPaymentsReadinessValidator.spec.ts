/**
 * Unit tests for scripts/recurring-payments/check-recurring-payments-readiness.ts
 * (Issue #139, F4).
 *
 * The validator is the off-chain CI gate that enforces structural drift checks
 * between the eight F4 recurring-payments artifacts and the production
 * contract:
 *   - docs/recurring-payments/SPECIFICATION.md          (AC-2)
 *   - docs/recurring-payments/TESTNET_DEPLOYMENT.md     (AC-3 / AC-7 / AC-8)
 *   - docs/recurring-payments/DASHBOARD_INTEGRATION.md  (AC-4)
 *   - docs/recurring-payments/WALLET_UX.md              (AC-5)
 *   - docs/recurring-payments/NOTIFICATIONS.md          (AC-6)
 *   - docs/recurring-payments/MONITORING.md             (AC-6 addendum)
 *   - docs/recurring-payments/CONTRACT_HARDENING.md     (RP-CH-1..RP-CH-5
 *                                                       backlog, A2-gated)
 *   - docs/recurring-payments/BUG_BOUNTY.md             (A5-gated)
 *   - contracts/RecurringPayments.tact                  (pre-A2 shapes,
 *                                                       evidence anchors)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported check
 * functions with both well-formed and tampered content. They do NOT require a
 * compiled contract and therefore run in any environment with ts-jest. The
 * pattern mirrors tests/cross-chain-bridge/BridgeReadinessValidator.spec.ts
 * (F3, PR #206).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    BILLING_PERIOD_SECONDS,
    ERROR_RP_CODES,
    T_RP_THREATS,
    RP_CH_ITEMS,
    R_RP_CH_RULES,
    SUB_M_IDS,
    RP_N_IDS,
    DASHBOARD_TEST_BAR,
    WALLET_UI_TEST_BAR,
    classifyAcceptanceCriterion,
    checkSpecificationDoc,
    checkDashboardIntegrationDoc,
    checkWalletUxDoc,
    checkNotificationsDoc,
    checkMonitoringDoc,
    checkContractHardeningDoc,
    checkTestnetDeploymentDoc,
    checkBugBountyDoc,
    checkContractEvidence,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/recurring-payments/check-recurring-payments-readiness';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-8 in order (Issue #139 §8)', () => {
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
            'testnet-deployment',
            'dashboard-integration',
            'wallet-ux',
            'notifications',
            'monitoring',
            'contract-hardening',
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

    it('routes AC-4 to the dashboard-integration evidence path', () => {
        const ac4 = classifyAcceptanceCriterion('AC-4');
        expect(ac4?.evidenceCheck).toBe('dashboard-integration');
    });

    it('routes AC-5 to the wallet-ux evidence path', () => {
        const ac5 = classifyAcceptanceCriterion('AC-5');
        expect(ac5?.evidenceCheck).toBe('wallet-ux');
    });

    it('routes AC-6 to the notifications evidence path', () => {
        const ac6 = classifyAcceptanceCriterion('AC-6');
        expect(ac6?.evidenceCheck).toBe('notifications');
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
    it('BILLING_PERIOD_SECONDS pins the four canonical billing periods', () => {
        expect(BILLING_PERIOD_SECONDS.map((p) => p.name)).toEqual([
            'daily', 'weekly', 'monthly', 'annual',
        ]);
        const byName = Object.fromEntries(
            BILLING_PERIOD_SECONDS.map((p) => [p.name, p.seconds]),
        );
        expect(byName.daily).toBe(86400);
        expect(byName.weekly).toBe(604800);
        expect(byName.monthly).toBe(2592000);
        expect(byName.annual).toBe(31536000);
    });

    it('ERROR_RP_CODES enumerates exactly codes 0..9', () => {
        expect(ERROR_RP_CODES.map((c) => c.value)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
        const byName = Object.fromEntries(
            ERROR_RP_CODES.map((c) => [c.name, c.value]),
        );
        expect(byName.ERROR_RP_NONE).toBe(0);
        expect(byName.ERROR_RP_NOT_OWNER).toBe(1);
        expect(byName.ERROR_RP_TOO_EARLY).toBe(6);
        expect(byName.ERROR_RP_NOT_AUTHORIZED).toBe(9);
    });

    it('T_RP_THREATS enumerates six subscription-specific threats (T-RP-1..T-RP-6)', () => {
        expect(T_RP_THREATS).toHaveLength(6);
        expect(T_RP_THREATS[0]).toBe('T-RP-1');
        expect(T_RP_THREATS[5]).toBe('T-RP-6');
    });

    it('RP_CH_ITEMS enumerates five hardening items (RP-CH-1..RP-CH-5)', () => {
        expect(RP_CH_ITEMS).toHaveLength(5);
        expect(RP_CH_ITEMS[0]).toBe('RP-CH-1');
        expect(RP_CH_ITEMS[4]).toBe('RP-CH-5');
    });

    it('R_RP_CH_RULES enumerates five CI guardrail rules (R-RP-CH-1..R-RP-CH-5)', () => {
        expect(R_RP_CH_RULES).toHaveLength(5);
        expect(R_RP_CH_RULES[0]).toBe('R-RP-CH-1');
    });

    it('SUB_M_IDS enumerates eighteen alerts in zero-padded form', () => {
        expect(SUB_M_IDS).toHaveLength(18);
        expect(SUB_M_IDS[0]).toBe('SUB-M01');
        expect(SUB_M_IDS[17]).toBe('SUB-M18');
    });

    it('RP_N_IDS enumerates eight notifications in zero-padded form', () => {
        expect(RP_N_IDS).toHaveLength(8);
        expect(RP_N_IDS[0]).toBe('RP-N01');
        expect(RP_N_IDS[7]).toBe('RP-N08');
    });

    it('Test bar constants pin Issue #139 §8 AC-8: 47 dashboard + 28 wallet-ui', () => {
        expect(DASHBOARD_TEST_BAR).toBe(47);
        expect(WALLET_UI_TEST_BAR).toBe(28);
    });
});

// ==================== checkSpecificationDoc ====================

describe('checkSpecificationDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/SPECIFICATION.md');

    it('passes every check against the committed SPECIFICATION.md', () => {
        expect(failures(checkSpecificationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSpecificationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SP.doc');
    });

    it.each([...BILLING_PERIOD_SECONDS])(
        'flags drift of billing period $name from $seconds s in §4.2',
        ({ name, seconds }) => {
            const re = new RegExp(
                `\\|\\s*\`${name}\`\\s*\\|\\s*\`${seconds}\``,
            );
            const tampered = realDoc.replace(re, `| \`${name}\` | \`9999999\``);
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.period.${name}`,
            );
        },
    );

    it.each([...T_RP_THREATS])(
        'flags removal of subscription-specific threat %s from §9',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-RP-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.threat.${threat}`,
            );
        },
    );

    it.each([...RP_CH_ITEMS])(
        'flags removal of hardening item %s from §10',
        (item) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${item}\\*\\*`, 'g'),
                '**RP-CH-X**',
            );
            expect(failures(checkSpecificationDoc(tampered))).toContain(
                `SP.hardening.${item}`,
            );
        },
    );

    it('flags drift of the §6.1 default grace period (7 days = 604800 s)', () => {
        const tampered = realDoc.replace(/grace_seconds\s*=\s*604800/g, 'grace_seconds = 1');
        expect(failures(checkSpecificationDoc(tampered))).toContain('SP.grace.default');
    });
});

// ==================== checkDashboardIntegrationDoc ====================

describe('checkDashboardIntegrationDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/DASHBOARD_INTEGRATION.md');

    it('passes every check against the committed DASHBOARD_INTEGRATION.md', () => {
        expect(failures(checkDashboardIntegrationDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkDashboardIntegrationDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('DI.doc');
    });

    it.each(['active', 'cancelled', 'expired', 'lapsed'])(
        'flags removal of subscriber status %s from §4.1',
        (status) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${status}\\*\\*`, 'g'),
                '**unknown**',
            );
            expect(failures(checkDashboardIntegrationDoc(tampered))).toContain(
                `DI.status.${status}`,
            );
        },
    );

    it.each([...BILLING_PERIOD_SECONDS])(
        'flags removal of MRR conversion row for $name',
        ({ name }) => {
            const tampered = realDoc.replace(
                new RegExp(`\\|\\s*\`?${name}\`?\\s*\\|`, 'g'),
                '| placeholder |',
            );
            expect(failures(checkDashboardIntegrationDoc(tampered))).toContain(
                `DI.mrr.${name}`,
            );
        },
    );
});

// ==================== checkWalletUxDoc ====================

describe('checkWalletUxDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/WALLET_UX.md');

    it('passes every check against the committed WALLET_UX.md', () => {
        expect(failures(checkWalletUxDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkWalletUxDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('WX.doc');
    });

    it.each([
        'ERROR_RP_NFT_NOT_REGISTERED',
        'ERROR_RP_NOT_OWNER',
        'ERROR_RP_INVALID_AMOUNT',
        'ERROR_RP_INVALID_PERIOD',
    ])('flags removal of user-facing error code %s from §3.4', (code) => {
        const tampered = realDoc.replace(new RegExp(code, 'g'), 'ERROR_RP_X');
        expect(failures(checkWalletUxDoc(tampered))).toContain(`WX.code.${code}`);
    });

    it('flags removal of the RP-CH-3 deferral note in §5 pause/resume', () => {
        const tampered = realDoc.replace(/RP-CH-3/g, 'RP-CH-X');
        expect(failures(checkWalletUxDoc(tampered))).toContain('WX.pause.RP-CH-3');
    });
});

// ==================== checkNotificationsDoc ====================

describe('checkNotificationsDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/NOTIFICATIONS.md');

    it('passes every check against the committed NOTIFICATIONS.md', () => {
        expect(failures(checkNotificationsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkNotificationsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('NF.doc');
    });

    it.each(RP_N_IDS)('flags removal of notification %s from §3 catalogue', (id) => {
        const tampered = realDoc.replace(
            new RegExp(`\\*\\*${id}\\*\\*`, 'g'),
            '**RP-NXX**',
        );
        expect(failures(checkNotificationsDoc(tampered))).toContain(`NF.id.${id}`);
    });

    it('flags removal of the T-3d anchor (259200 s)', () => {
        const tampered = realDoc.replace(/\b259200\b/g, '999');
        expect(failures(checkNotificationsDoc(tampered))).toContain('NF.t3d');
    });
});

// ==================== checkMonitoringDoc ====================

describe('checkMonitoringDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/MONITORING.md');

    it('passes every check against the committed MONITORING.md', () => {
        expect(failures(checkMonitoringDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkMonitoringDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('MN.doc');
    });

    it.each(SUB_M_IDS)('flags removal of alert %s from §3', (alert) => {
        const tampered = realDoc.replace(new RegExp(`\\b${alert}\\b`, 'g'), 'SUB-MXX');
        expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.alert.${alert}`);
    });

    it('flags duplicate alert rows in §3 catalogue', () => {
        const duplicateRow = realDoc.match(/\| SUB-M01 \|[^\n]*/);
        if (!duplicateRow) {
            throw new Error('Could not locate SUB-M01 catalogue row in MONITORING.md');
        }
        const tampered = realDoc.replace(
            duplicateRow[0],
            `${duplicateRow[0]}\n${duplicateRow[0]}`,
        );
        expect(failures(checkMonitoringDoc(tampered))).toContain('MN.alert.unique.SUB-M01');
    });

    it.each(['P0', 'P1', 'P2', 'P3'])(
        'flags removal of severity tier %s from §3.7',
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
    const realDoc = readRepoFile('docs/recurring-payments/CONTRACT_HARDENING.md');

    it('passes every check against the committed CONTRACT_HARDENING.md', () => {
        expect(failures(checkContractHardeningDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkContractHardeningDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CH.doc');
    });

    it.each([...RP_CH_ITEMS])(
        'flags removal of hardening item %s heading from §3',
        (item) => {
            const tampered = realDoc.replace(new RegExp(`### ${item} —`, 'g'), '### RP-CH-X —');
            expect(failures(checkContractHardeningDoc(tampered))).toContain(`CH.item.${item}`);
        },
    );

    it.each([...R_RP_CH_RULES])(
        'flags removal of CI guardrail rule %s from §5',
        (rule) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${rule}\\*\\*`, 'g'),
                '**R-RP-CH-X**',
            );
            expect(failures(checkContractHardeningDoc(tampered))).toContain(`CH.rule.${rule}`);
        },
    );

    it('flags removal of the A2-verdict-READY landing gate', () => {
        const tampered = realDoc.replace(/READY/g, 'PENDING');
        expect(failures(checkContractHardeningDoc(tampered))).toContain('CH.a2-gate');
    });
});

// ==================== checkTestnetDeploymentDoc ====================

describe('checkTestnetDeploymentDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/TESTNET_DEPLOYMENT.md');

    it('passes every check against the committed TESTNET_DEPLOYMENT.md', () => {
        expect(failures(checkTestnetDeploymentDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkTestnetDeploymentDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TN.doc');
    });

    it('flags drift of the dashboard test bar from §8 AC-8 (47 tests)', () => {
        const tampered = realDoc.replace(
            new RegExp(`${DASHBOARD_TEST_BAR}\\s*tests?`, 'g'),
            '1 test',
        );
        expect(failures(checkTestnetDeploymentDoc(tampered))).toContain('TN.bar.dashboard');
    });

    it('flags drift of the wallet-ui test bar from §8 AC-8 (28 tests)', () => {
        const tampered = realDoc.replace(
            new RegExp(`${WALLET_UI_TEST_BAR}\\s*tests?`, 'g'),
            '1 test',
        );
        expect(failures(checkTestnetDeploymentDoc(tampered))).toContain('TN.bar.walletui');
    });

    it.each(ERROR_RP_CODES.filter((c) => c.value !== 0))(
        'flags removal of error-path coverage row for $name',
        ({ name }) => {
            const tampered = realDoc.replace(new RegExp(name, 'g'), 'ERROR_RP_X');
            expect(failures(checkTestnetDeploymentDoc(tampered))).toContain(`TN.err.${name}`);
        },
    );
});

// ==================== checkBugBountyDoc ====================

describe('checkBugBountyDoc', () => {
    const realDoc = readRepoFile('docs/recurring-payments/BUG_BOUNTY.md');

    it('passes every check against the committed BUG_BOUNTY.md', () => {
        expect(failures(checkBugBountyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkBugBountyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('BB.doc');
    });

    it.each([...T_RP_THREATS])(
        'flags removal of threat-to-bounty mapping for %s',
        (threat) => {
            const tampered = realDoc.replace(
                new RegExp(`\\*\\*${threat}\\*\\*`, 'g'),
                '**T-RP-X**',
            );
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.threat.${threat}`);
        },
    );

    it('flags removal of the A2-READY activation gate', () => {
        const tampered = realDoc.replace(/READY/g, 'PENDING');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.a2-gate');
    });

    it('flags removal of the RC-BOUNTY-CRITICAL pause reason code', () => {
        const tampered = realDoc.replace(/RC-BOUNTY-CRITICAL/g, 'RC-OTHER');
        expect(failures(checkBugBountyDoc(tampered))).toContain('BB.pause-rc');
    });
});

// ==================== checkContractEvidence ====================

describe('checkContractEvidence', () => {
    const realContract = readRepoFile('contracts/RecurringPayments.tact');

    it('passes every check against the committed RecurringPayments.tact', () => {
        expect(failures(checkContractEvidence(realContract))).toEqual([]);
    });

    it('flags a missing contract', () => {
        const results = checkContractEvidence(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CT.tact');
    });

    it.each(ERROR_RP_CODES)(
        'flags drift of error code constant $name = $value',
        ({ name, value }) => {
            const tampered = realContract.replace(
                new RegExp(`const ${name}:\\s*Int\\s*=\\s*${value}\\b`, 'g'),
                `const ${name}_RENAMED: Int = ${value}`,
            );
            expect(failures(checkContractEvidence(tampered))).toContain(`CT.const.${name}`);
        },
    );

    it('flags removal of MIN_PERIOD_SECONDS = 3600', () => {
        const tampered = realContract.replace(
            /const MIN_PERIOD_SECONDS:\s*Int\s*=\s*3600\b/g,
            'const MIN_PERIOD_SECONDS_RENAMED: Int = 3600',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.min-period');
    });

    it('flags landing of RP-CH-1 (composite-key combinator change) without doc update', () => {
        // Simulate RP-CH-1 landing by swapping the integer-addition combinator
        // for a hash-based combinator. The validator must detect the divergence.
        const tampered = realContract.replace(
            /return sha256\(nft_address\.asSlice\(\)\) \+ mandate_id;/g,
            'return sha256(beginCell().storeSlice(nft_address.asSlice()).storeUint(mandate_id, 64).endCell().asSlice());',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.mandateKey.addition');
    });

    it('flags reintroduction of RegisterNFTOwnerRecurring in production', () => {
        const tampered = `${realContract}\nreceive(msg: RegisterNFTOwnerRecurring) {}`;
        expect(failures(checkContractEvidence(tampered))).toContain(
            'CT.testonly.RegisterNFTOwnerRecurring',
        );
    });

    it('flags removal of the ERROR_RP_TOO_EARLY schedule guard', () => {
        const tampered = realContract.replace(/ERROR_RP_TOO_EARLY/g, 'ERROR_OTHER');
        expect(failures(checkContractEvidence(tampered))).toContain('CT.schedule.too-early');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    function loadAllDocs(): Record<string, string | null> {
        return {
            specification:        readRepoFile('docs/recurring-payments/SPECIFICATION.md'),
            dashboardIntegration: readRepoFile('docs/recurring-payments/DASHBOARD_INTEGRATION.md'),
            walletUx:             readRepoFile('docs/recurring-payments/WALLET_UX.md'),
            notifications:        readRepoFile('docs/recurring-payments/NOTIFICATIONS.md'),
            monitoring:           readRepoFile('docs/recurring-payments/MONITORING.md'),
            contractHardening:    readRepoFile('docs/recurring-payments/CONTRACT_HARDENING.md'),
            testnetDeployment:    readRepoFile('docs/recurring-payments/TESTNET_DEPLOYMENT.md'),
            bugBounty:            readRepoFile('docs/recurring-payments/BUG_BOUNTY.md'),
        };
    }

    it('passes every cross-doc check against the committed artifacts', () => {
        expect(failures(checkCrossDocReferences(loadAllDocs()))).toEqual([]);
    });

    it('flags an undefined RP-CH-N reference (R-RP-CH-2)', () => {
        const docs = loadAllDocs();
        docs.monitoring = `${docs.monitoring}\n\nSee RP-CH-99 for follow-up.\n`;
        expect(failures(checkCrossDocReferences(docs))).toContain(
            'XR.RP-CH.monitoring.RP-CH-99',
        );
    });

    it('flags removal of T-RP-N threat from BUG_BOUNTY.md when SPECIFICATION.md still lists it', () => {
        const docs = loadAllDocs();
        if (docs.bugBounty) {
            docs.bugBounty = docs.bugBounty.replace(/\*\*T-RP-3\*\*/g, '**T-RP-X**');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.threat.T-RP-3');
    });

    it.each(SUB_M_IDS)(
        'flags missing %s from §3.7 severity matrix while still listed in §3 catalogue',
        (alert) => {
            const docs = loadAllDocs();
            const mn = docs.monitoring;
            if (!mn) throw new Error('MONITORING.md missing');
            const idx37 = mn.indexOf('### 3.7 Roll-up');
            const idxNext = mn.indexOf('## 4. Data sources');
            const slice37 = mn.slice(idx37, idxNext);
            // Strip every mention of the alert from §3.7 only.
            const tamperedSlice = slice37.replace(new RegExp(`\\b${alert}\\b`, 'g'), 'SUB-MXX');
            docs.monitoring = mn.slice(0, idx37) + tamperedSlice + mn.slice(idxNext);
            expect(failures(checkCrossDocReferences(docs))).toContain(`XR.sev.${alert}`);
        },
    );

    it('flags MONITORING.md citing a non-existent RP-Nxx notification', () => {
        const docs = loadAllDocs();
        if (docs.monitoring) {
            docs.monitoring = `${docs.monitoring}\n\nSee RP-N99 for follow-up.\n`;
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.rpn.RP-N99');
    });

    it.each(ERROR_RP_CODES.filter((c) => c.value !== 0))(
        'flags error code $name missing from SPECIFICATION.md while still in TESTNET_DEPLOYMENT.md',
        ({ name }) => {
            const docs = loadAllDocs();
            if (docs.specification) {
                docs.specification = docs.specification.replace(new RegExp(name, 'g'), 'ERROR_RP_X');
            }
            expect(failures(checkCrossDocReferences(docs))).toContain(`XR.err.${name}`);
        },
    );

    it.each([...BILLING_PERIOD_SECONDS])(
        'flags billing period $name missing from DASHBOARD_INTEGRATION.md',
        ({ name }) => {
            const docs = loadAllDocs();
            if (docs.dashboardIntegration) {
                docs.dashboardIntegration = docs.dashboardIntegration.replace(
                    new RegExp(`\\b${name}\\b`, 'g'),
                    'placeholder',
                );
            }
            expect(failures(checkCrossDocReferences(docs))).toContain(`XR.period.${name}`);
        },
    );

    it('flags removal of the NOTIFICATIONS.md hookback from WALLET_UX.md §6', () => {
        const docs = loadAllDocs();
        if (docs.walletUx) {
            docs.walletUx = docs.walletUx.replace(/NOTIFICATIONS\.md/g, 'OTHER_DOC.md');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.wx-nf.optin');
    });
});

// ==================== runAllChecks integration ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed F4 recurring-payments artifacts', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Surface the failing checks so CI logs are immediately diagnostic.
            // eslint-disable-next-line no-console
            console.error(
                'Recurring-payments readiness validator failures:\n' +
                    report.failures
                        .map((f) => `  ✗ ${f.id} — ${f.name} (${f.detail})`)
                        .join('\n'),
            );
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });

    it('counts more than 250 individual checks (sanity)', () => {
        // Guards against accidental gutting of the validator (e.g., empty docs
        // passing because their check functions short-circuit). The current
        // configuration emits 278 checks; we set a conservative floor.
        const report = runAllChecks();
        expect(report.results.length).toBeGreaterThanOrEqual(250);
    });
});
