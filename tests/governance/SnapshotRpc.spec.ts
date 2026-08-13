import { Address, beginCell, Cell } from '@ton/core';
import { describe, expect, it, jest } from '@jest/globals';
import {
  DiamondSnapshotTool,
  GovernanceConfig,
  TonJsonRpcSnapshotProvider,
} from '../../scripts/governance/snapshot';

const COLLECTION = Address.parseRaw('0:' + '11'.repeat(32));
const NFT = Address.parseRaw('0:' + '22'.repeat(32));
const OWNER = Address.parseRaw('0:' + '33'.repeat(32));

function encodedAddress(address: Address): string {
  return beginCell().storeAddress(address).endCell().toBoc().toString('base64');
}

function encodedCell(): string {
  return beginCell().storeUint(7, 8).endCell().toBoc().toString('base64');
}

function response(result: unknown): Response {
  return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) } as Response;
}

describe('TonJsonRpcSnapshotProvider', () => {
  it('parses collection and TEP-62 stacks and pins every query to one seqno', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const fetcher = jest.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      calls.push(request);
      if (request.method === 'getMasterchainInfo') {
        return response({ last: { seqno: 12345 } });
      }
      if (request.params.method === 'get_nft_address_by_index') {
        return response({ exit_code: 0, block_id: { seqno: 12345 }, stack: [['slice', { bytes: encodedAddress(NFT) }]] });
      }
      return response({
        exit_code: 0,
        block_id: { seqno: 12345 },
        stack: [
          ['num', '0x1'],
          ['num', '0x0'],
          ['slice', { bytes: encodedAddress(COLLECTION) }],
          ['slice', { bytes: encodedAddress(OWNER) }],
          ['cell', { bytes: encodedCell() }],
        ],
      });
    });
    const provider = new TonJsonRpcSnapshotProvider('https://example.invalid', undefined, fetcher);

    const block = await provider.getLatestBlock();
    const nft = await provider.getNFTAddress(COLLECTION, 0, block);
    const data = await provider.getNFTData(nft, block);

    expect(block).toBe(12345);
    expect(nft.equals(NFT)).toBe(true);
    expect(data).toMatchObject({ init: true, index: 0 });
    expect(data.collection_address.equals(COLLECTION)).toBe(true);
    expect(data.owner_address?.equals(OWNER)).toBe(true);
    expect(data.individual_content).toBeInstanceOf(Cell);
    expect(calls.slice(1).every((call) => call.params.seqno === 12345)).toBe(true);
  });

  it('rejects an endpoint response attested at another block', async () => {
    const fetcher = jest.fn(async () => response({
      exit_code: 0,
      block_id: { seqno: 999 },
      stack: [['slice', { bytes: encodedAddress(NFT) }]],
    }));
    const provider = new TonJsonRpcSnapshotProvider('https://example.invalid', undefined, fetcher);

    await expect(provider.getNFTAddress(COLLECTION, 0, 12345)).rejects.toThrow(/requested block 12345/);
  });

  it('rejects a getter failure before attempting to parse its stack', async () => {
    const fetcher = jest.fn(async () => response({
      exit_code: 32,
      block_id: { seqno: 12345 },
      stack: [],
    }));
    const provider = new TonJsonRpcSnapshotProvider('https://example.invalid', undefined, fetcher);

    await expect(provider.getNFTAddress(COLLECTION, 0, 12345)).rejects.toThrow(/exit code 32/);
  });
});

describe('DiamondSnapshotTool fail-closed snapshots', () => {
  const config: GovernanceConfig = {
    diamondsCollectionAddress: COLLECTION.toString(),
    totalSupply: 2,
    tonApiEndpoint: 'https://example.invalid',
  };

  it('aborts instead of emitting an incomplete snapshot after any RPC failure', async () => {
    let addressCalls = 0;
    const provider = {
      getLatestBlock: async () => 77,
      getNFTAddress: async () => {
        if (addressCalls++ === 0) return NFT;
        throw new Error('RPC unavailable');
      },
      getNFTData: async () => ({
        init: true, index: 0, collection_address: COLLECTION,
        owner_address: OWNER, individual_content: beginCell().endCell(),
      }),
    };
    const tool = new DiamondSnapshotTool(config, provider);

    await expect(tool.createSnapshot()).rejects.toThrow(/incomplete.*Diamond #1.*RPC unavailable/i);
  });

  it('marks explicitly requested partial snapshots and makes verification invalid', async () => {
    let addressCalls = 0;
    const provider = {
      getLatestBlock: async () => 77,
      getNFTAddress: async () => {
        if (addressCalls++ === 0) return NFT;
        throw new Error('RPC unavailable');
      },
      getNFTData: async () => ({
        init: true, index: 0, collection_address: COLLECTION,
        owner_address: OWNER, individual_content: beginCell().endCell(),
      }),
    };
    const tool = new DiamondSnapshotTool(config, provider);

    const snapshot = await tool.createSnapshot(undefined, { allowPartial: true });

    expect(snapshot.metadata.complete).toBe(false);
    expect(snapshot.metadata.failed_indices).toEqual([1]);
    expect(DiamondSnapshotTool.verifySnapshot(snapshot).valid).toBe(false);
  });
});
