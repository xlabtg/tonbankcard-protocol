/**
 * TONBANKCARD Protocol — Immutability Verification Tests
 *
 * Issue Reference: #42 - Protocol Versioning & Deployment Policy (Immutable-First)
 *
 * These tests verify that TONBANKCARD contracts adhere to the immutability policy:
 * - No upgrade mechanisms
 * - No proxy patterns
 * - No admin fund control
 * - No mutable logic
 *
 * IMPORTANT: These are static analysis and pattern-matching tests.
 * They complement the formal invariant tests (I1-I7) but focus specifically
 * on deployment and upgrade prevention.
 */

import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const CONTRACTS_DIR = path.join(__dirname, '../../contracts');
const TACT_FILE_PATTERN = /\.tact$/;
const FC_FILE_PATTERN = /\.fc$/;

// Forbidden patterns that indicate upgradeability
const FORBIDDEN_PATTERNS = {
  // Upgrade-related keywords
  upgradeKeywords: [
    /\bupgrade\s*\(/i,
    /\bsetImplementation\s*\(/i,
    /\bsetLogic\s*\(/i,
    /\bsetCode\s*\(/i,
    /\bmigrateStorage\s*\(/i,
    /\bproxy\s*\(/i,
  ],

  // Admin control patterns
  adminControl: [
    /\bonlyAdmin\b/i,
    /\bonlyOwner\b.*withdraw/i,
    /\badminWithdraw\s*\(/i,
    /\bemergencyWithdraw\s*\(/i,
    /\bdrainFunds\s*\(/i,
    /\bsweep\s*\(/i,
  ],

  // Delegatecall patterns (allows external code execution)
  delegatecall: [
    /\bdelegatecall\b/i,
    /\bCALL_CODE\b/,
    /DELEGATECALL/,
  ],

  // Self-destruct patterns
  selfDestruct: [
    /\bselfdestruct\b/i,
    /\bsuicide\b/i,
    /\bSELFDESTRUCT\b/,
  ],

  // Pause/kill switch patterns
  pausePatterns: [
    /\bpause\s*\(\s*\)/i,
    /\bunpause\s*\(\s*\)/i,
    /\bkillSwitch\b/i,
    /\bemergencyStop\b/i,
    /\bisPaused\b.*require/i,
  ],
};

// Allowed patterns (false positives to exclude)
const ALLOWED_PATTERNS = [
  // Version metadata (read-only, informational)
  /getProtocolVersion/,
  /getContractName/,
  /getSourceCommit/,

  // Comments mentioning forbidden patterns for documentation
  /\/\/.*upgrade/i,
  /\/\*.*upgrade.*\*\//i,

  // Test-only functions that are documented for removal
  /\/\/.*FOR TESTING.*ONLY/i,
  /\/\/.*MUST be removed.*production/i,
];

/**
 * Recursively find all contract files
 */
function findContractFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findContractFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a line contains an allowed pattern (false positive)
 */
function isAllowedPattern(line: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Scan a file for forbidden patterns
 */
function scanFileForForbiddenPatterns(
  filePath: string
): { file: string; violations: { line: number; pattern: string; content: string }[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: { line: number; pattern: string; content: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip allowed patterns
    if (isAllowedPattern(line)) {
      continue;
    }

    // Check each category of forbidden patterns
    for (const [category, patterns] of Object.entries(FORBIDDEN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          violations.push({
            line: lineNumber,
            pattern: `${category}: ${pattern.source}`,
            content: line.trim(),
          });
        }
      }
    }
  }

  return {
    file: filePath,
    violations,
  };
}

describe('TONBANKCARD Immutability Verification', () => {
  describe('Tact Contract Files', () => {
    const tactFiles = findContractFiles(CONTRACTS_DIR, TACT_FILE_PATTERN);

    test('should find Tact contract files', () => {
      expect(tactFiles.length).toBeGreaterThan(0);
      console.log(`Found ${tactFiles.length} Tact contract files`);
    });

    test.each(tactFiles.map(f => [path.relative(CONTRACTS_DIR, f), f]))(
      '%s should not contain upgrade patterns',
      (_relativePath, filePath) => {
        const result = scanFileForForbiddenPatterns(filePath);

        if (result.violations.length > 0) {
          const violationReport = result.violations
            .map(v => `  Line ${v.line}: ${v.pattern}\n    "${v.content}"`)
            .join('\n');

          fail(
            `Found ${result.violations.length} forbidden pattern(s) in ${_relativePath}:\n${violationReport}`
          );
        }
      }
    );

    test.each(tactFiles.map(f => [path.relative(CONTRACTS_DIR, f), f]))(
      '%s should not contain admin control patterns',
      (_relativePath, filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for admin fund withdrawal functions
        const hasAdminWithdraw = /receive\s*\([^)]*\)\s*\{[^}]*(?:send|transfer)[^}]*admin/is.test(content);

        expect(hasAdminWithdraw).toBe(false);
      }
    );

    test.each(tactFiles.map(f => [path.relative(CONTRACTS_DIR, f), f]))(
      '%s should not contain proxy patterns',
      (_relativePath, filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for implementation address storage (proxy pattern)
        const hasImplementationField = /\bimplementation\s*:\s*Address/i.test(content);
        const hasLogicField = /\blogic\s*:\s*Address/i.test(content);

        expect(hasImplementationField).toBe(false);
        expect(hasLogicField).toBe(false);
      }
    );
  });

  describe('FunC Contract Files', () => {
    const fcFiles = findContractFiles(CONTRACTS_DIR, FC_FILE_PATTERN);

    if (fcFiles.length > 0) {
      test('should find FunC contract files', () => {
        expect(fcFiles.length).toBeGreaterThan(0);
        console.log(`Found ${fcFiles.length} FunC contract files`);
      });

      test.each(fcFiles.map(f => [path.relative(CONTRACTS_DIR, f), f]))(
        '%s should not contain upgrade patterns',
        (_relativePath, filePath) => {
          const result = scanFileForForbiddenPatterns(filePath);

          // Filter out FunC-specific false positives
          const realViolations = result.violations.filter(v => {
            // Allow set_code for compilation (not runtime)
            if (v.pattern.includes('setCode') && v.content.includes(';;')) {
              return false;
            }
            return true;
          });

          if (realViolations.length > 0) {
            const violationReport = realViolations
              .map(v => `  Line ${v.line}: ${v.pattern}\n    "${v.content}"`)
              .join('\n');

            fail(
              `Found ${realViolations.length} forbidden pattern(s) in ${_relativePath}:\n${violationReport}`
            );
          }
        }
      );
    }
  });

  describe('Interface Files', () => {
    const interfaceDir = path.join(CONTRACTS_DIR, 'interfaces');
    const interfaceFiles = findContractFiles(interfaceDir, TACT_FILE_PATTERN);

    test('should have version metadata interface', () => {
      const versionMetadataFile = interfaceFiles.find(f =>
        f.includes('IVersionMetadata')
      );

      expect(versionMetadataFile).toBeDefined();
    });

    test('version metadata interface should be read-only', () => {
      const versionMetadataPath = path.join(interfaceDir, 'IVersionMetadata.tact');

      if (fs.existsSync(versionMetadataPath)) {
        const content = fs.readFileSync(versionMetadataPath, 'utf-8');

        // All functions should be getters (read-only)
        const functionMatches = content.match(/\b(get\s+)?fun\s+\w+/g) || [];
        const nonGetterFunctions = functionMatches.filter(
          f => !f.startsWith('get ')
        );

        expect(nonGetterFunctions.length).toBe(0);
      }
    });
  });

  describe('Deployment Manifest Schema', () => {
    const schemaPath = path.join(__dirname, '../../schemas/deployment-manifest-v1.json');

    test('should have deployment manifest schema', () => {
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('schema should require immutability fields', () => {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

      // Check that immutability section exists
      expect(schema.properties.immutability).toBeDefined();

      // Check that immutability fields have const: true
      const immutabilityProps = schema.properties.immutability.properties;
      expect(immutabilityProps.upgradeProhibited.const).toBe(true);
      expect(immutabilityProps.noProxyPatterns.const).toBe(true);
      expect(immutabilityProps.noAdminControl.const).toBe(true);
      expect(immutabilityProps.noSelfDestruct.const).toBe(true);
    });

    test('schema should require source commit', () => {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

      expect(schema.properties.source.required).toContain('commit');
    });
  });
});

describe('Absence of Upgrade Paths', () => {
  test('no contracts should have upgrade receiver functions', () => {
    const tactFiles = findContractFiles(CONTRACTS_DIR, TACT_FILE_PATTERN);

    for (const filePath of tactFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for upgrade message receivers
      const hasUpgradeReceiver = /receive\s*\(\s*msg\s*:\s*\w*[Uu]pgrade\w*\s*\)/i.test(content);

      expect(hasUpgradeReceiver).toBe(false);
    }
  });

  test('no contracts should store implementation addresses', () => {
    const tactFiles = findContractFiles(CONTRACTS_DIR, TACT_FILE_PATTERN);

    for (const filePath of tactFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for proxy-style implementation address storage
      const hasProxyStorage =
        /\bimplementation\s*:\s*Address/i.test(content) ||
        /\blogicContract\s*:\s*Address/i.test(content) ||
        /\bbeacon\s*:\s*Address/i.test(content);

      expect(hasProxyStorage).toBe(false);
    }
  });

  test('no contracts should have code mutation functions', () => {
    const tactFiles = findContractFiles(CONTRACTS_DIR, TACT_FILE_PATTERN);

    for (const filePath of tactFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for code mutation patterns
      const hasCodeMutation =
        /\bset_code\s*\(/i.test(content) ||
        /\bset_data\s*\(/i.test(content) && /\badmin/i.test(content);

      // Filter out allowed patterns (comments, test documentation)
      const isInComment = /\/\/.*set_code|\/\*.*set_code.*\*\//i.test(content);

      expect(hasCodeMutation && !isInComment).toBe(false);
    }
  });
});

describe('Deployment Policy Compliance', () => {
  test('versioning policy documentation should exist', () => {
    const policyPath = path.join(__dirname, '../../docs/versioning-policy.md');
    expect(fs.existsSync(policyPath)).toBe(true);
  });

  test('versioning policy should document prohibited patterns', () => {
    const policyPath = path.join(__dirname, '../../docs/versioning-policy.md');

    if (fs.existsSync(policyPath)) {
      const content = fs.readFileSync(policyPath, 'utf-8');

      // Check for required sections
      expect(content).toMatch(/[Uu]pgrade.*[Pp]rohibit/);
      expect(content).toMatch(/[Ii]mmutab/);
      expect(content).toMatch(/[Dd]eployment/);
      expect(content).toMatch(/[Vv]ersion/);
    }
  });

  test('deployment manifest example should be valid', () => {
    const examplePath = path.join(__dirname, '../../schemas/example-deployment-manifest.json');
    const schemaPath = path.join(__dirname, '../../schemas/deployment-manifest-v1.json');

    if (fs.existsSync(examplePath) && fs.existsSync(schemaPath)) {
      const example = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

      // Basic validation (without full JSON Schema validator)
      expect(example.protocolVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(example.deployment.network).toMatch(/^(mainnet|testnet|sandbox)$/);
      expect(example.source.commit).toMatch(/^[a-fA-F0-9]{40}$/);
      expect(example.contracts.length).toBeGreaterThan(0);

      // Verify immutability flags
      if (example.immutability) {
        expect(example.immutability.upgradeProhibited).toBe(true);
        expect(example.immutability.noProxyPatterns).toBe(true);
        expect(example.immutability.noAdminControl).toBe(true);
        expect(example.immutability.noSelfDestruct).toBe(true);
      }
    }
  });
});
