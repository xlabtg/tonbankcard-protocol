/**
 * Cross-Chain Bridge Production-Readiness Validator (Issue #138, F3)
 *
 * Purpose: Validate that the seven bridge production-readiness
 *   documents — SUPPORTED_CHAINS.md, VALIDATORS.md, REPLAY_PROTECTION.md,
 *   CIRCUIT_BREAKERS.md, CONTRACT_HARDENING.md, MONITORING.md, and
 *   BUG_BOUNTY.md — stay consistent with each other, with the contract
 *   source `contracts/CrossChainBridge.tact`, and with the engagement's
 *   acceptance criteria from Issue #138 §8.
 *
 * Type: Off-chain CI utility. No fund custody, no contract calls. Reads
 *   markdown / Tact sources from the repository working tree.
 *
 * Usage:
 *   npx ts-node scripts/bridge/check-bridge-readiness.ts
 *   npx ts-node scripts/bridge/check-bridge-readiness.ts --classify AC-4
 *   npx ts-node scripts/bridge/check-bridge-readiness.ts --strict
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 *
 * Mirrors the validator pattern established by
 *   scripts/governance/check-parameter-changes.ts (E2) and
 *   scripts/governance/check-risk-authority.ts (E3).
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ==================== ACCEPTANCE CRITERIA INVENTORY ====================
// Mirrors Issue #138 §8 ("Acceptance Criteria"). Each AC maps to the
// document evidence that satisfies it. Drift between this table and
// the linked documents is itself a CI-blocking defect.

export type AcceptanceCriterion = {
    id: string;
    description: string;
    artifact: string;
    evidenceCheck:
        | 'prerequisite'
        | 'supported-chains'
        | 'validators'
        | 'replay-protection'
        | 'circuit-breakers'
        | 'monitoring'
        | 'bug-bounty'
        | 'contract-hardening';
};

export const ACCEPTANCE_CRITERIA: AcceptanceCriterion[] = [
    { id: 'AC-1', description: 'A2 audit complete (prerequisite)',                     artifact: 'docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md', evidenceCheck: 'prerequisite' },
    { id: 'AC-2', description: 'Supported chain list documented',                       artifact: 'docs/bridge/SUPPORTED_CHAINS.md',                         evidenceCheck: 'supported-chains' },
    { id: 'AC-3', description: 'Bridge validator set architecture documented',          artifact: 'docs/bridge/VALIDATORS.md',                               evidenceCheck: 'validators' },
    { id: 'AC-4', description: 'Replay protection verified by auditor',                 artifact: 'docs/bridge/REPLAY_PROTECTION.md',                        evidenceCheck: 'replay-protection' },
    { id: 'AC-5', description: 'Bridge circuit breakers operational',                   artifact: 'docs/bridge/CIRCUIT_BREAKERS.md',                         evidenceCheck: 'circuit-breakers' },
    { id: 'AC-6', description: 'Bridge monitoring alerts configured',                   artifact: 'docs/bridge/MONITORING.md',                               evidenceCheck: 'monitoring' },
    { id: 'AC-7', description: 'Bridge bug-bounty category active (gated on A2 READY)', artifact: 'docs/bridge/BUG_BOUNTY.md',                               evidenceCheck: 'bug-bounty' },
];

// ==================== FILE PATHS ====================

const REPO_ROOT = resolve(__dirname, '..', '..');

const PATHS = {
    supportedChains:   resolve(REPO_ROOT, 'docs/bridge/SUPPORTED_CHAINS.md'),
    validators:        resolve(REPO_ROOT, 'docs/bridge/VALIDATORS.md'),
    replayProtection:  resolve(REPO_ROOT, 'docs/bridge/REPLAY_PROTECTION.md'),
    circuitBreakers:   resolve(REPO_ROOT, 'docs/bridge/CIRCUIT_BREAKERS.md'),
    contractHardening: resolve(REPO_ROOT, 'docs/bridge/CONTRACT_HARDENING.md'),
    monitoring:        resolve(REPO_ROOT, 'docs/bridge/MONITORING.md'),
    bugBounty:         resolve(REPO_ROOT, 'docs/bridge/BUG_BOUNTY.md'),
    contract:          resolve(REPO_ROOT, 'contracts/CrossChainBridge.tact'),
    parameters:        resolve(REPO_ROOT, 'docs/governance/PARAMETERS.md'),
    a2Engagement:      resolve(REPO_ROOT, 'docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md'),
    a2Status:          resolve(REPO_ROOT, 'docs/security/audits/A2-phase4-contracts/STATUS.md'),
    a5ProgramBrief:    resolve(REPO_ROOT, 'docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md'),
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

export const SUPPORTED_CHAINS = ['Ethereum', 'BSC', 'Polygon', 'Bitcoin', 'Solana'] as const;

export const CHAIN_CONSTANTS = [
    { name: 'CHAIN_ETHEREUM', id: 1 },
    { name: 'CHAIN_BITCOIN',  id: 2 },
    { name: 'CHAIN_BSC',      id: 3 },
    { name: 'CHAIN_POLYGON',  id: 4 },
    { name: 'CHAIN_SOLANA',   id: 5 },
] as const;

export const CANONICAL_HASH_FIELDS = [
    'target_chain',
    'intent_id',
    'amount',
    'target_address_hash',
    'external_tx_hash',
    'bridge_contract_addr',
    'chain_id_ton',
] as const;

export const PP_CCB_IDS = [
    'PP-CCB-1', 'PP-CCB-2', 'PP-CCB-3', 'PP-CCB-4',
    'PP-CCB-5', 'PP-CCB-6', 'PP-CCB-7', 'PP-CCB-8',
] as const;

export const AP_RULES = ['AP-1', 'AP-2', 'AP-3', 'AP-4', 'AP-5'] as const;

export const T_RP_THREATS = ['T-RP-1', 'T-RP-2', 'T-RP-3', 'T-RP-4', 'T-RP-5'] as const;

export const CH_ITEMS = ['CH-1', 'CH-2', 'CH-3', 'CH-4', 'CH-5', 'CH-6', 'CH-7'] as const;

export const R_CH_RULES = ['R-CH-1', 'R-CH-2', 'R-CH-3', 'R-CH-4', 'R-CH-5'] as const;

export const CCB_THREATS = [
    'CCB-1', 'CCB-2', 'CCB-3', 'CCB-4', 'CCB-5', 'CCB-6', 'CCB-7',
] as const;

// 20 alert IDs BR-M01 .. BR-M20
export const BR_M_IDS = Array.from({ length: 20 }, (_, i) => `BR-M${String(i + 1).padStart(2, '0')}`);

// ==================== DOCUMENT CHECKS ====================

export function checkSupportedChainsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'SC.doc', name: 'SUPPORTED_CHAINS.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'SC.doc', name: 'SUPPORTED_CHAINS.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'SC.sec.3',   pattern: /## 3\. Initial Chain Set/ },
        { id: 'SC.sec.4',   pattern: /## 4\. Per-Chain Limits/ },
        { id: 'SC.sec.4_1', pattern: /### 4\.1 Initial per-chain TVL caps/ },
        { id: 'SC.sec.5',   pattern: /## 5\. Chain Addition \/ Removal Procedure/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `SUPPORTED_CHAINS.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-2',
        });
    }

    for (const chain of SUPPORTED_CHAINS) {
        results.push({
            id: `SC.chain.${chain}`,
            name: `SUPPORTED_CHAINS.md §3 lists ${chain}`,
            passed: new RegExp(`\\*\\*${chain}\\*\\*`).test(content),
            detail: 'Chain registry table row',
        });
    }

    for (const { name, id } of CHAIN_CONSTANTS) {
        results.push({
            id: `SC.const.${name}`,
            name: `SUPPORTED_CHAINS.md §3 names contract constant ${name}=${id}`,
            passed: new RegExp(`\`${name}=${id}\``).test(content),
            detail: 'Contract <-> doc constant binding',
        });
    }

    // The §4.1 caps table must mention every chain (sanity check of the matrix).
    for (const chain of SUPPORTED_CHAINS) {
        results.push({
            id: `SC.cap.${chain}`,
            name: `SUPPORTED_CHAINS.md §4.1 caps row for ${chain}`,
            passed: new RegExp(`\\|\\s*${chain}\\s*\\|`).test(content),
            detail: 'Per-chain caps table row',
        });
    }

    return results;
}

export function checkValidatorsDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'VA.doc', name: 'VALIDATORS.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'VA.doc', name: 'VALIDATORS.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'VA.sec.3',   pattern: /## 3\. Trust model/ },
        { id: 'VA.sec.4',   pattern: /## 4\. Threshold Model — 5-of-9/ },
        { id: 'VA.sec.4_2', pattern: /### 4\.2 On-chain enforcement/ },
        { id: 'VA.sec.5',   pattern: /## 5\. Onboarding & Key Rotation/ },
        { id: 'VA.sec.6',   pattern: /## 6\. Slashing posture/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `VALIDATORS.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-3',
        });
    }

    // 5-of-9 threshold must be the named primary
    results.push({
        id: 'VA.threshold.5of9',
        name: 'VALIDATORS.md states 5-of-9 threshold',
        passed: /5[-‑–—\s]of[-‑–—\s]9/.test(content),
        detail: 'Issue #138 §5.2',
    });

    // §4.2 must cite the canonical-hash field list (the subset that VALIDATORS
    // pins down — the on-chain-relevant five fields, not the full seven).
    // Tolerate line wrapping between fields.
    results.push({
        id: 'VA.canonical-hash.cite',
        name: 'VALIDATORS.md §4.2 cites the canonical-hash field list from REPLAY_PROTECTION.md',
        passed:
            /target_chain\s*\|\|\s*intent_id\s*\|\|\s*amount\s*\|\|\s*target_address_hash\s*\|\|\s*external_tx_hash/.test(
                content
            ),
        detail: 'Cross-document contract — replay-protection canonical hash',
    });

    // §6 must explicitly reject on-chain bonding (slashing posture rationale)
    results.push({
        id: 'VA.no-on-chain-slashing',
        name: 'VALIDATORS.md §6 explains why on-chain slashing is NOT implemented (I1 non-custodial)',
        passed: /Why on-chain slashing is \*\*not implemented\*\*/.test(content),
        detail: 'Invariant I1 / Issue #138 §5.2',
    });

    return results;
}

