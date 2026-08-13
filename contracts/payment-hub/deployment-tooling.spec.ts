/**
 * Regression coverage for CHECK423-H1.
 *
 * The canonical deployment entry point must never turn a requested live
 * deployment into a dry-run manifest, and incomplete on-chain verification
 * must fail closed instead of producing `allPassed: true`.
 */

import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createDeploymentManifest,
  type DeploymentConfig,
} from '../../scripts/deploy/deploy';
import { verifyFromManifest } from '../../scripts/deploy/verify';

const LIVE_CONFIG: DeploymentConfig = {
  network: 'mainnet',
  adminAddress: 'EQAdmin',
  riskAuthority: 'EQRisk',
  lendingAdapter: null,
  rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
  dryRun: false,
  confirm: true,
};

describe('CHECK423-H1: production deployment tooling fails closed', () => {
  it('refuses a live deployment until a real Blueprint implementation exists', () => {
    expect(() => createDeploymentManifest(LIVE_CONFIG)).toThrow(
      /live deployment is not implemented/i,
    );
  });

  it('never passes a manifest without real on-chain verification', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check423-verify-'));
    const manifestPath = path.join(tempDir, 'manifest.json');

    try {
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          network: 'mainnet',
          timestamp: '2026-08-13T00:00:00.000Z',
          commit: 'synthetic-check423',
          contracts: {
            AccountLocks: {
              address: 'EQSyntheticAddress',
              codeHash: 'synthetic-code-hash',
            },
          },
        }),
      );

      const report = verifyFromManifest(manifestPath);

      expect(report.allPassed).toBe(false);
      expect(report.results).toHaveLength(1);
      expect(report.results[0]).toMatchObject({
        codeHashMatch: false,
        stateValid: false,
        adminAddressMatch: false,
      });
      expect(report.results[0].errors.join(' ')).toMatch(
        /on-chain verification is not implemented/i,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
