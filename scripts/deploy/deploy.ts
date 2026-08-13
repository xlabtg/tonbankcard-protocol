/**
 * Builds deterministic, unsigned TON deployment messages.
 *
 * No private key is accepted and no network request is made. The generated
 * external-in BOC contains StateInit and is intended to be wrapped/signed by
 * the deployment multi-sig described in the B1/B2 ceremony runbooks.
 */
import { beginCell, Cell, contractAddress, external, storeMessage, storeStateInit } from '@ton/core';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  type ContractDeployment,
  type DeploymentManifest,
  validateDeploymentManifest,
} from './manifest';

export type { ContractDeployment, DeploymentManifest } from './manifest';
export { validateDeploymentManifest } from './manifest';

export interface DeploymentConfig {
  network: 'testnet' | 'mainnet';
  adminAddress: string;
  riskAuthority: string;
  lendingAdapter: string | null;
  rpcEndpoint: string;
  dryRun: boolean;
  confirm: boolean;
}

export interface UnsignedDeployment extends ContractDeployment {}

interface ArtefactInput {
  contract: string;
  codeBoc: string;
  dataBoc: string;
  workchain?: number;
  initParameters: Record<string, unknown>;
}

function cellFromBase64(value: string, label: string): Cell {
  const cells = Cell.fromBoc(Buffer.from(value, 'base64'));
  if (cells.length !== 1) throw new Error(`${label} must contain exactly one root cell`);
  return cells[0];
}

export function buildUnsignedDeployment(
  _contractName: string,
  codeInput: Cell | Buffer | string,
  dataInput: Cell | Buffer | string,
  workchain: number,
): UnsignedDeployment {
  if (workchain !== 0 && workchain !== -1) throw new Error('workchain must be 0 or -1');
  const normalize = (value: Cell | Buffer | string, label: string): Cell => {
    if (typeof value === 'string') return cellFromBase64(value, label);
    if (Buffer.isBuffer(value)) {
      const roots = Cell.fromBoc(value);
      if (roots.length !== 1) throw new Error(`${label} must contain exactly one root cell`);
      return roots[0];
    }
    // Serialize across package boundaries; instanceof is unsafe when workspaces
    // contain compatible but physically distinct @ton/core installations.
    return Cell.fromBoc(value.toBoc())[0];
  };
  const code = normalize(codeInput, 'code');
  const data = normalize(dataInput, 'data');
  const init = { code, data };
  const address = contractAddress(workchain, init);
  const stateInit = beginCell().store(storeStateInit(init)).endCell();
  const message = beginCell().store(storeMessage(external({ to: address, init }))).endCell();

  return {
    address: address.toString({ testOnly: false, bounceable: true }),
    codeHash: code.hash().toString('hex'),
    dataHash: data.hash().toString('hex'),
    stateInitBoc: stateInit.toBoc().toString('base64'),
    unsignedStateInitBoc: message.toBoc().toString('base64'),
    workchain,
    initParameters: {},
  };
}

function currentCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function readArgs(): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const next = args[i + 1];
    if (next && !next.startsWith('--')) result[key.slice(2)] = args[++i];
    else result[key.slice(2)] = true;
  }
  return result;
}

function prepareManifest(inputPath: string, network: 'testnet' | 'mainnet'): DeploymentManifest {
  const inputs = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as ArtefactInput[];
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('artefacts must be a non-empty array');

  const contracts: Record<string, ContractDeployment> = {};
  for (const input of inputs) {
    if (!input.contract || contracts[input.contract]) throw new Error('contract names must be present and unique');
    const prepared = buildUnsignedDeployment(
      input.contract,
      cellFromBase64(input.codeBoc, `${input.contract}.codeBoc`),
      cellFromBase64(input.dataBoc, `${input.contract}.dataBoc`),
      input.workchain ?? 0,
    );
    prepared.initParameters = input.initParameters;
    contracts[input.contract] = prepared;
  }

  const manifest: DeploymentManifest = {
    version: '1.0.0',
    manifestType: 'tonbankcard.deploy.manifest',
    artefactType: 'prepared',
    network,
    timestamp: new Date().toISOString(),
    commit: currentCommit(),
    configuration: {
      adminAddress: process.env.ADMIN_ADDRESS ?? '',
      riskAuthority: process.env.RISK_AUTHORITY_ADDRESS ?? '',
      lendingAdapter: process.env.LENDING_ADAPTER_ADDRESS ?? null,
    },
    verificationBlock: null,
    contracts,
  };
  validateDeploymentManifest(manifest, 'prepared');
  return manifest;
}

function main(): void {
  const args = readArgs();
  const network = args.network;
  const input = args.artefacts;
  const output = args.output;
  if ((network !== 'testnet' && network !== 'mainnet') || typeof input !== 'string' ||
      typeof output !== 'string') {
    throw new Error(
      'Usage: deploy.ts --network testnet|mainnet --artefacts <input.json> ' +
      '--output <manifest.json>',
    );
  }
  if (network === 'mainnet' && args.confirm !== true) {
    throw new Error('--confirm is required for mainnet artefact preparation');
  }

  const manifest = prepareManifest(input, network);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
  console.log(`Prepared ${Object.keys(manifest.contracts).length} unsigned deploy BOC(s): ${output}`);
  console.log('No transaction was signed or broadcast. Wrap each StateInit in a funded internal multi-sig transfer.');
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Deployment preparation failed: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
