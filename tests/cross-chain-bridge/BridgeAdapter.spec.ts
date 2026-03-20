/**
 * Cross-Chain Bridge Adapter Test Suite (Phase 4)
 *
 * Tests for the CrossChainBridgeAdapter covering:
 * - Bridge intent management
 * - Chain support validation
 * - Quote parameter generation
 * - Intent lifecycle
 * - Security invariant verification
 *
 * ⚠️ CRITICAL: These tests verify that the adapter remains NON-CUSTODIAL
 * and does NOT handle cross-chain fund movement directly.
 */

import {
  CrossChainBridgeAdapter,
  createBridgeAdapter,
} from '../../backend/adapters/bridge';
import type {
  BridgeIntent,
  BridgeTargetChain,
} from '../../backend/adapters/types';

describe('Cross-Chain Bridge Adapter', () => {
  let adapter: CrossChainBridgeAdapter;

  const NFT_ACCOUNT = '7777001';
  const ETH_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f';
  const BTC_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

  beforeEach(() => {
    adapter = createBridgeAdapter();
  });

  // ===========================================================================
  // CHAIN SUPPORT
  // ===========================================================================

  describe('Chain Support', () => {
    test('should support ethereum', () => {
      expect(adapter.isChainSupported('ethereum')).toBe(true);
    });

    test('should support bitcoin', () => {
      expect(adapter.isChainSupported('bitcoin')).toBe(true);
    });

    test('should support bsc', () => {
      expect(adapter.isChainSupported('bsc')).toBe(true);
    });

    test('should support polygon', () => {
      expect(adapter.isChainSupported('polygon')).toBe(true);
    });

    test('should support solana', () => {
      expect(adapter.isChainSupported('solana')).toBe(true);
    });

    test('should return all supported chains', () => {
      const chains = adapter.getSupportedChains();
      expect(chains).toHaveLength(5);
      expect(chains).toContain('ethereum');
      expect(chains).toContain('bitcoin');
    });

    test('should return chain tickers', () => {
      expect(adapter.getChainTicker('ethereum')).toBe('eth');
      expect(adapter.getChainTicker('bitcoin')).toBe('btc');
      expect(adapter.getChainTicker('bsc')).toBe('bnb');
    });

    test('should return chain networks', () => {
      expect(adapter.getChainNetwork('ethereum')).toBe('eth');
      expect(adapter.getChainNetwork('bitcoin')).toBe('btc');
    });

    test('should allow custom supported chains', () => {
      const custom = createBridgeAdapter({
        supportedChains: ['ethereum', 'bitcoin'],
      });

      expect(custom.isChainSupported('ethereum')).toBe(true);
      expect(custom.isChainSupported('solana')).toBe(false);
    });
  });

  // ===========================================================================
  // BRIDGE INTENT MANAGEMENT
  // ===========================================================================

  describe('Bridge Intent Management', () => {
    test('should create valid bridge intent', () => {
      const intent = adapter.createBridgeIntent(
        NFT_ACCOUNT,
        'ethereum',
        '10.5',
        ETH_ADDRESS
      );

      expect(intent.nftAccountId).toBe(NFT_ACCOUNT);
      expect(intent.targetChain).toBe('ethereum');
      expect(intent.amount).toBe('10.5');
      expect(intent.targetAddress).toBe(ETH_ADDRESS);
      expect(intent.status).toBe('pending');
      expect(intent.intentId).toBeTruthy();
      expect(intent.createdAt).toBeInstanceOf(Date);
    });

    test('should create bitcoin bridge intent', () => {
      const intent = adapter.createBridgeIntent(
        NFT_ACCOUNT,
        'bitcoin',
        '0.01',
        BTC_ADDRESS
      );

      expect(intent.targetChain).toBe('bitcoin');
    });

    test('should reject unsupported chain', () => {
      const custom = createBridgeAdapter({
        supportedChains: ['ethereum'],
      });

      expect(() => {
        custom.createBridgeIntent(NFT_ACCOUNT, 'bitcoin', '1.0', BTC_ADDRESS);
      }).toThrow();
    });

    test('should reject invalid amount', () => {
      expect(() => {
        adapter.createBridgeIntent(NFT_ACCOUNT, 'ethereum', '0', ETH_ADDRESS);
      }).toThrow();
    });

    test('should reject negative amount', () => {
      expect(() => {
        adapter.createBridgeIntent(NFT_ACCOUNT, 'ethereum', '-1', ETH_ADDRESS);
      }).toThrow();
    });

    test('should reject empty target address', () => {
      expect(() => {
        adapter.createBridgeIntent(NFT_ACCOUNT, 'ethereum', '1.0', '');
      }).toThrow();
    });

    test('should generate unique intent IDs', () => {
      const i1 = adapter.createBridgeIntent(NFT_ACCOUNT, 'ethereum', '1', ETH_ADDRESS);
      const i2 = adapter.createBridgeIntent(NFT_ACCOUNT, 'ethereum', '2', ETH_ADDRESS);
      expect(i1.intentId).not.toBe(i2.intentId);
    });
  });

  // ===========================================================================
  // INTENT LIFECYCLE
  // ===========================================================================

  describe('Intent Lifecycle', () => {
    let intent: BridgeIntent;

    beforeEach(() => {
      intent = adapter.createBridgeIntent(
        NFT_ACCOUNT,
        'ethereum',
        '10.5',
        ETH_ADDRESS
      );
    });

    test('should link provider transaction', () => {
      const linked = adapter.linkProviderTransaction(intent, 'provider_tx_123');

      expect(linked.providerTxId).toBe('provider_tx_123');
      expect(linked.status).toBe('pending');
    });

    test('should confirm bridge intent', () => {
      const confirmed = adapter.confirmBridgeIntent(intent, '0xabc123');

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.externalTxHash).toBe('0xabc123');
      expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    });

    test('should cancel pending intent', () => {
      const cancelled = adapter.cancelBridgeIntent(intent);

      expect(cancelled.status).toBe('cancelled');
    });

    test('should not cancel confirmed intent', () => {
      const confirmed = adapter.confirmBridgeIntent(intent, '0xabc123');

      expect(() => {
        adapter.cancelBridgeIntent(confirmed);
      }).toThrow();
    });

    test('should not cancel already cancelled intent', () => {
      const cancelled = adapter.cancelBridgeIntent(intent);

      expect(() => {
        adapter.cancelBridgeIntent(cancelled);
      }).toThrow();
    });
  });

  // ===========================================================================
  // QUOTE PARAMETERS
  // ===========================================================================

  describe('Quote Parameters', () => {
    test('should generate correct quote params for ETH bridge', () => {
      const params = adapter.getBridgeQuoteParams({
        fromAsset: 'TON',
        toAsset: 'ETH',
        targetChain: 'ethereum',
        amount: '100',
      });

      expect(params.fromCurrency).toBe('ton');
      expect(params.toCurrency).toBe('eth');
      expect(params.fromNetwork).toBe('ton');
      expect(params.toNetwork).toBe('eth');
      expect(params.amount).toBe('100');
    });

    test('should generate correct quote params for BTC bridge', () => {
      const params = adapter.getBridgeQuoteParams({
        fromAsset: 'TON',
        toAsset: 'BTC',
        targetChain: 'bitcoin',
        amount: '50',
      });

      expect(params.toNetwork).toBe('btc');
    });

    test('should reject unsupported chain in quote', () => {
      const custom = createBridgeAdapter({
        supportedChains: ['ethereum'],
      });

      expect(() => {
        custom.getBridgeQuoteParams({
          fromAsset: 'TON',
          toAsset: 'SOL',
          targetChain: 'solana',
          amount: '10',
        });
      }).toThrow();
    });
  });

  // ===========================================================================
  // SECURITY INVARIANTS
  // ===========================================================================

  describe('Security Invariants', () => {
    test('adapter has no fund custody methods', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const dangerousMethods = methods.filter(m =>
        m.includes('transfer') ||
        m.includes('withdraw') ||
        m.includes('custody') ||
        m.includes('sign') ||
        m.includes('relay') ||
        m.includes('execute')
      );
      expect(dangerousMethods).toHaveLength(0);
    });

    test('adapter cannot verify cross-chain finality', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const verifyMethods = methods.filter(m =>
        m.includes('verifyFinality') ||
        m.includes('confirmOnChain') ||
        m.includes('validateExternal')
      );
      expect(verifyMethods).toHaveLength(0);
    });

    test('bridge intent IDs are unique', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const intent = adapter.createBridgeIntent(
          NFT_ACCOUNT,
          'ethereum',
          `${i + 1}`,
          ETH_ADDRESS
        );
        expect(ids.has(intent.intentId)).toBe(false);
        ids.add(intent.intentId);
      }
    });

    test('confirmed intent preserves original data', () => {
      const intent = adapter.createBridgeIntent(
        NFT_ACCOUNT,
        'ethereum',
        '10.5',
        ETH_ADDRESS
      );

      const confirmed = adapter.confirmBridgeIntent(intent, '0xabc');

      // Original data must be preserved
      expect(confirmed.nftAccountId).toBe(intent.nftAccountId);
      expect(confirmed.targetChain).toBe(intent.targetChain);
      expect(confirmed.amount).toBe(intent.amount);
      expect(confirmed.targetAddress).toBe(intent.targetAddress);
    });
  });
});
