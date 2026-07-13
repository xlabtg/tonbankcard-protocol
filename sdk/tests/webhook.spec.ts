/**
 * Webhook Signature Tests (SDK)
 *
 * Verifies that `sdk/src/webhook.ts`:
 *  - accepts signatures produced by the server-side helper byte-for-byte
 *  - detects every replay / tamper / malformation case
 *  - mirrors the documented machine-readable failure reasons
 */

import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import {
  verifyWebhook,
  computeWebhookSignature,
  SIGNATURE_VERSION,
  DEFAULT_TOLERANCE_SECONDS,
} from '../src/webhook';

const SECRET = 'whsec_sdk_unit_test';
const BODY = JSON.stringify({ event: 'invoice.settled', invoice_id: 'inv_sdk' });

function buildHeader(timestamp: number, signature: string): string {
  return `t=${timestamp},${SIGNATURE_VERSION}=${signature}`;
}

describe('SDK webhook verification', () => {
  it('accepts a freshly signed payload', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    const header = buildHeader(now, sig);
    const result = verifyWebhook(SECRET, BODY, header, { now });
    expect(result).toEqual({ valid: true });
  });

  // CHECK405-L2: the Go SDK decodes both hex sides to bytes before `hmac.Equal`
  // and the Python SDK lowercases both before `compare_digest`, so an
  // uppercase-hex `v1=` signature is accepted there. The TS SDK must match that
  // parity instead of rejecting it with a spurious `signature_mismatch`.
  it('accepts an uppercase-hex v1= signature (cross-SDK parity)', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    const header = buildHeader(now, sig.toUpperCase());
    expect(verifyWebhook(SECRET, BODY, header, { now })).toEqual({
      valid: true,
    });
  });

  it('still rejects a same-length but wrong uppercase-hex signature', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    // Flip the first hex nibble so the signature is wrong but still valid hex
    // of the correct length, then upper-case it.
    const flipped = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    const header = buildHeader(now, flipped.toUpperCase());
    expect(verifyWebhook(SECRET, BODY, header, { now }).reason).toBe(
      'signature_mismatch',
    );
  });

  it('reports missing_signature for null / undefined / empty input', () => {
    expect(verifyWebhook(SECRET, BODY, undefined).valid).toBe(false);
    expect(verifyWebhook(SECRET, BODY, null).reason).toBe('missing_signature');
    expect(verifyWebhook(SECRET, BODY, '').reason).toBe('missing_signature');
  });

  it('reports malformed_signature for garbage', () => {
    expect(verifyWebhook(SECRET, BODY, 'gibberish').reason).toBe(
      'malformed_signature',
    );
  });

  it('reports timestamp_out_of_tolerance for stale signatures', () => {
    const signedAt = 1_700_000_000;
    const verifyAt = signedAt + DEFAULT_TOLERANCE_SECONDS + 1;
    const sig = computeWebhookSignature(SECRET, String(signedAt), BODY);
    const header = buildHeader(signedAt, sig);
    const result = verifyWebhook(SECRET, BODY, header, { now: verifyAt });
    expect(result.reason).toBe('timestamp_out_of_tolerance');
  });

  it('reports signature_mismatch when the body is altered', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    const header = buildHeader(now, sig);
    const altered = BODY.replace('inv_sdk', 'inv_evil');
    expect(verifyWebhook(SECRET, altered, header, { now }).reason).toBe(
      'signature_mismatch',
    );
  });

  it('reports signature_mismatch when the secret is wrong', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    const header = buildHeader(now, sig);
    expect(verifyWebhook('other-secret', BODY, header, { now }).reason).toBe(
      'signature_mismatch',
    );
  });

  it('reports unsupported_version when only future schemes are present', () => {
    const now = 1_700_000_000;
    const sig = computeWebhookSignature(SECRET, String(now), BODY);
    const header = `t=${now},v999=${sig}`;
    expect(verifyWebhook(SECRET, BODY, header, { now }).reason).toBe(
      'unsupported_version',
    );
  });

  it('accepts custom tolerance windows', () => {
    const signedAt = 1_700_000_000;
    const verifyAt = signedAt + 600;
    const sig = computeWebhookSignature(SECRET, String(signedAt), BODY);
    const header = buildHeader(signedAt, sig);
    expect(verifyWebhook(SECRET, BODY, header, { now: verifyAt, tolerance: 900 }).valid).toBe(true);
    expect(verifyWebhook(SECRET, BODY, header, { now: verifyAt, tolerance: 60 }).reason).toBe(
      'timestamp_out_of_tolerance',
    );
  });

  it('accepts a Buffer raw body', () => {
    const now = 1_700_000_000;
    const buf = Buffer.from(BODY, 'utf8');
    const sig = computeWebhookSignature(SECRET, String(now), buf);
    const header = buildHeader(now, sig);
    expect(verifyWebhook(SECRET, buf, header, { now }).valid).toBe(true);
  });

  it('matches a manually computed HMAC-SHA256 byte-for-byte', () => {
    const now = 1_700_000_000;
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${now}.`)
      .update(BODY)
      .digest('hex');
    expect(computeWebhookSignature(SECRET, String(now), BODY)).toBe(expected);
  });
});
