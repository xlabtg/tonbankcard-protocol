/**
 * TONBANKCARD Cross-Chain Bridge Adapter
 *
 * This adapter coordinates cross-chain bridge operations between
 * TON and external blockchains via external swap providers.
 *
 * ============================================================================
 * ⚠️ CRITICAL: NON-CUSTODIAL BRIDGE ADAPTER
 * ============================================================================
 *
 * This adapter DOES NOT:
 * - Custody funds on any chain
 * - Hold private keys for any chain
 * - Execute cross-chain transactions directly
 * - Guarantee cross-chain finality
 * - Act as a relay or validator
 *
 * This adapter ONLY:
 * - Coordinates with external swap providers (ChangeNOW)
 * - Tracks bridge intents and their status
 * - Provides quotes and routing information
 * - Maps bridge operations to NFT accounts
 *
 * TRUST MODEL:
 * - Users trust their wallet for TON-side transactions
 * - Cross-chain swap execution is handled by external providers
 * - Bridge status tracking is for UX/display purposes only
 * - Protocol cannot verify cross-chain finality directly
 *
 * @see docs/security/THREAT_MODEL.md (section 4.4.4 "Cross-chain spoofing")
 */

import type {
  BridgeConfig,
  BridgeIntent,
  BridgeQuoteRequest,
  BridgeQuoteResponse,
  BridgeTargetChain,
  ExternalProvider,
  ProviderError,
  BRIDGE_CHAIN_IDS,
} from './types';

/**
 * Default supported chains
 */
const DEFAULT_SUPPORTED_CHAINS: BridgeTargetChain[] = [
  'ethereum',
  'bitcoin',
  'bsc',
  'polygon',
  'solana',
];

/**
 * Chain ticker mapping for external providers
 */
const CHAIN_TICKERS: Record<BridgeTargetChain, string> = {
  ethereum: 'eth',
  bitcoin: 'btc',
  bsc: 'bnb',
  polygon: 'matic',
  solana: 'sol',
};

/**
 * Chain network names for ChangeNOW API
 */
const CHAIN_NETWORKS: Record<BridgeTargetChain, string> = {
  ethereum: 'eth',
  bitcoin: 'btc',
  bsc: 'bsc',
  polygon: 'matic',
  solana: 'sol',
};

/**
 * Cross-Chain Bridge Adapter
 *
 * A non-custodial coordination layer for bridging assets
 * between TON and external blockchains via external providers.
 */
