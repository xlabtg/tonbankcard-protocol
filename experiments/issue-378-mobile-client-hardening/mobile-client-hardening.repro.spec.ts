/**
 * Standalone reproduction of PC-09 / #378 — mobile client hardening.
 *
 * Three independent low-severity weaknesses, each shown "before" (a faithful
 * copy of the pre-fix code) versus "after" (the REAL, fixed code from the
 * workspace — imported live where its dependencies resolve with the minimal
 * experiment install, or asserted against the on-disk source/manifest where
 * importing would pull a heavy transitive dependency such as `@ton/core`):
 *
 *   1. URL ENCODING — `mobile/` services interpolated `nftAddress` / `txId`
 *      RAW into the request URL, so a crafted id could traverse the path or
 *      smuggle query parameters into the API call.
 *   2. HTTPS CHECK — `mobile-app` `assertHttpsEndpoint` used a case-sensitive
 *      `startsWith('https://')` prefix test, which both rejects a valid
 *      mixed-case `HTTPS://` URL and reasons poorly about malformed input.
 *   3. ANDROID autoVerify — the manifest set `android:autoVerify="true"` on the
 *      custom `tonbankcard` scheme, where App Links verification never runs — a
 *      no-op that implies a verification guarantee that does not exist.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertHttpsEndpoint } from '../../mobile-app/src/lib/config';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, rel), 'utf8');

// ---------------------------------------------------------------------------
// 1. URL ENCODING
// ---------------------------------------------------------------------------

/** Faithful copy of the PRE-FIX request-URL builders (the bug under test). */
function oldTransactionsUrl(apiEndpoint: string, nftAddress: string): string {
  // nftAddress is interpolated raw — no percent-encoding.
  return `${apiEndpoint}/transactions/${nftAddress}`;
}
function oldAccountUrl(apiEndpoint: string, nftAddress: string): string {
  return `${apiEndpoint}/account/${nftAddress}`;
}

const craftedId = '../admin?inject=1&x=2';

const paymentServiceSource = read('../../mobile/src/services/PaymentService.ts');
const accountServiceSource = read('../../mobile/src/services/AccountService.ts');

describe('PC-09 #1 URL encoding — before the fix (raw interpolation)', () => {
  it('INJECTS: a crafted nftAddress traverses the path and adds query params', () => {
    const url = oldTransactionsUrl('https://api.example.com', craftedId);

    // The crafted id escapes its path segment: `../admin` walks the path and
    // `?inject=1` opens an attacker-controlled query string.
    expect(url).toBe('https://api.example.com/transactions/../admin?inject=1&x=2');
    expect(url).toContain('../admin');
    expect(url).toContain('?inject=1');
  });

  it('INJECTS: the same flaw is present in the account URL builder', () => {
    const url = oldAccountUrl('https://api.example.com', craftedId);
    expect(url).toContain('../admin');
    expect(url).toContain('?inject=1');
  });
});

describe('PC-09 #1 URL encoding — after the fix (real services percent-encode)', () => {
  it('PaymentService wraps both interpolated identifiers in encodeURIComponent', () => {
    expect(paymentServiceSource).toContain(
      '/transactions/${encodeURIComponent(nftAddress)}',
    );
    expect(paymentServiceSource).toContain(
      '/transaction/${encodeURIComponent(txId)}',
    );
    // The raw interpolations are gone.
    expect(paymentServiceSource).not.toContain('/transactions/${nftAddress}');
    expect(paymentServiceSource).not.toContain('/transaction/${txId}');
  });

  it('AccountService wraps the interpolated identifier in encodeURIComponent', () => {
    expect(accountServiceSource).toContain(
      '/account/${encodeURIComponent(nftAddress)}',
    );
    expect(accountServiceSource).not.toContain('/account/${nftAddress}');
  });

  it('encodeURIComponent neutralizes the crafted id (no traversal, no injection)', () => {
    // This is exactly the transformation the fixed code applies to the id.
    const safe = `https://api.example.com/transactions/${encodeURIComponent(craftedId)}`;

    expect(safe).toBe(
      'https://api.example.com/transactions/..%2Fadmin%3Finject%3D1%26x%3D2',
    );
    expect(safe).not.toContain('../admin');
    expect(safe).not.toContain('?inject=1');
  });

  it('leaves an ordinary base64url address byte-for-byte unchanged', () => {
    const addr = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';
    // base64url addresses contain no reserved characters, so encoding is a no-op.
    expect(encodeURIComponent(addr)).toBe(addr);
  });
});

