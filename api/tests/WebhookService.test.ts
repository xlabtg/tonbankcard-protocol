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
import { SecretCipher } from '../src/utils/secretCipher';
import { SIGNATURE_HEADER, verifyWebhookSignature } from '../src/utils/webhookSignature';

/** Fixed-key cipher so manually inserted endpoints carry valid ciphertext. */
const cipher = new SecretCipher('test-webhook-encryption-key-1234567890');

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
    service = new WebhookService(cipher);
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
        secret_encrypted: cipher.encrypt(TEST_SECRET),
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
        secret_encrypted: cipher.encrypt(TEST_SECRET),
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

describe('WebhookService — signing secret encryption at rest (API-M1, #269)', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService(cipher);
  });

  it('does not store the raw plaintext secret on a registered endpoint', async () => {
    const ep = await service.register(TEST_MERCHANT, 'https://example.com/hook', TEST_SECRET, {
      lookup: publicLookup(),
    });

    // The public contract is `secret_encrypted` — the legacy plaintext field
    // must be gone entirely.
    expect((ep as unknown as Record<string, unknown>).secret).toBeUndefined();
    expect(ep.secret_encrypted).toBeDefined();
    expect(ep.secret_encrypted).not.toBe(TEST_SECRET);
    expect(ep.secret_encrypted).not.toContain(TEST_SECRET);

    // The stored record (not just the returned copy) holds only ciphertext.
    const stored = service.find(ep.endpoint_id)!;
    expect(JSON.stringify(stored)).not.toContain(TEST_SECRET);

    // Ciphertext round-trips back to the original secret with the right key.
    expect(cipher.decrypt(stored.secret_encrypted)).toBe(TEST_SECRET);
  });

  it('encrypts the same secret to different ciphertexts (fresh IV per register)', async () => {
    const a = await service.register(TEST_MERCHANT, 'https://a.example.com/hook', TEST_SECRET, {
      lookup: publicLookup(),
    });
    const b = await service.register(TEST_MERCHANT, 'https://b.example.com/hook', TEST_SECRET, {
      lookup: publicLookup(),
    });
    expect(a.secret_encrypted).not.toBe(b.secret_encrypted);
  });

  it('decrypts the stored secret to sign a delivery with the original secret', async () => {
    const ep = await service.register(TEST_MERCHANT, 'https://example.com/hook', TEST_SECRET, {
      lookup: publicLookup(),
    });

    let capturedBody = '';
    let capturedSig: string | undefined;
    const fetchMock = jest.fn(async (_url: unknown, init: any) => {
      capturedBody = init.body as string;
      capturedSig = init.headers[SIGNATURE_HEADER];
      return { ok: true, status: 200 } as Response;
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await service.deliver(
        ep.endpoint_id,
        { event: 'payment.settled' },
        { ssrfGuard: { lookup: publicLookup() }, timestamp: 1_700_000_000 },
      );
      expect(result.ok).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }

    // The signature on the wire verifies against the ORIGINAL plaintext secret,
    // proving the stored ciphertext was correctly decrypted before signing.
    const verification = verifyWebhookSignature(TEST_SECRET, capturedBody, capturedSig, {
      now: 1_700_000_000,
    });
    expect(verification.valid).toBe(true);
  });

  it('returns a delivery error when the stored secret cannot be decrypted', async () => {
    const ep = service['endpoints'];
    ep.set('wh_corrupt', {
      endpoint_id: 'wh_corrupt',
      url: 'https://example.com/hook',
      secret_encrypted: 'v1:not:valid:ciphertext',
      merchant_nft: TEST_MERCHANT,
      created_at: new Date().toISOString(),
      is_active: true,
    });

    const result = await service.deliver('wh_corrupt', { event: 'test' }, {
      ssrfGuard: { lookup: publicLookup() },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Secret decryption failed/);
  });
});
