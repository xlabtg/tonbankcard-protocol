/** Regression coverage for CHECK423-H1 deployment integrity. */

import { describe, expect, it, jest } from '@jest/globals';
import { beginCell, Cell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { AccountStateMachine } from './dist/account-state_AccountStateMachine';
import {
  buildUnsignedDeployment,
  validateDeploymentManifest,
  type DeploymentManifest,
} from '../../scripts/deploy/deploy';
import {
  verifyManifest,
  type ChainStateProvider,
} from '../../scripts/deploy/verify';

const ADMIN = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

function cell(seed: number): Cell {
  return beginCell().storeUint(seed, 32).endCell();
}

function liveManifest(code = cell(1), data = cell(2)): DeploymentManifest {
  const prepared = buildUnsignedDeployment('PaymentHub', code, data, 0);
  return {
    version: '1.0.0',
    manifestType: 'tonbankcard.deploy.manifest',
    artefactType: 'live',
    network: 'mainnet',
    timestamp: '2026-08-13T00:00:00.000Z',
    commit: 'a'.repeat(40),
    configuration: { adminAddress: ADMIN, riskAuthority: ADMIN, lendingAdapter: null },
    verificationBlock: 123,
    contracts: {
      PaymentHub: {
        address: prepared.address,
        codeHash: prepared.codeHash,
        dataHash: prepared.dataHash,
        stateInitBoc: prepared.stateInitBoc,
        unsignedStateInitBoc: prepared.unsignedStateInitBoc,
        workchain: 0,
        initParameters: { admin: ADMIN },
      },
    },
  };
}

describe('CHECK423-H1: unsigned deployment artefacts', () => {
  it('builds a deterministic address and unsigned state-init BOC', () => {
    const first = buildUnsignedDeployment('AccountLocks', cell(1), cell(2), 0);
    const second = buildUnsignedDeployment('AccountLocks', cell(1), cell(2), 0);

    expect(first).toEqual(second);
    expect(Cell.fromBase64(first.stateInitBoc).hash()).toHaveLength(32);
    expect(Cell.fromBase64(first.unsignedStateInitBoc).hash()).toHaveLength(32);
    expect(first.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.dataHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects dry-run markers and malformed live manifests', () => {
    const manifest = liveManifest();
    manifest.contracts.PaymentHub.address = '[DRY RUN] fake';

    expect(() => validateDeploymentManifest(manifest, 'live')).toThrow(/address/i);
    expect(() => validateDeploymentManifest({ ...liveManifest(), artefactType: 'dry-run' }, 'live'))
      .toThrow(/artefactType/i);
  });

  it('does not allow a prepared unsigned artefact to pass as live', () => {
    const prepared = { ...liveManifest(), artefactType: 'prepared' as const, verificationBlock: null };
    expect(() => validateDeploymentManifest(prepared, 'prepared')).not.toThrow();
    expect(() => validateDeploymentManifest(prepared, 'live')).toThrow(/artefactType/i);
  });
});

describe('CHECK423-H1: block-pinned on-chain verification', () => {
  it('matches code and init state obtained from TON Sandbox', async () => {
    const blockchain = await Blockchain.create();
    const owner = await blockchain.treasury('deployment-owner');
    const contract = blockchain.openContract(await AccountStateMachine.fromInit(owner.address));
    const sender = await blockchain.treasury('deployment-sender');
    await contract.send(sender.getSender(), { value: 50_000_000n }, { $$type: 'Deploy', queryId: 0n });
    const state = await blockchain.getContract(contract.address);
    if (state.accountState?.type !== 'active') throw new Error('sandbox contract is not active');
    const code = state.accountState.state.code;
    const data = state.accountState.state.data;
    if (!code || !data) throw new Error('sandbox active state has no code/data');
    const prepared = buildUnsignedDeployment('AccountStateMachine', code, data, 0);
    const manifest = liveManifest(code, data);
    manifest.contracts = {
      AccountStateMachine: {
        ...prepared,
        initParameters: {},
      },
    };
    const provider: ChainStateProvider = {
      getContractState: async () => ({ block: 123, state: 'active', code, data, adminAddress: null }),
    };

    const report = await verifyManifest(manifest, 'sandbox.json', provider);
    expect(report.allPassed).toBe(true);
  });

  it('passes when active chain code/data and admin match the manifest', async () => {
    const code = cell(1);
    const data = cell(2);
    const provider: ChainStateProvider = {
      getContractState: jest.fn(async () => ({
        block: 123,
        state: 'active' as const,
        code,
        data,
        adminAddress: ADMIN,
      })),
    };

    const report = await verifyManifest(liveManifest(code, data), 'manifest.json', provider);

    expect(report.allPassed).toBe(true);
    expect(report.results[0]).toMatchObject({
      codeHashMatch: true,
      stateValid: true,
      adminAddressMatch: true,
    });
    expect(provider.getContractState).toHaveBeenCalledWith(
      expect.anything(),
      123,
      'PaymentHub',
    );
  });

  it('fails closed for a code mismatch', async () => {
    const manifest = liveManifest();
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 123,
        state: 'active',
        code: cell(99),
        data: cell(2),
        adminAddress: ADMIN,
      }),
    };

    const report = await verifyManifest(manifest, 'manifest.json', provider);

    expect(report.allPassed).toBe(false);
    expect(report.results[0].codeHashMatch).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/code hash mismatch/i);
  });

  it('rejects a manifest hash that does not match the compiled StateInit', async () => {
    const manifest = liveManifest();
    manifest.contracts.PaymentHub.codeHash = 'f'.repeat(64);
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 123, state: 'active', code: cell(1), data: cell(2), adminAddress: ADMIN,
      }),
    };

    const report = await verifyManifest(manifest, 'manifest.json', provider);
    expect(report.allPassed).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/does not match stateInitBoc/i);
  });

  it('fails closed when the endpoint returns another block', async () => {
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 124,
        state: 'active',
        code: cell(1),
        data: cell(2),
        adminAddress: ADMIN,
      }),
    };

    const report = await verifyManifest(liveManifest(), 'manifest.json', provider);

    expect(report.allPassed).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/requested block 123/i);
  });

  it('fails closed when verificationBlock precedes deployBlock', async () => {
    const manifest = liveManifest();
    manifest.contracts.PaymentHub.deployBlock = 124;
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 123, state: 'active', code: cell(1), data: cell(2), adminAddress: ADMIN,
      }),
    };

    const report = await verifyManifest(manifest, 'manifest.json', provider);
    expect(report.allPassed).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/precedes deploy block 124/i);
  });
});
