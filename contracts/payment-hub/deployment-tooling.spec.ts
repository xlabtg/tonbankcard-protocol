/** Regression coverage for CHECK423-H1 deployment integrity. */

import { describe, expect, it, jest } from '@jest/globals';
import { Address, beginCell, Cell } from '@ton/core';
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
import {
  a2VerdictAllowsMainnet,
  assertPhase4MainnetAllowed,
} from '../../scripts/deploy/phase4-release-gate';

const RISK = Address.parse('0:' + '11'.repeat(32)).toString();
const ADMIN = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

function cell(seed: number): Cell {
  return beginCell().storeUint(seed, 32).endCell();
}

function liveManifest(code = cell(1), data = cell(2)): DeploymentManifest {
  const prepared = buildUnsignedDeployment('MerchantPaymentHub', code, data, 0);
  return {
    version: '1.0.0',
    manifestType: 'tonbankcard.deploy.manifest',
    artefactType: 'live',
    network: 'mainnet',
    timestamp: '2026-08-13T00:00:00.000Z',
    commit: 'a'.repeat(40),
    configuration: { deployerAddress: Address.parse("0:" + "33".repeat(32)).toString(), adminAddress: ADMIN, riskAuthority: RISK, lendingAdapter: null },
    verificationBlock: 123,
    contracts: {
      MerchantPaymentHub: {
        address: prepared.address,
        codeHash: prepared.codeHash,
        dataHash: prepared.dataHash,
        stateInitBoc: prepared.stateInitBoc,
        unsignedStateInitBoc: prepared.unsignedStateInitBoc,
        workchain: 0,
        initParameters: { admin: ADMIN, account_locks: RISK, nft_resolver: RISK, tbc_settlement: RISK },
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
    manifest.contracts.MerchantPaymentHub.address = '[DRY RUN] fake';

    expect(() => validateDeploymentManifest(manifest, 'live')).toThrow(/address/i);
    expect(() => validateDeploymentManifest({ ...liveManifest(), artefactType: 'dry-run' }, 'live'))
      .toThrow(/artefactType/i);
  });

  it('does not allow a prepared unsigned artefact to pass as live', () => {
    const prepared = { ...liveManifest(), artefactType: 'prepared' as const, verificationBlock: null };
    expect(() => validateDeploymentManifest(prepared, 'prepared')).not.toThrow();
    expect(() => validateDeploymentManifest(prepared, 'live')).toThrow(/artefactType/i);
  });

  it('blocks Phase 4 mainnet manifests until the canonical A2 verdict is READY', () => {
    const phase4 = liveManifest();
    phase4.contracts = { RecurringPayments: phase4.contracts.MerchantPaymentHub };
    expect(() => validateDeploymentManifest(phase4, 'live')).toThrow(/A2 verdict.*READY/i);

    phase4.network = 'testnet';
    expect(() => validateDeploymentManifest(phase4, 'live')).not.toThrow();
  });

  it('only unlocks Phase 4 mainnet for a canonical READY verdict', () => {
    expect(a2VerdictAllowsMainnet('**Gating verdict:** Pending')).toBe(false);
    expect(a2VerdictAllowsMainnet('prose says READY')).toBe(false);
    expect(a2VerdictAllowsMainnet('**Gating verdict:** READY')).toBe(true);
    expect(a2VerdictAllowsMainnet('**Gating verdict:** READY WITH ACCEPTED RISKS')).toBe(true);

    expect(() => assertPhase4MainnetAllowed('mainnet', ['MerchantPaymentHub'])).not.toThrow();
    expect(() => assertPhase4MainnetAllowed('testnet', ['RecurringPayments'])).not.toThrow();
  });
});

