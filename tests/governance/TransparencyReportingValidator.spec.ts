/**
 * Unit tests for scripts/governance/check-transparency-reporting.ts (Issue #135, E4).
 *
 * The validator is the off-chain CI gate that enforces structural drift checks
 * between the seven E4 transparency artifacts:
 *   - docs/governance/TRANSPARENCY_REPORTING.md            (spec)
 *   - docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md      (quarterly template)
 *   - docs/governance/transparency-reports/Q1-FY2026.md    (first dry-run)
 *   - contracts/governance/TransparencyRegistry.tact       (§2.4 aggregate handlers)
 *   - backend/indexer/src/services/indexer-service.ts      (event subscription)
 *   - backend/indexer/src/api/routes.ts                    (public API route)
 *   - dashboard/src/components/TransparencyDashboard.ts    (read-only widget)
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
    checkSpecDoc,
    checkTemplate,
    checkFirstReport,
    checkRegistryHandlers,
    checkIndexerService,
    checkIndexerApi,
    checkDashboard,
    runAllChecks,
} from '../../scripts/governance/check-transparency-reporting';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #135 §8)', () => {
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
            'prerequisite',
            'transparency-registry',
            'indexer-service',
            'indexer-api',
            'dashboard',
            'template',
            'first-report',
        ]);
        for (const c of ACCEPTANCE_CRITERIA) {
            expect(allowed.has(c.evidenceCheck)).toBe(true);
        }
    });

    it('routes AC-2 to the transparency-registry evidence path', () => {
        const ac2 = classifyAcceptanceCriterion('AC-2');
        expect(ac2?.evidenceCheck).toBe('transparency-registry');
    });

    it('routes AC-4 to the indexer-api evidence path', () => {
        const ac4 = classifyAcceptanceCriterion('AC-4');
        expect(ac4?.evidenceCheck).toBe('indexer-api');
    });

    it('routes AC-5 to the dashboard evidence path', () => {
        const ac5 = classifyAcceptanceCriterion('AC-5');
        expect(ac5?.evidenceCheck).toBe('dashboard');
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== checkSpecDoc ====================

describe('checkSpecDoc', () => {
    const realDoc = readRepoFile('docs/governance/TRANSPARENCY_REPORTING.md');

    it('passes every check against the committed TRANSPARENCY_REPORTING.md', () => {
        const results = checkSpecDoc(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSpecDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TR.doc');
    });

    it('flags removal of the §2.4 additive-handlers heading', () => {
        const tampered = realDoc.replace(
            /### 2\.4 Aggregates anchored on `TransparencyRegistry` — additive[^\n]*/,
            '### 2.4 (removed)',
        );
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.sec.2_4');
    });

    it('flags removal of the §3.3 indexer-alarms heading', () => {
        const tampered = realDoc.replace(
            /### 3\.3 Indexer alarms \(E4 additions\)/,
            '### 3.3 (removed)',
        );
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.sec.3_3');
    });

    it.each([
        'receive(RecordProtocolMetrics)',
        'receive(RecordLockActivity)',
        'receive(RecordParameterChange)',
    ])('flags removal of §2.4 handler %s', (handler) => {
        const tampered = realDoc.split(handler).join('receive(_removed_)');
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain(`TR.handler.${handler}`);
    });

    it.each([
        'e4.aggregate-drift',
        'e4.lock-aggregate-drift',
        'e4.parameter-change-undisclosed',
        'e4.indexer-stale',
        'e4.api-endpoint-unreachable',
    ])('flags removal of §3.3 alarm %s', (alarm) => {
        const tampered = realDoc.split(alarm).join('e4.removed');
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain(`TR.alarm.${alarm}`);
    });

    it('flags drift of the public endpoint path (§4.1)', () => {
        const tampered = realDoc.replace(
            /GET \/v1\/transparency\/metrics/g,
            'GET /v1/transparency/private',
        );
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.api.path');
    });

    it('flags the §4.1 "no authentication" guarantee being weakened', () => {
        const tampered = realDoc.replace(
            /Authentication: none \(public\)/g,
            'Authentication: bearer token',
        );
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.api.noauth');
    });

    it('flags drift of the Cache-Control: public, max-age=60 contract', () => {
        const tampered = realDoc.replace(
            /Cache-Control: public, max-age=60/g,
            'Cache-Control: private, no-store',
        );
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.api.cache');
    });

    it('flags weakening of the ≥10-account cohort guarantee (NFR-1)', () => {
        const tampered = realDoc
            .replace(/≥\s*\*\*10\*\*\s*distinct accounts/g, '')
            .replace(/at least 10 distinct accounts/gi, 'at least 1 distinct account');
        const results = checkSpecDoc(tampered);
        expect(failures(results)).toContain('TR.privacy.cohort');
    });

    it.each(['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7'])(
        'flags removal of the acceptance-criterion mapping row %s',
        (code) => {
            const tampered = realDoc.replace(new RegExp(`\\| ${code} \\|`, 'g'), '| AC-X |');
            const results = checkSpecDoc(tampered);
            expect(failures(results)).toContain(`TR.map.${code}`);
        },
    );
});

