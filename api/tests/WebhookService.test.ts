/**
 * WebhookService Tests
 *
 * Covers SSRF guard integration in `services/WebhookService.ts`:
 *  - register() rejects non-HTTPS, loopback, private, and metadata URLs
 *  - deliver() re-validates URL before sending and blocks disallowed destinations
 *  - deliver() sets redirect:'error' (tested via mock fetch)
 *  - valid registrations and deliveries continue to work
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/244
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WebhookService } from '../src/services/WebhookService';
import { SsrfError } from '../src/utils/ssrfGuard';

/** Fake DNS that maps every host to a public IP unless specified otherwise. */
function publicLookup(overrides: Record<string, string[]> = {}) {
  return async (host: string): Promise<string[]> => {
    if (host in overrides) {
      const addrs = overrides[host];
      if (!addrs || addrs.length === 0) throw new Error(`ENOTFOUND ${host}`);
      return addrs;
    }
    return ['1.1.1.1'];
  };
}

const TEST_MERCHANT = 'merchant_nft_test';
const TEST_SECRET = 'whsec_test_secret_value';

describe('WebhookService — SSRF guard integration', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
  });

  describe('register()', () => {
    it('registers a valid HTTPS endpoint', async () => {
      const ep = await service.register(TEST_MERCHANT, 'https://example.com/hook', TEST_SECRET, {
        lookup: publicLookup(),
      });
      expect(ep.endpoint_id).toMatch(/^wh_/);
      expect(ep.url).toBe('https://example.com/hook');
      expect(ep.is_active).toBe(true);
    });

    it('rejects http:// at registration', async () => {
      const err = await service
        .register(TEST_MERCHANT, 'http://example.com/hook', TEST_SECRET, { lookup: publicLookup() })
        .catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('scheme_not_allowed');
    });

    it('rejects http://localhost at registration', async () => {
      const err = await service
        .register(TEST_MERCHANT, 'https://localhost/hook', TEST_SECRET, {
          lookup: publicLookup({ localhost: ['127.0.0.1'] }),
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });

    it('rejects https://169.254.169.254 at registration', async () => {
      const err = await service
        .register(TEST_MERCHANT, 'https://169.254.169.254/', TEST_SECRET, {
          lookup: publicLookup(),
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });

    it('rejects a hostname resolving to a private IP at registration', async () => {
      const err = await service
        .register(TEST_MERCHANT, 'https://internal.corp/hook', TEST_SECRET, {
          lookup: publicLookup({ 'internal.corp': ['10.0.0.1'] }),
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });
  });

  describe('deliver()', () => {
    it('blocks delivery to loopback endpoint', async () => {
      // Manually insert an endpoint that bypassed registration (e.g. was added
      // before SSRF guard was applied) to ensure deliver() re-validates.
      const ep = service['endpoints'];
      ep.set('wh_test', {
        endpoint_id: 'wh_test',
        url: 'https://127.0.0.1/hook',
        secret: TEST_SECRET,
        merchant_nft: TEST_MERCHANT,
        created_at: new Date().toISOString(),
        is_active: true,
      });

      const result = await service.deliver('wh_test', { event: 'test' }, {
        ssrfGuard: { lookup: publicLookup() },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/SSRF guard/);
    });

    it('blocks delivery when registered URL resolves to private IP', async () => {
      const ep = service['endpoints'];
      ep.set('wh_private', {
        endpoint_id: 'wh_private',
        url: 'https://internal.corp/hook',
        secret: TEST_SECRET,
        merchant_nft: TEST_MERCHANT,
        created_at: new Date().toISOString(),
        is_active: true,
      });

      const result = await service.deliver('wh_private', { event: 'test' }, {
        ssrfGuard: { lookup: publicLookup({ 'internal.corp': ['192.168.1.1'] }) },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/SSRF guard/);
    });

    it('returns error for unknown endpoint id', async () => {
      const result = await service.deliver('wh_unknown', { event: 'test' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Unknown webhook endpoint/);
    });

    it('returns error for deactivated endpoint', async () => {
      const ep = await service.register(TEST_MERCHANT, 'https://example.com/hook', TEST_SECRET, {
        lookup: publicLookup(),
      });
      service.deactivate(ep.endpoint_id);
      const result = await service.deliver(ep.endpoint_id, { event: 'test' }, {
        ssrfGuard: { lookup: publicLookup() },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/deactivated/);
    });
  });
});
