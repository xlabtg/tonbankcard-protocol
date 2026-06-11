/**
 * TONBANKCARD Mobile Core - Account Service
 *
 * SECURITY NOTICE:
 * This service is READ-ONLY and NON-CUSTODIAL by design.
 * It NEVER signs transactions, stores private keys, or acts as a payment authority.
 * The blockchain is the single source of truth.
 */

import { MobileConfig, CardAccount, AccountState } from '../types';
import { formatTBC } from '../utils';

/**
 * Account Service
 *
 * Provides read-only access to card account information.
 * All data is fetched from the API endpoint or blockchain.
 *
 * CRITICAL: This service NEVER modifies account state or signs transactions.
 */
export class AccountService {
  private config: MobileConfig;

  /**
   * Create an AccountService instance
   *
   * @param config - Mobile SDK configuration
   */
  constructor(config: MobileConfig) {
    this.config = config;
  }

  /**
   * Get card account information
   *
   * READ-ONLY: Queries account state but cannot modify it.
   *
   * The `nftAddress` is percent-encoded before being interpolated into the
   * request path so a value containing URL-significant characters (e.g. `/`,
   * `?`, `&`, `#`) cannot alter the request path or inject query parameters.
   *
   * @param nftAddress - NFT account address
   * @returns Card account information
   */
  async getAccount(nftAddress: string): Promise<CardAccount> {
    if (this.config.apiEndpoint) {
      try {
        const response = await fetch(
          `${this.config.apiEndpoint}/account/${encodeURIComponent(nftAddress)}`
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data: Record<string, unknown> = await response.json() as Record<string, unknown>;
        return {
          nftAddress: String(data.nftAddress),
          balance: String(data.balance),
          state: Number(data.state) as AccountState,
          canSend: Boolean(data.canSend),
          canReceive: Boolean(data.canReceive),
          lastSyncedAt: Number(data.lastSyncedAt),
        };
      } catch (error) {
        throw new Error(
          `Failed to fetch account: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Return placeholder when no API endpoint is configured
    return {
      nftAddress,
      balance: '0',
      state: AccountState.ACTIVE,
      canSend: false,
      canReceive: false,
      lastSyncedAt: 0,
    };
  }

  /**
   * Format balance from nanocoins to human-readable TBC
   *
   * @param nanocoins - Balance in nanocoins (string for precision)
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted balance string
   */
  formatBalance(nanocoins: string, decimals: number = 2): string {
    return formatTBC(nanocoins, decimals);
  }

  /**
   * Get human-readable label for account state
   *
   * @param state - Account state enum value
   * @returns Human-readable state label
   */
  getStateLabel(state: AccountState): string {
    switch (state) {
      case AccountState.ACTIVE:
        return 'Active';
      case AccountState.FROZEN:
        return 'Frozen';
      case AccountState.COLLATERAL_LOCKED:
        return 'Collateral Locked';
      case AccountState.CLOSED:
        return 'Closed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if account is in active state
   *
   * @param account - Card account to check
   * @returns true if account is active
   */
  isAccountActive(account: CardAccount): boolean {
    return account.state === AccountState.ACTIVE;
  }
}
