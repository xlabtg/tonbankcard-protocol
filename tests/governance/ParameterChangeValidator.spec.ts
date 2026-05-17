/**
 * Unit tests for scripts/governance/check-parameter-changes.ts (Issue #133, E2).
 *
 * The validator is the off-chain CI gate that enforces:
 *   - the proposal template structure (PARAMETER_CHANGES.md §2),
 *   - per-parameter quorum and cooldown floors (PARAMETERS.md §9),
 *   - the executor multi-sig minimum (2-of-3, PARAMETERS.md §10),
 *   - the canonical JSON metadata hashing rule (PARAMETER_CHANGES.md §3).
 *
 * These tests are pure TypeScript — they do not require a compiled contract
 * and therefore run in any environment with ts-jest.
 */

import { createHash } from 'crypto';
import {
    PARAMETER_INVENTORY,
    parseProposalMarkdown,
    validateProposal,
    canonicalJson,
} from '../../scripts/governance/check-parameter-changes';

const BASE_PROPOSAL_FIELDS = {
    parameterId: 'PP-13',
    contractFile: 'payments/PaymentHub.tact',
    setterMessage: 'WhitelistCollection',
    authorNftId: 42,
    category: 0,
    votingWindowDays: 7,
    quorumThreshold: 44,
    cooldownHours: 48,
    executorMultisig: 'EQDpaymenthubadminmultisigaddress2of3signersrequiredforaction',
    executorThresholdM: 2,
    executorThresholdN: 3,
    transparencyChecklist: [true, true, true],
};

describe('PARAMETER_INVENTORY', () => {
    it('contains at least one record for every contract in PARAMETERS.md §8', () => {
        const contracts = new Set(PARAMETER_INVENTORY.map((p) => p.contract));
        expect(contracts.has('governance/ProposalRegistry.tact')).toBe(true);
        expect(contracts.has('payments/PaymentHub.tact')).toBe(true);
        expect(contracts.has('MerchantPaymentHub.tact')).toBe(true);
        expect(contracts.has('CrossChainBridge.tact')).toBe(true);
    });

    it('uses only the four documented classifications G/T/I/U', () => {
        for (const record of PARAMETER_INVENTORY) {
            expect(['G', 'T', 'I', 'U']).toContain(record.classification);
        }
    });

    it('requires a recommended quorum for every governance-controlled (G) parameter', () => {
        for (const record of PARAMETER_INVENTORY) {
            if (record.classification === 'G') {
                expect(record.recommendedQuorum).toBeGreaterThan(0);
                expect(record.recommendedCooldownHours).toBeGreaterThan(0);
            }
        }
    });

    it('marks every Immutable (I) and User (U) parameter with zero governance overhead', () => {
        for (const record of PARAMETER_INVENTORY) {
            if (record.classification === 'I' || record.classification === 'U') {
                expect(record.recommendedQuorum).toBe(0);
                expect(record.recommendedCooldownHours).toBe(0);
            }
        }
    });
});

describe('canonicalJson', () => {
    it('produces identical output for objects with the same keys regardless of order', () => {
        const a = canonicalJson({ b: 1, a: 2, c: { y: 1, x: 2 } });
        const b = canonicalJson({ c: { x: 2, y: 1 }, a: 2, b: 1 });
        expect(a).toBe(b);
    });

    it('handles arrays element-wise without sorting them', () => {
        expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    });

    it('produces a stable SHA-256 across re-runs', () => {
        const payload = { z: [1, { b: 2, a: 1 }], a: null };
        const json = canonicalJson(payload);
        const h1 = createHash('sha256').update(json).digest('hex');
        const h2 = createHash('sha256').update(canonicalJson(payload)).digest('hex');
        expect(h1).toEqual(h2);
    });
});