describe('CHECK423-H1: block-pinned on-chain verification', () => {
  it('uses original fromInit artefact while verifying post-init Sandbox state', async () => {
    const blockchain = await Blockchain.create();
    const owner = await blockchain.treasury('deployment-owner');
    const wrapper = await AccountStateMachine.fromInit(owner.address);
    const contract = blockchain.openContract(wrapper);
    await contract.send(owner.getSender(), {value:100_000_000n}, {$$type:'Deploy',queryId:0n});
    const state = await blockchain.getContract(contract.address);
    if (state.accountState?.type !== 'active') throw new Error('inactive');
    const {code,data} = state.accountState.state;
    const prepared = buildUnsignedDeployment('AccountStateMachine', wrapper.init!.code, wrapper.init!.data, 0);
    expect(prepared.address).toBe(contract.address.toString());
    expect(data!.hash().equals(wrapper.init!.data.hash())).toBe(false);
    const manifest = liveManifest();
    manifest.contracts = {AccountStateMachine:{...prepared,initParameters:{owner:owner.address.toString()}}};
    const provider: ChainStateProvider = {getContractState:async()=>({block:123,state:'active',code:code!,data:data!,adminAddress:owner.address.toString(),configurationValues:{owner:(await contract.getGetOwner()).toString()}})};
    expect((await verifyManifest(manifest,'sandbox.json',provider)).allPassed).toBe(true);
    delete manifest.contracts.AccountStateMachine.initParameters.owner;
    expect((await verifyManifest(manifest,'sandbox.json',provider)).allPassed).toBe(false);
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
        configurationValues: {admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK},
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
      'MerchantPaymentHub',
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
        configurationValues: {admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK},
      }),
    };

    const report = await verifyManifest(manifest, 'manifest.json', provider);

    expect(report.allPassed).toBe(false);
    expect(report.results[0].codeHashMatch).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/code hash mismatch/i);
  });

  it('rejects a manifest hash that does not match the compiled StateInit', async () => {
    const manifest = liveManifest();
    manifest.contracts.MerchantPaymentHub.codeHash = 'f'.repeat(64);
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 123, state: 'active', code: cell(1), data: cell(2), adminAddress: ADMIN,
        configurationValues: {admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK},
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
        configurationValues: {admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK},
      }),
    };

    const report = await verifyManifest(liveManifest(), 'manifest.json', provider);

    expect(report.allPassed).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/requested block 123/i);
  });

  it('fails closed when verificationBlock precedes deployBlock', async () => {
    const manifest = liveManifest();
    manifest.contracts.MerchantPaymentHub.deployBlock = 124;
    const provider: ChainStateProvider = {
      getContractState: async () => ({
        block: 123, state: 'active', code: cell(1), data: cell(2), adminAddress: ADMIN,
        configurationValues: {admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK},
      }),
    };

    const report = await verifyManifest(manifest, 'manifest.json', provider);
    expect(report.allPassed).toBe(false);
    expect(report.results[0].errors.join(' ')).toMatch(/precedes deploy block 124/i);
  });
});

describe('required authorities and separated deployment roles #509', () => {
 const provider:ChainStateProvider={getContractState:async()=>({block:123,state:'active',code:cell(1),data:cell(2),adminAddress:ADMIN,configurationValues:{admin:ADMIN,account_locks:RISK,nft_resolver:RISK,tbc_settlement:RISK}})};
 it.each(['admin','account_locks','nft_resolver','tbc_settlement'])('fails if %s is absent',async parameter=>{
  const manifest=liveManifest(); delete manifest.contracts.MerchantPaymentHub.initParameters[parameter];
  expect((await verifyManifest(manifest,'manifest.json',provider)).allPassed).toBe(false);
 });
 it('fails when admin is mismatched',async()=>{
  const manifest=liveManifest(); manifest.contracts.MerchantPaymentHub.initParameters.admin=RISK;
  expect((await verifyManifest(manifest,'manifest.json',provider)).allPassed).toBe(false);
 });
 it.each(['deployerAddress','riskAuthority'] as const)('fails when %s equals admin',async role=>{
  const manifest=liveManifest(); manifest.configuration[role]=ADMIN;
  const report=await verifyManifest(manifest,'manifest.json',provider);
  expect(report.allPassed).toBe(false);
  expect(report.results[0].errors.join(' ')).toMatch(/must be distinct/);
 });
 it('fails when deployer is omitted',async()=>{
  const manifest=liveManifest();delete manifest.configuration.deployerAddress;
  expect((await verifyManifest(manifest,'manifest.json',provider)).allPassed).toBe(false);
 });
});
