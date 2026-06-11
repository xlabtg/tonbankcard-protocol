/**
 * Policy regression for PC-09 (#378) — Android `autoVerify` must never sit on a
 * custom-scheme intent-filter.
 *
 * Android App Links verification (`android:autoVerify="true"`) only runs for
 * http/https data schemes. On the custom `tonbankcard` scheme it is a no-op that
 * can give a false sense of link verification, so it must not appear there. This
 * test parses the real `AndroidManifest.xml` so the manifest cannot silently
 * regress.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestSource = readFileSync(
  resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml'),
  'utf8',
);

// Every <intent-filter ...> … </intent-filter> block in the manifest.
const intentFilters =
  manifestSource.match(/<intent-filter[\s\S]*?<\/intent-filter>/g) ?? [];

function schemesOf(filter: string): string[] {
  return [...filter.matchAll(/android:scheme\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
}

function hasAutoVerify(filter: string): boolean {
  return /android:autoVerify\s*=\s*"true"/.test(filter);
}

describe('AndroidManifest deep-link intent-filters (PC-09)', () => {
  it('declares at least one intent-filter', () => {
    expect(intentFilters.length).toBeGreaterThan(0);
  });

  it('never sets autoVerify on a custom-scheme (non-http/https) filter', () => {
    for (const filter of intentFilters) {
      if (!hasAutoVerify(filter)) {
        continue;
      }
      // autoVerify is only meaningful for http/https App Links, so any filter
      // that opts in MUST declare an http/https data scheme and nothing else.
      const schemes = schemesOf(filter);
      const onlyHttp =
        schemes.length > 0 && schemes.every((s) => s === 'http' || s === 'https');
      expect(onlyHttp).toBe(true);
    }
  });

  it('keeps the tonbankcard custom-scheme filter present but without autoVerify', () => {
    const tonbankcardFilter = intentFilters.find((f) =>
      schemesOf(f).includes('tonbankcard'),
    );
    expect(tonbankcardFilter).toBeDefined();
    expect(hasAutoVerify(tonbankcardFilter as string)).toBe(false);
  });
});