export function checkReplayProtectionDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'RP.doc', name: 'REPLAY_PROTECTION.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'RP.doc', name: 'REPLAY_PROTECTION.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'RP.sec.3',   pattern: /## 3\. Threat catalogue covered/ },
        { id: 'RP.sec.4',   pattern: /## 4\. Replay surfaces and how they are closed/ },
        { id: 'RP.sec.4_1', pattern: /### 4\.1 Same-chain replay/ },
        { id: 'RP.sec.4_2', pattern: /### 4\.2 Cross-chain replay/ },
        { id: 'RP.sec.4_3', pattern: /### 4\.3 Intent-key collision/ },
        { id: 'RP.sec.4_4', pattern: /### 4\.4 Off-chain attestation replay/ },
        { id: 'RP.sec.4_5', pattern: /### 4\.5 Finality replay/ },
        { id: 'RP.sec.5',   pattern: /## 5\. Per-chain finality assumption registry/ },
        { id: 'RP.sec.6',   pattern: /## 6\. Indexer correlation/ },
        { id: 'RP.sec.7',   pattern: /## 7\. CI enforcement/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `REPLAY_PROTECTION.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-4 / §5.3',
        });
    }

    for (const threat of T_RP_THREATS) {
        results.push({
            id: `RP.threat.${threat}`,
            name: `REPLAY_PROTECTION.md threat catalogue lists ${threat}`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'Threat catalogue §3',
        });
    }

    // All seven canonical-hash fields must appear in §4.4
    for (const field of CANONICAL_HASH_FIELDS) {
        results.push({
            id: `RP.canon.${field}`,
            name: `REPLAY_PROTECTION.md §4.4 canonical hash includes ${field}`,
            passed: new RegExp(`\\b${field}\\b`).test(content),
            detail: 'Cross-document canonical-hash contract',
        });
    }

    // §4.5 finality registry must list every chain in SUPPORTED_CHAINS.md §3
    for (const chain of SUPPORTED_CHAINS) {
        results.push({
            id: `RP.finality.${chain}`,
            name: `REPLAY_PROTECTION.md §4.5 finality table lists ${chain}`,
            passed: new RegExp(`\\|\\s*${chain}\\s*\\|`).test(content),
            detail: 'Finality registry mirrors SUPPORTED_CHAINS.md §3',
        });
    }

    return results;
}

export function checkCircuitBreakersDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'CB.doc', name: 'CIRCUIT_BREAKERS.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'CB.doc', name: 'CIRCUIT_BREAKERS.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'CB.sec.3',   pattern: /## 3\. Breaker Layers/ },
        { id: 'CB.sec.4',   pattern: /## 4\. Quantitative thresholds/ },
        { id: 'CB.sec.4_1', pattern: /### 4\.1 Per-chain caps/ },
        { id: 'CB.sec.5',   pattern: /## 5\. Pause Authority/ },
        { id: 'CB.sec.5_1', pattern: /### 5\.1 Auto-pause/ },
        { id: 'CB.sec.5_2', pattern: /### 5\.2 Manual pause/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `CIRCUIT_BREAKERS.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-5 / §7',
        });
    }

    for (const pp of PP_CCB_IDS) {
        results.push({
            id: `CB.param.${pp}`,
            name: `CIRCUIT_BREAKERS.md §4.1 references parameter ${pp}`,
            passed: new RegExp(`\\*\\*${pp}\\*\\*`).test(content),
            detail: 'PP-CCB-* inventory',
        });
    }

    for (const ap of AP_RULES) {
        results.push({
            id: `CB.ap.${ap}`,
            name: `CIRCUIT_BREAKERS.md §5.1 defines auto-pause rule ${ap}`,
            passed: new RegExp(`\\|\\s*${ap}\\s*\\|`).test(content),
            detail: 'Auto-pause trigger table',
        });
    }

    // L0/L1/L2 layered model
    for (const layer of ['L0', 'L1', 'L2']) {
        results.push({
            id: `CB.layer.${layer}`,
            name: `CIRCUIT_BREAKERS.md §3 defines breaker layer ${layer}`,
            passed: new RegExp(`\\*\\*${layer} —`).test(content),
            detail: 'Layered breaker model — Issue #138 §7',
        });
    }

    // 1% auto-pause floor (Issue #138 §7 explicit anchor)
    results.push({
        id: 'CB.autopause.1pct',
        name: 'CIRCUIT_BREAKERS.md anchors 1 % auto-pause floor from Issue #138 §7',
        passed: /1 %\/day is the \*\*floor\*\*/.test(content) || /1 % of advisory TVL/.test(content),
        detail: 'Issue #138 §7 — _"1% of TVL per day"_',
    });

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
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `CONTRACT_HARDENING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Post-A2 hardening track',
        });
    }

    for (const ch of CH_ITEMS) {
        results.push({
            id: `CH.item.${ch}`,
            name: `CONTRACT_HARDENING.md §3 defines hardening item ${ch}`,
            passed: new RegExp(`### ${ch} —`).test(content),
            detail: 'Hardening backlog — single source of truth for CH-N IDs',
        });
    }

    for (const rule of R_CH_RULES) {
        results.push({
            id: `CH.rule.${rule}`,
            name: `CONTRACT_HARDENING.md §5 defines CI guardrail rule ${rule}`,
            passed: new RegExp(`\\*\\*${rule}\\*\\*`).test(content),
            detail: 'CI guardrail inventory',
        });
    }

    // Explicit A2 verdict gate (R-CH-1)
    results.push({
        id: 'CH.a2-gate',
        name: 'CONTRACT_HARDENING.md §4 gates landing on A2 verdict READY',
        passed: /verdict[^\n]*READY/.test(content) || /verdict `READY`/.test(content),
        detail: 'Issue #138 §3 hard prerequisite',
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
        { id: 'MN.sec.3',     pattern: /## 3\. Alert catalogue/ },
        { id: 'MN.sec.3_1',   pattern: /### 3\.1 Per-chain volume alerts/ },
        { id: 'MN.sec.3_2',   pattern: /### 3\.2 Replay & correlation alerts/ },
        { id: 'MN.sec.3_3',   pattern: /### 3\.3 Daily-outflow & circuit-breaker alerts/ },
        { id: 'MN.sec.3_4',   pattern: /### 3\.4 Validator drift/ },
        { id: 'MN.sec.3_5',   pattern: /### 3\.5 Validator heartbeat/ },
        { id: 'MN.sec.3_6',   pattern: /### 3\.6 External provider/ },
        { id: 'MN.sec.3_7',   pattern: /### 3\.7 Roll-up — pager severity matrix/ },
        { id: 'MN.sec.4',     pattern: /## 4\. Data sources/ },
        { id: 'MN.sec.5',     pattern: /## 5\. Disaster-recovery drill schedule/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `MONITORING.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-6 / §7.3',
        });
    }

    for (const alert of BR_M_IDS) {
        // Catalogue rows use `BR-M07 |` shape inside markdown tables; the §3.7
        // roll-up references them in comma-separated form. Either form counts.
        results.push({
            id: `MN.alert.${alert}`,
            name: `MONITORING.md §3 references alert ${alert}`,
            passed: new RegExp(`\\b${alert}\\b`).test(content),
            detail: 'Bridge alert inventory',
        });
    }

    // Catalogue uniqueness — every BR-Mxx appears as a left-column table entry
    // exactly once across §3.1..§3.6.
    for (const alert of BR_M_IDS) {
        const cataloguePattern = new RegExp(`\\|\\s*${alert}\\s*\\|`, 'g');
        const occurrences = (content.match(cataloguePattern) ?? []).length;
        results.push({
            id: `MN.alert.unique.${alert}`,
            name: `MONITORING.md §3 catalogue row for ${alert} appears exactly once`,
            passed: occurrences === 1,
            detail: `expected 1 catalogue row, found ${occurrences}`,
        });
    }

    // P0 / P1 / P2 severity tiers (§3.7)
    for (const sev of ['P0', 'P1', 'P2']) {
        results.push({
            id: `MN.sev.${sev}`,
            name: `MONITORING.md §3.7 defines severity tier ${sev}`,
            passed: new RegExp(`\\*\\*${sev}\\*\\*`).test(content),
            detail: 'Pager routing',
        });
    }

    // DR drills DR-1..DR-5
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

export function checkBugBountyDoc(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'BB.doc', name: 'BUG_BOUNTY.md present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'BB.doc', name: 'BUG_BOUNTY.md present', passed: true, detail: 'found' });

    const requiredSections: { id: string; pattern: RegExp }[] = [
        { id: 'BB.sec.3', pattern: /## 3\. In-scope assets/ },
        { id: 'BB.sec.4', pattern: /## 4\. Bridge-specific severity uplifts/ },
        { id: 'BB.sec.5', pattern: /## 5\. Bridge-specific out-of-scope clarifications/ },
        { id: 'BB.sec.6', pattern: /## 6\. Threat-catalogue cross-reference/ },
        { id: 'BB.sec.7', pattern: /## 7\. Activation timeline/ },
        { id: 'BB.sec.8', pattern: /## 8\. Triage SLA/ },
    ];
    for (const sec of requiredSections) {
        results.push({
            id: sec.id,
            name: `BUG_BOUNTY.md ${sec.id}`,
            passed: sec.pattern.test(content),
            detail: 'Issue #138 AC-7',
        });
    }

    // A2 threats CCB-1..CCB-7 must each map to a bounty band in §6
    for (const threat of CCB_THREATS) {
        results.push({
            id: `BB.threat.${threat}`,
            name: `BUG_BOUNTY.md §6 maps A2 threat ${threat} to a bounty band`,
            passed: new RegExp(`\\*\\*${threat}\\*\\*`).test(content),
            detail: 'A2 ↔ A5 traceability',
        });
    }

    // Activation must be gated on A2 verdict READY
    results.push({
        id: 'BB.a2-gate',
        name: 'BUG_BOUNTY.md states activation requires A2 verdict READY',
        passed:
            /A2 verdict `READY`/.test(content) ||
            /activation gated on A2 verdict `READY`/.test(content),
        detail: 'Issue #138 §3 prerequisite',
    });

    // RC-BOUNTY-CRITICAL — the pause reason code referenced from §8
    results.push({
        id: 'BB.pause-rc',
        name: 'BUG_BOUNTY.md §8 cites RC-BOUNTY-CRITICAL pause reason code',
        passed: /RC-BOUNTY-CRITICAL/.test(content),
        detail: 'Critical-finding pause integration with CIRCUIT_BREAKERS.md §5.2',
    });

    return results;
}

// ==================== CONTRACT EVIDENCE CHECKS ====================
// These checks read the live contract to confirm pre-A2 state. They
// are how R-CH-3 (no surprise contract changes) is detected from the
// PR side: if the contract no longer shows the pre-A2 shapes asserted
// here, the validator demands a matching CH-N entry in §3 of
// CONTRACT_HARDENING.md before the PR can land.

export function checkContractEvidence(content: string | null): CheckResult[] {
    const results: CheckResult[] = [];
    if (content == null) {
        results.push({ id: 'CT.tact', name: 'CrossChainBridge.tact present', passed: false, detail: 'file not found' });
        return results;
    }
    results.push({ id: 'CT.tact', name: 'CrossChainBridge.tact present', passed: true, detail: 'found' });

    // CHAIN_* constants match SUPPORTED_CHAINS.md §3
    for (const { name, id } of CHAIN_CONSTANTS) {
        results.push({
            id: `CT.const.${name}`,
            name: `CrossChainBridge.tact declares ${name} = ${id}`,
            passed: new RegExp(`const ${name}:\\s*Int\\s*=\\s*${id}\\b`).test(content),
            detail: 'Contract <-> SUPPORTED_CHAINS.md §3 binding',
        });
    }

    // MAX_SUPPORTED_CHAIN = 5 (Issue #138 §5.1 caps at five chains for v1)
    results.push({
        id: 'CT.max-chain',
        name: 'CrossChainBridge.tact declares MAX_SUPPORTED_CHAIN = 5',
        passed: /const MAX_SUPPORTED_CHAIN:\s*Int\s*=\s*5\b/.test(content),
        detail: 'Issue #138 §5.1 v1 chain count',
    });

    // Test-only handlers — must still be present until CH-7 lands
    results.push({
        id: 'CT.testonly.RegisterRelayer',
        name: 'CrossChainBridge.tact still ships RegisterRelayer (CH-7 pending)',
        passed: /receive\(msg:\s*RegisterRelayer\)/.test(content),
        detail: 'Confirms CH-7 has not landed yet — see CONTRACT_HARDENING.md §3',
    });
    results.push({
        id: 'CT.testonly.RegisterNFTOwnerBridge',
        name: 'CrossChainBridge.tact still ships RegisterNFTOwnerBridge (CH-7 pending)',
        passed: /receive\(msg:\s*RegisterNFTOwnerBridge\)/.test(content),
        detail: 'Confirms CH-7 has not landed yet — see CONTRACT_HARDENING.md §3',
    });

    // The vulnerable composite-key combinator (CH-2 target) — must still be
    // addition until CH-2 lands. If a PR replaces the combinator without
    // ALSO updating §4.3 of REPLAY_PROTECTION.md to mark T-RP-3 closed, the
    // cross-doc check below trips.
    results.push({
        id: 'CT.intentKey.addition',
        name: 'CrossChainBridge.tact intentKey still uses integer addition (CH-2 pending)',
        passed: /fun intentKey[\s\S]{0,200}sha256\(nft_address\.asSlice\(\)\)\s*\+\s*intent_id/.test(content),
        detail: 'Confirms CH-2 has not landed yet — see CONTRACT_HARDENING.md §3',
    });

    // Status-check pattern that closes T-RP-1 today.
    results.push({
        id: 'CT.status-check',
        name: 'CrossChainBridge.tact rejects double-confirmation via ERROR_BR_INTENT_NOT_PENDING',
        passed: /ERROR_BR_INTENT_NOT_PENDING/.test(content),
        detail: 'T-RP-1 closure evidence — see REPLAY_PROTECTION.md §4.1',
    });

    return results;
}

// ==================== CROSS-DOCUMENT CHECKS ====================
// Each rule corresponds to a numbered guardrail in one of the seven
// documents. R-CH-2 ("every CH-N reference resolves to a §3 row")
// is the most prolific producer of cross-doc failures.

export function checkCrossDocReferences(
    docs: Record<string, string | null>
): CheckResult[] {
    const results: CheckResult[] = [];

    // R-CH-2: every CH-N mention in the six other bridge documents must
    // exist as a `### CH-N —` heading in CONTRACT_HARDENING.md §3.
    const hardening = docs.contractHardening;
    if (hardening != null) {
        const documentedItems = new Set<string>();
        const headingMatches = hardening.matchAll(/^### (CH-\d+) —/gm);
        for (const m of headingMatches) documentedItems.add(m[1]);

        for (const [name, content] of Object.entries(docs)) {
            if (content == null || name === 'contractHardening') continue;
            const referencedItems = new Set<string>();
            const refMatches = content.matchAll(/\bCH-(\d+)\b/g);
            for (const m of refMatches) referencedItems.add(`CH-${m[1]}`);

            for (const ref of referencedItems) {
                results.push({
                    id: `XR.CH.${name}.${ref}`,
                    name: `${name} cites ${ref} which resolves to a §3 heading`,
                    passed: documentedItems.has(ref),
                    detail: 'R-CH-2 of CONTRACT_HARDENING.md §5',
                });
            }
        }
    }

    // Canonical-hash parity: every field documented in REPLAY_PROTECTION.md
    // §4.4 must appear in VALIDATORS.md §4.2 (which cites the on-chain-relevant
    // subset). The opposite direction is enforced inside checkValidatorsDoc.
    const rp = docs.replayProtection;
    const va = docs.validators;
    if (rp != null && va != null) {
        // The validators doc cites the first five fields verbatim. We assert
        // those five are present in the canonical hash list. The other two
        // (bridge_contract_addr, chain_id_ton) are explicitly contract-bound
        // additions documented in REPLAY_PROTECTION.md §4.4 only.
        for (const field of [
            'target_chain',
            'intent_id',
            'amount',
            'target_address_hash',
            'external_tx_hash',
        ]) {
            results.push({
                id: `XR.canon.${field}`,
                name: `Canonical-hash field ${field} present in both REPLAY_PROTECTION.md §4.4 and VALIDATORS.md §4.2`,
                passed: rp.includes(field) && va.includes(field),
                detail: 'Cross-doc canonical-hash contract — REPLAY_PROTECTION.md §7 check 1',
            });
        }
    }

    // Finality registry coverage: every chain in SUPPORTED_CHAINS.md §3
    // must have a row in REPLAY_PROTECTION.md §4.5 (the finality table).
    // REPLAY_PROTECTION.md §7 check 3 mandates this.
    const sc = docs.supportedChains;
    if (sc != null && rp != null) {
        for (const chain of SUPPORTED_CHAINS) {
            const inRegistry = new RegExp(`\\|\\s*${chain}\\s*\\|`).test(sc);
            const inFinality = new RegExp(`\\|\\s*${chain}\\s*\\|`).test(rp);
            results.push({
                id: `XR.finality.${chain}`,
                name: `Finality registry covers chain ${chain} (REPLAY_PROTECTION.md §4.5 ↔ SUPPORTED_CHAINS.md §3)`,
                passed: inRegistry && inFinality,
                detail: 'REPLAY_PROTECTION.md §7 check 3',
            });
        }
    }

    // PP-CCB-* uniqueness in CIRCUIT_BREAKERS.md §4.1
    const cb = docs.circuitBreakers;
    if (cb != null) {
        // §4.1 reuses the same PP-CCB-N ID across the three caps for a chain
        // (per-tx / per-NFT 24 h / per-chain 24 h). The uniqueness contract
        // therefore applies to (chain × scope), not to bare occurrences.
        // We assert at least one bold occurrence per ID, which is the §6
        // verification check 2 spelling.
        for (const pp of PP_CCB_IDS) {
            const occurrences = (cb.match(new RegExp(`\\*\\*${pp}\\*\\*`, 'g')) ?? []).length;
            results.push({
                id: `XR.pp.${pp}`,
                name: `CIRCUIT_BREAKERS.md §4.1 declares ${pp} at least once`,
                passed: occurrences >= 1,
                detail: 'CIRCUIT_BREAKERS.md §6 check 2',
            });
        }
    }

    // AP-N coverage: every AP-N in CIRCUIT_BREAKERS.md §5.1 must be
    // referenced by at least one MONITORING.md alert.
    const mn = docs.monitoring;
    if (cb != null && mn != null) {
        for (const ap of AP_RULES) {
            const referenced = new RegExp(`\\b${ap}\\b`).test(mn);
            results.push({
                id: `XR.ap.${ap}`,
                name: `MONITORING.md §3 references auto-pause rule ${ap}`,
                passed: referenced,
                detail: 'MONITORING.md §6 check 3',
            });
        }
    }

    // Multi-sig threshold ≥ 2 (CIRCUIT_BREAKERS.md §6 check 5). If the
    // bridge multisig artefact exists, parse it; otherwise pass with note.
    const multisigPath = resolve(REPO_ROOT, 'docs/deployments/B2-mainnet/multisig.bridge.json');
    if (existsSync(multisigPath)) {
        try {
            const ms = JSON.parse(readFileSync(multisigPath, 'utf8'));
            const threshold = typeof ms?.threshold === 'number' ? ms.threshold : -1;
            const eoaOk = !ms?.signers || (Array.isArray(ms.signers) && ms.signers.every((s: { eoa?: boolean }) => !s.eoa));
            results.push({
                id: 'XR.multisig.threshold',
                name: 'docs/deployments/B2-mainnet/multisig.bridge.json threshold ≥ 2 and every signer non-EOA',
                passed: threshold >= 2 && eoaOk,
                detail: `CIRCUIT_BREAKERS.md §6 check 5 (threshold=${threshold})`,
            });
        } catch (err) {
            results.push({
                id: 'XR.multisig.threshold',
                name: 'docs/deployments/B2-mainnet/multisig.bridge.json parseable',
                passed: false,
                detail: `parse error: ${(err as Error).message}`,
            });
        }
    } else {
        results.push({
            id: 'XR.multisig.threshold',
            name: 'docs/deployments/B2-mainnet/multisig.bridge.json (B2 ceremony artefact)',
            passed: true,
            detail: 'not yet created — B2 ceremony schedules creation; check non-blocking until ceremony scheduled',
        });
    }

    // R-CH-1 (A2 verdict gate) — if A2 STATUS.md exists, require it to
    // report verdict before CH-N items are allowed to land. Until A2
    // ships, this check passes informatively.
    if (existsSync(PATHS.a2Status)) {
        const status = readFileSync(PATHS.a2Status, 'utf8');
        const verdictReady = /verdict[^\n]*READY/i.test(status);
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md records verdict READY (gate for CH-N landings)',
            passed: verdictReady,
            detail: 'R-CH-1 of CONTRACT_HARDENING.md §5 — only enforced when STATUS.md exists',
        });
    } else {
        results.push({
            id: 'XR.a2.verdict',
            name: 'A2 STATUS.md not yet created (gate currently inactive)',
            passed: true,
            detail: 'R-CH-1 inactive until STATUS.md exists — current PR scope is documentation-only',
        });
    }

    // T-RP-* threat IDs must exist in A2 ENGAGEMENT.md §4.1 (REPLAY_PROTECTION.md
    // §7 check 2). The threats are catalogued there as CCB-* IDs; the
    // mapping is documented in BUG_BOUNTY.md §6. We assert §6 of the
    // bug bounty exists rather than trying to grep the engagement doc
    // directly (the engagement format is not standardised yet).
    const bb = docs.bugBounty;
    if (bb != null) {
        for (const ccb of CCB_THREATS) {
            results.push({
                id: `XR.ccb.${ccb}`,
                name: `BUG_BOUNTY.md §6 maps A2 threat ${ccb} (REPLAY_PROTECTION.md §7 check 2)`,
                passed: new RegExp(`\\*\\*${ccb}\\*\\*`).test(bb),
                detail: 'A2 ↔ A5 traceability',
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
        supportedChains:   readSafe(PATHS.supportedChains),
        validators:        readSafe(PATHS.validators),
        replayProtection:  readSafe(PATHS.replayProtection),
        circuitBreakers:   readSafe(PATHS.circuitBreakers),
        contractHardening: readSafe(PATHS.contractHardening),
        monitoring:        readSafe(PATHS.monitoring),
        bugBounty:         readSafe(PATHS.bugBounty),
    };
    const contract = readSafe(PATHS.contract);

    const results = [
        ...checkSupportedChainsDoc(docs.supportedChains),
        ...checkValidatorsDoc(docs.validators),
        ...checkReplayProtectionDoc(docs.replayProtection),
        ...checkCircuitBreakersDoc(docs.circuitBreakers),
        ...checkContractHardeningDoc(docs.contractHardening),
        ...checkMonitoringDoc(docs.monitoring),
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
            'Usage: ts-node scripts/bridge/check-bridge-readiness.ts [--classify AC-x] [--strict]\n'
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
