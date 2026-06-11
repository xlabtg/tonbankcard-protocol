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

import { createHmac, timingSafeEqual } from 'crypto';

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
   * NOWPayments signs every IPN callback with HMAC-SHA512 over the JSON body
   * whose keys are sorted recursively, keyed by the merchant's IPN secret. The
   * resulting hex digest is delivered in the `x-nowpayments-sig` header. We
   * recompute that digest and compare it in constant time, which prevents
   * spoofed payment notifications: an attacker who does not know the IPN secret
   * cannot produce a matching signature.
   *
   * @param payload - Callback payload received (raw JSON string or parsed object)
   * @param signature - HMAC-SHA512 signature from the `x-nowpayments-sig` header
   * @returns true if the signature is authentic, false otherwise
   */
  verifyCallback(payload: string | PaymentCallback, signature: string): boolean {
    if (!this.config.ipnSecretKey) {
      throw new Error('IPN Secret Key is required for webhook verification');
    }

    // A missing or non-string signature can never be valid. Bail out before
    // touching crypto so a malformed header cannot throw inside the comparison.
    if (typeof signature !== 'string' || signature.length === 0) {
      return false;
    }

    try {
      // Reproduce the exact canonical form NOWPayments signed (recursively
      // key-sorted JSON); otherwise a genuine callback whose key order differs
      // from a naive JSON.stringify would be wrongly rejected.
      const canonicalPayload = this.canonicalizePayload(payload);
      const expectedSignature = this.calculateHMAC(canonicalPayload, this.config.ipnSecretKey);

      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      // Malformed JSON or any other unexpected error => treat as unverified.
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
   * Produce the canonical string that NOWPayments signs.
   *
   * The IPN signature is computed over the JSON body with **every** object's
   * keys sorted lexicographically (recursively), then `JSON.stringify`-ed. A
   * raw string payload is parsed first so the verifier is independent of the
   * exact byte order the caller happened to capture; an object payload is sorted
   * the same way. Array order is preserved (indices are significant); only
   * object keys are reordered — for the flat IPN bodies NOWPayments actually
   * sends, this matches their reference `sortObject` byte-for-byte.
   *
   * @param payload - Callback payload as received (raw JSON string or object)
   * @returns Deterministic JSON string with recursively sorted keys
   */
  private canonicalizePayload(payload: string | PaymentCallback): string {
    const parsed: unknown = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return JSON.stringify(this.sortObjectKeys(parsed));
  }

  /**
   * Recursively sort object keys so the serialized form is deterministic.
   *
   * Arrays keep their order and have each element sorted; plain objects have
   * their keys reordered lexicographically; primitives are returned unchanged.
   */
  private sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObjectKeys(item));
    }

    if (value !== null && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortObjectKeys((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return value;
  }

  /**
   * Calculate the HMAC-SHA512 signature for webhook verification.
   *
   * Matches the NOWPayments IPN scheme: HMAC-SHA512 of the canonical
   * (recursively key-sorted) JSON body, keyed by the IPN secret, hex-encoded.
   *
   * @param data - Canonical payload string (see {@link canonicalizePayload})
   * @param secret - IPN secret key configured for this merchant
   * @returns Lower-case hex HMAC-SHA512 digest (128 chars)
   */
  private calculateHMAC(data: string, secret: string): string {
    return createHmac('sha512', secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   *
   * Uses Node's `crypto.timingSafeEqual`, which compares in time independent of
   * how many leading bytes match. The length pre-check is itself safe: the
   * expected HMAC-SHA512 hex digest is always 128 chars, so a length mismatch
   * only reveals that the attacker-supplied signature is the wrong size, never
   * how much of a correct-length guess matched.
   */
  private constantTimeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
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