describe('parseProposalMarkdown', () => {
    const sample = `# Parameter Change Proposal — sample

**Author NFT ID:** _42_
**Category:** ROADMAP_SIGNAL (0)
**Voting window:** 7 days
**Quorum threshold:** 44
**Off-chain cooldown:** 48 h

## 2. Parameter identification

| Field | Value |
|-------|-------|
| Parameter ID | \`PP-13\` |
| Contract | \`payments/PaymentHub.tact\` |
| Setter message | \`WhitelistCollection\` |
| Executor multi-sig | \`EQDpaymenthubadminmultisigaddress2of3signersrequiredforaction\` |
| Executor signer threshold | \`2-of-3\` |

## 8. TransparencyRegistry logging requirement

- [x] handler embeds proposal_id
- [x] indexer recognises PP-13
- [x] diff reproducible from TransparencyRegistry

## 9. Voting recommendation

FOR

## 11. Appendices

### A. Proposal metadata JSON

\`\`\`json
{"a":1,"b":[1,2,3]}
\`\`\`
`;

    it('extracts all template fields with the documented values', () => {
        const parsed = parseProposalMarkdown(sample);
        expect(parsed.authorNftId).toBe(42);
        expect(parsed.category).toBe(0);
        expect(parsed.votingWindowDays).toBe(7);
        expect(parsed.quorumThreshold).toBe(44);
        expect(parsed.cooldownHours).toBe(48);
        expect(parsed.parameterId).toBe('PP-13');
        expect(parsed.contractFile).toBe('payments/PaymentHub.tact');
        expect(parsed.setterMessage).toBe('WhitelistCollection');
        expect(parsed.executorThresholdM).toBe(2);
        expect(parsed.executorThresholdN).toBe(3);
        expect(parsed.transparencyChecklist?.slice(0, 3)).toEqual([true, true, true]);
        expect(parsed.metadataJson).toContain('"a":1');
    });

    it('detects an unchecked checkbox in §8', () => {
        const broken = sample.replace('- [x] handler embeds proposal_id', '- [ ] handler embeds proposal_id');
        const parsed = parseProposalMarkdown(broken);
        expect(parsed.transparencyChecklist?.[0]).toBe(false);
    });
});

describe('validateProposal', () => {
    it('accepts a well-formed PP-13 proposal', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS } as any, false);
        const errors = issues.filter((i) => i.level === 'error');
        expect(errors).toEqual([]);
    });

    it('rejects an unknown parameter ID', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS, parameterId: 'PP-9999' } as any, false);
        expect(issues.some((i) => i.level === 'error' && /not in the inventory/.test(i.message))).toBe(true);
    });

    it('rejects redeployment-template territory (Immutable parameter)', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS, parameterId: 'PP-12' } as any, false);
        expect(issues.some((i) => /classified I/.test(i.message))).toBe(true);
    });

    it('rejects a 6-day voting window (floor is 7 days)', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS, votingWindowDays: 6 } as any, false);
        expect(issues.some((i) => /below the 7-day floor/.test(i.message))).toBe(true);
    });

    it('rejects a quorum below the PP-13 recommended value of 44', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS, quorumThreshold: 22 } as any, false);
        expect(issues.some((i) => /below the recommended 44/.test(i.message))).toBe(true);
    });

    it('rejects a cooldown below the 48-h protocol floor', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS, cooldownHours: 24 } as any, false);
        expect(issues.some((i) => /below the protocol floor/.test(i.message))).toBe(true);
    });

    it('permits a 24-h cooldown for PP-20 (account-locks emergency lane)', () => {
        const issues = validateProposal({
            ...BASE_PROPOSAL_FIELDS,
            parameterId: 'PP-20',
            quorumThreshold: 22,
            cooldownHours: 24,
            category: 3,
        } as any, false);
        expect(issues.some((i) => i.level === 'error')).toBe(false);
    });

    it('rejects a 1-of-1 executor signer threshold (must be ≥ 2-of-3)', () => {
        const issues = validateProposal({
            ...BASE_PROPOSAL_FIELDS,
            executorThresholdM: 1,
            executorThresholdN: 1,
        } as any, false);
        expect(issues.some((i) => /2-of-3 minimum/.test(i.message))).toBe(true);
    });

    it('rejects a missing TransparencyRegistry checklist', () => {
        const issues = validateProposal({
            ...BASE_PROPOSAL_FIELDS,
            transparencyChecklist: [true, false, true],
        } as any, false);
        expect(issues.some((i) => /three checkboxes/.test(i.message))).toBe(true);
    });

    it('requires Appendix A metadata in --strict mode', () => {
        const issues = validateProposal({ ...BASE_PROPOSAL_FIELDS } as any, true);
        expect(issues.some((i) => /Appendix A/.test(i.message))).toBe(true);
    });
});
