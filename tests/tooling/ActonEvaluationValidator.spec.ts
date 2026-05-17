/**
 * Unit tests for scripts/tooling/check-acton-evaluation.ts
 * (Issue #143, D6 — Acton Toolchain Evaluation).
 *
 * The validator is the off-chain CI gate that enforces structural drift
 * checks between the D6 evaluation artefacts and the upstream Issue #143
 * acceptance criteria:
 *   - docs/tooling/ACTON_EVALUATION.md
 *   - experiments/acton/README.md
 *   - experiments/acton/tolk-harness/account-locks-toy.tolk
 *
 * These tests are pure TypeScript fixtures — they exercise the exported
 * check functions with both well-formed (the on-disk artefacts) and
 * tampered (in-memory mutated) content. They do NOT install the Acton
 * binary, do NOT compile any Tolk, and do NOT touch contracts/ or CI.
 *
 * The pattern mirrors tests/analytics/AnalyticsReadinessValidator.spec.ts
 * (F7, PR #210) but is smaller because D6 ships a single evaluation
 * document plus a sandbox prototype rather than a nine-document
 * readiness pack.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    ACTON_PINNED_VERSION,
    ACTON_RELEASE_DATE,
    ACTON_CONFIG_FILE,
    ACTON_INSTALL_HOST,
    DECISION_PRIMARY,
    DECISION_COMPANION,
    REQUIRED_EVALUATION_SECTIONS,
    AUTHORITATIVE_TOOLS,
    RECOMMENDATION_TARGETS,
    FROZEN_FUNC_FILES,
    classifyAcceptanceCriterion,
    checkEvaluationDoc,
    checkExperimentReadme,
    checkTolkHarness,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/tooling/check-acton-evaluation';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]): string[] {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #143 §8)', () => {
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

    it('uses only the four documented evidenceCheck kinds', () => {
        const allowed = new Set([
            'evaluation',
            'experiment-readme',
            'tolk-harness',
            'cross-doc',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('AC-4 routes evidence to the experiments/acton/ prototype', () => {
        const ac4 = classifyAcceptanceCriterion('AC-4');
        expect(ac4).toBeDefined();
        expect(ac4!.artifact).toContain('experiments/acton');
        expect(ac4!.evidenceCheck).toBe('experiment-readme');
    });

    it('classifyAcceptanceCriterion returns undefined for unknown ids', () => {
        expect(classifyAcceptanceCriterion('AC-999')).toBeUndefined();
    });
});

// ==================== Exported constants ====================

describe('exported constants', () => {
    it('pins Acton to v1.0.0 released 2026-05-11', () => {
        expect(ACTON_PINNED_VERSION).toBe('v1.0.0');
        expect(ACTON_RELEASE_DATE).toBe('2026-05-11');
        expect(ACTON_CONFIG_FILE).toBe('Acton.toml');
        expect(ACTON_INSTALL_HOST).toBe('github.com/ton-blockchain/acton');
    });

    it('records the two-part decision (NO ADOPTION + EXPERIMENTS ONLY)', () => {
        expect(DECISION_PRIMARY).toBe('NO ADOPTION');
        expect(DECISION_COMPANION).toBe('EXPERIMENTS ONLY');
    });

    it('lists exactly twelve required evaluation sections', () => {
        expect(REQUIRED_EVALUATION_SECTIONS.length).toBe(12);
        expect(REQUIRED_EVALUATION_SECTIONS[0]).toContain('1. Goal');
        expect(REQUIRED_EVALUATION_SECTIONS[11]).toContain('12. References');
    });

    it('AUTHORITATIVE_TOOLS covers Tact compiler, sandbox, gas, deploy, immutability', () => {
        expect(AUTHORITATIVE_TOOLS).toContain('@tact-lang/compiler');
        expect(AUTHORITATIVE_TOOLS).toContain('@ton/sandbox');
        expect(AUTHORITATIVE_TOOLS).toContain('scripts/gas-profile/');
        expect(AUTHORITATIVE_TOOLS).toContain('scripts/deploy/deploy.ts');
        expect(AUTHORITATIVE_TOOLS).toContain('scripts/deploy/check-immutability.ts');
    });

    it('RECOMMENDATION_TARGETS covers exactly D1/D2/A3/B1/B2 (Issue §5.4)', () => {
        expect(RECOMMENDATION_TARGETS).toEqual(['D1', 'D2', 'A3', 'B1', 'B2']);
    });

    it('FROZEN_FUNC_FILES enumerates the five production FunC files', () => {
        expect(FROZEN_FUNC_FILES.length).toBe(5);
        expect(FROZEN_FUNC_FILES).toContain('contracts/payments/account-locks.fc');
        expect(FROZEN_FUNC_FILES).toContain('contracts/payments/payment-hub.fc');
    });
});

// ==================== checkEvaluationDoc ====================

describe('checkEvaluationDoc — well-formed on-disk artefact', () => {
    const content = readRepoFile('docs/tooling/ACTON_EVALUATION.md');

    it('produces zero failures against the committed evaluation document', () => {
        const results = checkEvaluationDoc(content);
        expect(failures(results)).toEqual([]);
    });

    it('always emits at least one check per AC-mapping row', () => {
        const results = checkEvaluationDoc(content);
        for (const ac of ACCEPTANCE_CRITERIA) {
            const found = results.find((r) => r.id === `EV.acmap.${ac.id}`);
            expect(found).toBeDefined();
            expect(found!.passed).toBe(true);
        }
    });

    it('verifies all five §9 recommendation targets are individually present', () => {
        const results = checkEvaluationDoc(content);
        for (const target of RECOMMENDATION_TARGETS) {
            const found = results.find((r) => r.id === `EV.recommendation.${target}`);
            expect(found).toBeDefined();
            expect(found!.passed).toBe(true);
        }
    });
});

describe('checkEvaluationDoc — tampered fixtures', () => {
    const base = readRepoFile('docs/tooling/ACTON_EVALUATION.md');

    it('fails when the primary decision string is removed', () => {
        const mutated = base.replace(/NO ADOPTION/g, 'YES ADOPTION');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.decision.primary');
    });

    it('fails when the companion posture is removed', () => {
        const mutated = base.replace(/EXPERIMENTS ONLY/g, 'EXPERIMENTS WELCOME');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.decision.companion');
    });

    it('fails when the pinned Acton version disappears', () => {
        const mutated = base.replace(/v1\.0\.0/g, 'v0.9.x');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.acton.version');
    });

    it('fails when a required section heading is removed', () => {
        const mutated = base.replace('## 10. Reconsideration Triggers', '## 10. _Removed_');
        const results = checkEvaluationDoc(mutated);
        const failedIds = failures(results);
        expect(failedIds.some((id) => id.startsWith('EV.section.'))).toBe(true);
    });

    it('fails when a §9 recommendation target is dropped', () => {
        const mutated = base.replace(/\*\*B2 — Mainnet Deployment Plan\*\*/g, '~~removed~~');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.recommendation.B2');
    });

    it('fails when the §10 trigger count is wrong', () => {
        const mutated = base.replace(
            /## 10\. Reconsideration Triggers[\s\S]*?## 11\./,
            '## 10. Reconsideration Triggers\n\n1. **Only trigger**.\n\n## 11.',
        );
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.triggers.count');
    });

    it('fails when the partial-migration cost range is removed', () => {
        const mutated = base.replace(/20\D?35\s*dev-days/gi, 'unknown effort');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.cost.partialMigration');
    });

    it('fails when the full-migration cost range is removed', () => {
        const mutated = base.replace(/3\D?4\s*months/gi, 'unknown effort');
        const results = checkEvaluationDoc(mutated);
        expect(failures(results)).toContain('EV.cost.fullMigration');
    });

    it('fails when content is null (missing file)', () => {
        const results = checkEvaluationDoc(null);
        expect(failures(results)).toContain('EV.exists');
    });
});

