/**
 * Unit tests for TonbankcardDashboard
 *
 * Tests the dashboard's configuration validation, state management,
 * and view navigation. DOM rendering tests are limited to the jsdom environment.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TonbankcardDashboard } from '../src/components/DashboardApp';
import {
  DashboardView,
  MerchantStats,
  PaymentRecord,
  WebhookConfig,
} from '../src/types';

describe('TonbankcardDashboard', () => {
  const testConfig = {
    containerId: 'dashboard-container',
    merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  };

  const testStats: MerchantStats = {
    totalPayments: 42,
    totalVolume: '50000000000',
    successRate: 0.95,
    averageAmount: '1190476190',
    periodStart: 1700000000,
    periodEnd: 1700100000,
  };

  const testPayments: PaymentRecord[] = [
    {
      id: 'pay-1',
      payerAddress: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
      amount: '1000000000',
      status: 'settled',
      orderId: 'ORD-001',
      timestamp: 1700050000,
      txHash: 'abc123',
    },
    {
      id: 'pay-2',
      payerAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
      amount: '2500000000',
      status: 'pending',
      timestamp: 1700060000,
    },
  ];

  const testWebhooks: WebhookConfig[] = [
    {
      url: 'https://merchant.example.com/webhook',
      events: ['payment.settled', 'payment.failed'],
      enabled: true,
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="dashboard-container"></div>';
  });

  describe('constructor validation', () => {
    it('should create dashboard with valid config', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      expect(dashboard).toBeDefined();
    });

    it('should throw on missing merchantNft', () => {
      expect(
        () =>
          new TonbankcardDashboard({
            ...testConfig,
            merchantNft: '',
          })
      ).toThrow('merchantNft is required');
    });

    it('should throw on missing containerId', () => {
      expect(
        () =>
          new TonbankcardDashboard({
            ...testConfig,
            containerId: '',
          })
      ).toThrow('containerId is required');
    });
  });

  describe('mount / unmount', () => {
    it('should mount into the container element', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();

      const container = document.getElementById('dashboard-container');
      expect(container?.children.length).toBeGreaterThan(0);
    });

    it('should throw when container element is not found', () => {
      const dashboard = new TonbankcardDashboard({
        ...testConfig,
        containerId: 'nonexistent',
      });

      expect(() => dashboard.mount()).toThrow('Container element not found');
    });

    it('should call onReady callback after mount', () => {
      let readyCalled = false;
      const dashboard = new TonbankcardDashboard({
        ...testConfig,
        onReady: () => {
          readyCalled = true;
        },
      });
      dashboard.mount();
      expect(readyCalled).toBe(true);
    });

    it('should clean up on unmount', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();
      dashboard.unmount();

      const container = document.getElementById('dashboard-container');
      expect(container?.innerHTML).toBe('');
    });
  });

  describe('setStats', () => {
    it('should update internal stats state', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.setStats(testStats);
      expect(dashboard.getStats()).toEqual(testStats);
    });

    it('should re-render when mounted', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();
      dashboard.setStats(testStats);

      const container = document.getElementById('dashboard-container');
      expect(container?.textContent).toContain('42');
    });
  });

  describe('setPayments', () => {
    it('should update internal payments state', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.setPayments(testPayments);
      expect(dashboard.getPayments()).toEqual(testPayments);
    });

    it('should re-render payments when mounted and on payments view', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();
      dashboard.navigateTo(DashboardView.PAYMENTS);
      dashboard.setPayments(testPayments);

      const container = document.getElementById('dashboard-container');
      expect(container?.textContent).toContain('SETTLED');
    });
  });

  describe('setWebhooks', () => {
    it('should update internal webhooks state', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.setWebhooks(testWebhooks);
      expect(dashboard.getWebhooks()).toEqual(testWebhooks);
    });

    it('should re-render webhooks when mounted and on webhooks view', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();
      dashboard.navigateTo(DashboardView.WEBHOOKS);
      dashboard.setWebhooks(testWebhooks);

      const container = document.getElementById('dashboard-container');
      expect(container?.textContent).toContain('merchant.example.com');
    });
  });

  describe('navigation', () => {
    it('should default to overview view', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      expect(dashboard.getCurrentView()).toBe(DashboardView.OVERVIEW);
    });

    it('should navigate to payments view', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.navigateTo(DashboardView.PAYMENTS);
      expect(dashboard.getCurrentView()).toBe(DashboardView.PAYMENTS);
    });

    it('should navigate to generate view', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();
      dashboard.navigateTo(DashboardView.GENERATE);

      const container = document.getElementById('dashboard-container');
      expect(container?.textContent).toContain('Generate Payment Link');
    });
  });

  describe('theme', () => {
    it('should support dark theme', () => {
      const dashboard = new TonbankcardDashboard({
        ...testConfig,
        theme: 'dark',
      });
      dashboard.mount();

      const container = document.getElementById('dashboard-container');
      const wrapper = container?.querySelector('.tonbankcard-dashboard') as HTMLElement;
      expect(wrapper?.style.background).toBe('rgb(26, 26, 46)');
    });

    it('should support light theme by default', () => {
      const dashboard = new TonbankcardDashboard(testConfig);
      dashboard.mount();

      const container = document.getElementById('dashboard-container');
      const wrapper = container?.querySelector('.tonbankcard-dashboard') as HTMLElement;
      expect(wrapper?.style.background).toBe('rgb(255, 255, 255)');
    });
  });
});