// ==================== checkTemplate ====================

describe('checkTemplate', () => {
    const realDoc = readRepoFile('docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md');

    it('passes every check against the committed TRANSPARENCY_REPORT_TEMPLATE.md', () => {
        const results = checkTemplate(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkTemplate(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('TPL.doc');
    });

    it('flags removal of the §8 attestation heading', () => {
        const tampered = realDoc.replace(/## 8\. Independence attestation/g, '## 8. (removed)');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.sec.8');
    });

    it('flags removal of Appendix A — Raw API response', () => {
        const tampered = realDoc.replace(/## Appendix A — Raw API response/g, '## Appendix A — (removed)');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.sec.A');
    });

    it('flags removal of the "observation, not control" disclaimer wording', () => {
        const tampered = realDoc.replace(/observation, not control/g, 'control, not observation');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.disclaimer.observation');
    });

    it('flags removal of the "single source of truth" disclaimer wording', () => {
        const tampered = realDoc.replace(/single source of truth/gi, 'one source of guidance');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.disclaimer.source-of-truth');
    });

    it('flags removal of the two-signer attestation requirement', () => {
        const tampered = realDoc.replace(/Counter-signer/g, 'Sole signer');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.signers.two');
    });

    it('flags Appendix A losing its raw-JSON fenced block', () => {
        const tampered = realDoc.replace(/```json/g, '```text');
        const results = checkTemplate(tampered);
        expect(failures(results)).toContain('TPL.appendixA.raw');
    });
});

// ==================== checkFirstReport ====================

describe('checkFirstReport', () => {
    const realDoc = readRepoFile('docs/governance/transparency-reports/Q1-FY2026.md');

    it('passes every check against the committed Q1-FY2026.md', () => {
        const results = checkFirstReport(realDoc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkFirstReport(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('RPT.doc');
    });

    it('flags removal of the DRY-RUN banner', () => {
        const tampered = realDoc.replace(/DRY-RUN BANNER/g, 'AUTHORITATIVE');
        const results = checkFirstReport(tampered);
        expect(failures(results)).toContain('RPT.dryrun.banner');
    });

    it('flags removal of the §2 snapshot_block anchor', () => {
        const tampered = realDoc.replace(/`snapshot_block`/g, '`block_value`');
        const results = checkFirstReport(tampered);
        expect(failures(results)).toContain('RPT.anchor.block');
    });

    it('flags removal of the §2 snapshot_hash anchor', () => {
        const tampered = realDoc.replace(/`snapshot_hash`/g, '`block_digest`');
        const results = checkFirstReport(tampered);
        expect(failures(results)).toContain('RPT.anchor.hash');
    });

    it('flags Appendix A losing its raw-JSON fenced block', () => {
        const tampered = realDoc.replace(/```json/g, '```text');
        const results = checkFirstReport(tampered);
        expect(failures(results)).toContain('RPT.appendixA.json');
    });
});

// ==================== checkRegistryHandlers ====================

describe('checkRegistryHandlers', () => {
    const realContract = readRepoFile('contracts/governance/TransparencyRegistry.tact');

    it('passes every check against the committed TransparencyRegistry.tact', () => {
        const results = checkRegistryHandlers(realContract);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing contract', () => {
        const results = checkRegistryHandlers(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('REG.tact');
    });

    it.each([
        { id: 'protocol-metrics',  needle: 'receive(msg: RecordProtocolMetrics)' },
        { id: 'lock-activity',     needle: 'receive(msg: RecordLockActivity)' },
        { id: 'parameter-change',  needle: 'receive(msg: RecordParameterChange)' },
    ])('flags removal of the $id receive handler', ({ id, needle }) => {
        const tampered = realContract.split(needle).join('receive(msg: Removed)');
        const results = checkRegistryHandlers(tampered);
        expect(failures(results)).toContain(`REG.handler.${id}.receive`);
    });

    it.each([
        { id: 'protocol-metrics',  needle: 'emit(ProtocolMetricsRecorded{' },
        { id: 'lock-activity',     needle: 'emit(LockActivityRecorded{' },
        { id: 'parameter-change',  needle: 'emit(ParameterChangeRecorded{' },
    ])('flags removal of the $id event emit', ({ id, needle }) => {
        const tampered = realContract.split(needle).join('emit(Nothing{');
        const results = checkRegistryHandlers(tampered);
        expect(failures(results)).toContain(`REG.handler.${id}.emit`);
    });

    it.each([
        'RecordProtocolMetrics',
        'RecordLockActivity',
        'RecordParameterChange',
    ])('flags removal of the message declaration %s', (msg) => {
        const tampered = realContract.replace(new RegExp(`message ${msg}\\s*\\{`), 'message Removed {');
        const results = checkRegistryHandlers(tampered);
        expect(failures(results)).toContain(`REG.msg.${msg}`);
    });
});

// ==================== checkIndexerService ====================

describe('checkIndexerService', () => {
    const realSvc = readRepoFile('backend/indexer/src/services/indexer-service.ts');

    it('passes every check against the committed indexer-service.ts', () => {
        const results = checkIndexerService(realSvc);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing service file', () => {
        const results = checkIndexerService(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('IDX.svc');
    });

    it.each([
        { id: 'protocol-metrics', needle: 'insertTransparencyProtocolMetrics' },
        { id: 'lock-activity',    needle: 'insertTransparencyLockActivity' },
        { id: 'parameter-change', needle: 'insertTransparencyParameterChange' },
    ])('flags removal of the $id DB writer call', ({ id, needle }) => {
        const tampered = realSvc.split(needle).join('insertRemoved');
        const results = checkIndexerService(tampered);
        expect(failures(results)).toContain(`IDX.svc.${id}`);
    });

    it('flags the subscription losing config.contracts.transparencyRegistry as target', () => {
        const tampered = realSvc.replace(/this\.config\.contracts\.transparencyRegistry/g, 'this.config.contracts.other');
        const results = checkIndexerService(tampered);
        expect(failures(results)).toContain('IDX.svc.registry');
    });
});

// ==================== checkIndexerApi ====================

describe('checkIndexerApi', () => {
    const realRoutes = readRepoFile('backend/indexer/src/api/routes.ts');

    it('passes every check against the committed routes.ts', () => {
        const results = checkIndexerApi(realRoutes);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing routes file', () => {
        const results = checkIndexerApi(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('API.routes');
    });

    it('flags drift of the /transparency/metrics path', () => {
        const tampered = realRoutes
            .replace(/'\/transparency\/metrics'/g, "'/transparency/private'")
            .replace(/"\/transparency\/metrics"/g, '"/transparency/private"');
        const results = checkIndexerApi(tampered);
        expect(failures(results)).toContain('API.routes.path');
    });

    it('flags drift of the Cache-Control: public, max-age=60 header', () => {
        const tampered = realRoutes.replace(/public, max-age=60/g, 'private, no-store');
        const results = checkIndexerApi(tampered);
        expect(failures(results)).toContain('API.routes.cache');
    });

    it('flags removal of the TransparencyMetricsResponse type reference', () => {
        const tampered = realRoutes.replace(/TransparencyMetricsResponse/g, 'AdHocResponse');
        const results = checkIndexerApi(tampered);
        expect(failures(results)).toContain('API.routes.type');
    });
});

// ==================== checkDashboard ====================

describe('checkDashboard', () => {
    const realComponent = readRepoFile('dashboard/src/components/TransparencyDashboard.ts');

    it('passes every check against the committed TransparencyDashboard.ts', () => {
        const results = checkDashboard(realComponent);
        expect(failures(results)).toEqual([]);
    });

    it('flags a missing component file', () => {
        const results = checkDashboard(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('DSH.doc');
    });

    it('flags renaming the exported class', () => {
        const tampered = realComponent.replace(
            /export\s+class\s+TonbankcardTransparencyDashboard/,
            'export class RenamedDashboard',
        );
        const results = checkDashboard(tampered);
        expect(failures(results)).toContain('DSH.class');
    });

    it.each(['mount', 'unmount', 'setSnapshot', 'getSnapshot'])(
        'flags removal of the %s() lifecycle method',
        (method) => {
            const tampered = realComponent.replace(
                new RegExp(`\\b${method}\\s*\\(`, 'g'),
                '__removed__(',
            );
            const results = checkDashboard(tampered);
            expect(failures(results)).toContain(`DSH.method.${method}`);
        },
    );

    it('flags introduction of a write-path fetch (POST/PUT/PATCH/DELETE)', () => {
        // Append a synthetic POST request to verify the read-only guard fires.
        const tampered =
            realComponent + "\n// drift\nfetch('/x', { method: 'POST' });\n";
        const results = checkDashboard(tampered);
        expect(failures(results)).toContain('DSH.readonly.no-fetch-mutation');
    });
});

// ==================== runAllChecks integration ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed E4 artifacts', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Surface the failing checks so CI logs are immediately diagnostic.
            // eslint-disable-next-line no-console
            console.error(
                'Transparency Reporting validator failures:\n' +
                    report.failures.map((f) => `  ✗ ${f.id} — ${f.name} (${f.detail})`).join('\n'),
            );
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });
});
