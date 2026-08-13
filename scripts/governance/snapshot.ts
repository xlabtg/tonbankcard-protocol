/**
 * TBC Diamonds Governance Snapshot Tool
 *
 * Purpose: Create voter snapshots for governance proposals
 * Type: Off-chain utility (no fund custody, no execution)
 *
 * Usage:
 *   npm run governance:snapshot                    # Snapshot at current block
 *   npm run governance:snapshot -- --block=12345678 # Snapshot at specific block
 */

import { Address, Cell } from '@ton/core';
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
    complete: boolean;
    failed_indices: number[];
  };
}

interface NFTData {
  init: boolean;
  index: number;
  collection_address: Address;
  owner_address: Address | null;
  individual_content: any;
}

interface SnapshotProvider {
  getLatestBlock(): Promise<number>;
  getNFTAddress(collectionAddress: Address, index: number, block: number): Promise<Address>;
  getNFTData(nftAddress: Address, block: number): Promise<NFTData>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type RpcStackEntry = [string, unknown];
interface RpcStackResult {
  exit_code: number;
  stack: RpcStackEntry[];
  block_id?: { seqno?: number };
}

/** JSON-RPC provider whose get-method reads are attested at one masterchain seqno. */
class TonJsonRpcSnapshotProvider implements SnapshotProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
    private readonly fetcher: Fetch = fetch,
  ) {}

  async getLatestBlock(): Promise<number> {
    const result = await this.call<{ last?: { seqno?: number } }>('getMasterchainInfo', {});
    const seqno = result.last?.seqno;
    if (!Number.isSafeInteger(seqno) || seqno! <= 0) {
      throw new Error('TON endpoint did not return a valid masterchain seqno');
    }
    return seqno!;
  }

  async getNFTAddress(collectionAddress: Address, index: number, block: number): Promise<Address> {
    const result = await this.runMethod(collectionAddress, 'get_nft_address_by_index', [
      ['num', `0x${BigInt(index).toString(16)}`],
    ], block);
    return this.readAddress(result.stack[0], 'get_nft_address_by_index address');
  }

  async getNFTData(nftAddress: Address, block: number): Promise<NFTData> {
    const result = await this.runMethod(nftAddress, 'get_nft_data', [], block);
    if (result.stack.length < 5) throw new Error('get_nft_data returned an incomplete TEP-62 stack');
    return {
      init: this.readNumber(result.stack[0], 'init') !== 0n,
      index: this.toSafeNumber(this.readNumber(result.stack[1], 'index'), 'index'),
      collection_address: this.readAddress(result.stack[2], 'collection address'),
      owner_address: this.readOptionalAddress(result.stack[3], 'owner address'),
      individual_content: this.readCell(result.stack[4], 'individual content'),
    };
  }

  private async runMethod(
    address: Address, method: string, stack: RpcStackEntry[], block: number,
  ): Promise<RpcStackResult> {
    const result = await this.call<RpcStackResult>('runGetMethod', {
      address: address.toString(), method, stack, seqno: block,
    });
    if (result.exit_code !== 0) throw new Error(`${method} failed with exit code ${result.exit_code}`);
    if (result.block_id?.seqno !== block) {
      throw new Error(`${method} was not executed at requested block ${block}`);
    }
    if (!Array.isArray(result.stack)) throw new Error(`${method} returned no stack`);
    return result;
  }

  private async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`TON endpoint returned HTTP ${response.status}`);
    const payload = await response.json() as { result?: T; error?: { message?: string } };
    if (payload.result === undefined) {
      throw new Error(payload.error?.message ?? 'TON endpoint returned no result');
    }
    return payload.result;
  }

  private readNumber(entry: RpcStackEntry | undefined, label: string): bigint {
    if (!entry || entry[0] !== 'num') throw new Error(`get_nft_data returned invalid ${label}`);
    const raw = typeof entry[1] === 'string'
      ? entry[1]
      : (entry[1] as { number?: string } | undefined)?.number;
    if (!raw) throw new Error(`get_nft_data returned invalid ${label}`);
    try { return BigInt(raw); } catch { throw new Error(`get_nft_data returned invalid ${label}`); }
  }

  private toSafeNumber(value: bigint, label: string): number {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0) throw new Error(`get_nft_data returned invalid ${label}`);
    return result;
  }

  private readAddress(entry: RpcStackEntry | undefined, label: string): Address {
    const cell = this.readCell(entry, label);
    const address = cell.beginParse().loadAddress();
    if (!address) throw new Error(`TON getter returned empty ${label}`);
    return address;
  }

  private readOptionalAddress(entry: RpcStackEntry | undefined, label: string): Address | null {
    const cell = this.readCell(entry, label);
    return cell.beginParse().loadMaybeAddress();
  }

  private readCell(entry: RpcStackEntry | undefined, label: string): Cell {
    if (!entry || (entry[0] !== 'cell' && entry[0] !== 'slice')) {
      throw new Error(`TON getter returned invalid ${label}`);
    }
    const encoded = typeof entry[1] === 'string'
      ? entry[1]
      : (entry[1] as { bytes?: string } | undefined)?.bytes;
    if (!encoded) throw new Error(`TON getter returned invalid ${label}`);
    try { return Cell.fromBase64(encoded); } catch { throw new Error(`TON getter returned invalid ${label}`); }
  }
}

