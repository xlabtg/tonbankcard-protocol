/**
 * TONBANKCARD NOWPayments Adapter
 *
 * This adapter integrates TONBANKCARD with NOWPayments for merchant crypto payment processing.
 *
 * ⚠️ SECURITY & NON-CUSTODIAL GUARANTEES:
 * - This is an off-chain orchestrator service
 * - DOES NOT custody merchant or customer funds
 * - DOES NOT store or have access to private keys
 * - DOES NOT proxy payments through TONBANKCARD
 * - All payments go directly to merchant's wallet
 * - Cannot modify recipient addresses
 * - Cannot hold, intercept, or revert payments
 *
 * SUPPORTED SCENARIOS:
 * - Merchant accepts payment in TON/TBC
 * - Payment verified and tracked on-chain
 * - Linked to merchant's NFT Account for bookkeeping
 *
 * @see https://documenter.getpostman.com/view/7907941/S1a32n38
 */

import type {
  NOWPaymentsConfig,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  PaymentCallback,
  ExternalTransaction,
  ProviderError,
  TransactionStatus,
} from './types';

/**
 * NOWPayments API client for cryptocurrency payment processing
 */
export class NOWPaymentsAdapter {
  private readonly config: Required<NOWPaymentsConfig>;
  private readonly baseUrl: string;

  constructor(config: NOWPaymentsConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.nowpayments.io',
      ipnSecretKey: config.ipnSecretKey,
    };
    this.baseUrl = `${this.config.baseUrl}/v1`;

