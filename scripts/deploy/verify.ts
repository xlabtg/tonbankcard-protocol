/** Block-pinned, fail-closed verification of TON deployment manifests. */
import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import * as fs from 'fs';
import * as path from 'path';
import { DEPLOYABLE_CONTRACTS } from './deployable-contracts';
import {
  type DeploymentManifest,
  validateDeploymentManifest,
} from './manifest';

export interface VerificationResult {
  contract: string;
  address: string;
  codeHashMatch: boolean;
  stateValid: boolean;
  adminAddressMatch: boolean;
  errors: string[];
}

export interface VerificationReport {
  timestamp: string;
  network: string;
  manifestFile: string;
  verificationBlock: number;
  allPassed: boolean;
  results: VerificationResult[];
}

export interface ChainContractState {
  block: number;
  state: 'active' | 'uninitialized' | 'frozen';
  code: Cell | null;
  data: Cell | null;
  adminAddress: string | null;
  configurationValues?: Record<string, string>;
}

export interface ChainStateProvider {
  getContractState(address: Address, block: number, contractName: string): Promise<ChainContractState>;
}

interface RpcResult {
  status: string;
  code?: string;
  data?: string;
  block_id?: { seqno?: number };
}

interface RpcStackResult {
  exit_code: number;
  stack: Array<[string, unknown]>;
  block_id?: { seqno?: number };
}

// Every deployable contract exposes its authority/configuration through getters.
export const REQUIRED_INIT_GETTERS: Record<string, Record<string, string>> = {
  AccountLocks: { risk_authority: 'get_risk_authority', lending_adapter: 'get_lending_adapter', payment_hub: 'get_payment_hub' },
  AccountStateMachine: { owner: 'getOwner' },
  VerifiedNFTAccountResolver: { collection7777: 'getCollection7777', collection8888: 'getCollection8888' },
  MerchantPaymentHub: { admin: 'getAdmin', account_locks: 'getAccountLocksContract', nft_resolver: 'getNFTResolver', tbc_settlement: 'getTBCSettlement' },
  CollateralSignal: { nft_resolver: 'getNFTResolver' },
  ProposalRegistry: { deployer: 'getDeployer' },
  SnapshotVerifier: { deployer: 'getDeployer' },
  TransparencyRegistry: { deployer: 'getDeployer' },
};

export class TonJsonRpcStateProvider implements ChainStateProvider {
  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}

  async getContractState(address: Address, block: number, contractName: string): Promise<ChainContractState> {
    const result = await this.call<RpcResult>('getAddressInformation', {
      address: address.toString(), seqno: block,
    });
    const returnedBlock = result.block_id?.seqno;
    if (!Number.isSafeInteger(returnedBlock)) throw new Error('TON endpoint did not attest a block seqno');

    const code = result.code ? Cell.fromBase64(result.code) : null;
    const data = result.data ? Cell.fromBase64(result.data) : null;
    const configurationValues: Record<string, string> = {};
    const getters = REQUIRED_INIT_GETTERS[contractName];
    if (!getters) throw new Error(`Missing configuration getters for ${contractName}`);
    for (const [parameter, getter] of Object.entries(getters)) {
      configurationValues[parameter] = await this.queryAddress(address, block, getter);
    }
    return {
      block: returnedBlock!,
      state: result.status === 'active' ? 'active' : result.status === 'frozen' ? 'frozen' : 'uninitialized',
      code,
      data,
      adminAddress: Object.values(configurationValues)[0],
      configurationValues,
    };
  }

  private async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method, params,
      }),
    });
    if (!response.ok) throw new Error(`TON endpoint returned HTTP ${response.status}`);
    const payload = await response.json() as { result?: T; error?: { message?: string } };
    if (!payload.result) throw new Error(payload.error?.message ?? 'TON endpoint returned no result');
    return payload.result;
  }

  private async queryAddress(address: Address, block: number, getter: string): Promise<string> {
    const result = await this.call<RpcStackResult>('runGetMethod', {
      address: address.toString(), method: getter, stack: [], seqno: block,
    });
    if (result.exit_code !== 0) throw new Error(`${getter} failed with exit code ${result.exit_code}`);
    if (result.block_id?.seqno !== block) throw new Error(`${getter} was not executed at requested block ${block}`);
    const entry = result.stack[0];
    if (!entry || (entry[0] !== 'slice' && entry[0] !== 'cell')) throw new Error(`${getter} returned no address`);
    const encoded = typeof entry[1] === 'string' ? entry[1] :
      (entry[1] as { bytes?: string } | undefined)?.bytes;
    if (!encoded) throw new Error(`${getter} returned an unsupported stack value`);
    return Cell.fromBase64(encoded).beginParse().loadAddress().toString();
  }
}