export class CrossChainBridgeAdapter {
  private readonly config: Required<BridgeConfig>;

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = {
      supportedChains: config.supportedChains || DEFAULT_SUPPORTED_CHAINS,
      defaultProvider: config.defaultProvider || 'ChangeNOW',
      bridgeContractAddress: config.bridgeContractAddress || '',
    };
  }

  // ===========================================================================
  // BRIDGE INTENT MANAGEMENT
  // ===========================================================================

  /**
   * Create a bridge intent
   *
   * This creates an off-chain record of the user's intent to bridge assets.
   * The actual cross-chain swap is initiated separately through the provider.
   *
   * ⚠️ This does NOT move funds. User must initiate the swap themselves.
   *
   * @param nftAccountId - NFT Account ID
   * @param targetChain - Target blockchain
   * @param amount - Amount to bridge
   * @param targetAddress - Destination address on target chain
   * @returns Bridge intent record
   */
  createBridgeIntent(
    nftAccountId: string,
    targetChain: BridgeTargetChain,
    amount: string,
    targetAddress: string
  ): BridgeIntent {
    // Validate chain is supported
    if (!this.isChainSupported(targetChain)) {
      throw this.createError(
        `Unsupported target chain: ${targetChain}`,
        'UNSUPPORTED_CHAIN'
      );
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      throw this.createError('Invalid bridge amount', 'INVALID_AMOUNT');
    }

    // Validate target address
    if (!targetAddress || targetAddress.trim().length === 0) {
      throw this.createError(
        'Target address is required',
        'INVALID_ADDRESS'
      );
    }

    const intentId = this.generateIntentId();
    const now = new Date();

    return {
      intentId,
      nftAccountId,
      targetChain,
      amount,
      targetAddress,
      provider: this.config.defaultProvider,
      status: 'pending',
      createdAt: now,
    };
  }

  /**
   * Update bridge intent with provider transaction ID
   *
   * After the user initiates a swap through the provider,
   * this links the provider's transaction to the bridge intent.
   *
   * @param intent - Existing bridge intent
   * @param providerTxId - Provider's transaction ID
   * @returns Updated bridge intent
   */
  linkProviderTransaction(
    intent: BridgeIntent,
    providerTxId: string
  ): BridgeIntent {
    return {
      ...intent,
      providerTxId,
      status: 'pending',
    };
  }

  /**
   * Mark bridge intent as confirmed
   *
   * ⚠️ NOTE: This is for TRACKING and UX only.
   * The protocol cannot verify cross-chain finality.
   *
   * @param intent - Existing bridge intent
   * @param externalTxHash - Transaction hash on target chain
   * @returns Updated bridge intent
   */
  confirmBridgeIntent(
    intent: BridgeIntent,
    externalTxHash: string
  ): BridgeIntent {
    return {
      ...intent,
      status: 'confirmed',
      confirmedAt: new Date(),
      externalTxHash,
    };
  }

  /**
   * Cancel a bridge intent
   *
   * @param intent - Existing bridge intent
   * @returns Cancelled bridge intent
   */
  cancelBridgeIntent(intent: BridgeIntent): BridgeIntent {
    if (intent.status !== 'pending') {
      throw this.createError(
        'Can only cancel pending intents',
        'INVALID_STATUS'
      );
    }

    return {
      ...intent,
      status: 'cancelled',
    };
  }

  // ===========================================================================
  // QUOTE AND ROUTING
  // ===========================================================================

  /**
   * Get bridge quote parameters for external provider
   *
   * This provides the parameters needed to request a quote from
   * the external swap provider. The actual quote is fetched
   * through the provider's adapter (e.g., ChangeNOW).
   *
   * @param request - Bridge quote request
   * @returns Parameters for the external provider
   */
  getBridgeQuoteParams(request: BridgeQuoteRequest): {
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    amount: string;
  } {
    if (!this.isChainSupported(request.targetChain)) {
      throw this.createError(
        `Unsupported target chain: ${request.targetChain}`,
        'UNSUPPORTED_CHAIN'
      );
    }

    return {
      fromCurrency: request.fromAsset.toLowerCase(),
      toCurrency: request.toAsset.toLowerCase(),
      fromNetwork: 'ton',
      toNetwork: CHAIN_NETWORKS[request.targetChain],
      amount: request.amount,
    };
  }

  // ===========================================================================
  // CHAIN SUPPORT
  // ===========================================================================

  /**
   * Check if a chain is supported for bridging
   *
   * @param chain - Target chain
   * @returns Whether chain is supported
   */
  isChainSupported(chain: BridgeTargetChain): boolean {
    return this.config.supportedChains.includes(chain);
  }

  /**
   * Get list of supported chains
   *
   * @returns Supported chain list
   */
  getSupportedChains(): BridgeTargetChain[] {
    return [...this.config.supportedChains];
  }

  /**
   * Get chain ticker for external providers
   *
   * @param chain - Target chain
   * @returns Ticker string
   */
  getChainTicker(chain: BridgeTargetChain): string {
    return CHAIN_TICKERS[chain] || chain;
  }

  /**
   * Get chain network name for external providers
   *
   * @param chain - Target chain
   * @returns Network name
   */
  getChainNetwork(chain: BridgeTargetChain): string {
    return CHAIN_NETWORKS[chain] || chain;
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  /**
   * Generate unique intent ID
   */
  private generateIntentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `bridge_${timestamp}_${random}`;
  }

  /**
   * Create standardized provider error
   */
  private createError(message: string, code?: string): ProviderError {
    return {
      message,
      code,
      provider: this.config.defaultProvider,
    };
  }
}

/**
 * Factory function to create Cross-Chain Bridge adapter
 *
 * @param config - Optional configuration
 * @returns Configured bridge adapter
 */
export function createBridgeAdapter(
  config?: Partial<BridgeConfig>
): CrossChainBridgeAdapter {
  return new CrossChainBridgeAdapter(config);
}
