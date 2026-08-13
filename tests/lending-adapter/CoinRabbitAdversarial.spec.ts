import { createCoinRabbitAdapter } from '../../backend/adapters/coinrabbit';
import type {
  ChainSnapshot,
  CoinRabbitChainGateway,
} from '../../backend/adapters/types';

const COLLECTION_7777 = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const OWNER = 'EQD_verified_owner';

function snapshot(overrides: Partial<ChainSnapshot> = {}): ChainSnapshot {
  return {
    chainId: 1,
    blockSeqno: 42,
    observedAt: new Date(),
    ...overrides,
  };
}

function gateway(overrides: Partial<CoinRabbitChainGateway> = {}): CoinRabbitChainGateway {
  return {
    getLatestSnapshot: jest.fn().mockResolvedValue(snapshot()),
    getNFTAccount: jest.fn().mockResolvedValue({
      nftAccountId: '7777001',
      nftAddress: 'EQD_nft',
      collectionAddress: COLLECTION_7777,
      ownerAddress: OWNER,
      initialized: true,
    }),
    getCollateralSignal: jest.fn().mockResolvedValue({
      signalId: 'signal-1',
      nftAccountId: '7777001',
      nftAddress: 'EQD_nft',
      assetType: 'TON',
      signalAmount: '1000000000',
      isActive: true,
      createdAt: new Date('2026-08-13T00:00:00Z'),
    }),
    ...overrides,
  };
}

describe('CoinRabbit chain verification fails closed (CHECK423-M3)', () => {
  test.each([
    '7777001-special',
    ' 7777001 ',
    '7777',
    `7777${'0'.repeat(100)}`,
  ])('rejects malformed NFT account ID %p', async (nftAccountId) => {
    const identity = await createCoinRabbitAdapter().resolveBorrowerIdentity(nftAccountId);

    expect(identity.isValid).toBe(false);
    expect(identity.verificationStatus).toBe('invalid');
  });

  test('does not accept a caller-provided owner as verified identity', async () => {
    const identity = await createCoinRabbitAdapter().resolveBorrowerIdentity(
      '7777001',
      'EQD_forged_owner'
    );

    expect(identity.isValid).toBe(false);
    expect(identity.currentOwnerAddress).toBeUndefined();
    expect(identity.verificationStatus).toBe('unavailable');
  });

  test('does not confirm an arbitrary signal without a chain gateway', async () => {
    const verification = await createCoinRabbitAdapter().verifyCollateralSignal({
      signalId: 'arbitrary-signal',
      nftAccountId: '7777001',
    });

    expect(verification.isValid).toBe(false);
    expect(verification.ownershipVerified).toBe(false);
    expect(verification.signalInfo).toBeUndefined();
    expect(verification.verificationStatus).toBe('unavailable');
  });

  test('verifies identity and signal from the same network/block snapshot', async () => {
    const chainGateway = gateway();
    const adapter = createCoinRabbitAdapter({ chainId: 1, chainGateway });

    const identity = await adapter.resolveBorrowerIdentity('7777001', OWNER);
    const verification = await adapter.verifyCollateralSignal({
      signalId: 'signal-1',
      nftAccountId: '7777001',
    });

    expect(identity).toMatchObject({
      isValid: true,
      currentOwnerAddress: OWNER,
      verificationStatus: 'verified',
      verifiedAtBlock: 42,
    });
    expect(verification).toMatchObject({
      isValid: true,
      ownershipVerified: true,
      verificationStatus: 'verified',
      verifiedAtBlock: 42,
    });
    expect(chainGateway.getNFTAccount).toHaveBeenLastCalledWith(
      '7777001',
      expect.objectContaining({ chainId: 1, blockSeqno: 42 })
    );
    expect(chainGateway.getCollateralSignal).toHaveBeenCalledWith(
      'signal-1',
      expect.objectContaining({ chainId: 1, blockSeqno: 42 })
    );
  });

  test('marks RPC failures unavailable', async () => {
    const adapter = createCoinRabbitAdapter({
      chainGateway: gateway({
        getNFTAccount: jest.fn().mockRejectedValue(new Error('RPC unavailable')),
      }),
    });

    const identity = await adapter.resolveBorrowerIdentity('7777001');
    expect(identity).toMatchObject({ isValid: false, verificationStatus: 'unavailable' });
  });

  test('rejects wrong on-chain collection', async () => {
    const adapter = createCoinRabbitAdapter({
      chainGateway: gateway({
        getNFTAccount: jest.fn().mockResolvedValue({
          nftAccountId: '7777001',
          nftAddress: 'EQD_nft',
          collectionAddress: 'EQD_attacker_collection',
          ownerAddress: OWNER,
          initialized: true,
        }),
      }),
    });

    const identity = await adapter.resolveBorrowerIdentity('7777001');
    expect(identity).toMatchObject({ isValid: false, verificationStatus: 'unverified' });
  });

  test('rejects a stale masterchain snapshot before querying contracts', async () => {
    const chainGateway = gateway({
      getLatestSnapshot: jest.fn().mockResolvedValue(
        snapshot({ observedAt: new Date(Date.now() - 121_000) })
      ),
    });
    const adapter = createCoinRabbitAdapter({ chainGateway });

    const verification = await adapter.verifyCollateralSignal({
      signalId: 'signal-1',
      nftAccountId: '7777001',
    });

    expect(verification).toMatchObject({ isValid: false, verificationStatus: 'unavailable' });
    expect(chainGateway.getNFTAccount).not.toHaveBeenCalled();
    expect(chainGateway.getCollateralSignal).not.toHaveBeenCalled();
  });

  test('rejects a signal bound to another NFT account', async () => {
    const adapter = createCoinRabbitAdapter({
      chainGateway: gateway({
        getCollateralSignal: jest.fn().mockResolvedValue({
          signalId: 'signal-1',
          nftAccountId: '7777999',
          nftAddress: 'EQD_other_nft',
          assetType: 'TON',
          signalAmount: '1000000000',
          isActive: true,
          createdAt: new Date(),
        }),
      }),
    });

    const verification = await adapter.verifyCollateralSignal({
      signalId: 'signal-1',
      nftAccountId: '7777001',
    });
    expect(verification).toMatchObject({
      isValid: false,
      ownershipVerified: false,
      verificationStatus: 'unverified',
    });
  });

  test('rejects a signal bound to another NFT address', async () => {
    const adapter = createCoinRabbitAdapter({
      chainGateway: gateway({
        getCollateralSignal: jest.fn().mockResolvedValue({
          signalId: 'signal-1',
          nftAccountId: '7777001',
          nftAddress: 'EQD_forged_nft',
          assetType: 'TON',
          signalAmount: '1000000000',
          isActive: true,
          createdAt: new Date(),
        }),
      }),
    });

    const verification = await adapter.verifyCollateralSignal({
      signalId: 'signal-1',
      nftAccountId: '7777001',
    });
    expect(verification).toMatchObject({
      isValid: false,
      ownershipVerified: false,
      verificationStatus: 'unverified',
    });
  });
});
