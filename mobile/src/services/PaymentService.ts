/**
 * TONBANKCARD Mobile Core - Payment Service
 *
 * SECURITY NOTICE:
 * This service generates payment links ONLY. It NEVER executes payments,
 * signs transactions, stores private keys, or acts as a payment authority.
 * All payments require explicit user wallet consent.
 * The blockchain is the single source of truth.
 */

import { MobileConfig, PaymentRequest, TransactionItem } from '../types';
import { assertAmount, assertReturnUrl, isValidTonAddress } from '../utils';

/**
 * Payment Service
 *
 * Provides payment link generation and read-only transaction history.
 *
 * CRITICAL: This service NEVER initiates payments or signs transactions.
 * It generates deep links that open the user's wallet for consent.
 */
export class PaymentService {
  private config: MobileConfig;

  /**
   * Create a PaymentService instance
   *
   * @param config - Mobile SDK configuration
   */
  constructor(config: MobileConfig) {
    this.config = config;
  }

  /**
   * Generate a TON Connect payment deep link
   *
   * This creates a ton:// deep link that opens the user's wallet
   * with pre-filled payment details. The user MUST approve the transaction.
   *
   * SECURITY: This does NOT execute the payment. User consent is required.
   *
   * Every user-controlled field is validated and encoded exactly once so that
   * a value containing reserved characters (e.g. `&` or `=`) cannot inject
   * additional query parameters into the generated deep link.
   *
   * @param request - Payment request parameters
   * @returns ton:// deep link URL
   * @throws Error if `merchantNft` is not a valid TON address or `amountTbc`
   *         is not a non-negative numeric string
   */
  generatePaymentLink(request: PaymentRequest): string {
    if (!isValidTonAddress(request.merchantNft)) {
      throw new Error(`Invalid merchant NFT address: ${String(request.merchantNft)}`);
    }

    const amount = assertAmount(request.amountTbc);

    const parts = [
      'TONBANKCARD Payment',
      request.orderId ? `Order: ${request.orderId}` : '',
      request.description || '',
    ]
      .filter(Boolean)
      .join(' | ');

    const merchant = encodeURIComponent(request.merchantNft);
    const text = encodeURIComponent(parts);
    let link = `ton://transfer/${merchant}?amount=${encodeURIComponent(amount)}&text=${text}`;

    if (request.returnUrl) {
      const returnUrl = assertReturnUrl(request.returnUrl, {
        allowedHosts: this.config.allowedReturnUrlHosts,
      });
      link += `&return=${encodeURIComponent(returnUrl)}`;
    }

    return link;
  }

  /**
   * Get transaction history for an account
   *
   * READ-ONLY: Queries transaction history from the API endpoint.
   *
   * The `nftAddress` is percent-encoded before being interpolated into the
   * request path so a value containing URL-significant characters (e.g. `/`,
   * `?`, `&`, `#`) cannot alter the request path or inject query parameters.
   *
   * @param nftAddress - NFT account address
   * @returns Array of transaction items
   */
  async getTransactionHistory(nftAddress: string): Promise<TransactionItem[]> {
    if (!this.config.apiEndpoint) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/transactions/${encodeURIComponent(nftAddress)}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: unknown[] = await response.json() as unknown[];
      return data.map((item) => {
        const tx = item as Record<string, unknown>;
        return {
          id: String(tx.id),
          type: String(tx.type) as 'send' | 'receive',
          counterparty: String(tx.counterparty),
          amount: String(tx.amount),
          timestamp: Number(tx.timestamp),
          status: String(tx.status) as 'confirmed' | 'pending',
          txHash: tx.txHash ? String(tx.txHash) : undefined,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch transactions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a single transaction by ID
   *
   * READ-ONLY: Queries transaction details from the API endpoint.
   *
   * The `txId` is percent-encoded before being interpolated into the request
   * path so a value containing URL-significant characters cannot alter the
   * request path or inject query parameters.
   *
   * @param txId - Transaction identifier
   * @returns Transaction item or null if not found
   */
  async getTransactionById(txId: string): Promise<TransactionItem | null> {
    if (!this.config.apiEndpoint) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/transaction/${encodeURIComponent(txId)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API error: ${response.statusText}`);
      }

      const tx: Record<string, unknown> = await response.json() as Record<string, unknown>;
      return {
        id: String(tx.id),
        type: String(tx.type) as 'send' | 'receive',
        counterparty: String(tx.counterparty),
        amount: String(tx.amount),
        timestamp: Number(tx.timestamp),
        status: String(tx.status) as 'confirmed' | 'pending',
        txHash: tx.txHash ? String(tx.txHash) : undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch transaction: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