    if (!this.config.apiKey) {
      throw new Error('NOWPayments API key is required');
    }
  }

  /**
   * Create a payment invoice
   *
   * ⚠️ CRITICAL: This function does NOT custody funds.
   * It creates an invoice/payment request that directs funds to the merchant's wallet.
   * TONBANKCARD never touches the payment flow.
   *
   * @param request - Invoice creation request
   * @returns Invoice details including payment URL
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    try {
      const payload = {
        price_amount: request.price_amount,
        price_currency: request.price_currency,
        pay_currency: request.pay_currency,
        ...(request.ipn_callback_url && { ipn_callback_url: request.ipn_callback_url }),
        ...(request.success_url && { success_url: request.success_url }),
        ...(request.cancel_url && { cancel_url: request.cancel_url }),
        ...(request.order_id && { order_id: request.order_id }),
        ...(request.order_description && { order_description: request.order_description }),
      };

      const response = await fetch(`${this.baseUrl}/invoice`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
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
        invoice_url: data.invoice_url,
        price_amount: data.price_amount,
        price_currency: data.price_currency,
        pay_currency: data.pay_currency,
        pay_amount: data.pay_amount,
        payment_status: data.payment_status,
        order_id: data.order_id,
        created_at: data.created_at,
        ...data,
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get payment status
   *
   * @param paymentId - NOWPayments payment ID
   * @returns Payment status and details
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentCallback> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/${paymentId}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
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
   * Verify webhook callback authenticity
   *
   * NOWPayments uses HMAC signature to verify callback authenticity.
   * This prevents spoofed payment notifications.
   *
   * @param payload - Callback payload received
   * @param signature - HMAC signature from header
   * @returns true if signature is valid
   */
  verifyCallback(payload: string | PaymentCallback, signature: string): boolean {
    if (!this.config.ipnSecretKey) {
      throw new Error('IPN Secret Key is required for webhook verification');
    }

    try {
      // Convert payload to string if it's an object
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // In a real implementation, use crypto.createHmac
      // This is a placeholder that shows the verification pattern
      // Real implementation would require Node.js crypto or Web Crypto API
      const expectedSignature = this.calculateHMAC(payloadString, this.config.ipnSecretKey);

      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Map payment to NFT Account
   *
   * This creates an off-chain association between a NOWPayments transaction
   * and a merchant's NFT Account for bookkeeping.
   *
   * ⚠️ This does NOT give the adapter any control over funds.
   * It only maintains records for merchant accounting.
   *
   * @param invoiceResponse - Invoice creation response
   * @param nftAccountId - Merchant's NFT Account ID
   * @returns ExternalTransaction record for off-chain storage
   */
  mapPaymentToNFTAccount(
    invoiceResponse: CreateInvoiceResponse,
    nftAccountId: string
  ): ExternalTransaction {
    return {
      provider: 'NOWPayments',
      providerTxId: invoiceResponse.id,
      nftAccountId,
      amountIn: invoiceResponse.pay_amount || '0',
      amountOut: invoiceResponse.price_amount,
      assetIn: invoiceResponse.pay_currency,
      assetOut: invoiceResponse.price_currency,
      status: this.mapStatus(invoiceResponse.payment_status),
      createdAt: new Date(invoiceResponse.created_at),
      updatedAt: new Date(),
      metadata: {
        invoiceUrl: invoiceResponse.invoice_url,
        orderId: invoiceResponse.order_id,
        originalStatus: invoiceResponse.payment_status,
      },
    };
  }

  /**
   * Emit payment settled event
   *
   * This is called when a payment is confirmed to update off-chain records.
   * In a real implementation, this would trigger event handlers or webhooks.
   *
   * @param callback - Payment callback data
   * @param nftAccountId - Merchant's NFT Account ID
   * @returns ExternalTransaction record representing the settled payment
   */
  emitPaymentSettledEvent(
    callback: PaymentCallback,
    nftAccountId: string
  ): ExternalTransaction {
    return {
      provider: 'NOWPayments',
      providerTxId: callback.payment_id.toString(),
      nftAccountId,
      amountIn: callback.pay_amount?.toString() || '0',
      amountOut: callback.outcome_amount?.toString() || callback.price_amount.toString(),
      assetIn: callback.pay_currency,
      assetOut: callback.outcome_currency || callback.price_currency,
      status: this.mapStatus(callback.payment_status),
      tonTxHash: callback.payin_hash,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        orderId: callback.order_id,
        purchaseId: callback.purchase_id,
        payAddress: callback.pay_address,
        originalStatus: callback.payment_status,
      },
    };
  }

  /**
   * Get list of available currencies
   *
   * @returns List of supported payment currencies
   */
  async getAvailableCurrencies(): Promise<Array<{ ticker: string; name: string; network?: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/currencies`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      return data.currencies || data;
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get minimum payment amount for a currency
   *
   * @param currency - Currency ticker
   * @returns Minimum payment amount
   */
  async getMinAmount(currency: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/min-amount?currency_from=${currency}&currency_to=${currency}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      return data.min_amount;
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Map NOWPayments status to our internal status
   */
  private mapStatus(nowPaymentsStatus: string): TransactionStatus {
    const statusMap: Record<string, TransactionStatus> = {
      'waiting': 'waiting',
      'confirming': 'confirming',
      'confirmed': 'finished',
      'sending': 'sending',
      'partially_paid': 'pending',
      'finished': 'finished',
      'failed': 'failed',
      'refunded': 'refunded',
      'expired': 'failed',
    };

    return statusMap[nowPaymentsStatus.toLowerCase()] || 'pending';
  }

  /**
   * Calculate HMAC signature for webhook verification
   *
   * NOTE: This is a placeholder. Real implementation requires:
   * - Node.js: crypto.createHmac('sha512', secret).update(data).digest('hex')
   * - Browser: Web Crypto API SubtleCrypto.sign()
   */
  private calculateHMAC(data: string, secret: string): string {
    // Placeholder - actual implementation would use crypto
    // This should be implemented with proper HMAC-SHA512
    return `hmac_placeholder_${data.length}_${secret.length}`;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Handle API errors
   */
  private async handleError(response: Response): Promise<ProviderError> {
    let message = 'NOWPayments API error';
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
      provider: 'NOWPayments',
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
      provider: 'NOWPayments',
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
 * Factory function to create NOWPayments adapter instance
 *
 * @param apiKey - NOWPayments API key
 * @param ipnSecretKey - Optional IPN secret key for webhook verification
 * @returns Configured NOWPayments adapter
 */
export function createNOWPaymentsAdapter(apiKey: string, ipnSecretKey?: string): NOWPaymentsAdapter {
  return new NOWPaymentsAdapter({ apiKey, ipnSecretKey });
}
