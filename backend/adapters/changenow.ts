/**
 * TONBANKCARD ChangeNOW Adapter
 *
 * This adapter integrates TONBANKCARD with ChangeNOW for crypto swap and on/off-ramp functionality.
 *
 * ⚠️ SECURITY & NON-CUSTODIAL GUARANTEES:
 * - This is an off-chain orchestrator service
 * - DOES NOT custody user funds at any point
 * - DOES NOT store or have access to private keys
 * - DOES NOT proxy money through TONBANKCARD
 * - All swaps are user-initiated and controlled
 * - Cannot modify recipient addresses
 * - Cannot hold or revert transactions
 *
 * SUPPORTED FLOWS:
 * - TON → external chain (BTC, ETH, etc.)
 * - External chain → TON (via user wallet)
 * - TBC ↔ TON (via existing TONCO pool, then ChangeNOW)
 *
 * @see https://changenow.io/api/docs
 */

import type {
  ChangeNOWConfig,
  CreateSwapRequest,
  CreateSwapResponse,
  SwapQuote,
  ExternalTransaction,
  ProviderError,
  TransactionStatus,
} from './types';

/**
 * ChangeNOW API client for cryptocurrency exchange operations
 */
export class ChangeNOWAdapter {
  private readonly config: Required<ChangeNOWConfig>;
  private readonly baseUrl: string;

  constructor(config: ChangeNOWConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.changenow.io',
      apiVersion: config.apiVersion || 'v2',
    };
    this.baseUrl = `${this.config.baseUrl}/${this.config.apiVersion}`;

