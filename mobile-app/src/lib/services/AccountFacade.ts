/**
 * Thin facade around @tonbankcard/mobile-core's AccountService.
 *
 * NON-CUSTODIAL:
 * - Wraps a READ-ONLY service.
 * - NEVER signs, stores, or transmits private keys.
 * - Exposes the same on-chain truth the core package observes.
 */

import {
  AccountService,
  type CardAccount,
  formatTBC,
  shortAddress,
} from '@tonbankcard/mobile-core';

import type { AppConfig } from '../config';

export interface AccountSnapshot {
  readonly nftAddress: string;
  readonly shortAddress: string;
  readonly balanceNanocoins: string;
  readonly balanceFormatted: string;
  readonly state: CardAccount['state'];
  readonly canSend: boolean;
  readonly canReceive: boolean;
  readonly lastSyncedAt: number;
}

export class AccountFacade {
  private readonly service: AccountService;

  constructor(config: AppConfig, service?: AccountService) {
    this.service = service ?? new AccountService(config);
  }

  async getSnapshot(nftAddress: string): Promise<AccountSnapshot> {
    const account = await this.service.getAccount(nftAddress);
    return {
      nftAddress: account.nftAddress,
      shortAddress: shortAddress(account.nftAddress),
      balanceNanocoins: account.balance,
      balanceFormatted: `${formatTBC(account.balance, 2)} TBC`,
      state: account.state,
      canSend: account.canSend,
      canReceive: account.canReceive,
      lastSyncedAt: account.lastSyncedAt,
    };
  }
}
