import { describe, it, expect } from '@jest/globals';
import {
  assertHttpsEndpoint,
  validateAppConfig,
  DEFAULT_MAINNET_CONFIG,
  DEFAULT_TESTNET_CONFIG,
  type AppConfig,
} from '../../src/lib/config';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...DEFAULT_MAINNET_CONFIG,
    paymentHubAddress: VALID_HUB,
    ...overrides,
  };
}

describe('assertHttpsEndpoint', () => {
  it('accepts https URLs', () => {
    expect(() => assertHttpsEndpoint('https://example.com', 'foo')).not.toThrow();
  });

  it('skips undefined endpoints', () => {
    expect(() => assertHttpsEndpoint(undefined, 'foo')).not.toThrow();
  });

  it('rejects http URLs', () => {
    expect(() => assertHttpsEndpoint('http://example.com', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
  });

  it('rejects schemeless URLs', () => {
    expect(() => assertHttpsEndpoint('example.com', 'apiEndpoint')).toThrow(
      /must use HTTPS/,
    );
  });

  // PC-09: the check parses the URL instead of a case-sensitive prefix test.
  it('accepts a mixed-case HTTPS scheme', () => {
    expect(() => assertHttpsEndpoint('HTTPS://example.com', 'foo')).not.toThrow();
    expect(() => assertHttpsEndpoint('HtTpS://example.com/path', 'foo')).not.toThrow();
  });

  it('rejects non-HTTPS schemes such as ftp', () => {
    expect(() => assertHttpsEndpoint('ftp://example.com', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
  });

  it('rejects javascript: pseudo-URLs', () => {
    expect(() => assertHttpsEndpoint('javascript:alert(1)', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
  });

  it('rejects a mixed-case HTTP scheme that a prefix check would also catch', () => {
    expect(() => assertHttpsEndpoint('HTTP://example.com', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
  });

  it('rejects structurally invalid URLs', () => {
    expect(() => assertHttpsEndpoint('https://', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
    expect(() => assertHttpsEndpoint('ht!tp://nope', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
    expect(() => assertHttpsEndpoint('not a url', 'apiEndpoint')).toThrow(
      /apiEndpoint must use HTTPS/,
    );
  });
});

describe('validateAppConfig', () => {
  it('returns config when valid', () => {
    const config = makeConfig();
    expect(validateAppConfig(config)).toBe(config);
  });

  it('throws when paymentHubAddress is missing', () => {
    expect(() => validateAppConfig(makeConfig({ paymentHubAddress: '' }))).toThrow(
      /paymentHubAddress is required/,
    );
  });

  it('throws on unknown network value', () => {
    const config = makeConfig({ network: 'devnet' as unknown as 'mainnet' });
    expect(() => validateAppConfig(config)).toThrow(/network must be/);
  });

  it('throws when apiEndpoint is not HTTPS', () => {
    expect(() =>
      validateAppConfig(makeConfig({ apiEndpoint: 'http://api.tonbankcard.app' })),
    ).toThrow(/apiEndpoint must use HTTPS/);
  });

  it('throws when tonConnectManifestUrl is not HTTPS', () => {
    expect(() =>
      validateAppConfig(makeConfig({ tonConnectManifestUrl: 'http://manifest' })),
    ).toThrow(/tonConnectManifestUrl must use HTTPS/);
  });

  it('throws when certificate pin entry is missing host or pins', () => {
    expect(() =>
      validateAppConfig(
        makeConfig({ certificatePins: [{ host: '', sha256Pins: ['abc'] }] }),
      ),
    ).toThrow(/certificatePins entries require/);
    expect(() =>
      validateAppConfig(
        makeConfig({ certificatePins: [{ host: 'api', sha256Pins: [] }] }),
      ),
    ).toThrow(/certificatePins entries require/);
  });
});

describe('default configs', () => {
  it('mainnet defaults use HTTPS for every endpoint', () => {
    expect(DEFAULT_MAINNET_CONFIG.rpcEndpoint?.startsWith('https://')).toBe(true);
    expect(DEFAULT_MAINNET_CONFIG.apiEndpoint?.startsWith('https://')).toBe(true);
    expect(DEFAULT_MAINNET_CONFIG.tonConnectManifestUrl.startsWith('https://')).toBe(true);
    expect(DEFAULT_MAINNET_CONFIG.appUrl.startsWith('https://')).toBe(true);
  });

  it('testnet defaults use HTTPS for every endpoint', () => {
    expect(DEFAULT_TESTNET_CONFIG.rpcEndpoint?.startsWith('https://')).toBe(true);
    expect(DEFAULT_TESTNET_CONFIG.apiEndpoint?.startsWith('https://')).toBe(true);
    expect(DEFAULT_TESTNET_CONFIG.tonConnectManifestUrl.startsWith('https://')).toBe(true);
    expect(DEFAULT_TESTNET_CONFIG.appUrl.startsWith('https://')).toBe(true);
  });
});
