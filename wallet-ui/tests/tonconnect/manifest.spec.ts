/**
 * Unit tests for TON Connect manifest validation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateManifest,
  buildManifest,
  serializeManifest,
} from '../../src/tonconnect/manifest';

const okManifest = {
  url: 'https://tonbankcard.com',
  name: 'TONBANKCARD',
  iconUrl: 'https://tonbankcard.com/icon.png',
};

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const result = validateManifest(okManifest);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects HTTP URLs', () => {
    const result = validateManifest({
      ...okManifest,
      url: 'http://tonbankcard.com',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/url/);
  });

  it('rejects empty / missing fields', () => {
    expect(validateManifest({ ...okManifest, name: '' }).ok).toBe(false);
    expect(validateManifest({ ...okManifest, iconUrl: 'ftp://x' }).ok).toBe(
      false
    );
  });

  it('rejects names that exceed 64 characters', () => {
    const longName = 'x'.repeat(65);
    const result = validateManifest({ ...okManifest, name: longName });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('64'))).toBe(true);
  });

  it('rejects non-HTTPS termsOfUseUrl / privacyPolicyUrl', () => {
    const result = validateManifest({
      ...okManifest,
      termsOfUseUrl: 'http://x',
      privacyPolicyUrl: 'javascript:alert(1)',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects null / undefined inputs', () => {
    expect(validateManifest(undefined).ok).toBe(false);
    expect(validateManifest(null).ok).toBe(false);
  });
});

describe('buildManifest', () => {
  it('returns a clean object for valid input', () => {
    const m = buildManifest(okManifest);
    expect(m).toEqual(okManifest);
  });

  it('preserves optional fields', () => {
    const m = buildManifest({
      ...okManifest,
      termsOfUseUrl: 'https://tonbankcard.com/tos',
      privacyPolicyUrl: 'https://tonbankcard.com/privacy',
    });
    expect(m.termsOfUseUrl).toBe('https://tonbankcard.com/tos');
    expect(m.privacyPolicyUrl).toBe('https://tonbankcard.com/privacy');
  });

  it('throws on invalid input', () => {
    expect(() =>
      buildManifest({ ...okManifest, url: 'http://insecure' })
    ).toThrow(/Invalid TON Connect manifest/);
  });
});

describe('serializeManifest', () => {
  it('produces pretty-printed JSON', () => {
    const json = serializeManifest(okManifest);
    expect(json).toContain('"url": "https://tonbankcard.com"');
    expect(JSON.parse(json)).toEqual(okManifest);
  });
});
