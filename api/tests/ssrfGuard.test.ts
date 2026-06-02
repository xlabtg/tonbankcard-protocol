/**
 * SSRF Guard Tests
 *
 * Covers `utils/ssrfGuard.ts`:
 *  - scheme enforcement (HTTPS-only)
 *  - host allowlist
 *  - loopback, link-local (169.254.169.254), and RFC1918 private ranges blocked
 *  - IPv4-mapped IPv6 addresses blocked
 *  - redirect bypass (redirect:'error' enforced by caller)
 *  - valid public URLs pass through
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/244
 */

import { describe, it, expect } from '@jest/globals';
import { assertSafeWebhookUrl, isBlockedAddress, SsrfError } from '../src/utils/ssrfGuard';

/** Fake DNS resolver that maps hostnames to IPs for testing. */
function fakeLookup(map: Record<string, string[]>) {
  return async (host: string): Promise<string[]> => {
    const addrs = map[host];
    if (!addrs || addrs.length === 0) throw new Error(`ENOTFOUND ${host}`);
    return addrs;
  };
}

describe('isBlockedAddress', () => {
  const blocked = [
    '127.0.0.1',
    '127.255.255.255',
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
    '169.254.0.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '224.0.0.1', // multicast
    '::1', // IPv6 loopback
    'fc00::1', // unique local
    'fe80::1', // link-local
    'ff02::1', // multicast
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:169.254.169.254', // IPv4-mapped cloud metadata
    '::ffff:a9fe:a9fe', // same in hex notation
  ];

  for (const ip of blocked) {
    it(`blocks ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(true);
    });
  }

  const allowed = [
    '1.1.1.1',
    '8.8.8.8',
    '104.16.0.1',
    '2606:4700::1', // Cloudflare public IPv6
  ];

  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(false);
    });
  }
});

describe('assertSafeWebhookUrl', () => {
  const publicLookup = fakeLookup({ 'example.com': ['1.1.1.1'] });

  describe('scheme enforcement', () => {
    it('rejects http:// URLs', async () => {
      const err = await assertSafeWebhookUrl('http://example.com/hook', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('scheme_not_allowed');
    });

    it('rejects ftp:// URLs', async () => {
      const err = await assertSafeWebhookUrl('ftp://example.com/hook', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('scheme_not_allowed');
    });

    it('rejects file:// URLs', async () => {
      const err = await assertSafeWebhookUrl('file:///etc/passwd', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('scheme_not_allowed');
    });

    it('accepts https:// URLs to public hosts', async () => {
      await expect(
        assertSafeWebhookUrl('https://example.com/hook', { lookup: publicLookup }),
      ).resolves.toBeDefined();
    });
  });

  describe('invalid URLs', () => {
    it('rejects a non-URL string', async () => {
      const err = await assertSafeWebhookUrl('not-a-url', {}).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('invalid_url');
    });
  });

  describe('localhost / loopback blocking', () => {
    it('blocks http://localhost', async () => {
      const err = await assertSafeWebhookUrl('https://localhost/hook', {
        lookup: fakeLookup({ localhost: ['127.0.0.1'] }),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });

    it('blocks IP literal 127.0.0.1', async () => {
      const err = await assertSafeWebhookUrl('https://127.0.0.1/hook', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });
  });

  describe('cloud metadata endpoint blocking', () => {
    it('blocks https://169.254.169.254', async () => {
      const err = await assertSafeWebhookUrl('https://169.254.169.254/', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });

    it('blocks a hostname that resolves to 169.254.169.254', async () => {
      const err = await assertSafeWebhookUrl('https://metadata.internal/', {
        lookup: fakeLookup({ 'metadata.internal': ['169.254.169.254'] }),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });
  });

  describe('RFC1918 private range blocking', () => {
    const privateIps = [
      ['10.0.0.1', '10.x.x.x'],
      ['172.16.0.1', '172.16.x.x'],
      ['192.168.1.1', '192.168.x.x'],
    ];

    for (const [ip, label] of privateIps) {
      it(`blocks hostname resolving to ${label}`, async () => {
        const err = await assertSafeWebhookUrl('https://internal.corp/', {
          lookup: fakeLookup({ 'internal.corp': [ip] }),
        }).catch((e) => e);
        expect(err).toBeInstanceOf(SsrfError);
        expect((err as SsrfError).reason).toBe('blocked_address');
      });
    }
  });

  describe('host allowlist', () => {
    it('rejects a public host not in the allowlist', async () => {
      const err = await assertSafeWebhookUrl('https://example.com/hook', {
        lookup: publicLookup,
        allowHosts: ['allowed.example.com'],
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('host_not_allowed');
    });

    it('accepts a public host in the allowlist', async () => {
      await expect(
        assertSafeWebhookUrl('https://example.com/hook', {
          lookup: publicLookup,
          allowHosts: ['example.com'],
        }),
      ).resolves.toBeDefined();
    });

    it('does case-insensitive allowlist matching', async () => {
      await expect(
        assertSafeWebhookUrl('https://Example.COM/hook', {
          lookup: fakeLookup({ 'example.com': ['1.1.1.1'] }),
          allowHosts: ['EXAMPLE.COM'],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('DNS resolution failure', () => {
    it('rejects a hostname that cannot be resolved', async () => {
      const err = await assertSafeWebhookUrl('https://nonexistent.invalid/', {
        lookup: fakeLookup({}),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('dns_resolution_failed');
    });
  });

  describe('IPv4-mapped IPv6 blocking', () => {
    it('blocks ::ffff:169.254.169.254 (IPv4-mapped cloud metadata)', async () => {
      expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    });

    it('blocks ::1 (IPv6 loopback)', async () => {
      const err = await assertSafeWebhookUrl('https://[::1]/hook', {
        lookup: publicLookup,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(SsrfError);
      expect((err as SsrfError).reason).toBe('blocked_address');
    });
  });
});
