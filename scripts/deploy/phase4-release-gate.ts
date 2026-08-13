import { Cell } from '@ton/core';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const PHASE4_CONTRACTS = [
  'RecurringPayments',
  'MultiSigCard',
  'CrossChainBridge',
  'LendingProtocolCoordinator',
] as const;

const PHASE4_CONTRACT_SET = new Set<string>(PHASE4_CONTRACTS);

export const PHASE4_TEST_ONLY_MESSAGES: Record<string, number> = {
  RegisterNFTOwnerRecurring: messageOpcode('RegisterNFTOwnerRecurring'),
  RegisterNFTOwnerMultiSig: messageOpcode('RegisterNFTOwnerMultiSig'),
  RegisterNFTOwnerBridge: messageOpcode('RegisterNFTOwnerBridge'),
  RegisterRelayer: messageOpcode('RegisterRelayer'),
  RegisterNFTOwnerLending: 0x7e8764ef,
};

export function messageOpcode(name: string): number {
  return createHash('sha256').update(name).digest().readUInt32BE(0);
}

function cellContainsOpcode(cell: Cell, opcode: number): boolean {
  const bits = cell.bits.toString();
  const needle = opcode.toString(2).padStart(32, '0');
  if (bits.includes(needle)) return true;
  return cell.refs.some(ref => cellContainsOpcode(ref, opcode));
}

export function scanPhase4Artifact(abiPath: string, codeBocPath: string): string[] {
  const failures: string[] = [];
  const abi = fs.readFileSync(abiPath, 'utf8');
  for (const name of Object.keys(PHASE4_TEST_ONLY_MESSAGES)) {
    if (abi.includes(`"${name}"`)) failures.push(`ABI contains test-only message ${name}`);
  }
  const roots = Cell.fromBoc(fs.readFileSync(codeBocPath));
  for (const [name, opcode] of Object.entries(PHASE4_TEST_ONLY_MESSAGES)) {
    if (roots.some(root => cellContainsOpcode(root, opcode))) {
      failures.push(`bytecode contains test-only opcode ${name} (0x${opcode.toString(16)})`);
    }
  }
  return failures;
}

export function a2VerdictAllowsMainnet(status: string): boolean {
  const match = status.match(/^\*\*Gating verdict:\*\*\s*(.+)$/m);
  if (!match) return false;
  return /^(?:✅\s*)?READY(?: WITH ACCEPTED RISKS)?(?:\s|$)/.test(match[1].trim());
}

export function assertPhase4MainnetAllowed(
  network: 'testnet' | 'mainnet',
  contractNames: string[],
  statusPath = path.resolve(__dirname, '../../docs/security/audits/A2-phase4-contracts/STATUS.md'),
): void {
  if (network !== 'mainnet' || !contractNames.some(name => PHASE4_CONTRACT_SET.has(name))) return;
  if (!a2VerdictAllowsMainnet(fs.readFileSync(statusPath, 'utf8'))) {
    throw new Error('Phase 4 mainnet artifacts are blocked until canonical A2 verdict is READY');
  }
}
