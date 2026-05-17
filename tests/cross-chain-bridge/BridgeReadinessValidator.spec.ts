/**
 * Unit tests for scripts/bridge/check-bridge-readiness.ts (Issue #138, F3).
 *
 * The validator is the off-chain CI gate that enforces structural drift checks
 * between the seven F3 bridge artifacts and the production contract:
 *   - docs/bridge/SUPPORTED_CHAINS.md      (AC-2)
 *   - docs/bridge/VALIDATORS.md            (AC-3)
 *   - docs/bridge/REPLAY_PROTECTION.md     (AC-4)
 *   - docs/bridge/CIRCUIT_BREAKERS.md      (AC-5)
 *   - docs/bridge/MONITORING.md            (AC-6)
 *   - docs/bridge/BUG_BOUNTY.md            (AC-7)
 *   - docs/bridge/CONTRACT_HARDENING.md    (CH-1..CH-7 backlog, A2-gated)
 *   - contracts/CrossChainBridge.tact      (pre-A2 shapes, evidence anchors)
 *
 * These tests are pure TypeScript fixtures — they exercise the exported check
 * functions with both well-formed and tampered content. They do NOT require a
 * compiled contract and therefore run in any environment with ts-jest. The
 * pattern mirrors tests/governance/RiskAuthorityValidator.spec.ts (E3).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    ACCEPTANCE_CRITERIA,
    SUPPORTED_CHAINS,
    CHAIN_CONSTANTS,
    CANONICAL_HASH_FIELDS,
    PP_CCB_IDS,
    AP_RULES,
    T_RP_THREATS,
    CH_ITEMS,
    R_CH_RULES,
    CCB_THREATS,
    BR_M_IDS,
    classifyAcceptanceCriterion,
    checkSupportedChainsDoc,
    checkValidatorsDoc,
    checkReplayProtectionDoc,
    checkCircuitBreakersDoc,
    checkContractHardeningDoc,
    checkMonitoringDoc,
    checkBugBountyDoc,
    checkContractEvidence,
    checkCrossDocReferences,
    runAllChecks,
} from '../../scripts/bridge/check-bridge-readiness';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readRepoFile(rel: string): string {
    return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function failures(results: { passed: boolean; id: string }[]) {
    return results.filter((r) => !r.passed).map((r) => r.id);
}

// ==================== ACCEPTANCE_CRITERIA inventory ====================

describe('ACCEPTANCE_CRITERIA', () => {
    it('contains exactly AC-1 … AC-7 in order (Issue #138 §8)', () => {
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

    it('uses only the eight documented evidenceCheck kinds', () => {
        const allowed = new Set([
            'prerequisite',
            'supported-chains',
            'validators',
            'replay-protection',
            'circuit-breakers',
            'monitoring',
            'bug-bounty',
            'contract-hardening',
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

    it('routes AC-4 to the replay-protection evidence path', () => {
        const ac4 = classifyAcceptanceCriterion('AC-4');
        expect(ac4?.evidenceCheck).toBe('replay-protection');
    });

    it('routes AC-7 to the bug-bounty evidence path', () => {
        const ac7 = classifyAcceptanceCriterion('AC-7');
        expect(ac7?.evidenceCheck).toBe('bug-bounty');
    });

    it('returns undefined for an unknown criterion id', () => {
        expect(classifyAcceptanceCriterion('AC-99')).toBeUndefined();
    });
});

// ==================== Centralised expected constants ====================

describe('Centralised expected constants', () => {
    it('SUPPORTED_CHAINS lists the five initial chains', () => {
        expect([...SUPPORTED_CHAINS]).toEqual([
            'Ethereum', 'BSC', 'Polygon', 'Bitcoin', 'Solana',
        ]);
    });

    it('CHAIN_CONSTANTS pins the protocol-internal numeric IDs (1..5)', () => {
        expect(CHAIN_CONSTANTS.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
        const byName = Object.fromEntries(CHAIN_CONSTANTS.map((c) => [c.name, c.id]));
        expect(byName.CHAIN_ETHEREUM).toBe(1);
        expect(byName.CHAIN_BITCOIN).toBe(2);
        expect(byName.CHAIN_BSC).toBe(3);
        expect(byName.CHAIN_POLYGON).toBe(4);
        expect(byName.CHAIN_SOLANA).toBe(5);
    });

    it('CANONICAL_HASH_FIELDS has the seven-field shape', () => {
        expect([...CANONICAL_HASH_FIELDS]).toEqual([
            'target_chain',
            'intent_id',
            'amount',
            'target_address_hash',
            'external_tx_hash',
            'bridge_contract_addr',
            'chain_id_ton',
        ]);
    });

    it('PP_CCB_IDS lists exactly eight bridge governance parameters', () => {
        expect(PP_CCB_IDS).toHaveLength(8);
        expect([...PP_CCB_IDS]).toEqual([
            'PP-CCB-1', 'PP-CCB-2', 'PP-CCB-3', 'PP-CCB-4',
            'PP-CCB-5', 'PP-CCB-6', 'PP-CCB-7', 'PP-CCB-8',
        ]);
    });

    it('AP_RULES enumerates five auto-pause rules (AP-1..AP-5)', () => {
        expect(AP_RULES).toHaveLength(5);
    });

    it('T_RP_THREATS enumerates five replay-protection threats (T-RP-1..T-RP-5)', () => {
        expect(T_RP_THREATS).toHaveLength(5);
    });

    it('CH_ITEMS enumerates seven hardening items (CH-1..CH-7)', () => {
        expect(CH_ITEMS).toHaveLength(7);
    });

    it('R_CH_RULES enumerates five CI guardrail rules (R-CH-1..R-CH-5)', () => {
        expect(R_CH_RULES).toHaveLength(5);
    });

    it('CCB_THREATS enumerates seven A2 bridge threat categories', () => {
        expect(CCB_THREATS).toHaveLength(7);
    });

    it('BR_M_IDS enumerates twenty alerts in zero-padded form', () => {
        expect(BR_M_IDS).toHaveLength(20);
        expect(BR_M_IDS[0]).toBe('BR-M01');
        expect(BR_M_IDS[19]).toBe('BR-M20');
    });
});

// ==================== checkSupportedChainsDoc ====================

describe('checkSupportedChainsDoc', () => {
    const realDoc = readRepoFile('docs/bridge/SUPPORTED_CHAINS.md');

    it('passes every check against the committed SUPPORTED_CHAINS.md', () => {
        expect(failures(checkSupportedChainsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkSupportedChainsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('SC.doc');
    });

    it.each([...CHAIN_CONSTANTS])(
        'flags removal of chain constant $name=$id',
        ({ name, id }) => {
            const re = new RegExp(`${name}\\s*=\\s*${id}`, 'g');
            const tampered = realDoc.replace(re, `${name}_RENAMED = ${id}`);
            const results = checkSupportedChainsDoc(tampered);
            expect(failures(results)).toContain(`SC.const.${name}`);
        },
    );

    it.each([...SUPPORTED_CHAINS])(
        'flags omission of chain %s from §3',
        (chain) => {
            const tampered = realDoc.replace(new RegExp(chain, 'g'), 'PlaceholderChain');
            const results = checkSupportedChainsDoc(tampered);
            // At minimum the §3 chain reference must be flagged.
            expect(failures(results)).toContain(`SC.chain.${chain}`);
        },
    );
});

// ==================== checkValidatorsDoc ====================

describe('checkValidatorsDoc', () => {
    const realDoc = readRepoFile('docs/bridge/VALIDATORS.md');

    it('passes every check against the committed VALIDATORS.md', () => {
        expect(failures(checkValidatorsDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkValidatorsDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('VA.doc');
    });

    it('flags drift from the 5-of-9 threshold', () => {
        const tampered = realDoc.replace(/5[-‑–—\s]of[-‑–—\s]9/g, '3-of-5');
        expect(failures(checkValidatorsDoc(tampered))).toContain('VA.threshold.5of9');
    });

    it('flags removal of the canonical-hash field list citation', () => {
        const tampered = realDoc
            .replace(/target_chain/g, 'tc')
            .replace(/intent_id/g, 'ii');
        expect(failures(checkValidatorsDoc(tampered))).toContain('VA.canonical-hash.cite');
    });

    it('flags removal of the §6 "on-chain slashing is not implemented" rationale', () => {
        const tampered = realDoc.replace(
            /Why on-chain slashing is \*\*not implemented\*\*/g,
            'Slashing rationale removed',
        );
        expect(failures(checkValidatorsDoc(tampered))).toContain('VA.no-on-chain-slashing');
    });
});

