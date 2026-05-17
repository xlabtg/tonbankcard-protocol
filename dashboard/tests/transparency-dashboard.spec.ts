/**
 * Unit tests for TonbankcardTransparencyDashboard (E4, Issue #135).
 *
 * Covers config validation, lifecycle, theme, and that the rendered DOM
 * accurately reflects the on-chain snapshot returned by
 * GET /api/v1/transparency/metrics.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TonbankcardTransparencyDashboard } from '../src/components/TransparencyDashboard';
import { TransparencyMetricsSnapshot } from '../src/types';

const sampleSnapshot: TransparencyMetricsSnapshot = {
  disclaimer:
    'This data is non-authoritative. Verify all data on-chain. Governance outcomes are advisory only.',
  snapshot: {
    indexedAt: 1_700_500_000,
    latestBlockIndexed: 9001,
  },
  protocolMetrics: {
    latest: {
      periodStart: 1_697_500_000,
      periodEnd: 1_700_100_000,
      activeAccounts: 4242,
      tbcVolumeTransferred: '12345000000000',
      transferCount: 9876,
      blockNumber: 100,
      transactionHash: 'abcdef1234567890',
    },
    history: [
      {
        periodStart: 1_697_500_000,
        periodEnd: 1_700_100_000,
        activeAccounts: 4242,
        tbcVolumeTransferred: '12345000000000',
        transferCount: 9876,
        blockNumber: 100,
        transactionHash: 'abcdef1234567890',
      },
    ],
    periodCount: 1,
  },
  lockActivity: {
    latest: {
      periodStart: 1_697_500_000,
      periodEnd: 1_700_100_000,
      locksSet: 12,
      locksCleared: 4,
      locksActive: 8,
      appealsFiled: 3,
      appealsOverturned: 1,
      appealsUpheld: 2,
      blockNumber: 101,
      transactionHash: 'fedcba0987654321',
    },
    history: [],
    periodCount: 1,
  },
  parameterChanges: {
    total: 1,
    history: [
      {
        parameterId: 'PP-13.fee.bps',
        oldValueHash: 'a'.repeat(64),
        newValueHash: 'b'.repeat(64),
        effectiveBlock: 200,
        governanceProposalId: 7,
        blockNumber: 199,
        transactionHash: 'c'.repeat(64),
        timestamp: 1_700_050_000,
      },
    ],
  },
};

describe('TonbankcardTransparencyDashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="transparency-container"></div>';
  });

  describe('constructor validation', () => {
    it('creates a dashboard with valid config', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      expect(d).toBeDefined();
    });

    it('throws when containerId is missing', () => {
      expect(
        () =>
          new TonbankcardTransparencyDashboard({
            containerId: '',
          })
      ).toThrow('containerId is required');
    });
  });

  describe('mount / unmount', () => {
    it('mounts into the container element', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      const container = document.getElementById('transparency-container');
      expect(container?.children.length).toBeGreaterThan(0);
    });

    it('calls onReady after mount', () => {
      let ready = false;
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
        onReady: () => {
          ready = true;
        },
      });
      d.mount();
      expect(ready).toBe(true);
    });

    it('throws when container is missing and calls onError', () => {
      const errors: Error[] = [];
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'no-such-element',
        onError: (e) => errors.push(e),
      });
      expect(() => d.mount()).toThrow('Container element not found');
      expect(errors).toHaveLength(1);
    });

    it('clears the container on unmount', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.unmount();
      const container = document.getElementById('transparency-container');
      expect(container?.children.length).toBe(0);
    });
  });

  describe('snapshot rendering', () => {
    it('shows an empty-state hint when no snapshot is set', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      const text = document.body.textContent ?? '';
      expect(text).toContain('No transparency snapshot loaded yet.');
    });

    it('renders the disclaimer and the latest protocol-metrics tile', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.setSnapshot(sampleSnapshot);

      const text = document.body.textContent ?? '';
      expect(text).toContain(sampleSnapshot.disclaimer);
      expect(text).toContain('Active accounts');
      expect(text).toContain('4,242');
      expect(text).toContain('TBC volume');
      // formatted via formatCurrency: 12345000000000 nanocoins == 12345 TBC
      expect(text).toContain('12,345.00 TBC');
      expect(text).toContain('Transfers');
      expect(text).toContain('9,876');
    });

    it('renders the lock-activity counters', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.setSnapshot(sampleSnapshot);

      const text = document.body.textContent ?? '';
      expect(text).toContain('Locks set');
      expect(text).toContain('12');
      expect(text).toContain('Locks cleared');
      expect(text).toContain('Appeals overturned');
    });

    it('renders the parameter-change audit table', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.setSnapshot(sampleSnapshot);

      const text = document.body.textContent ?? '';
      expect(text).toContain('Parameter Changes');
      expect(text).toContain('PP-13.fee.bps');
      expect(text).toContain('#7');
      // Effective block must be visible as an authoritative anchor.
      expect(text).toContain('200');
    });

    it('round-trips the snapshot via getSnapshot()', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.setSnapshot(sampleSnapshot);

      expect(d.getSnapshot()).toBe(sampleSnapshot);
    });

    it('survives a snapshot with no latest values (cold-start)', () => {
      const empty: TransparencyMetricsSnapshot = {
        disclaimer: 'cold',
        snapshot: { indexedAt: 1, latestBlockIndexed: 0 },
        protocolMetrics: { latest: null, history: [], periodCount: 0 },
        lockActivity: { latest: null, history: [], periodCount: 0 },
        parameterChanges: { total: 0, history: [] },
      };
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      d.setSnapshot(empty);

      const text = document.body.textContent ?? '';
      expect(text).toContain('No protocol metric checksums anchored yet.');
      expect(text).toContain('No lock-activity checksums anchored yet.');
      expect(text).toContain('No parameter changes have been recorded.');
    });
  });

  describe('theme', () => {
    it('defaults to light theme', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
      });
      d.mount();
      const wrap = document.querySelector(
        '.tonbankcard-transparency'
      ) as HTMLElement;
      expect(wrap.style.background).toBe('rgb(255, 255, 255)');
    });

    it('honours the dark theme', () => {
      const d = new TonbankcardTransparencyDashboard({
        containerId: 'transparency-container',
        theme: 'dark',
      });
      d.mount();
      const wrap = document.querySelector(
        '.tonbankcard-transparency'
      ) as HTMLElement;
      expect(wrap.style.background).toBe('rgb(26, 26, 46)');
    });
  });
});
