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
   * @param request - Payment request parameters
   * @returns ton:// deep link URL
   */
  generatePaymentLink(request: PaymentRequest): string {
    const parts = [
      'TONBANKCARD Payment',
      request.orderId ? `Order: ${request.orderId}` : '',
      request.description || '',
    ]
      .filter(Boolean)
      .join(' | ');

    const text = encodeURIComponent(parts);
    let link = `ton://transfer/${request.merchantNft}?amount=${request.amountTbc}&text=${text}`;

    if (request.returnUrl) {
      link += `&return=${encodeURIComponent(request.returnUrl)}`;
    }

    return link;
  }

  /**
   * Get transaction history for an account
   *
   * READ-ONLY: Queries transaction history from the API endpoint.
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
        `${this.config.apiEndpoint}/transactions/${nftAddress}`
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
   * @param txId - Transaction identifier
   * @returns Transaction item or null if not found
   */
  async getTransactionById(txId: string): Promise<TransactionItem | null> {
    if (!this.config.apiEndpoint) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/transaction/${txId}`
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
