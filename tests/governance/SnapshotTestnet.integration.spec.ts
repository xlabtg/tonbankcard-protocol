import { Address } from '@ton/core';
import { TonJsonRpcSnapshotProvider } from '../../scripts/governance/snapshot';

const run = process.env.TON_TESTNET_NFT_COLLECTION && process.env.TON_TESTNET_NFT_ADDRESS
  ? describe
  : describe.skip;

run('governance snapshot testnet fixture', () => {
  it('reads one collection fixture and its TEP-62 item at one block', async () => {
    const endpoint = process.env.TON_TESTNET_RPC_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
    const provider = new TonJsonRpcSnapshotProvider(endpoint, process.env.TONCENTER_API_KEY);
    const collection = Address.parse(process.env.TON_TESTNET_NFT_COLLECTION!);
    const expectedNft = Address.parse(process.env.TON_TESTNET_NFT_ADDRESS!);
    const index = Number(process.env.TON_TESTNET_NFT_INDEX ?? '0');
    const block = await provider.getLatestBlock();

    const nft = await provider.getNFTAddress(collection, index, block);
    const data = await provider.getNFTData(nft, block);

    expect(nft.equals(expectedNft)).toBe(true);
    expect(data.index).toBe(index);
    expect(data.collection_address.equals(collection)).toBe(true);
  });
});

