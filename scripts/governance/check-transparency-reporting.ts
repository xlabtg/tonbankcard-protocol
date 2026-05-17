/**
 * Transparency Reporting Validator (Issue #135, E4)
 *
 * Purpose: Validate that the E4 transparency artifacts —
 *   docs/governance/TRANSPARENCY_REPORTING.md (spec),
 *   docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md (quarterly template),
 *   docs/governance/transparency-reports/Q1-FY2026.md (first dry-run),
 *   contracts/governance/TransparencyRegistry.tact (§2.4 aggregate handlers),
 *   backend/indexer/src/services/indexer-service.ts (event subscription),
 *   backend/indexer/src/api/routes.ts (GET /transparency/metrics),
 *   dashboard/src/components/TransparencyDashboard.ts (read-only public widget)
 *   — remain consistent with each other and with the engagement's acceptance
 *   criteria.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / TypeScript / Tact sources from the repository working tree.
 *
 * Usage:
 *   npx ts-node scripts/governance/check-transparency-reporting.ts
 *   npx ts-node scripts/governance/check-transparency-reporting.ts --classify AC-4
 *   npx ts-node scripts/governance/check-transparency-reporting.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #135 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and the
// linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'prerequisite'
        | 'transparency-registry'
        | 'indexer-service'
        | 'indexer-api'
        | 'dashboard'
        | 'template'
        | 'first-report';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'E1 (DAO governance) + E3 (Risk Authority) complete (prerequisite)', artifact: 'docs/governance/E1-activation/ENGAGEMENT.md + docs/governance/RISK_AUTHORITY.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'TransparencyRegistry used to log all required event types',        artifact: 'contracts/governance/TransparencyRegistry.tact §§ RecordProtocolMetrics/RecordLockActivity/RecordParameterChange', evidenceCheck: 'transparency-registry' },
    { id: 'AC-3', description: 'Indexer extended to read and store transparency events',           artifact: 'backend/indexer/src/services/indexer-service.ts + src/parsers/event-parser.ts + src/db/database.ts', evidenceCheck: 'indexer-service' },
    { id: 'AC-4', description: 'Public transparency API endpoint implemented',                    artifact: 'backend/indexer/src/api/routes.ts GET /transparency/metrics',                      evidenceCheck: 'indexer-api' },
    { id: 'AC-5', description: 'Transparency dashboard deployed and accessible',                  artifact: 'dashboard/src/components/TransparencyDashboard.ts',                                 evidenceCheck: 'dashboard' },
    { id: 'AC-6', description: 'docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md created',         artifact: 'docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md',                                   evidenceCheck: 'template' },
    { id: 'AC-7', description: 'First quarterly transparency report published',                   artifact: 'docs/governance/transparency-reports/Q1-FY2026.md',                                 evidenceCheck: 'first-report' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    spec:       resolve(REPO_ROOT, 'docs/governance/TRANSPARENCY_REPORTING.md'),
    template:   resolve(REPO_ROOT, 'docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md'),
    firstReport: resolve(REPO_ROOT, 'docs/governance/transparency-reports/Q1-FY2026.md'),
    registry:   resolve(REPO_ROOT, 'contracts/governance/TransparencyRegistry.tact'),
    indexerService: resolve(REPO_ROOT, 'backend/indexer/src/services/indexer-service.ts'),
    indexerRoutes:  resolve(REPO_ROOT, 'backend/indexer/src/api/routes.ts'),
    dashboard:  resolve(REPO_ROOT, 'dashboard/src/components/TransparencyDashboard.ts'),
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

// ==================== DOCUMENT CHECKS ====================

export function checkSpecDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'TR.doc', name: 'TRANSPARENCY_REPORTING.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'TR.doc', name: 'TRANSPARENCY_REPORTING.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp; reason: string }[] = [
        { id: 'TR.sec.1', pattern: /## 1\. Purpose & scope/,                              reason: 'Engagement scope' },
        { id: 'TR.sec.2', pattern: /## 2\. Standardized on-chain event format/,           reason: 'AC-2 event vocabulary' },
        { id: 'TR.sec.2_4', pattern: /### 2\.4 Aggregates anchored on `TransparencyRegistry` — additive/, reason: 'AC-2 additive E4 handlers' },
        { id: 'TR.sec.3', pattern: /## 3\. Indexer integration/,                          reason: 'AC-3 indexer pipeline' },
        { id: 'TR.sec.3_3', pattern: /### 3\.3 Indexer alarms \(E4 additions\)/,          reason: 'Drift / staleness alarms' },
        { id: 'TR.sec.4', pattern: /## 4\. Public transparency API/,                      reason: 'AC-4 endpoint contract' },
        { id: 'TR.sec.5', pattern: /## 5\. Public transparency dashboard/,                reason: 'AC-5 dashboard contract' },
        { id: 'TR.sec.6', pattern: /## 6\. Quarterly transparency reports/,               reason: 'AC-6 / AC-7 cadence' },
        { id: 'TR.sec.7', pattern: /## 7\. Privacy guarantees \(forbidden data\)/,        reason: 'NFR-1 / aggregate-only' },
        { id: 'TR.sec.8', pattern: /## 8\. Acceptance criteria mapping/,                  reason: 'Engagement traceability' },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `TRANSPARENCY_REPORTING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: sec.reason,
        });
    }

    // §2.4 enumerates exactly three additive handlers (Issue #135 §3)
    for (const handler of [
        'receive(RecordProtocolMetrics)',
        'receive(RecordLockActivity)',
        'receive(RecordParameterChange)',
    ]) {
        const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        results.push({
            id: `TR.handler.${handler}`,
            name: `TRANSPARENCY_REPORTING.md §2.4 names ${handler}`,
            passed: new RegExp(escaped).test(content),
            detail: 'Additive aggregate handler — AC-2',
        });
    }

    // §3.3 alarm catalogue — five E4 alarms documented in the spec
    for (const alarm of [
        'e4.aggregate-drift',
        'e4.lock-aggregate-drift',
        'e4.parameter-change-undisclosed',
        'e4.indexer-stale',
        'e4.api-endpoint-unreachable',
    ]) {
        results.push({
            id: `TR.alarm.${alarm}`,
            name: `TRANSPARENCY_REPORTING.md §3.3 lists ${alarm}`,
            passed: new RegExp(`\`${alarm.replace(/\./g, '\\.')}\``).test(content),
            detail: 'Indexer drift / staleness alarms',
        });
    }

    // §4.1 endpoint contract — path, no-auth and Cache-Control
    results.push({
        id: 'TR.api.path',
        name: 'TRANSPARENCY_REPORTING.md §4 declares GET /v1/transparency/metrics',
        passed: /GET \/v1\/transparency\/metrics/.test(content),
        detail: 'AC-4 endpoint contract',
    });
    results.push({
        id: 'TR.api.noauth',
        name: 'TRANSPARENCY_REPORTING.md §4 declares no authentication',
        passed: /Authentication: none \(public\)/.test(content),
        detail: 'NFR-3 — dashboard readable without login',
    });
    results.push({
        id: 'TR.api.cache',
        name: 'TRANSPARENCY_REPORTING.md §4 declares Cache-Control: public, max-age=60',
        passed: /Cache-Control: public, max-age=60/.test(content),
        detail: '§4.2 determinism + CDN fan-out',
    });

    // §7 privacy — 10-account cohort minimum (NFR-1)
    results.push({
        id: 'TR.privacy.cohort',
        name: 'TRANSPARENCY_REPORTING.md §7 enforces ≥10 distinct accounts cohort',
        passed: /≥\s*\*\*10\*\*\s*distinct accounts/.test(content) || /at least 10 distinct accounts/i.test(content),
        detail: 'NFR-1 aggregate-only',
    });

    // AC mapping — at least one row per AC-1…AC-7
    for (const code of ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7']) {
        results.push({
            id: `TR.map.${code}`,
            name: `TRANSPARENCY_REPORTING.md maps ${code}`,
            passed: new RegExp(`\\| ${code} \\|`).test(content),
            detail: 'Engagement traceability §8',
        });
    }

    return results;
}

export function checkTemplate(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'TPL.doc', name: 'TRANSPARENCY_REPORT_TEMPLATE.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'TPL.doc', name: 'TRANSPARENCY_REPORT_TEMPLATE.md present', passed: true, detail: 'found' });

    // The 10 numbered sections fixed by spec §6.2 — order matters for diffability.
    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'TPL.sec.1',  pattern: /## 1\. Reporting period/ },
        { id: 'TPL.sec.2',  pattern: /## 2\. Source data anchor/ },
        { id: 'TPL.sec.3',  pattern: /## 3\. Protocol health metrics/ },
        { id: 'TPL.sec.4',  pattern: /## 4\. Lock activity/ },
        { id: 'TPL.sec.5',  pattern: /## 5\. Governance activity/ },
        { id: 'TPL.sec.6',  pattern: /## 6\. Parameter changes/ },
        { id: 'TPL.sec.7',  pattern: /## 7\. Indexer alarms/ },
        { id: 'TPL.sec.8',  pattern: /## 8\. Independence attestation/ },
        { id: 'TPL.sec.9',  pattern: /## 9\. Disclaimer/ },
        { id: 'TPL.sec.A',  pattern: /## Appendix A — Raw API response/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `TRANSPARENCY_REPORT_TEMPLATE.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Section order frozen by spec §6.2',
        });
    }

    // §9 carries the canonical disclaimer (must match the spec §1 wording).
    results.push({
        id: 'TPL.disclaimer.observation',
        name: 'TRANSPARENCY_REPORT_TEMPLATE.md §9 includes "observation, not control"',
        passed: /observation, not control/.test(content),
        detail: 'Disclaimer reproduced verbatim from spec §1',
    });
    results.push({
        id: 'TPL.disclaimer.source-of-truth',
        name: 'TRANSPARENCY_REPORT_TEMPLATE.md §9 names the blockchain as single source of truth',
        passed: /single source of truth/i.test(content),
        detail: 'Non-authoritative reminder',
    });

    // Two-signer attestation discipline (spec §6.4).
    results.push({
        id: 'TPL.signers.two',
        name: 'TRANSPARENCY_REPORT_TEMPLATE.md §8 requires author AND counter-signer',
        passed: /Author/.test(content) && /Counter-signer/.test(content),
        detail: 'Risk Authority quarterly attestation rendezvous',
    });

    // Reproducibility — Appendix A captures the raw API response.
    results.push({
        id: 'TPL.appendixA.raw',
        name: 'TRANSPARENCY_REPORT_TEMPLATE.md Appendix A captures the raw JSON',
        passed: /Raw API response/.test(content) && /```json/.test(content),
        detail: 'Spec §6.3 reproducibility requirement',
    });

    return results;
}

export function checkFirstReport(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'RPT.doc', name: 'transparency-reports/Q1-FY2026.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'RPT.doc', name: 'transparency-reports/Q1-FY2026.md present', passed: true, detail: 'found' });

    // Inherits the 10-section template order from the template.
    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'RPT.sec.1', pattern: /## 1\. Reporting period/ },
        { id: 'RPT.sec.2', pattern: /## 2\. Source data anchor/ },
        { id: 'RPT.sec.3', pattern: /## 3\. Protocol health metrics/ },
        { id: 'RPT.sec.4', pattern: /## 4\. Lock activity/ },
        { id: 'RPT.sec.5', pattern: /## 5\. Governance activity/ },
        { id: 'RPT.sec.6', pattern: /## 6\. Parameter changes/ },
        { id: 'RPT.sec.7', pattern: /## 7\. Indexer alarms/ },
        { id: 'RPT.sec.8', pattern: /## 8\. Independence attestation/ },
        { id: 'RPT.sec.9', pattern: /## 9\. Disclaimer/ },
        { id: 'RPT.sec.A', pattern: /## Appendix A — Raw API response/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `Q1-FY2026.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Inherits template section order (spec §6.2)',
        });
    }

    // Dry-run banner is the visible non-authoritative marker until mainnet regen.
    results.push({
        id: 'RPT.dryrun.banner',
        name: 'Q1-FY2026.md carries the DRY-RUN banner',
        passed: /DRY-RUN BANNER/.test(content),
        detail: 'Spec §6.1 — synthetic numbers until mainnet regeneration',
    });

    // §2 anchors a concrete snapshot_block and snapshot_hash so the report is reproducible.
    results.push({
        id: 'RPT.anchor.block',
        name: 'Q1-FY2026.md §2 quotes a concrete snapshot_block',
        passed: /`snapshot_block`/.test(content) && /\d{6,}/.test(content),
        detail: 'Spec §6.3 reproducibility',
    });
    results.push({
        id: 'RPT.anchor.hash',
        name: 'Q1-FY2026.md §2 quotes a concrete snapshot_hash',
        passed: /`snapshot_hash`/.test(content) && /0x[0-9a-fA-F]{16,}/.test(content),
        detail: 'Spec §6.3 reproducibility',
    });

    // Appendix A holds the raw JSON the dry-run numbers were generated from.
    results.push({
        id: 'RPT.appendixA.json',
        name: 'Q1-FY2026.md Appendix A holds the raw JSON',
        passed: /## Appendix A — Raw API response/.test(content) && /```json/.test(content),
        detail: 'Spec §6.3 reproducibility',
    });

    return results;
}

export function checkRegistryHandlers(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'REG.tact', name: 'TransparencyRegistry.tact present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'REG.tact', name: 'TransparencyRegistry.tact present', passed: true, detail: 'found' });

    // §2.4 lists exactly three additive receive handlers + their emitted events.
    const handlers: { id: string; receive: RegExp; emit: RegExp; reason: string }[] = [
        {
            id: 'protocol-metrics',
            receive: /receive\(msg: RecordProtocolMetrics\)/,
            emit: /emit\(ProtocolMetricsRecorded\{/,
            reason: 'Monthly aggregate snapshot of §2.2 metrics',
        },
        {
            id: 'lock-activity',
            receive: /receive\(msg: RecordLockActivity\)/,
            emit: /emit\(LockActivityRecorded\{/,
            reason: 'Monthly aggregate of §2.3 metrics',
        },
        {
            id: 'parameter-change',
            receive: /receive\(msg: RecordParameterChange\)/,
            emit: /emit\(ParameterChangeRecorded\{/,
            reason: 'Audit trail for PARAMETERS.md §§ 8–11 changes',
        },
    ];
    for (const h of handlers) {
        results.push({
            id: `REG.handler.${h.id}.receive`,
            name: `TransparencyRegistry.tact defines receive for ${h.id}`,
            passed: h.receive.test(content),
            detail: h.reason,
        });
        results.push({
            id: `REG.handler.${h.id}.emit`,
            name: `TransparencyRegistry.tact emits the matching event for ${h.id}`,
            passed: h.emit.test(content),
            detail: h.reason,
        });
    }

    // Append-only invariant — handlers must declare the corresponding message struct.
    for (const msg of ['RecordProtocolMetrics', 'RecordLockActivity', 'RecordParameterChange']) {
        results.push({
            id: `REG.msg.${msg}`,
            name: `TransparencyRegistry.tact declares message ${msg}`,
            passed: new RegExp(`message ${msg}\\s*\\{`).test(content),
            detail: 'AC-2 / off-chain schema cross-reference',
        });
    }

    return results;
}

export function checkIndexerService(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'IDX.svc', name: 'indexer-service.ts present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'IDX.svc', name: 'indexer-service.ts present', passed: true, detail: 'found' });

    // The service must subscribe each of the three §2.4 event types to a DB writer.
    const subscriptions: { id: string; needle: RegExp; reason: string }[] = [
        {
            id: 'protocol-metrics',
            needle: /case 'TransparencyProtocolMetrics':[\s\S]*?insertTransparencyProtocolMetrics/,
            reason: 'AC-3 — protocol metrics ingestion',
        },
        {
            id: 'lock-activity',
            needle: /case 'TransparencyLockActivity':[\s\S]*?insertTransparencyLockActivity/,
            reason: 'AC-3 — lock activity ingestion',
        },
        {
            id: 'parameter-change',
            needle: /case 'TransparencyParameterChange':[\s\S]*?insertTransparencyParameterChange/,
            reason: 'AC-3 — parameter-change audit ingestion',
        },
    ];
    for (const s of subscriptions) {
        results.push({
            id: `IDX.svc.${s.id}`,
            name: `indexer-service.ts ingests ${s.id}`,
            passed: s.needle.test(content),
            detail: s.reason,
        });
    }

    // Subscription target must be the configured transparency registry contract.
    results.push({
        id: 'IDX.svc.registry',
        name: 'indexer-service.ts subscribes to config.contracts.transparencyRegistry',
        passed: /this\.config\.contracts\.transparencyRegistry/.test(content),
        detail: 'AC-3 — only the TransparencyRegistry is mirrored',
    });

    return results;
}

export function checkIndexerApi(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'API.routes', name: 'routes.ts present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'API.routes', name: 'routes.ts present', passed: true, detail: 'found' });

    // Route declaration must match the spec — '/transparency/metrics' under /api/v1.
    results.push({
        id: 'API.routes.path',
        name: 'routes.ts mounts /transparency/metrics',
        passed: /['"]\/transparency\/metrics['"]/.test(content),
        detail: 'AC-4 endpoint contract',
    });

    // Cache-Control: public, max-age=60 (spec §4.1) — verified literally so a
    // future change to a stricter or absent header trips CI.
    results.push({
        id: 'API.routes.cache',
        name: 'routes.ts sets Cache-Control: public, max-age=60',
        passed: /public, max-age=60/.test(content),
        detail: 'AC-4 / §4.2 CDN fan-out',
    });

    // The response must be typed with the canonical interface (no ad-hoc shape).
    results.push({
        id: 'API.routes.type',
        name: 'routes.ts returns a TransparencyMetricsResponse',
        passed: /TransparencyMetricsResponse/.test(content),
        detail: 'Camel-case contract documented in spec §4.1',
    });

    return results;
}

export function checkDashboard(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'DSH.doc', name: 'TransparencyDashboard.ts present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'DSH.doc', name: 'TransparencyDashboard.ts present', passed: true, detail: 'found' });

    // The component must export a class with the agreed name.
    results.push({
        id: 'DSH.class',
        name: 'TransparencyDashboard.ts exports class TonbankcardTransparencyDashboard',
        passed: /export\s+class\s+TonbankcardTransparencyDashboard/.test(content),
        detail: 'AC-5 component contract',
    });

    // Lifecycle parity with the existing DashboardApp.
    for (const method of ['mount', 'unmount', 'setSnapshot', 'getSnapshot']) {
        results.push({
            id: `DSH.method.${method}`,
            name: `TransparencyDashboard.ts implements ${method}()`,
            passed: new RegExp(`\\b${method}\\s*\\(`).test(content),
            detail: 'Lifecycle parity with DashboardApp',
        });
    }

    // Read-only guarantee — dashboard must not introduce a write path.
    results.push({
        id: 'DSH.readonly.no-fetch-mutation',
        name: 'TransparencyDashboard.ts issues no POST/PUT/PATCH/DELETE',
        passed: !/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(content),
        detail: '§5.3 / NFR-3 dashboard is GET-only',
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
    const spec       = readSafe(PATHS.spec);
    const template   = readSafe(PATHS.template);
    const firstReport = readSafe(PATHS.firstReport);
    const registry   = readSafe(PATHS.registry);
    const service    = readSafe(PATHS.indexerService);
    const routes     = readSafe(PATHS.indexerRoutes);
    const dashboard  = readSafe(PATHS.dashboard);

    const results = [
        ...checkSpecDoc(spec),
        ...checkTemplate(template),
        ...checkFirstReport(firstReport),
        ...checkRegistryHandlers(registry),
        ...checkIndexerService(service),
        ...checkIndexerApi(routes),
        ...checkDashboard(dashboard),
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
            'Usage: ts-node scripts/governance/check-transparency-reporting.ts [--classify AC-x] [--strict]\n'
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