// ==================== checkReplayProtectionDoc ====================

describe('checkReplayProtectionDoc', () => {
    const realDoc = readRepoFile('docs/bridge/REPLAY_PROTECTION.md');

    it('passes every check against the committed REPLAY_PROTECTION.md', () => {
        expect(failures(checkReplayProtectionDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkReplayProtectionDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('RP.doc');
    });

    it.each([...T_RP_THREATS])('flags omission of threat %s from §3', (threat) => {
        const tampered = realDoc.replace(new RegExp(`\\b${threat}\\b`, 'g'), 'T-RP-X');
        expect(failures(checkReplayProtectionDoc(tampered))).toContain(`RP.threat.${threat}`);
    });

    it.each([...CANONICAL_HASH_FIELDS])(
        'flags removal of canonical-hash field %s from §4.4',
        (field) => {
            const tampered = realDoc.replace(new RegExp(field, 'g'), `${field}_renamed`);
            expect(failures(checkReplayProtectionDoc(tampered))).toContain(`RP.canon.${field}`);
        },
    );

    it.each([...SUPPORTED_CHAINS])(
        'flags omission of finality registry row for %s',
        (chain) => {
            const tampered = realDoc.replace(new RegExp(`\\| ${chain}\\b`, 'g'), '| MissingChain');
            expect(failures(checkReplayProtectionDoc(tampered))).toContain(`RP.finality.${chain}`);
        },
    );
});

// ==================== checkCircuitBreakersDoc ====================

describe('checkCircuitBreakersDoc', () => {
    const realDoc = readRepoFile('docs/bridge/CIRCUIT_BREAKERS.md');

    it('passes every check against the committed CIRCUIT_BREAKERS.md', () => {
        expect(failures(checkCircuitBreakersDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkCircuitBreakersDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CB.doc');
    });

    it.each([...PP_CCB_IDS])(
        'flags removal of governance parameter %s from §4.1',
        (param) => {
            const tampered = realDoc.replace(new RegExp(param, 'g'), 'PP-CCB-X');
            expect(failures(checkCircuitBreakersDoc(tampered))).toContain(`CB.param.${param}`);
        },
    );

    it.each([...AP_RULES])('flags removal of auto-pause rule %s from §5.1', (rule) => {
        const tampered = realDoc.replace(new RegExp(`\\b${rule}\\b`, 'g'), 'AP-X');
        expect(failures(checkCircuitBreakersDoc(tampered))).toContain(`CB.ap.${rule}`);
    });

    it.each(['L0', 'L1', 'L2'])(
        'flags removal of breaker layer %s from §3',
        (layer) => {
            const tampered = realDoc.replace(new RegExp(`\\b${layer}\\b`, 'g'), 'LX');
            expect(failures(checkCircuitBreakersDoc(tampered))).toContain(`CB.layer.${layer}`);
        },
    );
});

// ==================== checkContractHardeningDoc ====================

describe('checkContractHardeningDoc', () => {
    const realDoc = readRepoFile('docs/bridge/CONTRACT_HARDENING.md');

    it('passes every check against the committed CONTRACT_HARDENING.md', () => {
        expect(failures(checkContractHardeningDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkContractHardeningDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CH.doc');
    });

    it.each([...CH_ITEMS])('flags removal of hardening item %s', (item) => {
        const tampered = realDoc.replace(new RegExp(`### ${item} —`, 'g'), '### CH-X —');
        expect(failures(checkContractHardeningDoc(tampered))).toContain(`CH.item.${item}`);
    });

    it.each([...R_CH_RULES])('flags removal of CI guardrail rule %s', (rule) => {
        const tampered = realDoc.replace(new RegExp(`\\b${rule}\\b`, 'g'), 'R-CH-X');
        expect(failures(checkContractHardeningDoc(tampered))).toContain(`CH.rule.${rule}`);
    });

    it('flags removal of the A2-verdict-READY landing gate', () => {
        // Replace every occurrence of READY with PENDING so no `verdict ... READY`
        // line survives — that's the structural invariant the gate enforces.
        const tampered = realDoc.replace(/READY/g, 'PENDING');
        expect(failures(checkContractHardeningDoc(tampered))).toContain('CH.a2-gate');
    });
});

// ==================== checkMonitoringDoc ====================

describe('checkMonitoringDoc', () => {
    const realDoc = readRepoFile('docs/bridge/MONITORING.md');

    it('passes every check against the committed MONITORING.md', () => {
        expect(failures(checkMonitoringDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkMonitoringDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('MN.doc');
    });

    it.each(BR_M_IDS)('flags removal of alert %s from §3', (alert) => {
        const tampered = realDoc.replace(new RegExp(`\\b${alert}\\b`, 'g'), 'BR-MXX');
        expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.alert.${alert}`);
    });

    it('flags duplicate alert rows in §3 catalogue', () => {
        // Insert a duplicate row for BR-M01.
        const duplicateRow = realDoc.match(/\| BR-M01 \|[^\n]*/);
        if (!duplicateRow) {
            throw new Error('Could not locate BR-M01 catalogue row in MONITORING.md');
        }
        const tampered = realDoc.replace(
            duplicateRow[0],
            `${duplicateRow[0]}\n${duplicateRow[0]}`,
        );
        expect(failures(checkMonitoringDoc(tampered))).toContain('MN.alert.unique.BR-M01');
    });

    it.each(['P0', 'P1', 'P2'])('flags removal of severity tier %s from §3.7', (tier) => {
        const tampered = realDoc.replace(new RegExp(`\\b${tier}\\b`, 'g'), 'PX');
        expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.sev.${tier}`);
    });

    it.each(['DR-1', 'DR-2', 'DR-3', 'DR-4', 'DR-5'])(
        'flags removal of drill %s from §5',
        (drill) => {
            const tampered = realDoc.replace(new RegExp(`\\b${drill}\\b`, 'g'), 'DR-X');
            expect(failures(checkMonitoringDoc(tampered))).toContain(`MN.drill.${drill}`);
        },
    );
});

// ==================== checkBugBountyDoc ====================

describe('checkBugBountyDoc', () => {
    const realDoc = readRepoFile('docs/bridge/BUG_BOUNTY.md');

    it('passes every check against the committed BUG_BOUNTY.md', () => {
        expect(failures(checkBugBountyDoc(realDoc))).toEqual([]);
    });

    it('flags a missing document', () => {
        const results = checkBugBountyDoc(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('BB.doc');
    });

    it.each([...CCB_THREATS])(
        'flags removal of A2 threat-to-bounty mapping for %s',
        (threat) => {
            const tampered = realDoc.replace(new RegExp(`\\b${threat}\\b`, 'g'), 'CCB-X');
            expect(failures(checkBugBountyDoc(tampered))).toContain(`BB.threat.${threat}`);
        },
    );

    it('flags removal of the A2-READY activation gate', () => {
        // Replace every READY token — the gate hinges on the literal `A2 verdict
        // `READY`` phrasing, so dropping the token removes the gate evidence.
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
    const realContract = readRepoFile('contracts/CrossChainBridge.tact');

    it('passes every check against the committed CrossChainBridge.tact', () => {
        expect(failures(checkContractEvidence(realContract))).toEqual([]);
    });

    it('flags a missing contract', () => {
        const results = checkContractEvidence(null);
        expect(results[0].passed).toBe(false);
        expect(results[0].id).toBe('CT.tact');
    });

    it.each([...CHAIN_CONSTANTS])(
        'flags removal of contract constant $name=$id',
        ({ name, id }) => {
            const tampered = realContract.replace(
                new RegExp(`const ${name}:[^=]+=\\s*${id}`, 'g'),
                `const ${name}_RENAMED: Int = ${id}`,
            );
            expect(failures(checkContractEvidence(tampered))).toContain(`CT.const.${name}`);
        },
    );

    it('flags removal of MAX_SUPPORTED_CHAIN = 5', () => {
        const tampered = realContract.replace(
            /MAX_SUPPORTED_CHAIN:[^=]+=\s*5/g,
            'MAX_SUPPORTED_CHAIN_RENAMED: Int = 5',
        );
        expect(failures(checkContractEvidence(tampered))).toContain('CT.max-chain');
    });

    it('flags removal of the ERROR_BR_INTENT_NOT_PENDING status-check wiring', () => {
        const tampered = realContract.replace(/ERROR_BR_INTENT_NOT_PENDING/g, 'ERROR_OTHER');
        expect(failures(checkContractEvidence(tampered))).toContain('CT.status-check');
    });
});

// ==================== checkCrossDocReferences ====================

describe('checkCrossDocReferences', () => {
    function loadAllDocs(): Record<string, string | null> {
        return {
            supportedChains:   readRepoFile('docs/bridge/SUPPORTED_CHAINS.md'),
            validators:        readRepoFile('docs/bridge/VALIDATORS.md'),
            replayProtection:  readRepoFile('docs/bridge/REPLAY_PROTECTION.md'),
            circuitBreakers:   readRepoFile('docs/bridge/CIRCUIT_BREAKERS.md'),
            contractHardening: readRepoFile('docs/bridge/CONTRACT_HARDENING.md'),
            monitoring:        readRepoFile('docs/bridge/MONITORING.md'),
            bugBounty:         readRepoFile('docs/bridge/BUG_BOUNTY.md'),
        };
    }

    it('passes every cross-doc check against the committed artifacts', () => {
        expect(failures(checkCrossDocReferences(loadAllDocs()))).toEqual([]);
    });

    it('flags an undefined CH-N reference (R-CH-2)', () => {
        const docs = loadAllDocs();
        // Inject an undefined hardening item reference into MONITORING.md.
        docs.monitoring = `${docs.monitoring}\n\nSee CH-99 for follow-up.\n`;
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.CH.monitoring.CH-99');
    });

    it('flags canonical-hash field drift between REPLAY_PROTECTION and VALIDATORS', () => {
        const docs = loadAllDocs();
        if (docs.validators) {
            docs.validators = docs.validators.replace(/target_chain/g, 'tc');
        }
        expect(failures(checkCrossDocReferences(docs))).toContain('XR.canon.target_chain');
    });
});

// ==================== runAllChecks integration ====================

describe('runAllChecks', () => {
    it('reports zero failures against the committed F3 bridge artifacts', () => {
        const report = runAllChecks();
        if (report.failed > 0) {
            // Surface the failing checks so CI logs are immediately diagnostic.
            // eslint-disable-next-line no-console
            console.error(
                'Bridge readiness validator failures:\n' +
                    report.failures.map((f) => `  ✗ ${f.id} — ${f.name} (${f.detail})`).join('\n'),
            );
        }
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(report.results.length);
    });

    it('counts more than 200 individual checks (sanity)', () => {
        // Guards against accidental gutting of the validator (e.g., empty docs
        // passing because their check functions short-circuit). The current
        // configuration emits 233 checks; we set a conservative floor.
        const report = runAllChecks();
        expect(report.results.length).toBeGreaterThanOrEqual(200);
    });
});
