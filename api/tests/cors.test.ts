/**
 * CORS Configuration Tests
 *
 * Verifies that the CORS configuration (fixes issue #92):
 * 1. Never defaults to wildcard '*' when ALLOWED_ORIGINS is not set
 * 2. Allows configured origins via the origin callback
 * 3. Rejects origins not in the allowlist
 * 4. Allows server-to-server requests (no Origin header)
 */

import { describe, it, expect, afterEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-import corsOptions fresh each time so that process.env changes
 * take effect (Jest module cache must be busted).
 */
async function loadCorsOptions(allowedOriginsEnv?: string): Promise<any> {
  jest.resetModules();
  const originalEnv = process.env.ALLOWED_ORIGINS;
  if (allowedOriginsEnv !== undefined) {
    process.env.ALLOWED_ORIGINS = allowedOriginsEnv;
  } else {
    delete process.env.ALLOWED_ORIGINS;
  }
  const mod = await import('../src/routes/invoiceRoutes');
  if (allowedOriginsEnv !== undefined) {
    process.env.ALLOWED_ORIGINS = originalEnv;
  } else {
    delete process.env.ALLOWED_ORIGINS;
  }
  return mod.corsOptions;
}

/**
 * Invoke the origin handler and return { allowed, error }.
 */
function checkOrigin(
  corsOptions: any,
  origin: string | undefined
): Promise<{ allowed: boolean; error: Error | null }> {
  return new Promise((resolve) => {
    if (typeof corsOptions.origin === 'function') {
      corsOptions.origin(origin, (err: Error | null, result?: boolean) => {
        resolve({ allowed: !!result && !err, error: err });
      });
    } else {
      // Static string/array — check directly
      const o = corsOptions.origin;
      if (o === '*') {
        resolve({ allowed: true, error: null });
      } else if (Array.isArray(o)) {
        resolve({ allowed: origin !== undefined && o.includes(origin), error: null });
      } else {
        resolve({ allowed: origin === o, error: null });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CORS configuration (fixes issue #92)', () => {
  afterEach(() => {
    jest.resetModules();
  });

  // -------------------------------------------------------------------------
  // 1. No wildcard when ALLOWED_ORIGINS is unset
  // -------------------------------------------------------------------------

  it('should NOT use wildcard origin when ALLOWED_ORIGINS env var is not set', async () => {
    const options = await loadCorsOptions(undefined);

    // The origin must not be the literal wildcard string '*'
    expect(options.origin).not.toBe('*');
  });

  // -------------------------------------------------------------------------
  // 2. Unlisted origin is rejected when no ALLOWED_ORIGINS configured
  // -------------------------------------------------------------------------

  it('should reject any cross-origin request when ALLOWED_ORIGINS is not set', async () => {
    const options = await loadCorsOptions(undefined);
    const { allowed } = await checkOrigin(options, 'https://evil.com');
    expect(allowed).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Configured origins are allowed
  // -------------------------------------------------------------------------

  it('should allow an origin that is in the ALLOWED_ORIGINS list', async () => {
    const options = await loadCorsOptions('https://example.com,https://staging.example.com');
    const { allowed } = await checkOrigin(options, 'https://example.com');
    expect(allowed).toBe(true);
  });

  it('should allow all origins listed in ALLOWED_ORIGINS', async () => {
    const options = await loadCorsOptions('https://example.com,https://staging.example.com');
    const staging = await checkOrigin(options, 'https://staging.example.com');
    expect(staging.allowed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Origin not in the list is rejected even when list is set
  // -------------------------------------------------------------------------

  it('should reject an origin not present in ALLOWED_ORIGINS', async () => {
    const options = await loadCorsOptions('https://example.com');
    const { allowed } = await checkOrigin(options, 'https://evil.com');
    expect(allowed).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Server-to-server (no Origin header) is allowed
  // -------------------------------------------------------------------------

  it('should allow requests with no Origin header (server-to-server)', async () => {
    const options = await loadCorsOptions(undefined);
    const { allowed } = await checkOrigin(options, undefined);
    expect(allowed).toBe(true);
  });
});
