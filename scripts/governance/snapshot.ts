/**
 * TBC Diamonds Governance Snapshot Tool
 *
 * Purpose: Create voter snapshots for governance proposals
 * Type: Off-chain utility (no fund custody, no execution)
 *
 * Usage:
 *   npm run governance:snapshot                    # Snapshot at current block
 *   npm run governance:snapshot --block 12345678   # Snapshot at specific block
 */

import { Address, TonClient } from '@ton/ton';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ==================== CONFIGURATION ====================

interface GovernanceConfig {
  diamondsCollectionAddress: string;
  totalSupply: number;
  tonApiEndpoint: string;
  tonApiKey?: string;
}

// Default configuration (can be overridden via config file)
const DEFAULT_CONFIG: GovernanceConfig = {
  diamondsCollectionAddress: '', // To be set after TBC Diamonds deployment
  totalSupply: 222,
  tonApiEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
  tonApiKey: undefined, // Optional API key for rate limit increases
};

// ==================== TYPES ====================

interface VoterSnapshot {
  nft_index: number;
  owner_address: string;
  voting_power: number; // Always 1 for TBC Diamonds (1 NFT = 1 vote)
}

interface GovernanceSnapshot {
  snapshot_block: number;
  snapshot_time: string;
  collection_address: string;
  total_supply: number;
  voters: VoterSnapshot[];
  total_voting_power: number;
  unique_owners: number;
  metadata: {
    created_at: string;
    tool_version: string;
    governance_type: string;
  };
}

interface NFTData {
  init: boolean;
  index: number;
  collection_address: Address;
  owner_address: Address | null;
  individual_content: any;
}

// ==================== SNAPSHOT CREATION ====================

class DiamondSnapshotTool {
  private client: TonClient;
  private config: GovernanceConfig;

  constructor(config: GovernanceConfig) {
    this.config = config;
    this.client = new TonClient({
      endpoint: config.tonApiEndpoint,
      apiKey: config.tonApiKey,
    });
  }

