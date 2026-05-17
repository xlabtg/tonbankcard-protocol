/**
 * Acton Toolchain Evaluation Validator (Issue #143, D6)
 *
 * Purpose: Validate that the D6 evaluation artefacts
 *   — docs/tooling/ACTON_EVALUATION.md,
 *     experiments/acton/README.md,
 *     experiments/acton/tolk-harness/account-locks-toy.tolk —
 *   stay internally consistent and cross-linked from docs/INDEX.md
 *   and docs/audit-scope.md.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / Tolk sources from the repository working tree only.
 *
 * Usage:
 *   npx ts-node scripts/tooling/check-acton-evaluation.ts
 *   npx ts-node scripts/tooling/check-acton-evaluation.ts --classify AC-4
 *   npx ts-node scripts/tooling/check-acton-evaluation.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the F-series validator pattern (F3..F7); kept smaller because
 * D6 ships a single evaluation document plus a sandbox prototype rather
 * than a nine-document readiness pack.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #143 §8 ("Acceptance Criteria"). Drift between this
// table and the linked artefacts is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'evaluation'
        | 'experiment-readme'
        | 'tolk-harness'
        | 'cross-doc';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'docs/tooling/ACTON_EVALUATION.md created with an explicit adoption decision', artifact: 'docs/tooling/ACTON_EVALUATION.md',                                  evidenceCheck: 'evaluation' },
    { id: 'AC-2', description: 'Current Tact/FunC/TypeScript tooling inventory completed',                    artifact: 'docs/tooling/ACTON_EVALUATION.md',                                  evidenceCheck: 'evaluation' },
    { id: 'AC-3', description: 'Acton feature matrix completed for testing, fuzzing, mutation, coverage, gas, deployment, verification, and CI', artifact: 'docs/tooling/ACTON_EVALUATION.md', evidenceCheck: 'evaluation' },
    { id: 'AC-4', description: 'Minimal experiments/acton/ prototype added (companion experiments-only posture)', artifact: 'experiments/acton/README.md',                                    evidenceCheck: 'experiment-readme' },
    { id: 'AC-5', description: 'Migration risks and estimated implementation effort documented',              artifact: 'docs/tooling/ACTON_EVALUATION.md',                                  evidenceCheck: 'evaluation' },
    { id: 'AC-6', description: 'Recommended updates to D1, D2, A3, B1, and B2 documented',                    artifact: 'docs/tooling/ACTON_EVALUATION.md',                                  evidenceCheck: 'evaluation' },
    { id: 'AC-7', description: 'No existing contract semantics or CI checks changed without an approved follow-up issue', artifact: 'docs/tooling/ACTON_EVALUATION.md',                      evidenceCheck: 'evaluation' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    evaluation:       resolve(REPO_ROOT, 'docs/tooling/ACTON_EVALUATION.md'),
    experimentReadme: resolve(REPO_ROOT, 'experiments/acton/README.md'),
    tolkHarness:      resolve(REPO_ROOT, 'experiments/acton/tolk-harness/account-locks-toy.tolk'),
    docsIndex:        resolve(REPO_ROOT, 'docs/INDEX.md'),
    auditScope:       resolve(REPO_ROOT, 'docs/audit-scope.md'),
};

// ==================== EXPECTED CONSTANTS ====================
// Centralised so a single edit propagates to every consistency check.

export const ACTON_PINNED_VERSION = 'v1.0.0';
export const ACTON_RELEASE_DATE   = '2026-05-11';
export const ACTON_CONFIG_FILE    = 'Acton.toml';
export const ACTON_INSTALL_HOST   = 'github.com/ton-blockchain/acton';

export const DECISION_PRIMARY     = 'NO ADOPTION';
export const DECISION_COMPANION   = 'EXPERIMENTS ONLY';

// Sections required by Issue #143 §3 ("Scope of Work") and §8 ("AC").
export const REQUIRED_EVALUATION_SECTIONS = [
    '1. Goal',
    '2. Current Tooling Inventory',
    '3. Acton Capability Review',
    '4. Compatibility Prototype',
    '5. Workflow Comparison',
    '6. Compatibility Findings',
    '7. Adoption Decision',
    '8. Migration Cost & Risk Estimate',
    '9. Recommended Updates',
    '10. Reconsideration Triggers',
    '11. Acceptance-Criteria Mapping',
    '12. References',
];

// Existing tools that the decision says remain authoritative (cf. §7.2).
export const AUTHORITATIVE_TOOLS = [
    '@tact-lang/compiler',
    '@ton/sandbox',
    'scripts/gas-profile/',
    'scripts/deploy/deploy.ts',
    'scripts/deploy/check-immutability.ts',
];

// Issue identifiers that must each receive a recommendation in §9.
export const RECOMMENDATION_TARGETS = ['D1', 'D2', 'A3', 'B1', 'B2'];

// Production FunC files explicitly named in the "what we did not
// migrate" register in experiments/acton/README.md §4.
export const FROZEN_FUNC_FILES = [
    'contracts/payments/account-locks.fc',
    'contracts/payments/payment-hub.fc',
    'contracts/nft-resolver/nft_account_resolver.fc',
    'contracts/collateral-lookup/public-collateral-lookup.fc',
    'contracts/governance/diamond_resolver.fc',
];

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

// ==================== EVALUATION DOCUMENT CHECKS ====================

export function checkEvaluationDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'EV.exists',
            name: 'docs/tooling/ACTON_EVALUATION.md exists',
            passed: false,
            detail: 'Evaluation document is missing — AC-1 fails',
        });
        return results;
    }

    results.push({
        id: 'EV.exists',
        name: 'docs/tooling/ACTON_EVALUATION.md exists',
        passed: true,
        detail: 'Evaluation document present',
    });

    // Decision strings (AC-1).
    results.push({
        id: 'EV.decision.primary',
        name: `Primary decision "${DECISION_PRIMARY}" is recorded`,
        passed: content.includes(DECISION_PRIMARY),
        detail: 'AC-1 — explicit adoption / non-adoption decision required',
    });
    results.push({
        id: 'EV.decision.companion',
        name: `Companion posture "${DECISION_COMPANION}" is recorded`,
        passed: content.includes(DECISION_COMPANION),
        detail: 'AC-1 — companion posture justifies experiments/acton/ existence',
    });

    // Pinned Acton version (AC-3).
    results.push({
        id: 'EV.acton.version',
        name: `Pinned Acton release ${ACTON_PINNED_VERSION} is referenced`,
        passed: content.includes(ACTON_PINNED_VERSION),
        detail: 'AC-3 — capability matrix must pin a release',
    });
    results.push({
        id: 'EV.acton.releaseDate',
        name: `Release date ${ACTON_RELEASE_DATE} is referenced`,
        passed: content.includes(ACTON_RELEASE_DATE),
        detail: 'AC-3 — pinned release must include release date for re-evaluation diff',
    });
    results.push({
        id: 'EV.acton.config',
        name: `Acton config file "${ACTON_CONFIG_FILE}" is referenced`,
        passed: content.includes(ACTON_CONFIG_FILE),
        detail: 'AC-3 — toolchain artefact must be named',
    });
    results.push({
        id: 'EV.acton.installHost',
        name: `Install host "${ACTON_INSTALL_HOST}" is referenced`,
        passed: content.includes(ACTON_INSTALL_HOST),
        detail: 'AC-3 — install command source must be named',
    });

    // Required sections (AC-1..AC-7 evidence map).
    for (const section of REQUIRED_EVALUATION_SECTIONS) {
        results.push({
            id: `EV.section.${slug(section)}`,
            name: `Section "${section}" present`,
            passed: content.includes(section),
            detail: 'Evaluation structure required by Issue #143 §3 / §8',
        });
    }

    // Authoritative-tools list (AC-6 — recommendation precondition).
    for (const tool of AUTHORITATIVE_TOOLS) {
        results.push({
            id: `EV.authoritative.${slug(tool)}`,
            name: `Authoritative tool "${tool}" listed as not-replaced`,
            passed: content.includes(tool),
            detail: 'AC-6 — recommendations must cite the tools they preserve',
        });
    }

    // §9 recommendations for D1/D2/A3/B1/B2 (AC-6).
    for (const target of RECOMMENDATION_TARGETS) {
        const re = new RegExp(`\\*\\*${target}[^A-Z]`);
        results.push({
            id: `EV.recommendation.${target}`,
            name: `§9 recommendation for ${target} present`,
            passed: re.test(content),
            detail: `AC-6 — recommended update for ${target} required`,
        });
    }

    // §8 cost-estimate ranges (AC-5).
    results.push({
        id: 'EV.cost.partialMigration',
        name: '§8.1 partial-migration cost (20–35 dev-days) recorded',
        passed: /20\D?35\s*dev-days/.test(content),
        detail: 'AC-5 — partial-migration cost range required',
    });
    results.push({
        id: 'EV.cost.fullMigration',
        name: '§8.2 full Tact→Tolk migration cost (3–4 months) recorded',
        passed: /3\D?4\s*months/.test(content),
        detail: 'AC-5 — full-migration cost range required',
    });
    results.push({
        id: 'EV.risk.register',
        name: '§8.3 risk register present with at least 5 rows',
        passed: countTableRows(content, '## 8. Migration Cost & Risk Estimate', '## 9. ') >= 5,
        detail: 'AC-5 — risk register must enumerate the migration risks',
    });

    // §10 reconsideration triggers — Issue #143 lists four conditions.
    results.push({
        id: 'EV.triggers.count',
        name: '§10 records exactly 4 reconsideration triggers',
        passed: countNumberedItemsInSection(content, '## 10. Reconsideration Triggers', '## 11.') === 4,
        detail: 'AC-1 — primary decision must specify when it is reviewed',
    });

    // §11 AC mapping table (AC-1).
    for (const ac of ACCEPTANCE_CRITERIA) {
        results.push({
            id: `EV.acmap.${ac.id}`,
            name: `§11 maps ${ac.id}`,
            passed: new RegExp(`\\|\\s*${ac.id}\\s*[—-]`).test(content),
            detail: 'AC-1 — every acceptance criterion must be mapped to evidence',
        });
    }

    // AC-7 ("no existing contract semantics or CI checks changed") — the
    // evaluation must explicitly state which directories this PR touches.
    results.push({
        id: 'EV.ac7.scope',
        name: '§11 AC-7 row enumerates the directories touched by this PR',
        passed: /AC-7[^\n]*docs\/[^\n]*experiments\//.test(content) ||
                /this PR touches only `docs\//.test(content),
        detail: 'AC-7 — must explicitly disclaim contract/ CI / deploy changes',
    });

    return results;
}

// ==================== EXPERIMENT README CHECKS ====================

export function checkExperimentReadme(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'EXP.exists',
            name: 'experiments/acton/README.md exists',
            passed: false,
            detail: 'AC-4 — experiments/acton/ prototype is missing',
        });
        return results;
    }

    results.push({
        id: 'EXP.exists',
        name: 'experiments/acton/README.md exists',
        passed: true,
        detail: 'Experiment README present',
    });

    // Pinned version + install host (AC-4).
    results.push({
        id: 'EXP.pinnedVersion',
        name: `Pinned Acton release ${ACTON_PINNED_VERSION} is referenced`,
        passed: content.includes(ACTON_PINNED_VERSION),
        detail: 'AC-4 — pinned version required for reproducibility',
    });
    results.push({
        id: 'EXP.installHost',
        name: `Install host "${ACTON_INSTALL_HOST}" is referenced`,
        passed: content.includes(ACTON_INSTALL_HOST),
        detail: 'AC-4 — install command source must be named',
    });
    results.push({
        id: 'EXP.installCurl',
        name: 'curl-based install command present (operator-driven)',
        passed: /curl\s+-LsSf/.test(content),
        detail: 'AC-4 — exact local install command required',
    });
    results.push({
        id: 'EXP.dockerDigest',
        name: 'Docker digest placeholder present',
        passed: /<DIGEST>/.test(content) || /sha256:/.test(content),
        detail: 'AC-4 — Docker install must require a pinned digest (supply-chain risk §8.3)',
    });
    results.push({
        id: 'EXP.initCommand',
        name: '`acton init` command present',
        passed: /acton\s+init/.test(content),
        detail: 'AC-4 — Issue §3 requires running acton init in the sandbox',
    });

    // "What we did NOT migrate" register (AC-4 + AC-7).
    for (const file of FROZEN_FUNC_FILES) {
        results.push({
            id: `EXP.notMigrated.${slug(file)}`,
            name: `Not-migrated register mentions ${file}`,
            passed: content.includes(file),
            detail: 'AC-7 — register required so freeze-window violations are visible',
        });
    }

    // Audit-scope freeze citation (AC-7).
    results.push({
        id: 'EXP.freezeCitation',
        name: 'docs/audit-scope.md §G.5 freeze rule is cited',
        passed: /audit-scope\.md.*G\.5/.test(content) || /§G\.5/.test(content),
        detail: 'AC-7 — register must cite the freeze rule that prevents migration',
    });

    // Cross-link to the evaluation doc.
    results.push({
        id: 'EXP.linkEvaluation',
        name: 'README cross-links docs/tooling/ACTON_EVALUATION.md',
        passed: /docs\/tooling\/ACTON_EVALUATION\.md/.test(content),
        detail: 'AC-4 — companion artefacts must link back to the decision doc',
    });

    // Cross-link to the toy Tolk harness.
    results.push({
        id: 'EXP.linkHarness',
        name: 'README cross-links the toy Tolk harness',
        passed: /tolk-harness\/account-locks-toy\.tolk/.test(content),
        detail: 'AC-4 — prototype must reference its sample source',
    });

    return results;
}

// ==================== TOLK HARNESS CHECKS ====================

export function checkTolkHarness(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];

    if (content == null) {
        results.push({
            id: 'TH.exists',
            name: 'experiments/acton/tolk-harness/account-locks-toy.tolk exists',
            passed: false,
            detail: 'AC-4 — illustrative Tolk source required',
        });
        return results;
    }

    results.push({
        id: 'TH.exists',
        name: 'experiments/acton/tolk-harness/account-locks-toy.tolk exists',
        passed: true,
        detail: 'Toy Tolk harness present',
    });

    // Lock-flag constants parallel to account-locks.fc lines 22..25.
    for (const flag of ['LOCK_NONE', 'FRAUD_LOCK', 'COLLATERAL_LOCK', 'READ_ONLY']) {
        results.push({
            id: `TH.const.${flag}`,
            name: `Constant ${flag} declared`,
            passed: new RegExp(`const\\s+${flag}\\b`).test(content),
            detail: 'AC-4 — lock-type bit flags must mirror the FunC source',
        });
    }

    // I6 invariant ("Lock ≠ Confiscation") must be modelled by an
    // unconditional can_receive() in the toy harness.
    results.push({
        id: 'TH.invariant.I6.can_receive',
        name: 'INVARIANT I6: can_receive() is unconditional',
        passed: /fun\s+can_receive\s*\(\s*\)\s*:\s*int\s*{[\s\S]*?return\s+1\s*;\s*}/.test(content),
        detail: 'AC-4 — toy harness must model I6 ("locks restrict sending only")',
    });

    // Explicit invariant comment so reviewers can grep for it.
    results.push({
        id: 'TH.invariant.I6.comment',
        name: 'INVARIANT I6 is named in a comment',
        passed: /INVARIANT\s+I6/.test(content),
        detail: 'AC-4 — invariant cross-reference helps reviewers',
    });
    results.push({
        id: 'TH.invariant.I3.comment',
        name: 'INVARIANT I3 is named in a comment',
        passed: /INVARIANT\s+I3/.test(content),
        detail: 'AC-4 — invariant cross-reference helps reviewers',
    });

    // Illustrative status disclaimer — the harness MUST NOT be deployed.
    results.push({
        id: 'TH.illustrativeOnly',
        name: 'Harness header marks the file as illustrative / not deployable',
        passed: /ILLUSTRATIVE\s+ONLY/.test(content) && /MUST NOT be deployed/.test(content),
        detail: 'AC-7 — non-production status must be explicit',
    });

    return results;
}

// ==================== CROSS-DOC CHECKS ====================

export function checkCrossDocReferences(): CheckResult[] {
    const results: CheckResult[] = [];

    const docsIndex = readSafe(PATHS.docsIndex);
    if (docsIndex != null) {
        results.push({
            id: 'XR.index.tooling',
            name: 'docs/INDEX.md surfaces docs/tooling/ACTON_EVALUATION.md',
            passed: /tooling\/ACTON_EVALUATION\.md/.test(docsIndex) ||
                    /docs\/tooling\/ACTON_EVALUATION\.md/.test(docsIndex),
            detail: 'INDEX wiring required so the evaluation is discoverable',
        });
    } else {
        results.push({
            id: 'XR.index.exists',
            name: 'docs/INDEX.md exists',
            passed: false,
            detail: 'Documentation index is required for cross-doc surfacing',
        });
    }

    const auditScope = readSafe(PATHS.auditScope);
    if (auditScope != null) {
        results.push({
            id: 'XR.auditScope.tooling',
            name: 'docs/audit-scope.md references docs/tooling/ACTON_EVALUATION.md',
            passed: /docs\/tooling\/ACTON_EVALUATION\.md/.test(auditScope) ||
                    /ACTON_EVALUATION\.md/.test(auditScope),
            detail: 'AC-7 — audit scope must acknowledge the D6 decision',
        });
    } else {
        results.push({
            id: 'XR.auditScope.exists',
            name: 'docs/audit-scope.md exists',
            passed: false,
            detail: 'Audit-scope document is required for D6 cross-link',
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
    const results = [
        ...checkEvaluationDoc(readSafe(PATHS.evaluation)),
        ...checkExperimentReadme(readSafe(PATHS.experimentReadme)),
        ...checkTolkHarness(readSafe(PATHS.tolkHarness)),
        ...checkCrossDocReferences(),
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

// ==================== HELPERS ====================

function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function countTableRows(content: string, sectionHeader: string, endHeader: string): number {
    const start = content.indexOf(sectionHeader);
    if (start < 0) return 0;
    const end = content.indexOf(endHeader, start);
    const slice = end < 0 ? content.slice(start) : content.slice(start, end);
    const lines = slice.split('\n').filter((l) => l.trim().startsWith('|') && !/\|\s*-+/.test(l));
    return Math.max(0, lines.length - 1); // exclude header row
}

function countNumberedItemsInSection(content: string, sectionHeader: string, endHeader: string): number {
    const start = content.indexOf(sectionHeader);
    if (start < 0) return 0;
    const end = content.indexOf(endHeader, start);
    const slice = end < 0 ? content.slice(start) : content.slice(start, end);
    const matches = slice.match(/^\d+\.\s+\*\*/gm);
    return matches ? matches.length : 0;
}

// ==================== CLI ====================

function cli(argv: string[]): number {
    const args = argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(
            'Usage: ts-node scripts/tooling/check-acton-evaluation.ts [--classify AC-x] [--strict]\n',
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
