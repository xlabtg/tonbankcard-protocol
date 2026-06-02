/**
 * Regression guard for audit finding CONTRACTS-H3 (#260):
 * "Non-functional FunC stubs (payment-hub, nft_account_resolver) ship in
 * deployable set".
 *
 * These tests assert — without compiling FunC — that:
 *  1. The non-production FunC stubs are excluded from every deployable manifest.
 *  2. The payment-hub stub keeps its 0xDEAD deploy blocker on every message.
 *  3. The NFT resolver stub cannot report an empty/dummy owner as a valid account.
 *  4. The deploy/verify scripts source their contract set from the single
 *     deployable manifest (so the stubs cannot silently re-enter the set).
 *
 * The suite runs in the "Test (Contracts)" CI job (contracts/payment-hub `npm test`).
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Repository root, resolved from contracts/payment-hub/.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const STUB_FILES = [
  'contracts/payments/payment-hub.fc',
  'contracts/nft-resolver/nft_account_resolver.fc',
];

const MANIFEST = 'scripts/deploy/deployable-contracts.ts';
const DEPLOY_SCRIPTS = [
  'scripts/deploy/check-immutability.ts',
  'scripts/deploy/verify.ts',
];

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

/**
 * Extract the body of an exported object/array literal by brace/bracket matching
 * starting at the declaration. Keeps the test independent of formatting.
 */
function extractLiteral(source: string, declaration: string, open: string, close: string): string {
  const declIdx = source.indexOf(declaration);
  expect(declIdx).toBeGreaterThanOrEqual(0);
  // Start after the `=` so a type annotation like `: string[]` is not matched.
  const start = source.indexOf('=', declIdx);
  expect(start).toBeGreaterThanOrEqual(0);
  const openIdx = source.indexOf(open, start);
  expect(openIdx).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  throw new Error(`Unterminated ${open}${close} literal for ${declaration}`);
}

describe('CONTRACTS-H3: non-production FunC stubs excluded from deployable set', () => {
  it('lists both stubs as non-production and keeps them out of the deployable map', () => {
    const manifest = read(MANIFEST);

    const deployable = extractLiteral(manifest, 'const DEPLOYABLE_CONTRACTS', '{', '}');
    for (const stub of STUB_FILES) {
      expect(deployable).not.toContain(stub);
    }

    const nonProduction = extractLiteral(manifest, 'const NON_PRODUCTION_STUBS', '[', ']');
    for (const stub of STUB_FILES) {
      expect(nonProduction).toContain(stub);
    }
  });

  it('keeps the production Tact sources in the deployable map', () => {
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain('contracts/payments/PaymentHub.tact');
    expect(deployable).toContain('contracts/nft-resolver/nft_account_resolver.tact');
  });

  it('deploy/verify scripts source their contract set from the shared manifest', () => {
    for (const script of DEPLOY_SCRIPTS) {
      const source = read(script);
      expect(source).toContain("from './deployable-contracts'");
      // The scripts must not re-introduce the stubs as inline deployable entries.
      for (const stub of STUB_FILES) {
        expect(source).not.toContain(stub);
      }
    }
  });

  it('the stub files still exist on disk as frozen audit reference', () => {
    for (const stub of STUB_FILES) {
      expect(fs.existsSync(path.join(REPO_ROOT, stub))).toBe(true);
    }
  });
});

describe('CONTRACTS-H3: payment-hub.fc keeps the 0xDEAD deploy blocker', () => {
  const source = read('contracts/payments/payment-hub.fc');

  it('defines the DEPLOY_BLOCKER_NOT_PRODUCTION_READY = 0xDEAD constant', () => {
    expect(source).toMatch(/const\s+int\s+DEPLOY_BLOCKER_NOT_PRODUCTION_READY\s*=\s*0xDEAD\s*;/);
  });

  it('throws the deploy blocker as the first statement of recv_internal', () => {
    const recvIdx = source.indexOf('recv_internal');
    expect(recvIdx).toBeGreaterThanOrEqual(0);
    const body = source.slice(recvIdx);
    // The first executable statement (ignoring comments) must be the throw.
    const firstThrow = body.indexOf('throw(DEPLOY_BLOCKER_NOT_PRODUCTION_READY)');
    expect(firstThrow).toBeGreaterThanOrEqual(0);
    // No handler op-code routing can run before the blocker.
    const firstOp = body.indexOf('op == op::');
    expect(firstOp === -1 || firstThrow < firstOp).toBe(true);
  });
});

describe('CONTRACTS-H3: nft_account_resolver.fc rejects empty/dummy owners', () => {
  const source = read('contracts/nft-resolver/nft_account_resolver.fc');

  it('marks the file as a non-production reference stub', () => {
    expect(source).toMatch(/NON-PRODUCTION REFERENCE STUB/i);
  });

  it('guards resolve_owner_with_validation against non-address owners', () => {
    // is_valid must depend on a real-owner check, not just initialization/whitelist.
    expect(source).toContain('owner_addr.slice_bits()');
    expect(source).toMatch(/is_valid\s*=\s*is_initialized\s*&\s*is_whitelisted\s*&\s*owner_present/);
  });
});