  /**
   * Load configuration from file
   */
  static loadConfig(configPath?: string): GovernanceConfig {
    const path = configPath || join(__dirname, 'config.json');

    if (existsSync(path)) {
      try {
        const fileConfig = JSON.parse(readFileSync(path, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...fileConfig };
      } catch (error) {
        console.warn(`Failed to load config from ${path}, using defaults`);
        return DEFAULT_CONFIG;
      }
    }

    return DEFAULT_CONFIG;
  }

  /**
   * Calculate NFT item address from collection and index
   *
   * Note: This is a simplified implementation.
   * In production, use the collection contract's get_nft_address_by_index method.
   */
  private async getNFTAddress(collectionAddress: Address, index: number): Promise<Address> {
    // Call collection contract's get_nft_address_by_index
    // This is collection-specific and depends on the NFT collection implementation

    // Placeholder: In production, execute get method call:
    // const result = await this.client.runMethod(collectionAddress, 'get_nft_address_by_index', [
    //   { type: 'int', value: BigInt(index) }
    // ]);
    // return result.stack.readAddress();

    // For now, throw an error indicating this needs implementation
    throw new Error(
      'NFT address calculation not implemented. ' +
      'This requires calling the collection contract\'s get_nft_address_by_index method. ' +
      'Please implement based on the actual TBC Diamonds collection contract.'
    );
  }

  /**
   * Get NFT data at specific block
   */
  private async getNFTData(nftAddress: Address, blockNumber?: number): Promise<NFTData> {
    // Call NFT contract's get_nft_data method
    // This is a standard TEP-62 method

    // Placeholder: In production, execute get method call:
    // const result = await this.client.runMethod(nftAddress, 'get_nft_data', [], blockNumber);
    //
    // Parse result:
    // const init = result.stack.readBoolean();
    // const index = result.stack.readNumber();
    // const collection_address = result.stack.readAddress();
    // const owner_address = result.stack.readAddressOpt();
    // const individual_content = result.stack.readCell();
    //
    // return { init, index, collection_address, owner_address, individual_content };

    throw new Error(
      'NFT data query not implemented. ' +
      'This requires calling each NFT item\'s get_nft_data method. ' +
      'Please implement based on TON SDK and the actual deployed NFT collection.'
    );
  }

  /**
   * Create snapshot at specific block
   */
  async createSnapshot(blockNumber?: number): Promise<GovernanceSnapshot> {
    console.log('Creating TBC Diamonds governance snapshot...');

    // Validate configuration
    if (!this.config.diamondsCollectionAddress) {
      throw new Error(
        'TBC Diamonds collection address not configured. ' +
        'Please set diamondsCollectionAddress in config.json'
      );
    }

    const collectionAddress = Address.parse(this.config.diamondsCollectionAddress);

    // Determine snapshot block
    let snapshotBlock: number;
    let snapshotTime: string;

    if (blockNumber) {
      snapshotBlock = blockNumber;
      snapshotTime = new Date().toISOString(); // Approximate
      console.log(`Using specified block: ${snapshotBlock}`);
    } else {
      // Get current block (placeholder - implement using TON API)
      snapshotBlock = 0; // TODO: Get latest block from TON API
      snapshotTime = new Date().toISOString();
      console.log(`Using current block: ${snapshotBlock}`);
    }

    // Query all NFT owners
    console.log(`Querying ${this.config.totalSupply} Diamond NFTs...`);
    const voters: VoterSnapshot[] = [];
    const ownerSet = new Set<string>();

    for (let index = 0; index < this.config.totalSupply; index++) {
      try {
        // Get NFT address
        const nftAddress = await this.getNFTAddress(collectionAddress, index);

        // Get NFT data at snapshot block
        const nftData = await this.getNFTData(nftAddress, snapshotBlock);

        // Only include initialized NFTs with owners
        if (nftData.init && nftData.owner_address) {
          const ownerAddr = nftData.owner_address.toString();

          voters.push({
            nft_index: index,
            owner_address: ownerAddr,
            voting_power: 1, // Each Diamond = 1 vote
          });

          ownerSet.add(ownerAddr);
        } else {
          console.log(`Diamond #${index}: Not initialized or no owner (excluded)`);
        }

        // Progress indicator
        if ((index + 1) % 50 === 0) {
          console.log(`Progress: ${index + 1}/${this.config.totalSupply} NFTs queried`);
        }
      } catch (error) {
        console.error(`Error querying Diamond #${index}:`, error);
        // Continue with other NFTs
      }
    }

    // Create snapshot
    const snapshot: GovernanceSnapshot = {
      snapshot_block: snapshotBlock,
      snapshot_time: snapshotTime,
      collection_address: this.config.diamondsCollectionAddress,
      total_supply: this.config.totalSupply,
      voters: voters.sort((a, b) => a.nft_index - b.nft_index), // Sort by index
      total_voting_power: voters.length, // Each NFT = 1 vote
      unique_owners: ownerSet.size,
      metadata: {
        created_at: new Date().toISOString(),
        tool_version: '1.0.0',
        governance_type: 'advisory-non-binding',
      },
    };

    console.log(`\nSnapshot complete:`);
    console.log(`  Block: ${snapshot.snapshot_block}`);
    console.log(`  Total NFTs: ${snapshot.total_supply}`);
    console.log(`  Active Voters: ${snapshot.voters.length}`);
    console.log(`  Unique Owners: ${snapshot.unique_owners}`);
    console.log(`  Total Voting Power: ${snapshot.total_voting_power}`);

    return snapshot;
  }

  /**
   * Save snapshot to file
   */
  saveSnapshot(snapshot: GovernanceSnapshot, outputPath?: string): string {
    const filename = outputPath || `snapshot_${snapshot.snapshot_block}.json`;
    const filepath = join(__dirname, '../../snapshots', filename);

    // Ensure snapshots directory exists
    const snapshotsDir = join(__dirname, '../../snapshots');
    if (!existsSync(snapshotsDir)) {
      require('fs').mkdirSync(snapshotsDir, { recursive: true });
    }

    writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`\nSnapshot saved to: ${filepath}`);

    return filepath;
  }

  /**
   * Verify snapshot integrity
   */
  static verifySnapshot(snapshot: GovernanceSnapshot): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate structure
    if (!snapshot.snapshot_block || snapshot.snapshot_block < 0) {
      errors.push('Invalid snapshot_block');
    }

    if (!snapshot.collection_address) {
      errors.push('Missing collection_address');
    }

    if (snapshot.total_supply !== 222) {
      errors.push('Total supply must be 222');
    }

