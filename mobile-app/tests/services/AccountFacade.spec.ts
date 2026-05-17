import { describe, it, expect } from '@jest/globals';
import {
  AccountService,
  AccountState,
  type CardAccount,
} from '@tonbankcard/mobile-core';

import { AccountFacade } from '../../src/lib/services/AccountFacade';
import { DEFAULT_MAINNET_CONFIG, type AppConfig } from '../../src/lib/config';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const NFT_ADDRESS = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';

function makeConfig(): AppConfig {
  return { ...DEFAULT_MAINNET_CONFIG, paymentHubAddress: VALID_HUB };
}

class StubAccountService extends AccountService {
  constructor(private readonly account: CardAccount) {
    super({ network: 'testnet', paymentHubAddress: VALID_HUB });
  }
  override async getAccount(_address: string): Promise<CardAccount> {
    return this.account;
  }
}

describe('AccountFacade', () => {
  it('returns a formatted snapshot', async () => {
    const account: CardAccount = {
      nftAddress: NFT_ADDRESS,
      balance: '12345678900',
      state: AccountState.ACTIVE,
      canSend: true,
      canReceive: true,
      lastSyncedAt: 1700000000,
    };

    const facade = new AccountFacade(makeConfig(), new StubAccountService(account));
    const snapshot = await facade.getSnapshot(NFT_ADDRESS);

    expect(snapshot.nftAddress).toBe(NFT_ADDRESS);
    expect(snapshot.balanceNanocoins).toBe('12345678900');
    expect(snapshot.balanceFormatted).toBe('12.35 TBC');
    expect(snapshot.canSend).toBe(true);
    expect(snapshot.canReceive).toBe(true);
    expect(snapshot.shortAddress.length).toBeLessThan(NFT_ADDRESS.length);
    expect(snapshot.state).toBe(AccountState.ACTIVE);
    expect(snapshot.lastSyncedAt).toBe(1700000000);
  });

  it('propagates frozen state without mutation', async () => {
    const account: CardAccount = {
      nftAddress: NFT_ADDRESS,
      balance: '0',
      state: AccountState.FROZEN,
      canSend: false,
      canReceive: false,
      lastSyncedAt: 0,
    };

    const facade = new AccountFacade(makeConfig(), new StubAccountService(account));
    const snapshot = await facade.getSnapshot(NFT_ADDRESS);

    expect(snapshot.state).toBe(AccountState.FROZEN);
    expect(snapshot.canSend).toBe(false);
    expect(snapshot.canReceive).toBe(false);
    expect(snapshot.balanceFormatted).toBe('0.00 TBC');
  });

  it('constructs a default service from config when none is supplied', () => {
    const facade = new AccountFacade(makeConfig());
    expect(facade).toBeInstanceOf(AccountFacade);
  });
});