    if (!this.config.apiKey) {
      throw new Error('ChangeNOW API key is required');
    }
  }

  /**
   * Get estimated exchange quote
   *
   * This provides a non-binding estimate for user information only.
   * Users initiate the actual swap after reviewing the quote.
   *
   * @param fromCurrency - Source currency ticker
   * @param toCurrency - Destination currency ticker
   * @param fromAmount - Amount to exchange
   * @param flow - Exchange flow type ('standard' or 'fixed-rate')
   * @returns Estimated exchange quote
   */
  async getQuote(
    fromCurrency: string,
    toCurrency: string,
    fromAmount: string,
    flow: 'standard' | 'fixed-rate' = 'standard'
  ): Promise<SwapQuote> {
    try {
      const endpoint = flow === 'fixed-rate'
        ? `${this.baseUrl}/exchange/estimated-amount`
        : `${this.baseUrl}/exchange/estimated-amount`;

      const params = new URLSearchParams({
        fromCurrency: fromCurrency.toLowerCase(),
        toCurrency: toCurrency.toLowerCase(),
        fromAmount,
        flow,
      });

      const response = await fetch(`${endpoint}?${params}`, {
        method: 'GET',
        headers: {
          'x-changenow-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();

      return {
        estimatedAmount: data.toAmount || data.estimatedAmount,
        rate: data.rate,
        rateId: data.rateId,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        networkFee: data.networkFee,
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Create a new exchange (swap) transaction
   *
   * ⚠️ CRITICAL: This function does NOT custody funds.
   * It only creates an exchange order with ChangeNOW.
   * User must manually send funds to the provided deposit address.
   *
   * @param request - Exchange creation request
   * @returns Exchange details including deposit address
   */
  async createSwap(request: CreateSwapRequest): Promise<CreateSwapResponse> {
    try {
      const payload = {
        fromCurrency: request.fromCurrency.toLowerCase(),
        toCurrency: request.toCurrency.toLowerCase(),
        fromNetwork: request.fromNetwork.toLowerCase(),
        toNetwork: request.toNetwork.toLowerCase(),
        fromAmount: request.fromAmount,
        address: request.address, // USER-CONTROLLED destination address
        flow: request.flow,
        ...(request.refundAddress && { refundAddress: request.refundAddress }),
        ...(request.extraId && { extraId: request.extraId }),
      };

      const response = await fetch(`${this.baseUrl}/exchange`, {
        method: 'POST',
        headers: {
          'x-changenow-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();

      return {
        id: data.id,
        payinAddress: data.payinAddress,
        payoutAddress: data.payoutAddress,
        fromAmount: data.fromAmount,
        toAmount: data.toAmount,
        status: data.status,
        payoutHash: data.payoutHash,
        ...data,
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get the current status of an exchange
   *
   * This is used to track swap progress and update off-chain records.
   *
   * @param exchangeId - ChangeNOW exchange ID
   * @returns Current exchange status and details
   */
  async trackSwapStatus(exchangeId: string): Promise<CreateSwapResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/exchange/by-id?id=${exchangeId}`, {
        method: 'GET',
        headers: {
          'x-changenow-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();

      return {
        id: data.id,
        payinAddress: data.payinAddress,
        payoutAddress: data.payoutAddress,
        fromAmount: data.fromAmount,
        toAmount: data.toAmount,
        status: data.status,
        payoutHash: data.payoutHash,
        ...data,
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Map ChangeNOW swap to NFT Account
   *
   * This creates an off-chain association between a ChangeNOW swap
   * and a TONBANKCARD NFT Account for tracking purposes.
   *
   * ⚠️ This does NOT give the adapter any control over funds.
   * It only maintains an audit trail for user convenience.
   *
   * @param swapResponse - Swap creation response from ChangeNOW
   * @param nftAccountId - NFT Account ID
   * @returns ExternalTransaction record for off-chain storage
   */
  mapSwapToNFTAccount(
    swapResponse: CreateSwapResponse,
    nftAccountId: string
  ): ExternalTransaction {
    return {
      provider: 'ChangeNOW',
      providerTxId: swapResponse.id,
      nftAccountId,
      amountIn: swapResponse.fromAmount,
      amountOut: swapResponse.toAmount,
      assetIn: this.extractAsset(swapResponse, 'from'),
      assetOut: this.extractAsset(swapResponse, 'to'),
      status: this.mapStatus(swapResponse.status),
      tonTxHash: swapResponse.payoutHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        payinAddress: swapResponse.payinAddress,
        payoutAddress: swapResponse.payoutAddress,
        originalStatus: swapResponse.status,
      },
    };
  }

  /**
   * Get minimum exchange amount for a currency pair
   *
   * @param fromCurrency - Source currency
   * @param toCurrency - Destination currency
   * @returns Minimum amount
   */
  async getMinAmount(fromCurrency: string, toCurrency: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        fromCurrency: fromCurrency.toLowerCase(),
        toCurrency: toCurrency.toLowerCase(),
      });

      const response = await fetch(`${this.baseUrl}/exchange/min-amount?${params}`, {
        method: 'GET',
        headers: {
          'x-changenow-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      return data.minAmount;
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get list of available currencies
   *
   * @returns List of supported currencies
   */
  async getAvailableCurrencies(): Promise<Array<{ ticker: string; name: string; network?: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/exchange/currencies`, {
        method: 'GET',
        headers: {
          'x-changenow-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Map ChangeNOW status to our internal status
   */
  private mapStatus(changeNowStatus: string): TransactionStatus {
    const statusMap: Record<string, TransactionStatus> = {
      'new': 'pending',
      'waiting': 'waiting',
      'confirming': 'confirming',
      'exchanging': 'exchanging',
      'sending': 'sending',
      'finished': 'finished',
      'failed': 'failed',
      'refunded': 'refunded',
      'expired': 'failed',
    };

    return statusMap[changeNowStatus.toLowerCase()] || 'pending';
  }

  /**
   * Extract asset ticker from response
   */
  private extractAsset(response: CreateSwapResponse, direction: 'from' | 'to'): string {
    const key = direction === 'from' ? 'fromCurrency' : 'toCurrency';
    return (response as any)[key] || 'unknown';
  }

  /**
   * Handle API errors
   */
  private async handleError(response: Response): Promise<ProviderError> {
    let message = 'ChangeNOW API error';
    let code: string | undefined;

    try {
      const error = await response.json();
      message = error.message || error.error || message;
      code = error.code;
    } catch {
      message = response.statusText || message;
    }

    return {
      message,
      code,
      statusCode: response.status,
      provider: 'ChangeNOW',
    };
  }

  /**
   * Wrap errors with provider context
   */
  private wrapError(error: unknown): ProviderError {
    if (this.isProviderError(error)) {
      return error;
    }

    return {
      message: error instanceof Error ? error.message : 'Unknown error',
      provider: 'ChangeNOW',
    };
  }

  /**
   * Type guard for ProviderError
   */
  private isProviderError(error: unknown): error is ProviderError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'provider' in error &&
      'message' in error
    );
  }
}

/**
 * Factory function to create ChangeNOW adapter instance
 *
 * @param apiKey - ChangeNOW API key
 * @returns Configured ChangeNOW adapter
 */
export function createChangeNOWAdapter(apiKey: string): ChangeNOWAdapter {
  return new ChangeNOWAdapter({ apiKey });
}