    // Validate voters
    if (!Array.isArray(snapshot.voters)) {
      errors.push('Voters must be an array');
    } else {
      const indices = new Set<number>();
      const owners = new Set<string>();

      snapshot.voters.forEach((voter, i) => {
        // Check index range
        if (voter.nft_index < 0 || voter.nft_index >= 222) {
          errors.push(`Voter ${i}: Invalid NFT index ${voter.nft_index}`);
        }

        // Check for duplicates
        if (indices.has(voter.nft_index)) {
          errors.push(`Voter ${i}: Duplicate NFT index ${voter.nft_index}`);
        }
        indices.add(voter.nft_index);

        // Validate owner address format
        try {
          Address.parse(voter.owner_address);
        } catch {
          errors.push(`Voter ${i}: Invalid owner address format`);
        }

        // Track unique owners
        owners.add(voter.owner_address);

        // Validate voting power
        if (voter.voting_power !== 1) {
          errors.push(`Voter ${i}: Voting power must be 1 (got ${voter.voting_power})`);
        }
      });

      // Validate totals
      if (snapshot.total_voting_power !== snapshot.voters.length) {
        errors.push(
          `Total voting power mismatch: expected ${snapshot.voters.length}, got ${snapshot.total_voting_power}`
        );
      }

      if (snapshot.unique_owners !== owners.size) {
        errors.push(
          `Unique owners mismatch: expected ${owners.size}, got ${snapshot.unique_owners}`
        );
      }

      // Warnings
      if (snapshot.voters.length < snapshot.total_supply * 0.5) {
        warnings.push(
          `Low participation: Only ${snapshot.voters.length}/${snapshot.total_supply} NFTs included (${
            ((snapshot.voters.length / snapshot.total_supply) * 100).toFixed(1)
          }%)`
        );
      }

      if (owners.size === 1) {
        warnings.push('All NFTs owned by single address - potential centralization');
      }
    }

    // Validate metadata
    if (!snapshot.metadata || snapshot.metadata.governance_type !== 'advisory-non-binding') {
      warnings.push('Governance type should be "advisory-non-binding"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ==================== CLI INTERFACE ====================

async function main() {
  const args = process.argv.slice(2);

  // Parse command
  const command = args[0] || 'create';

  if (command === 'create') {
    // Parse options
    const blockArg = args.find((arg) => arg.startsWith('--block='));
    const blockNumber = blockArg ? parseInt(blockArg.split('=')[1], 10) : undefined;

    const configArg = args.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // Load configuration
    const config = DiamondSnapshotTool.loadConfig(configPath);

    // Create snapshot
    const tool = new DiamondSnapshotTool(config);
    const snapshot = await tool.createSnapshot(blockNumber);

    // Save snapshot
    tool.saveSnapshot(snapshot);

    // Verify snapshot
    const verification = DiamondSnapshotTool.verifySnapshot(snapshot);
    console.log('\nSnapshot Verification:');
    console.log(`  Valid: ${verification.valid ? '✅' : '❌'}`);

    if (verification.errors.length > 0) {
      console.log('  Errors:');
      verification.errors.forEach((err) => console.log(`    - ${err}`));
    }

    if (verification.warnings.length > 0) {
      console.log('  Warnings:');
      verification.warnings.forEach((warn) => console.log(`    - ${warn}`));
    }
  } else if (command === 'verify') {
    // Verify existing snapshot
    const snapshotPath = args[1];
    if (!snapshotPath) {
      console.error('Usage: npm run governance:verify-snapshot <snapshot_file>');
      process.exit(1);
    }

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
    const verification = DiamondSnapshotTool.verifySnapshot(snapshot);

    console.log('Snapshot Verification:');
    console.log(`  File: ${snapshotPath}`);
    console.log(`  Valid: ${verification.valid ? '✅' : '❌'}`);

    if (verification.errors.length > 0) {
      console.log('  Errors:');
      verification.errors.forEach((err) => console.log(`    - ${err}`));
    }

    if (verification.warnings.length > 0) {
      console.log('  Warnings:');
      verification.warnings.forEach((warn) => console.log(`    - ${warn}`));
    }

    process.exit(verification.valid ? 0 : 1);
  } else {
    console.error('Unknown command:', command);
    console.log('Usage:');
    console.log('  npm run governance:snapshot [--block=<number>] [--config=<path>]');
    console.log('  npm run governance:verify-snapshot <snapshot_file>');
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

// Export for testing
export { DiamondSnapshotTool, GovernanceSnapshot, VoterSnapshot, GovernanceConfig };
