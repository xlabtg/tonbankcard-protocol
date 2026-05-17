import { describe, it, expect } from '@jest/globals';
import { validateManifest } from '../../src/lib/tonconnect/manifest';

describe('validateManifest', () => {
  it('accepts a well-formed HTTPS manifest', () => {
    const result = validateManifest({
      url: 'https://tonbankcard.app',
      name: 'TONBANKCARD',
      iconUrl: 'https://tonbankcard.app/icon.png',
      termsOfUseUrl: 'https://tonbankcard.app/terms',
      privacyPolicyUrl: 'https://tonbankcard.app/privacy',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags missing required fields', () => {
    const result = validateManifest({
      url: '',
      name: '',
      iconUrl: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'manifest.url is required',
        'manifest.name is required',
        'manifest.iconUrl is required',
      ]),
    );
  });

  it('rejects non-HTTPS url and iconUrl', () => {
    const result = validateManifest({
      url: 'http://tonbankcard.app',
      name: 'TONBANKCARD',
      iconUrl: 'http://tonbankcard.app/icon.png',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'manifest.url must use HTTPS',
        'manifest.iconUrl must use HTTPS',
      ]),
    );
  });

  it('rejects non-HTTPS optional URLs when provided', () => {
    const result = validateManifest({
      url: 'https://tonbankcard.app',
      name: 'TONBANKCARD',
      iconUrl: 'https://tonbankcard.app/icon.png',
      termsOfUseUrl: 'http://example.com/terms',
      privacyPolicyUrl: 'http://example.com/privacy',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'manifest.termsOfUseUrl must use HTTPS',
        'manifest.privacyPolicyUrl must use HTTPS',
      ]),
    );
  });
});
