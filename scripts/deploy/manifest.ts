import Ajv2020 from 'ajv/dist/2020';
import { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { assertPhase4MainnetAllowed } from './phase4-release-gate';

export type ArtefactType = 'dry-run' | 'prepared' | 'live';

export interface ContractDeployment {
  address: string;
  codeHash: string;
  dataHash: string;
  stateInitBoc: string;
  unsignedStateInitBoc: string;
  workchain: number;
  initParameters: Record<string, unknown>;
  deployTx?: string;
  deployBlock?: number;
}

export interface DeploymentManifest {
  version: '1.0.0';
  manifestType: 'tonbankcard.deploy.manifest';
  artefactType: ArtefactType;
  network: 'testnet' | 'mainnet';
  timestamp: string;
  commit: string;
  configuration: {
    adminAddress: string;
    riskAuthority: string;
    lendingAdapter: string | null;
  };
  verificationBlock: number | null;
  contracts: Record<string, ContractDeployment>;
}

const schemaPath = path.resolve(__dirname, '../../docs/deployments/manifest.schema.json');

export function validateDeploymentManifest(
  manifest: unknown,
  expectedType?: ArtefactType,
): asserts manifest is DeploymentManifest {
  if (expectedType && (manifest as Partial<DeploymentManifest>)?.artefactType !== expectedType) {
    throw new Error(
      `Invalid artefactType: expected ${expectedType}, received ` +
      `${(manifest as Partial<DeploymentManifest>)?.artefactType}`,
    );
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(manifest)) {
    const errors = (validate.errors ?? [])
      .map((error: ErrorObject) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    throw new Error(`Invalid deployment manifest: ${errors}`);
  }
  const deployment = manifest as DeploymentManifest;
  assertPhase4MainnetAllowed(deployment.network, Object.keys(deployment.contracts));
}
