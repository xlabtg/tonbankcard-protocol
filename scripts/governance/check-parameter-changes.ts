/**
 * Protocol Parameter Change Proposal Validator (Issue #133, E2)
 *
 * Purpose: Validate that parameter-change proposals follow the template in
 *   docs/governance/PARAMETER_CHANGES.md and the inventory in
 *   docs/governance/PARAMETERS.md §8.
 * Type: Off-chain utility (no fund custody, no execution, no contract calls).
 *
 * Usage:
 *   npx ts-node scripts/governance/check-parameter-changes.ts --classify PP-13
 *   npx ts-node scripts/governance/check-parameter-changes.ts --proposal docs/governance/proposals/<slug>.md --strict
 *   npx ts-node scripts/governance/check-parameter-changes.ts --audit-manifest docs/deployments/B2-mainnet/manifest.json
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — usage error
 *   2 — validation failure (one or more checks failed)
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ==================== TYPES ====================

type ParameterClass = 'G' | 'T' | 'I' | 'U';

interface ParameterRecord {
  id: string;                       // e.g. "PP-13"
  contract: string;                 // e.g. "payments/PaymentHub.tact"
  parameter: string;                // e.g. "whitelisted_collections"
  classification: ParameterClass;
  recommendedQuorum: number;        // 0 means "default applies"
  recommendedCooldownHours: number; // 0 means "no cooldown applies (immutable)"
  proposalCategory?: number;        // ProposalRegistry category enum 0..5
}

interface ParameterChangeProposal {
  proposalId?: string;
  authorNftId: number;
  category: number;
  votingWindowDays: number;
  quorumThreshold: number;
  cooldownHours: number;
  parameterId: string;
  contractFile: string;
  setterMessage: string;
  executorMultisig: string;
  executorThresholdM: number;
  executorThresholdN: number;
  transparencyChecklist: boolean[]; // three booleans for §8 of the template
  metadataJson?: string;            // canonical JSON from Appendix A
}

// ==================== STATIC INVENTORY ====================
// Mirrors docs/governance/PARAMETERS.md §§ 8.2–8.5 and §9.
// CI (this file) reads from here; any edit to PARAMETERS.md must be reflected
// here in the same PR. Drift is itself a CI-blocking defect.

const PARAMETER_INVENTORY: ParameterRecord[] = [
  // §8.2 Governance & transparency
  { id: 'PP-1',  contract: 'governance/ProposalRegistry.tact',  parameter: 'DEFAULT_VOTING_DURATION', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-2',  contract: 'governance/ProposalRegistry.tact',  parameter: 'DEFAULT_QUORUM_THRESHOLD', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-3',  contract: 'governance/ProposalRegistry.tact',  parameter: 'DIAMONDS_TOTAL_SUPPLY', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-4',  contract: 'governance/ProposalRegistry.tact',  parameter: 'DIAMONDS_COLLECTION', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-5',  contract: 'governance/ProposalRegistry.tact',  parameter: 'category enum 0..5', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-6',  contract: 'governance/ProposalRegistry.tact',  parameter: 'vote enum 0..2', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-7',  contract: 'governance/SnapshotVerifier.tact',  parameter: 'proposal_registry', classification: 'T', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-8',  contract: 'governance/TransparencyRegistry.tact', parameter: 'snapshot pointer', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 48, proposalCategory: 3 },
  { id: 'PP-9',  contract: 'governance/TransparencyRegistry.tact', parameter: 'quorum_threshold (init-only)', classification: 'I', recommendedQuorum: 0, recommendedCooldownHours: 0 },
  { id: 'PP-10', contract: 'governance/TransparencyRegistry.tact', parameter: 'counters', classification: 'U', recommendedQuorum: 0, recommendedCooldownHours: 0 },

  // §8.3 Payment contracts
  { id: 'PP-11', contract: 'payments/PaymentHub.tact',          parameter: 'admin', classification: 'T', recommendedQuorum: 0,  recommendedCooldownHours: 7 * 24 },
  { id: 'PP-12', contract: 'payments/PaymentHub.tact',          parameter: 'ADMIN_TRANSFER_DELAY', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-13', contract: 'payments/PaymentHub.tact',          parameter: 'whitelisted_collections', classification: 'G', recommendedQuorum: 44, recommendedCooldownHours: 48, proposalCategory: 0 },
  { id: 'PP-14', contract: 'payments/PaymentHub.tact',          parameter: 'accounts (admin init)', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 48, proposalCategory: 0 },
  { id: 'PP-15', contract: 'MerchantPaymentHub.tact',           parameter: 'admin', classification: 'T', recommendedQuorum: 0,  recommendedCooldownHours: 7 * 24 },
  { id: 'PP-16', contract: 'MerchantPaymentHub.tact',           parameter: 'MERCHANT_ADMIN_TRANSFER_DELAY', classification: 'I', recommendedQuorum: 0, recommendedCooldownHours: 0 },
  { id: 'PP-17', contract: 'MerchantPaymentHub.tact',           parameter: 'whitelisted_collections', classification: 'G', recommendedQuorum: 44, recommendedCooldownHours: 48, proposalCategory: 0 },
  { id: 'PP-18', contract: 'MerchantPaymentHub.tact',           parameter: 'account_states', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 48, proposalCategory: 1 },
  { id: 'PP-19', contract: 'MerchantPaymentHub.tact',           parameter: 'account_balances (initial)', classification: 'G', recommendedQuorum: 44, recommendedCooldownHours: 48, proposalCategory: 1 },
  { id: 'PP-20', contract: 'MerchantPaymentHub.tact',           parameter: 'account_locks', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 24, proposalCategory: 3 },

  // §8.4 Recurring / multi-sig / bridge
  { id: 'PP-21', contract: 'RecurringPayments.tact',            parameter: 'MIN_PERIOD_SECONDS', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-22', contract: 'RecurringPayments.tact',            parameter: 'mandates', classification: 'U', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-23', contract: 'MultiSigCard.tact',                 parameter: 'multisig_configs', classification: 'U', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-24', contract: 'MultiSigCard.tact',                 parameter: 'MAX_SIGNERS', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-25', contract: 'CrossChainBridge.tact',             parameter: 'bridge_intents', classification: 'U', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-26', contract: 'CrossChainBridge.tact',             parameter: 'authorized_relayers', classification: 'G', recommendedQuorum: 44, recommendedCooldownHours: 48, proposalCategory: 1 },
  { id: 'PP-27', contract: 'CrossChainBridge.tact',             parameter: 'CHAIN_* enum', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-28', contract: 'CrossChainBridge.tact',             parameter: 'MAX_SUPPORTED_CHAIN', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },

  // §8.5 Signaling / lending / lookup
  { id: 'PP-29', contract: 'CollateralSignal.tact',             parameter: 'collateral_signals', classification: 'U', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-30', contract: 'LendingProtocolCoordinator.tact',   parameter: 'lending_intents', classification: 'U', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-31', contract: 'collateral-lookup/PublicCollateralLookup.tact', parameter: 'owner', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-32', contract: 'collateral-lookup/PublicCollateralLookup.tact', parameter: 'accountLocksContract', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 48, proposalCategory: 1 },
  { id: 'PP-33', contract: 'collateral-lookup/PublicCollateralLookup.tact', parameter: 'VERSION', classification: 'I', recommendedQuorum: 0,  recommendedCooldownHours: 0 },
  { id: 'PP-34', contract: 'nft-resolver/nft_account_resolver.tact',       parameter: 'payment_hub', classification: 'G', recommendedQuorum: 22, recommendedCooldownHours: 48, proposalCategory: 1 },
  { id: 'PP-35', contract: 'nft-resolver/nft_account_resolver.tact',       parameter: 'COLLECTION_7777/8888', classification: 'I', recommendedQuorum: 0, recommendedCooldownHours: 0 },
];

const DEFAULT_QUORUM = 22;
const MIN_COOLDOWN_HOURS = 48;
const MIN_EMERGENCY_COOLDOWN_HOURS = 24; // only permitted for PP-20 per PARAMETERS.md §9
const MIN_EXECUTOR_M = 2;
const MIN_EXECUTOR_N = 3;
const MIN_VOTING_WINDOW_DAYS = 7;

// ==================== CLASSIFY MODE ====================

function classify(parameterId: string): number {
  const record = PARAMETER_INVENTORY.find(p => p.id === parameterId);
  if (!record) {
    console.error(`error: parameter ${parameterId} is not in the inventory (docs/governance/PARAMETERS.md §8)`);
    return 2;
  }
  const recommendedQuorum = record.recommendedQuorum > 0 ? record.recommendedQuorum : DEFAULT_QUORUM;
  const cooldown = record.recommendedCooldownHours > 0 ? record.recommendedCooldownHours : 0;
  console.log(JSON.stringify({
    parameter_id: record.id,
    contract: record.contract,
    parameter: record.parameter,
    classification: record.classification,
    recommended_quorum: recommendedQuorum,
    recommended_cooldown_hours: cooldown,
    proposal_category: record.proposalCategory ?? null,
    requires_governance_proposal: record.classification === 'G' || record.classification === 'T',
  }, null, 2));
  return 0;
}

// ==================== PROPOSAL MODE ====================

const FIELD_PATTERNS: Array<[keyof ParameterChangeProposal, RegExp]> = [
  ['authorNftId', /\*\*Author NFT ID:\*\*\s*_?<?([0-9]+)>?_?/i],
  ['category', /\*\*Category:\*\*\s*[^(]*\((\d+)\)/i],
  ['quorumThreshold', /\*\*Quorum threshold:\*\*\s*_?<?(\d+)>?_?/i],
  ['cooldownHours', /\*\*Off-chain cooldown:\*\*\s*_?<?(\d+)\s*h/i],
  ['parameterId', /Parameter ID\s*\|\s*`?(PP-\d+)`?/i],
  ['contractFile', /Contract\s*\|\s*`?<?([^`>\n|]+)>?`?/i],
  ['setterMessage', /Setter message\s*\|\s*`?<?([^`>\n|]+)>?`?/i],
  ['executorMultisig', /Executor multi-sig\s*\|\s*`?<?(EQ[^`>\n|]+)>?`?/i],
];

function parseProposalMarkdown(text: string): Partial<ParameterChangeProposal> {
  const out: Partial<ParameterChangeProposal> = {};
  for (const [field, regex] of FIELD_PATTERNS) {
    const m = text.match(regex);
    if (m) {
      const value = m[1].trim();
      if (field === 'authorNftId' || field === 'category' || field === 'quorumThreshold' || field === 'cooldownHours') {
        (out as Record<string, number | string>)[field] = parseInt(value, 10);
      } else {
        (out as Record<string, number | string>)[field] = value;
      }
    }
  }

  // Voting window in days (line "Voting window: ... days")
  const vw = text.match(/\*\*Voting window:\*\*\s*[^_]*_?<?(\d+)\s*days?/i);
  if (vw) out.votingWindowDays = parseInt(vw[1], 10);

  // Executor threshold "m-of-n"
  const th = text.match(/Executor signer threshold\s*\|\s*`?(\d+)-of-(\d+)`?/i);
  if (th) {
    out.executorThresholdM = parseInt(th[1], 10);
    out.executorThresholdN = parseInt(th[2], 10);
  }

  // Transparency checklist — three "- [x]" lines in §8 of the template
  const sectionEight = text.split(/##\s*8\./)[1]?.split(/##\s*9\./)[0] ?? '';
  const checks = Array.from(sectionEight.matchAll(/^- \[([ xX])\]/gm)).map(m => m[1].toLowerCase() === 'x');
  out.transparencyChecklist = checks;

  // Metadata JSON in Appendix A — a fenced ```json block immediately after a header
  // containing "Proposal metadata JSON".
  const metaIdx = text.indexOf('Proposal metadata JSON');
  if (metaIdx !== -1) {
    const after = text.slice(metaIdx);
    const fence = after.match(/```json\s*\n([\s\S]*?)\n```/);
    if (fence) out.metadataJson = fence[1];
  }

  return out;
}

interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

function validateProposal(proposal: ParameterChangeProposal, strict: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const record = PARAMETER_INVENTORY.find(p => p.id === proposal.parameterId);
  if (!record) {
    issues.push({ level: 'error', message: `Parameter ${proposal.parameterId} is not in the inventory (docs/governance/PARAMETERS.md §8). Update PARAMETERS.md before submitting.` });
    return issues;
  }

  if (record.classification !== 'G' && record.classification !== 'T') {
    issues.push({ level: 'error', message: `Parameter ${proposal.parameterId} is classified ${record.classification}; parameter-change proposals only apply to G or T parameters. Use the redeployment template instead.` });
  }

  if (proposal.votingWindowDays < MIN_VOTING_WINDOW_DAYS) {
    issues.push({ level: 'error', message: `Voting window ${proposal.votingWindowDays} days is below the 7-day floor (PARAMETERS.md §3, P-3).` });
  }

  const requiredQuorum = record.recommendedQuorum > 0 ? record.recommendedQuorum : DEFAULT_QUORUM;
  if (proposal.quorumThreshold < requiredQuorum) {
    issues.push({ level: 'error', message: `Quorum ${proposal.quorumThreshold} is below the recommended ${requiredQuorum} for ${proposal.parameterId} (PARAMETERS.md §9).` });
  }

  const requiredCooldown = record.recommendedCooldownHours > 0 ? record.recommendedCooldownHours : MIN_COOLDOWN_HOURS;
  const cooldownFloor = (proposal.parameterId === 'PP-20') ? MIN_EMERGENCY_COOLDOWN_HOURS : MIN_COOLDOWN_HOURS;
  if (proposal.cooldownHours < cooldownFloor) {
    issues.push({ level: 'error', message: `Cooldown ${proposal.cooldownHours} h is below the protocol floor (${cooldownFloor} h; PARAMETERS.md §5/§9).` });
  }
  if (proposal.cooldownHours < requiredCooldown) {
    issues.push({ level: 'warning', message: `Cooldown ${proposal.cooldownHours} h is below the recommended ${requiredCooldown} h for ${proposal.parameterId} (PARAMETERS.md §9).` });
  }

  if (record.proposalCategory !== undefined && proposal.category !== record.proposalCategory) {
    issues.push({ level: 'warning', message: `Category ${proposal.category} differs from the recommended category ${record.proposalCategory} for ${proposal.parameterId}.` });
  }

  if (proposal.authorNftId < 1 || proposal.authorNftId > 222) {
    issues.push({ level: 'error', message: `Author NFT ID ${proposal.authorNftId} is out of range (must be 1..222).` });
  }

  if (proposal.executorThresholdM < MIN_EXECUTOR_M || proposal.executorThresholdN < MIN_EXECUTOR_N || proposal.executorThresholdM > proposal.executorThresholdN) {
    issues.push({ level: 'error', message: `Executor multi-sig threshold ${proposal.executorThresholdM}-of-${proposal.executorThresholdN} is below the 2-of-3 minimum (PARAMETERS.md §10).` });
  }

  if (!proposal.executorMultisig || !proposal.executorMultisig.startsWith('EQ')) {
    issues.push({ level: 'error', message: `Executor multi-sig address must be a base64-url TON address starting with "EQ".` });
  }

  if (!proposal.transparencyChecklist || proposal.transparencyChecklist.length < 3 || !proposal.transparencyChecklist.slice(0, 3).every(Boolean)) {
    issues.push({ level: 'error', message: `All three checkboxes in §8 (TransparencyRegistry logging requirement) must be checked.` });
  }

  if (strict && !proposal.metadataJson) {
    issues.push({ level: 'error', message: `Appendix A (canonical metadata JSON) is missing or unparseable. The on-chain metadata_hash anchors this JSON.` });
  }

  if (proposal.metadataJson) {
    try {
      const parsed = JSON.parse(proposal.metadataJson);
      const canonical = canonicalJson(parsed);
      const hash = createHash('sha256').update(canonical).digest('hex');
      console.log(`computed metadata_hash (sha-256 of canonical JSON): ${hash}`);
    } catch (e) {
      issues.push({ level: 'error', message: `Appendix A metadata JSON is invalid: ${(e as Error).message}` });
    }
  }

  return issues;
}

function canonicalJson(value: unknown): string {
  // RFC 8785-ish JSON Canonicalisation Scheme (subset): sorted keys, no insignificant whitespace.
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k])).join(',') + '}';
}

function validateProposalFile(filename: string, strict: boolean): number {
  const abs = resolve(filename);
  if (!existsSync(abs)) {
    console.error(`error: proposal file not found: ${abs}`);
    return 1;
  }
  const text = readFileSync(abs, 'utf8');
  const parsed = parseProposalMarkdown(text) as ParameterChangeProposal;

  if (!parsed.parameterId) {
    console.error(`error: could not find a Parameter ID (PP-<n>) in ${filename}. Use the template in docs/governance/PARAMETER_CHANGES.md §2.`);
    return 2;
  }

  const issues = validateProposal(parsed, strict);
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  for (const i of issues) {
    const prefix = i.level === 'error' ? 'ERROR' : 'WARN ';
    console.error(`${prefix}: ${i.message}`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`ok: ${filename} — ${parsed.parameterId} (${parsed.executorThresholdM}-of-${parsed.executorThresholdN}, quorum ${parsed.quorumThreshold}, cooldown ${parsed.cooldownHours} h)`);
  } else {
    console.log(`summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
  }
  return errors.length === 0 ? 0 : 2;
}

// ==================== MANIFEST AUDIT MODE ====================

interface DeploymentManifest {
  network: string;
  contracts: Array<{
    name: string;
    address: string;
    admin: {
      kind: 'eoa' | 'multisig' | 'governance';
      address: string;
      threshold?: { m: number; n: number };
      signers?: string[];
    };
  }>;
}

function auditManifest(filename: string): number {
  const abs = resolve(filename);
  if (!existsSync(abs)) {
    console.error(`error: manifest file not found: ${abs}`);
    return 1;
  }
  let manifest: DeploymentManifest;
  try {
    manifest = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error(`error: manifest is not valid JSON: ${(e as Error).message}`);
    return 1;
  }
  let problems = 0;
  for (const c of manifest.contracts ?? []) {
    if (!c.admin) {
      console.error(`ERROR: ${c.name} (${c.address}) has no admin field; refusing to publish.`);
      problems++;
      continue;
    }
    if (c.admin.kind === 'eoa') {
      console.error(`ERROR: ${c.name} (${c.address}) admin is an EOA (${c.admin.address}); single-key parameter control is forbidden (PARAMETERS.md §10).`);
      problems++;
      continue;
    }
    if (c.admin.kind === 'multisig') {
      const t = c.admin.threshold;
      if (!t || t.m < MIN_EXECUTOR_M || t.n < MIN_EXECUTOR_N || t.m > t.n) {
        console.error(`ERROR: ${c.name} multi-sig threshold ${t?.m}-of-${t?.n} is below the 2-of-3 minimum (PARAMETERS.md §10).`);
        problems++;
        continue;
      }
      if (!c.admin.signers || c.admin.signers.length !== t.n) {
        console.error(`ERROR: ${c.name} multi-sig signer list length does not match n=${t.n}.`);
        problems++;
        continue;
      }
    }
    console.log(`ok: ${c.name} — admin is ${c.admin.kind} ${c.admin.address}${c.admin.threshold ? ` (${c.admin.threshold.m}-of-${c.admin.threshold.n})` : ''}`);
  }
  if (problems > 0) {
    console.log(`summary: ${problems} problem(s) — manifest must not be published.`);
    return 2;
  }
  console.log(`summary: all admin fields satisfy the single-key elimination policy.`);
  return 0;
}

// ==================== ENTRY POINT ====================

function usage(): number {
  console.error(`usage:
  check-parameter-changes.ts --classify PP-<n>
  check-parameter-changes.ts --proposal <path/to/proposal.md> [--strict]
  check-parameter-changes.ts --audit-manifest <path/to/manifest.json>`);
  return 1;
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0) return usage();

  if (args[0] === '--classify' && args[1]) return classify(args[1]);
  if (args[0] === '--audit-manifest' && args[1]) return auditManifest(args[1]);
  if (args[0] === '--proposal' && args[1]) {
    const strict = args.includes('--strict');
    return validateProposalFile(args[1], strict);
  }
  if (args[0] === '--list') {
    for (const r of PARAMETER_INVENTORY) {
      console.log(`${r.id}\t${r.classification}\t${r.contract}\t${r.parameter}`);
    }
    return 0;
  }
  return usage();
}

if (require.main === module) {
  process.exit(main(process.argv));
}

export {
  PARAMETER_INVENTORY,
  parseProposalMarkdown,
  validateProposal,
  canonicalJson,
  classify,
  auditManifest,
};