function verifyInvariants(contractName: string): string[] {
  const files = DEPLOYABLE_CONTRACTS[contractName];
  if (!files?.length) return [`Source mapping not found for ${contractName}`];
  const repoRoot = path.resolve(__dirname, '../..');
  const existing = files.map(file => path.resolve(repoRoot, file)).filter(file => fs.existsSync(file));
  if (!existing.length) return [`No mapped source exists for ${contractName}`];
  const source = existing.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [/adminWithdraw/i, /emergencyDrain/i, /forcedTransfer/i, /set_code\s*\(/i];
  return forbidden.filter(pattern => pattern.test(source)).map(pattern => `Forbidden source pattern: ${pattern}`);
}

export async function verifyManifest(
  manifest: DeploymentManifest,
  manifestFile: string,
  provider: ChainStateProvider,
): Promise<VerificationReport> {
  validateDeploymentManifest(manifest, 'live');
  const block = manifest.verificationBlock;
  if (block === null) throw new Error('Live manifest requires verificationBlock');
  const results: VerificationResult[] = [];

  for (const [contractName, deployment] of Object.entries(manifest.contracts)) {
    const errors = verifyInvariants(contractName);
    try {
      const {deployerAddress, adminAddress, riskAuthority} = manifest.configuration;
      if (!deployerAddress) throw new Error('Missing deployerAddress');
      const roles = [deployerAddress, adminAddress, riskAuthority].map(value => Address.parse(value).toRawString());
      if (new Set(roles).size !== 3) throw new Error('Deployer, admin and risk authority must be distinct');
    } catch (error) {
      errors.push(`Invalid deployment roles: ${(error as Error).message}`);
    }
    try {
      const stateInit = loadStateInit(Cell.fromBase64(deployment.stateInitBoc).beginParse());
      const compiledCodeHash = stateInit.code?.hash().toString('hex') ?? '';
      const compiledDataHash = stateInit.data?.hash().toString('hex') ?? '';
      if (compiledCodeHash !== deployment.codeHash) errors.push('Manifest codeHash does not match stateInitBoc');
      if (compiledDataHash !== deployment.dataHash) errors.push('Manifest dataHash does not match stateInitBoc');
      const compiledAddress = contractAddress(deployment.workchain, stateInit);
      if (!compiledAddress.equals(Address.parse(deployment.address))) {
        errors.push('Manifest address does not match stateInitBoc');
      }
    } catch (error) {
      errors.push(`Invalid compiled StateInit: ${(error as Error).message}`);
    }
    if (deployment.deployBlock !== undefined && deployment.deployBlock > block) {
      errors.push(`Verification block ${block} precedes deploy block ${deployment.deployBlock}`);
    }
    let codeHashMatch = false;
    let stateValid = false;
    let adminAddressMatch = false;
    try {
      const chain = await provider.getContractState(Address.parse(deployment.address), block, contractName);
      if (chain.block !== block) errors.push(`Endpoint returned block ${chain.block}; requested block ${block}`);
      if (chain.state !== 'active') errors.push(`Contract state is ${chain.state}, expected active`);
      const actualCodeHash = chain.code?.hash().toString('hex') ?? '';
      codeHashMatch = actualCodeHash === deployment.codeHash;
      if (!codeHashMatch) errors.push(`Code hash mismatch: expected ${deployment.codeHash}, actual ${actualCodeHash || 'missing'}`);
      // Tact runs init on its first message; live data deliberately differs from StateInit.
      stateValid = chain.block === block && chain.state === 'active' && chain.data !== null;
      if (!chain.data) errors.push('Missing initialized live data');
      const getters = REQUIRED_INIT_GETTERS[contractName];
      if (!getters) errors.push(`No authority policy for ${contractName}`);
      adminAddressMatch = !!getters;
      for (const parameter of Object.keys(getters ?? {})) {
        const expected = deployment.initParameters[parameter];
        const actual = chain.configurationValues?.[parameter];
        const role = parameter === 'admin' ? manifest.configuration.adminAddress :
          parameter === 'risk_authority' ? manifest.configuration.riskAuthority :
          parameter === 'deployer' ? manifest.configuration.deployerAddress : undefined;
        if (role && typeof expected === 'string' && !Address.parse(role).equals(Address.parse(expected))) {
          errors.push(`Manifest role mismatch for ${parameter}`);
          adminAddressMatch = false;
        }
        if (typeof expected !== 'string' || !expected) {
          errors.push(`Required init authority/configuration missing: ${parameter}`);
          adminAddressMatch = false;
          continue;
        }
        if (!actual || !Address.parse(actual).equals(Address.parse(expected))) {
          errors.push(`Configuration mismatch for ${parameter}: expected ${expected}, actual ${actual ?? 'unavailable'}`);
          adminAddressMatch = false;
        }
      }
    } catch (error) {
      errors.push(`On-chain query failed: ${(error as Error).message}`);
    }
    results.push({ contract: contractName, address: deployment.address, codeHashMatch, stateValid, adminAddressMatch, errors });
  }

  return {
    timestamp: new Date().toISOString(), network: manifest.network, manifestFile,
    verificationBlock: block, allPassed: results.every(result => result.errors.length === 0), results,
  };
}

export async function verifyFromManifest(manifestPath: string, provider?: ChainStateProvider): Promise<VerificationReport> {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DeploymentManifest;
  validateDeploymentManifest(manifest, 'live');
  const endpoint = process.env.TON_RPC_ENDPOINT ??
    (manifest.network === 'mainnet' ? 'https://toncenter.com/api/v2/jsonRPC' : 'https://testnet.toncenter.com/api/v2/jsonRPC');
  return verifyManifest(manifest, manifestPath, provider ?? new TonJsonRpcStateProvider(endpoint, process.env.TONCENTER_API_KEY));
}

async function main(): Promise<void> {
  const index = process.argv.indexOf('--manifest');
  if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: verify.ts --manifest <manifest.json>');
  const manifestPath = process.argv[index + 1];
  const report = await verifyFromManifest(manifestPath);
  const output = manifestPath.replace(/\.json$/, '.verification.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`Verification report: ${output}`);
  if (!report.allPassed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => { console.error(`Verification failed: ${(error as Error).message}`); process.exitCode = 1; });
}