// ---------------------------------------------------------------------------
// 2. HTTPS CHECK
// ---------------------------------------------------------------------------

const HTTPS_PREFIX = 'https://';

/** Faithful copy of the PRE-FIX HTTPS guard (the bug under test). */
function oldAssertHttpsEndpoint(url: string | undefined, fieldName: string): void {
  if (!url) {
    return;
  }
  if (!url.startsWith(HTTPS_PREFIX)) {
    throw new Error(`${fieldName} must use HTTPS, received: ${url}`);
  }
}

describe('PC-09 #2 HTTPS check — before the fix (case-sensitive prefix)', () => {
  it('FALSE NEGATIVE: rejects a perfectly valid mixed-case HTTPS URL', () => {
    // `HTTPS://` is a valid secure endpoint, but the prefix test rejects it.
    expect(() => oldAssertHttpsEndpoint('HTTPS://example.com', 'apiEndpoint')).toThrow(
      /must use HTTPS/,
    );
  });

  it('reasons only about the literal prefix, never the URL structure', () => {
    // It happens to reject this, but only because the bytes differ — it never
    // parses the URL, so it cannot distinguish a real scheme from a lookalike.
    expect(() => oldAssertHttpsEndpoint('https:/example.com', 'apiEndpoint')).toThrow(
      /must use HTTPS/,
    );
  });
});

describe('PC-09 #2 HTTPS check — after the fix (real assertHttpsEndpoint parses URL)', () => {
  it('accepts a mixed-case HTTPS scheme the prefix test wrongly rejected', () => {
    expect(() => assertHttpsEndpoint('HTTPS://example.com', 'apiEndpoint')).not.toThrow();
    expect(() => assertHttpsEndpoint('HtTpS://example.com/p', 'apiEndpoint')).not.toThrow();
  });

  it('still accepts a normal https URL and skips undefined', () => {
    expect(() => assertHttpsEndpoint('https://example.com', 'apiEndpoint')).not.toThrow();
    expect(() => assertHttpsEndpoint(undefined, 'apiEndpoint')).not.toThrow();
  });

  it('rejects non-HTTPS schemes (http, ftp, javascript) and malformed input', () => {
    for (const bad of [
      'http://example.com',
      'ftp://example.com',
      'javascript:alert(1)',
      'example.com',
      'https://',
      'not a url',
    ]) {
      expect(() => assertHttpsEndpoint(bad, 'apiEndpoint')).toThrow(/must use HTTPS/);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. ANDROID autoVerify
// ---------------------------------------------------------------------------

const manifestSource = read('../../mobile-app/android/app/src/main/AndroidManifest.xml');

function schemesOf(filter: string): string[] {
  return [...filter.matchAll(/android:scheme\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
}
function hasAutoVerify(filter: string): boolean {
  return /android:autoVerify\s*=\s*"true"/.test(filter);
}

/** A faithful copy of the PRE-FIX custom-scheme intent-filter (the bug). */
const oldCustomSchemeFilter = `
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="tonbankcard" />
  </intent-filter>`;

describe('PC-09 #3 autoVerify — before the fix (no-op on custom scheme)', () => {
  it('NO-OP: autoVerify sits on a custom (non-http/https) scheme', () => {
    expect(hasAutoVerify(oldCustomSchemeFilter)).toBe(true);
    // The only scheme is the custom `tonbankcard` one, where App Links
    // verification never runs — so autoVerify is meaningless here.
    expect(schemesOf(oldCustomSchemeFilter)).toEqual(['tonbankcard']);
  });
});

describe('PC-09 #3 autoVerify — after the fix (real manifest)', () => {
  const intentFilters =
    manifestSource.match(/<intent-filter[\s\S]*?<\/intent-filter>/g) ?? [];

  it('keeps the tonbankcard custom-scheme filter present but without autoVerify', () => {
    const filter = intentFilters.find((f) => schemesOf(f).includes('tonbankcard'));
    expect(filter).toBeDefined();
    expect(hasAutoVerify(filter as string)).toBe(false);
  });

  it('never sets autoVerify on any custom-scheme filter', () => {
    for (const filter of intentFilters) {
      if (!hasAutoVerify(filter)) {
        continue;
      }
      const schemes = schemesOf(filter);
      const onlyHttp =
        schemes.length > 0 && schemes.every((s) => s === 'http' || s === 'https');
      expect(onlyHttp).toBe(true);
    }
  });
});
