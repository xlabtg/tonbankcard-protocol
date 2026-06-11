/**
 * Unit tests for AccountService
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { AccountService } from '../src/services/AccountService';
import { AccountState, MobileConfig, CardAccount } from '../src/types';

const testConfig: MobileConfig = {
  network: 'testnet',
  paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
};

const apiConfig: MobileConfig = {
  ...testConfig,
  apiEndpoint: 'https://api.example.com',
};

/** Build a minimal `fetch`-compatible Response stub for the mocked calls. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response;
}

describe('AccountService', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const service = new AccountService(testConfig);
      expect(service).toBeInstanceOf(AccountService);
    });

    it('should accept mainnet config', () => {
      const config: MobileConfig = {
        network: 'mainnet',
        paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
      };
      const service = new AccountService(config);
      expect(service).toBeInstanceOf(AccountService);
    });
  });

  describe('formatBalance', () => {
    const service = new AccountService(testConfig);

    it('should format nanocoins to TBC with default decimals', () => {
      expect(service.formatBalance('10500000000')).toBe('10.50');
    });

    it('should format 1 TBC correctly', () => {
      expect(service.formatBalance('1000000000')).toBe('1.00');
    });

    it('should format zero balance', () => {
      expect(service.formatBalance('0')).toBe('0.00');
    });

    it('should support custom decimal places', () => {
      expect(service.formatBalance('10500000000', 4)).toBe('10.5000');
    });

    it('should support zero decimal places', () => {
      expect(service.formatBalance('10500000000', 0)).toBe('11');
    });

    it('should handle small amounts', () => {
      expect(service.formatBalance('123456789')).toBe('0.12');
    });

    it('should format amounts above Number.MAX_SAFE_INTEGER exactly', () => {
      expect(service.formatBalance('90071992547409910', 9)).toBe(
        '90071992.547409910'
      );
    });

    it('should round fractional display values without floating point drift', () => {
      expect(service.formatBalance('995000000')).toBe('1.00');
    });
  });

  describe('getStateLabel', () => {
    const service = new AccountService(testConfig);

    it('should return "Active" for ACTIVE state', () => {
      expect(service.getStateLabel(AccountState.ACTIVE)).toBe('Active');
    });

    it('should return "Frozen" for FROZEN state', () => {
      expect(service.getStateLabel(AccountState.FROZEN)).toBe('Frozen');
    });

    it('should return "Collateral Locked" for COLLATERAL_LOCKED state', () => {
      expect(service.getStateLabel(AccountState.COLLATERAL_LOCKED)).toBe(
        'Collateral Locked'
      );
    });

    it('should return "Closed" for CLOSED state', () => {
      expect(service.getStateLabel(AccountState.CLOSED)).toBe('Closed');
    });

    it('should return "Unknown" for unrecognized state', () => {
      expect(service.getStateLabel(99 as AccountState)).toBe('Unknown');
    });
  });

  describe('isAccountActive', () => {
    const service = new AccountService(testConfig);

    it('should return true for active account', () => {
      const account: CardAccount = {
        nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        balance: '1000000000',
        state: AccountState.ACTIVE,
        canSend: true,
        canReceive: true,
        lastSyncedAt: 1234567890,
      };
      expect(service.isAccountActive(account)).toBe(true);
    });

    it('should return false for frozen account', () => {
      const account: CardAccount = {
        nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        balance: '1000000000',
        state: AccountState.FROZEN,
        canSend: false,
        canReceive: false,
        lastSyncedAt: 1234567890,
      };
      expect(service.isAccountActive(account)).toBe(false);
    });

    it('should return false for closed account', () => {
      const account: CardAccount = {
        nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        balance: '0',
        state: AccountState.CLOSED,
        canSend: false,
        canReceive: false,
        lastSyncedAt: 1234567890,
      };
      expect(service.isAccountActive(account)).toBe(false);
    });

    it('should return false for collateral locked account', () => {
      const account: CardAccount = {
        nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        balance: '5000000000',
        state: AccountState.COLLATERAL_LOCKED,
        canSend: false,
        canReceive: true,
        lastSyncedAt: 1234567890,
      };
      expect(service.isAccountActive(account)).toBe(false);
    });
  });

  describe('getAccount', () => {
    it('should return placeholder when no API endpoint is configured', async () => {
      const service = new AccountService(testConfig);
      const account = await service.getAccount(
        'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
      );

      expect(account.nftAddress).toBe(
        'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
      );
      expect(account.balance).toBe('0');
      expect(account.state).toBe(AccountState.ACTIVE);
      expect(account.canSend).toBe(false);
      expect(account.canReceive).toBe(false);
      expect(account.lastSyncedAt).toBe(0);
    });
  });

  describe('getAccount request URL hardening (PC-09)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('percent-encodes nftAddress in the account request path', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({
          nftAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
          balance: '0',
          state: AccountState.ACTIVE,
          canSend: false,
          canReceive: false,
          lastSyncedAt: 0,
        })
      );

      const service = new AccountService(apiConfig);
      const crafted = '../admin?inject=1&x=2';
      await service.getAccount(crafted);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toBe(
        `https://api.example.com/account/${encodeURIComponent(crafted)}`
      );
      // The raw, unencoded id must not survive: no path traversal, no injected
      // query parameters.
      expect(calledUrl).not.toContain('../admin');
      expect(calledUrl).not.toContain('?inject=1');
    });
  });
});