// ==================== SNAPSHOT CREATION ====================

class DiamondSnapshotTool {
  private readonly provider: SnapshotProvider;

  constructor(private readonly config: GovernanceConfig, provider?: SnapshotProvider) {
    this.provider = provider ?? new TonJsonRpcSnapshotProvider(config.tonApiEndpoint, config.tonApiKey);
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
   * Execute the collection's get_nft_address_by_index at the pinned block.
   */
  private async getNFTAddress(collectionAddress: Address, index: number, block: number): Promise<Address> {
    return this.provider.getNFTAddress(collectionAddress, index, block);
  }

  /**
   * Get NFT data at specific block
   */
  private async getNFTData(nftAddress: Address, blockNumber: number): Promise<NFTData> {
    return this.provider.getNFTData(nftAddress, blockNumber);
  }

  /**
   * Create snapshot at specific block
   */
  async createSnapshot(
    blockNumber?: number,
    options: { allowPartial?: boolean } = {},
  ): Promise<GovernanceSnapshot> {
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

    if (blockNumber !== undefined) {
      if (!Number.isSafeInteger(blockNumber) || blockNumber <= 0) {
        throw new Error('Snapshot block must be a positive integer masterchain seqno');
      }
      snapshotBlock = blockNumber;
      snapshotTime = new Date().toISOString(); // Approximate
      console.log(`Using specified block: ${snapshotBlock}`);
    } else {
      snapshotBlock = await this.provider.getLatestBlock();
      snapshotTime = new Date().toISOString();
      console.log(`Using current block: ${snapshotBlock}`);
    }

    // Query all NFT owners
    console.log(`Querying ${this.config.totalSupply} Diamond NFTs...`);
    const voters: VoterSnapshot[] = [];
    const ownerSet = new Set<string>();
    const failedIndices: number[] = [];

    for (let index = 0; index < this.config.totalSupply; index++) {
      try {
        // Get NFT address
        const nftAddress = await this.getNFTAddress(collectionAddress, index, snapshotBlock);

        // Get NFT data at snapshot block
        const nftData = await this.getNFTData(nftAddress, snapshotBlock);

        if (nftData.index !== index) {
          throw new Error(`get_nft_data returned index ${nftData.index}`);
        }
        if (!nftData.collection_address.equals(collectionAddress)) {
          throw new Error('get_nft_data returned another collection address');
        }

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
        failedIndices.push(index);
        if (!options.allowPartial) {
          throw new Error(
            `Snapshot incomplete at Diamond #${index}: ${(error as Error).message}`,
          );
        }
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
        complete: failedIndices.length === 0,
        failed_indices: failedIndices,
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
    if (snapshot.metadata?.complete !== true || snapshot.metadata.failed_indices?.length > 0) {
      errors.push('Snapshot is partial or completeness is not attested');
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
    if (blockArg && (!Number.isSafeInteger(blockNumber) || blockNumber! <= 0)) {
      throw new Error('--block must be a positive integer masterchain seqno');
    }

    const configArg = args.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // Load configuration
    const config = DiamondSnapshotTool.loadConfig(configPath);

    // Create snapshot
    const tool = new DiamondSnapshotTool(config);
    const allowPartial = args.includes('--allow-partial');
    const snapshot = await tool.createSnapshot(blockNumber, { allowPartial });

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
export {
  DiamondSnapshotTool,
  GovernanceSnapshot,
  VoterSnapshot,
  GovernanceConfig,
  NFTData,
  SnapshotProvider,
  TonJsonRpcSnapshotProvider,
};