// ==================== checkExperimentReadme ====================

describe('checkExperimentReadme — well-formed on-disk artefact', () => {
    const content = readRepoFile('experiments/acton/README.md');

    it('produces zero failures against the committed README', () => {
        const results = checkExperimentReadme(content);
        expect(failures(results)).toEqual([]);
    });

    it('lists every frozen FunC file in the not-migrated register', () => {
        const results = checkExperimentReadme(content);
        for (const f of FROZEN_FUNC_FILES) {
            const id = `EXP.notMigrated.${f.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
            const found = results.find((r) => r.id === id);
            expect(found).toBeDefined();
            expect(found!.passed).toBe(true);
        }
    });
});

describe('checkExperimentReadme — tampered fixtures', () => {
    const base = readRepoFile('experiments/acton/README.md');

    it('fails when the curl install command is removed', () => {
        const mutated = base.replace(/curl\s+-LsSf/g, 'wget --quiet');
        const results = checkExperimentReadme(mutated);
        expect(failures(results)).toContain('EXP.installCurl');
    });

    it('fails when the Docker digest placeholder is removed', () => {
        const mutated = base.replace(/<DIGEST>/g, 'latest').replace(/sha256:/g, 'tag:');
        const results = checkExperimentReadme(mutated);
        expect(failures(results)).toContain('EXP.dockerDigest');
    });

    it('fails when account-locks.fc is dropped from the not-migrated register', () => {
        const mutated = base.replace(/contracts\/payments\/account-locks\.fc/g, 'removed');
        const results = checkExperimentReadme(mutated);
        const id = 'EXP.notMigrated.contracts-payments-account-locks-fc';
        expect(failures(results)).toContain(id);
    });

    it('fails when the freeze-rule citation is removed', () => {
        const mutated = base.replace(/§G\.5/g, '§X').replace(/audit-scope\.md.*G\.5/g, 'audit-scope.md');
        const results = checkExperimentReadme(mutated);
        expect(failures(results)).toContain('EXP.freezeCitation');
    });

    it('fails when the evaluation-doc link is removed', () => {
        const mutated = base.replace(/docs\/tooling\/ACTON_EVALUATION\.md/g, 'NOWHERE.md');
        const results = checkExperimentReadme(mutated);
        expect(failures(results)).toContain('EXP.linkEvaluation');
    });

    it('fails when content is null (missing file)', () => {
        const results = checkExperimentReadme(null);
        expect(failures(results)).toContain('EXP.exists');
    });
});

// ==================== checkTolkHarness ====================

describe('checkTolkHarness — well-formed on-disk artefact', () => {
    const content = readRepoFile('experiments/acton/tolk-harness/account-locks-toy.tolk');

    it('produces zero failures against the committed Tolk harness', () => {
        const results = checkTolkHarness(content);
        expect(failures(results)).toEqual([]);
    });

    it('always declares all four lock-flag constants', () => {
        const results = checkTolkHarness(content);
        for (const flag of ['LOCK_NONE', 'FRAUD_LOCK', 'COLLATERAL_LOCK', 'READ_ONLY']) {
            const found = results.find((r) => r.id === `TH.const.${flag}`);
            expect(found).toBeDefined();
            expect(found!.passed).toBe(true);
        }
    });
});

describe('checkTolkHarness — tampered fixtures', () => {
    const base = readRepoFile('experiments/acton/tolk-harness/account-locks-toy.tolk');

    it('fails when FRAUD_LOCK is renamed away from the FunC source', () => {
        const mutated = base.replace(/const\s+FRAUD_LOCK\b/g, 'const FRAUD_LOCK_RENAMED');
        const results = checkTolkHarness(mutated);
        expect(failures(results)).toContain('TH.const.FRAUD_LOCK');
    });

    it('fails when can_receive() becomes conditional (I6 violation)', () => {
        // Insert an early return that would gate receiving on lock state.
        const mutated = base.replace(
            /fun\s+can_receive\s*\(\s*\)\s*:\s*int\s*{[\s\S]*?return\s+1\s*;\s*}/,
            'fun can_receive(s : Storage, nft : address) : int { return is_locked(lock_state_for(s, nft)) == 0 ? 1 : 0; }',
        );
        const results = checkTolkHarness(mutated);
        expect(failures(results)).toContain('TH.invariant.I6.can_receive');
    });

    it('fails when the INVARIANT I6 comment is removed', () => {
        const mutated = base.replace(/INVARIANT\s+I6/g, 'invariant six');
        const results = checkTolkHarness(mutated);
        expect(failures(results)).toContain('TH.invariant.I6.comment');
    });

    it('fails when the ILLUSTRATIVE-ONLY disclaimer is removed', () => {
        const mutated = base.replace(/ILLUSTRATIVE\s+ONLY/g, 'production-ready');
        const results = checkTolkHarness(mutated);
        expect(failures(results)).toContain('TH.illustrativeOnly');
    });

    it('fails when content is null (missing file)', () => {
        const results = checkTolkHarness(null);
        expect(failures(results)).toContain('TH.exists');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    it('finds docs/tooling/ACTON_EVALUATION.md surfaced in docs/INDEX.md', () => {
        const results = checkCrossDocReferences();
        const found = results.find((r) => r.id === 'XR.index.tooling');
        expect(found).toBeDefined();
        expect(found!.passed).toBe(true);
    });

    it('finds docs/tooling/ACTON_EVALUATION.md referenced in docs/audit-scope.md', () => {
        const results = checkCrossDocReferences();
        const found = results.find((r) => r.id === 'XR.auditScope.tooling');
        expect(found).toBeDefined();
        expect(found!.passed).toBe(true);
    });
});

// ==================== runAllChecks orchestration ====================

describe('runAllChecks orchestration', () => {
    it('aggregates every individual check group with zero failures', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Print failing ids in the assertion message for fast triage.
            // eslint-disable-next-line no-console
            console.error(JSON.stringify(report.failures, null, 2));
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });

    it('returns counts that sum to results.length', () => {
        const report = runAllChecks();
        expect(report.passed + report.failed).toBe(report.results.length);
    });

    it('emits no duplicate check ids', () => {
        const report = runAllChecks();
        const ids = report.results.map((r) => r.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });
});
