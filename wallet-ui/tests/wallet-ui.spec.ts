/**
 * Unit tests for TONBANKCARD Wallet UI
 *
 * Tests the wallet UI's configuration validation, state management,
 * and utility functions.
 * DOM rendering tests are excluded as they require a browser environment.
 */

import { describe, it, expect } from '@jest/globals';
import { TonbankcardWalletUI } from '../src/components/WalletApp';
import { formatTBC, shortAddress, formatDate, getAccountStateLabel } from '../src/utils';
import { AccountState, WalletView } from '../src/types';
import type { WalletAccount, TransactionRecord } from '../src/types';

const testConfig = {
  containerId: 'wallet-container',
  network: 'mainnet' as const,
  paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
};

const testAccount: WalletAccount = {
  nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  balance: '5000000000',
  state: AccountState.ACTIVE,
  canSend: true,
  canReceive: true,
};

const testTransactions: TransactionRecord[] = [
  {
    id: 'tx-001',
    type: 'receive',
    counterparty: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX6gPJkNZ0dGEds1rJj0',
    amount: '1000000000',
    timestamp: 1700000000,
    status: 'confirmed',
    txHash: 'abc123',
  },
  {
    id: 'tx-002',
    type: 'send',
    counterparty: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    amount: '500000000',
    timestamp: 1700001000,
    status: 'pending',
  },
];

describe('TonbankcardWalletUI', () => {
  describe('constructor validation', () => {
    it('should create wallet UI with valid config', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      expect(wallet).toBeDefined();
    });

    it('should throw on missing containerId', () => {
      expect(() => new TonbankcardWalletUI({
        ...testConfig,
        containerId: '',
      })).toThrow('containerId is required');
    });

    it('should throw on missing network', () => {
      expect(() => new TonbankcardWalletUI({
        ...testConfig,
        network: '' as 'mainnet',
      })).toThrow('network is required');
    });

    it('should throw on missing paymentHubAddress', () => {
      expect(() => new TonbankcardWalletUI({
        ...testConfig,
        paymentHubAddress: '',
      })).toThrow('paymentHubAddress is required');
    });

    it('should accept optional theme parameter', () => {
      const wallet = new TonbankcardWalletUI({
        ...testConfig,
        theme: 'dark',
      });
      expect(wallet).toBeDefined();
    });
  });

  describe('setAccount', () => {
    it('should update internal account state', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      wallet.setAccount(testAccount);
      expect(wallet.getAccount()).toEqual(testAccount);
    });

    it('should update account with frozen state', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      const frozenAccount: WalletAccount = {
        ...testAccount,
        state: AccountState.FROZEN,
        canSend: false,
      };
      wallet.setAccount(frozenAccount);
      expect(wallet.getAccount()?.state).toBe(AccountState.FROZEN);
      expect(wallet.getAccount()?.canSend).toBe(false);
    });

    it('should replace previous account data', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      wallet.setAccount(testAccount);
      const newAccount: WalletAccount = {
        ...testAccount,
        balance: '9999000000000',
      };
      wallet.setAccount(newAccount);
      expect(wallet.getAccount()?.balance).toBe('9999000000000');
    });
  });

  describe('setTransactions', () => {
    it('should update internal transaction list', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      wallet.setTransactions(testTransactions);
      expect(wallet.getTransactions()).toEqual(testTransactions);
    });

    it('should handle empty transaction list', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      wallet.setTransactions([]);
      expect(wallet.getTransactions()).toEqual([]);
    });

    it('should replace previous transactions', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      wallet.setTransactions(testTransactions);
      wallet.setTransactions([]);
      expect(wallet.getTransactions()).toEqual([]);
    });
  });

  describe('generateConnectLink', () => {
    it('should generate a valid TON deep link', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      const link = wallet.generateConnectLink();
      expect(link).toContain('ton://transfer/');
      expect(link).toContain(testConfig.paymentHubAddress);
      expect(link).toContain('text=');
    });
  });

  describe('getCurrentView', () => {
    it('should default to balance view', () => {
      const wallet = new TonbankcardWalletUI(testConfig);
      expect(wallet.getCurrentView()).toBe(WalletView.BALANCE);
    });
  });
});

describe('formatTBC', () => {
  it('should format nanocoins to TBC with default decimals', () => {
    expect(formatTBC('1000000000')).toBe('1.00');
  });

  it('should format nanocoins with custom decimals', () => {
    expect(formatTBC('1500000000', 4)).toBe('1.5000');
  });

  it('should format zero', () => {
    expect(formatTBC('0')).toBe('0.00');
  });

  it('should handle large amounts', () => {
    expect(formatTBC('999000000000')).toBe('999.00');
  });

  it('should handle fractional amounts', () => {
    expect(formatTBC('123456789')).toBe('0.12');
  });

  it('should format amounts above Number.MAX_SAFE_INTEGER exactly', () => {
    expect(formatTBC('90071992547409910', 9)).toBe('90071992.547409910');
  });

  it('should round fractional display values without floating point drift', () => {
    expect(formatTBC('995000000')).toBe('1.00');
  });
});

describe('shortAddress', () => {
  it('should shorten a long address', () => {
    const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
    const result = shortAddress(addr);
    expect(result).toBe('EQAjHk...3il-Le');
  });

  it('should return short address unchanged', () => {
    expect(shortAddress('abc')).toBe('abc');
  });

  it('should respect custom chars parameter', () => {
    const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
    const result = shortAddress(addr, 4);
    expect(result).toBe('EQAj...l-Le');
  });
});

describe('formatDate', () => {
  it('should format a unix timestamp', () => {
    const result = formatDate(1700000000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle zero timestamp', () => {
    const result = formatDate(0);
    expect(typeof result).toBe('string');
  });
});

describe('getAccountStateLabel', () => {
  it('should return Active for ACTIVE state', () => {
    expect(getAccountStateLabel(AccountState.ACTIVE)).toBe('Active');
  });

  it('should return Frozen for FROZEN state', () => {
    expect(getAccountStateLabel(AccountState.FROZEN)).toBe('Frozen');
  });

  it('should return Collateral Locked for COLLATERAL_LOCKED state', () => {
    expect(getAccountStateLabel(AccountState.COLLATERAL_LOCKED)).toBe('Collateral Locked');
  });

  it('should return Closed for CLOSED state', () => {
    expect(getAccountStateLabel(AccountState.CLOSED)).toBe('Closed');
  });

  it('should return Unknown for unrecognized state', () => {
    expect(getAccountStateLabel(99 as AccountState)).toBe('Unknown');
  });
});
