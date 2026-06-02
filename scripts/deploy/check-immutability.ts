#!/usr/bin/env -S npx ts-node
/**
 * TONBANKCARD Protocol — Immutability Verification (B2 mainnet)
 *
 * Three-layer scan that confirms deployed contracts cannot be replaced.
 * Companion document: docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md
 *
 * Layer 1 — Source-level forbidden-pattern scan (in-scope contracts only).
 *   Patterns: adminWithdraw, emergencyDrain, forcedTransfer, set_code(.
 * Layer 2 — Compiled-cell SETCODE opcode scan.
 *   Walks build/disassembly artefacts (.disasm.txt) committed alongside the
 *   mainnet manifest under deployments/mainnet/<timestamp>.immutability-bytecode/.
 * Layer 3 — Persistent-state schema check.
 *   Looks for any "code" / "pending_code" / "next_code" / "code_v2" field
 *   declarations in the source-level contract storage.
 *
 * Usage:
 *   npx ts-node scripts/deploy/check-immutability.ts
 *   npx ts-node scripts/deploy/check-immutability.ts --disasm-dir deployments/mainnet/2026-06-15T10-00-00Z.immutability-bytecode
 *
 * Exit code 0 — all layers pass.
 * Exit code 1 — any layer flags a forbidden artefact (deployment MUST abort).
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEPLOYABLE_CONTRACTS } from './deployable-contracts';

interface LayerResult {
  layer: string;
  passed: boolean;
  details: string[];
}

// In-scope B2 contracts (mirrors DEPLOYMENT_PLAN.md §3). Sourced from the single
// deployable-contract manifest so non-production FunC stubs (CONTRACTS-H3, #260)
// can never re-enter the scan set.
const IN_SCOPE_CONTRACTS: Record<string, string[]> = DEPLOYABLE_CONTRACTS;

// Layer 1: forbidden source-level patterns.
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /adminWithdraw/i, label: 'admin withdrawal' },
  { pattern: /emergencyDrain/i, label: 'emergency drain' },
  { pattern: /forcedTransfer/i, label: 'forced transfer' },
  { pattern: /set_code\s*\(/i, label: 'set_code() bytecode replacement' },
];

// Layer 3: forbidden state field declarations.
// Match Tact/FunC patterns where a contract stores an upgrade target.
const FORBIDDEN_STATE_FIELDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bpending_code\b/i, label: 'pending_code state field' },
  { pattern: /\bnext_code\b/i, label: 'next_code state field' },
  { pattern: /\bcode_v2\b/i, label: 'code_v2 state field' },
  // Note: a bare `code` identifier is benign in many TON contracts; we look
  // only for clearly upgrade-shaped names.
];

function scanSource(): LayerResult {
  const details: string[] = [];
  let passed = true;

  for (const [contract, files] of Object.entries(IN_SCOPE_CONTRACTS)) {
    const existing = files.filter(f => fs.existsSync(f));
    if (existing.length === 0) {
      details.push(`SKIP ${contract}: no source files exist on disk (${files.join(', ')})`);
      continue;
    }

    for (const file of existing) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          details.push(`FAIL ${contract} (${file}): forbidden — ${label}`);
          passed = false;
        }
      }
    }
  }

  if (passed && details.length === 0) {
    details.push('No forbidden patterns found in any in-scope source file.');
  }

  return { layer: 'Layer 1 — source-level forbidden patterns', passed, details };
}

function scanDisassembly(disasmDir: string | undefined): LayerResult {
  const details: string[] = [];

  if (!disasmDir) {
    details.push(
      'SKIP — no --disasm-dir provided. Run `npx blueprint build` and pass ' +
        'the disassembly directory (e.g. ' +
        'deployments/mainnet/<timestamp>.immutability-bytecode) after mainnet ' +
        'compilation completes. Source-level scan (Layer 1) still gates this run.',
    );
    return { layer: 'Layer 2 — compiled-cell SETCODE scan', passed: true, details };
  }

  if (!fs.existsSync(disasmDir)) {
    details.push(`FAIL — disassembly directory does not exist: ${disasmDir}`);
    return { layer: 'Layer 2 — compiled-cell SETCODE scan', passed: false, details };
  }

  const files = fs
    .readdirSync(disasmDir)
    .filter(f => f.endsWith('.disasm.txt') || f.endsWith('.disasm') || f.endsWith('.asm'));

  if (files.length === 0) {
    details.push(`FAIL — no disassembly files (*.disasm.txt) found in ${disasmDir}`);
    return { layer: 'Layer 2 — compiled-cell SETCODE scan', passed: false, details };
  }

  let passed = true;
  for (const f of files) {
    const fullPath = path.join(disasmDir, f);
    const content = fs.readFileSync(fullPath, 'utf8');
    const match = content.match(/\bSETCODE\b/);
    if (match) {
      const lineNumber =
        content.substring(0, match.index ?? 0).split('\n').length;
      details.push(`FAIL ${f}: SETCODE opcode found at line ${lineNumber}`);
      passed = false;
    } else {
      details.push(`PASS ${f}: no SETCODE opcode`);
    }
  }

  return { layer: 'Layer 2 — compiled-cell SETCODE scan', passed, details };
}

function scanStateSchema(): LayerResult {
  const details: string[] = [];
  let passed = true;

  for (const [contract, files] of Object.entries(IN_SCOPE_CONTRACTS)) {
    const existing = files.filter(f => fs.existsSync(f));
    for (const file of existing) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { pattern, label } of FORBIDDEN_STATE_FIELDS) {
        if (pattern.test(source)) {
          details.push(`FAIL ${contract} (${file}): forbidden — ${label}`);
          passed = false;
        }
      }
    }
  }

  if (passed && details.length === 0) {
    details.push(
      'No upgrade-shaped state fields (pending_code / next_code / code_v2) found.',
    );
  }

  return { layer: 'Layer 3 — persistent-state schema', passed, details };
}

function printLayer(result: LayerResult): void {
  const icon = result.passed ? '✅' : '❌';
  console.log(`\n${icon} ${result.layer}`);
  console.log('─'.repeat(result.layer.length + 4));
  for (const line of result.details) {
    const prefix = line.startsWith('FAIL')
      ? '  ❌'
      : line.startsWith('SKIP')
        ? '  ⏭️ '
        : line.startsWith('PASS')
          ? '  ✅'
          : '  •';
    console.log(`${prefix} ${line}`);
  }
}

function main(): void {
  console.log('🔒 TONBANKCARD Protocol — Immutability Verification (B2 mainnet)');
  console.log('================================================================');
  console.log(
    'Companion doc: docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md',
  );

  const args = process.argv.slice(2);
  let disasmDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--disasm-dir') {
      disasmDir = args[++i];
    }
  }

  const layer1 = scanSource();
  const layer2 = scanDisassembly(disasmDir);
  const layer3 = scanStateSchema();

  printLayer(layer1);
  printLayer(layer2);
  printLayer(layer3);

  const allPassed = layer1.passed && layer2.passed && layer3.passed;

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('✅ Immutability gates PASSED — deployment may proceed.');
  } else {
    console.log('❌ Immutability gates FAILED — deployment MUST abort.');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main();
