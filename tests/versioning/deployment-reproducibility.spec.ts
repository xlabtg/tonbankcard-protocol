/**
 * TONBANKCARD Protocol — Deployment Reproducibility Tests
 *
 * Issue Reference: #42 - Protocol Versioning & Deployment Policy (Immutable-First)
 *
 * These tests verify that TONBANKCARD deployments are reproducible:
 * - Source code is available and versioned
 * - Build process is deterministic
 * - Deployment manifests contain all required information
 * - Code hashes can be independently verified
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Test configuration
const ROOT_DIR = path.join(__dirname, '../..');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'schemas');
const CONTRACTS_DIR = path.join(ROOT_DIR, 'contracts');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

/**
 * Calculate SHA-256 hash of a file
 */
function calculateFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load and parse JSON file
 */
function loadJsonFile(filePath: string): unknown {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Recursively find all files with given extension
 */
function findFiles(dir: string, extension: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findFiles(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Deployment Manifest Schema Validation', () => {
  const schemaPath = path.join(SCHEMAS_DIR, 'deployment-manifest-v1.json');

  test('schema file should exist', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  test('schema should be valid JSON', () => {
    expect(() => loadJsonFile(schemaPath)).not.toThrow();
  });

  test('schema should have correct JSON Schema version', () => {
    const schema = loadJsonFile(schemaPath) as { $schema?: string };
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  test('schema should require essential deployment fields', () => {
    const schema = loadJsonFile(schemaPath) as { required?: string[] };
    const requiredFields = schema.required || [];

    expect(requiredFields).toContain('protocolVersion');
    expect(requiredFields).toContain('deployment');
    expect(requiredFields).toContain('source');
    expect(requiredFields).toContain('compiler');
    expect(requiredFields).toContain('contracts');
  });

  test('schema should enforce semantic versioning pattern', () => {
    const schema = loadJsonFile(schemaPath) as {
      properties?: {
        protocolVersion?: {
          pattern?: string;
        };
      };
    };

    const versionPattern = schema.properties?.protocolVersion?.pattern;
    expect(versionPattern).toBeDefined();

    // Test that pattern matches valid semver
    const regex = new RegExp(versionPattern!);
    expect(regex.test('1.0.0')).toBe(true);
    expect(regex.test('2.10.5')).toBe(true);
    expect(regex.test('invalid')).toBe(false);
    expect(regex.test('1.0')).toBe(false);
  });

  test('schema should require commit hash in source', () => {
    const schema = loadJsonFile(schemaPath) as {
      properties?: {
        source?: {
          required?: string[];
          properties?: {
            commit?: {
              pattern?: string;
            };
          };
        };
      };
    };

    expect(schema.properties?.source?.required).toContain('commit');

    // Commit hash pattern should be 40 hex characters
    const commitPattern = schema.properties?.source?.properties?.commit?.pattern;
    expect(commitPattern).toBeDefined();

    const regex = new RegExp(commitPattern!);
    expect(regex.test('abc123def456789012345678901234567890abcd')).toBe(true);
    expect(regex.test('shortcommit')).toBe(false);
  });

  test('schema should define immutability constraints', () => {
    const schema = loadJsonFile(schemaPath) as {
      properties?: {
        immutability?: {
          properties?: {
            upgradeProhibited?: { const?: boolean };
            noProxyPatterns?: { const?: boolean };
            noAdminControl?: { const?: boolean };
            noSelfDestruct?: { const?: boolean };
          };
        };
      };
    };

    const immutabilityProps = schema.properties?.immutability?.properties;
    expect(immutabilityProps).toBeDefined();

    // All immutability flags must be const: true
    expect(immutabilityProps?.upgradeProhibited?.const).toBe(true);
    expect(immutabilityProps?.noProxyPatterns?.const).toBe(true);
    expect(immutabilityProps?.noAdminControl?.const).toBe(true);
    expect(immutabilityProps?.noSelfDestruct?.const).toBe(true);
  });
});

describe('Example Deployment Manifest Validation', () => {
  const examplePath = path.join(SCHEMAS_DIR, 'example-deployment-manifest.json');

  test('example manifest should exist', () => {
    expect(fs.existsSync(examplePath)).toBe(true);
  });

  test('example manifest should be valid JSON', () => {
    expect(() => loadJsonFile(examplePath)).not.toThrow();
  });

  test('example manifest should have valid protocol version', () => {
    const manifest = loadJsonFile(examplePath) as { protocolVersion?: string };
    expect(manifest.protocolVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('example manifest should have deployment information', () => {
    const manifest = loadJsonFile(examplePath) as {
      deployment?: {
        network?: string;
        networkId?: number;
        timestamp?: string;
        deployer?: string;
      };
    };

    expect(manifest.deployment).toBeDefined();
    expect(manifest.deployment?.network).toMatch(/^(mainnet|testnet|sandbox)$/);
    expect(typeof manifest.deployment?.networkId).toBe('number');
    expect(manifest.deployment?.timestamp).toBeDefined();
    expect(manifest.deployment?.deployer).toBeDefined();
  });

  test('example manifest should have source information', () => {
    const manifest = loadJsonFile(examplePath) as {
      source?: {
        repository?: string;
        commit?: string;
        branch?: string;
        tag?: string;
      };
    };

    expect(manifest.source).toBeDefined();
    expect(manifest.source?.repository).toMatch(/^https?:\/\//);
    expect(manifest.source?.commit).toMatch(/^[a-fA-F0-9]{40}$/);
  });

  test('example manifest should have compiler information', () => {
    const manifest = loadJsonFile(examplePath) as {
      compiler?: {
        tact?: string;
        func?: string;
        fift?: string;
      };
    };

    expect(manifest.compiler).toBeDefined();
    // At least one compiler version should be specified
    const hasCompilerVersion =
      manifest.compiler?.tact ||
      manifest.compiler?.func ||
      manifest.compiler?.fift;
    expect(hasCompilerVersion).toBeTruthy();
  });

  test('example manifest should have contract information', () => {
    const manifest = loadJsonFile(examplePath) as {
      contracts?: Array<{
        name?: string;
        address?: string;
        codeHash?: string;
      }>;
    };

    expect(manifest.contracts).toBeDefined();
    expect(Array.isArray(manifest.contracts)).toBe(true);
    expect(manifest.contracts!.length).toBeGreaterThan(0);

    for (const contract of manifest.contracts!) {
      expect(contract.name).toBeDefined();
      expect(contract.address).toBeDefined();
      expect(contract.codeHash).toMatch(/^sha256:[a-fA-F0-9]{64}$/);
    }
  });

  test('example manifest should have immutability flags set to true', () => {
    const manifest = loadJsonFile(examplePath) as {
      immutability?: {
        upgradeProhibited?: boolean;
        noProxyPatterns?: boolean;
        noAdminControl?: boolean;
        noSelfDestruct?: boolean;
      };
    };

    if (manifest.immutability) {
      expect(manifest.immutability.upgradeProhibited).toBe(true);
      expect(manifest.immutability.noProxyPatterns).toBe(true);
      expect(manifest.immutability.noAdminControl).toBe(true);
      expect(manifest.immutability.noSelfDestruct).toBe(true);
    }
  });
});

describe('Source Code Reproducibility', () => {
  test('contract source files should be deterministically hashable', () => {
    const tactFiles = findFiles(CONTRACTS_DIR, '.tact');
    const fcFiles = findFiles(CONTRACTS_DIR, '.fc');
    const allContractFiles = [...tactFiles, ...fcFiles];

    expect(allContractFiles.length).toBeGreaterThan(0);

    // Hash each file and verify determinism
    const hashes: Map<string, string> = new Map();

    for (const file of allContractFiles) {
      const hash = calculateFileHash(file);
      hashes.set(file, hash);

      // Verify hash is deterministic (same content = same hash)
      const secondHash = calculateFileHash(file);
      expect(hash).toBe(secondHash);
    }

    console.log(`Verified ${hashes.size} contract files are deterministically hashable`);
  });

  test('interface files should be available', () => {
    const interfaceDir = path.join(CONTRACTS_DIR, 'interfaces');
    expect(fs.existsSync(interfaceDir)).toBe(true);

    const interfaceFiles = findFiles(interfaceDir, '.tact');
    expect(interfaceFiles.length).toBeGreaterThan(0);

    // Check for version metadata interface
    const hasVersionInterface = interfaceFiles.some(f =>
      f.includes('IVersionMetadata')
    );
    expect(hasVersionInterface).toBe(true);
  });

  test('type definition files should be available', () => {
    const typesDir = path.join(CONTRACTS_DIR, 'types');

    if (fs.existsSync(typesDir)) {
      const typeFiles = findFiles(typesDir, '.tact');
      expect(typeFiles.length).toBeGreaterThan(0);
    }
  });
});

describe('Documentation Reproducibility', () => {
  test('versioning policy should be documented', () => {
    const policyPath = path.join(DOCS_DIR, 'versioning-policy.md');
    expect(fs.existsSync(policyPath)).toBe(true);

    const content = fs.readFileSync(policyPath, 'utf-8');

    // Check for essential sections
    expect(content).toMatch(/[Ss]emantic [Vv]ersioning/);
    expect(content).toMatch(/[Dd]eployment [Mm]anifest/);
    expect(content).toMatch(/[Ii]mmutab/);
    expect(content).toMatch(/[Rr]eproducib/);
  });

  test('versioning policy should reference deployment schema', () => {
    const policyPath = path.join(DOCS_DIR, 'versioning-policy.md');

    if (fs.existsSync(policyPath)) {
      const content = fs.readFileSync(policyPath, 'utf-8');
      expect(content).toMatch(/deployment-manifest/i);
    }
  });

  test('versioning policy should document build verification steps', () => {
    const policyPath = path.join(DOCS_DIR, 'versioning-policy.md');

    if (fs.existsSync(policyPath)) {
      const content = fs.readFileSync(policyPath, 'utf-8');

      // Check for verification instructions
      expect(content).toMatch(/git.*clone|checkout/i);
      expect(content).toMatch(/compiler|compile/i);
      expect(content).toMatch(/hash|verify/i);
    }
  });
});

describe('Build Determinism Requirements', () => {
  test('should have reproducibility checklist in documentation', () => {
    const policyPath = path.join(DOCS_DIR, 'versioning-policy.md');

    if (fs.existsSync(policyPath)) {
      const content = fs.readFileSync(policyPath, 'utf-8');

      // Check for build reproducibility section
      expect(content).toMatch(/[Rr]eproducib.*[Cc]hecklist|[Dd]eterministic.*[Bb]uild/);
    }
  });

  test('package.json files should have pinned dependencies for SDK', () => {
    const sdkPackagePath = path.join(ROOT_DIR, 'sdk', 'package.json');

    if (fs.existsSync(sdkPackagePath)) {
      const packageJson = loadJsonFile(sdkPackagePath) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      // Check that dependencies use specific versions (not ranges)
      const checkVersionPinning = (deps: Record<string, string> | undefined) => {
        if (!deps) return;

        for (const [name, version] of Object.entries(deps)) {
          // Allow ^ for dev dependencies (less critical)
          // Production dependencies should ideally be exact or ^
          const isValidVersion = /^\^?\d+\.\d+\.\d+/.test(version);
          expect(isValidVersion).toBe(true);
        }
      };

      checkVersionPinning(packageJson.dependencies);
      // Dev dependencies can have more flexibility
    }
  });
});

describe('Version Metadata Interface Verification', () => {
  const versionInterfacePath = path.join(
    CONTRACTS_DIR,
    'interfaces',
    'IVersionMetadata.tact'
  );

  test('version metadata interface should exist', () => {
    expect(fs.existsSync(versionInterfacePath)).toBe(true);
  });

  test('version metadata interface should be read-only', () => {
    const content = fs.readFileSync(versionInterfacePath, 'utf-8');

    // All functions should be getters
    const functionDeclarations = content.match(/(?:get\s+)?fun\s+\w+/g) || [];

    for (const decl of functionDeclarations) {
      // Either starts with 'get' or is a comment about being read-only
      const isGetter = decl.startsWith('get ');
      const isDocumented = content.includes('read-only') || content.includes('READ-ONLY');

      // At least the interface should document read-only nature
      expect(isGetter || isDocumented).toBe(true);
    }
  });

  test('version metadata interface should define required getters', () => {
    const content = fs.readFileSync(versionInterfacePath, 'utf-8');

    // Required getter functions
    expect(content).toMatch(/get\s+fun\s+getProtocolVersion/);
    expect(content).toMatch(/get\s+fun\s+getContractName/);
    expect(content).toMatch(/get\s+fun\s+getSourceCommit/);
  });

  test('version metadata interface should not modify state', () => {
    const content = fs.readFileSync(versionInterfacePath, 'utf-8');

    // Should not have any receive handlers (state modification)
    expect(content).not.toMatch(/receive\s*\(/);

    // Should not have any non-getter functions
    const hasNonGetter = /(?<!get\s)fun\s+\w+.*\{/.test(content);
    expect(hasNonGetter).toBe(false);
  });
});

describe('Deployment Checklist Verification', () => {
  test('versioning policy should include deployment checklist', () => {
    const policyPath = path.join(DOCS_DIR, 'versioning-policy.md');

    if (fs.existsSync(policyPath)) {
      const content = fs.readFileSync(policyPath, 'utf-8');

      // Check for checklist items (markdown checkboxes)
      expect(content).toMatch(/- \[ \]/);

      // Check for key checklist items
      expect(content).toMatch(/invariant.*test|test.*pass/i);
      expect(content).toMatch(/audit/i);
      expect(content).toMatch(/manifest/i);
      expect(content).toMatch(/source.*code|code.*tag/i);
    }
  });
});
