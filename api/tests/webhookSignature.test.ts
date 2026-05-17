/**
 * Webhook Signature Tests (server side)
 *
 * Covers `utils/webhookSignature.ts`:
 *  - round-trips: sign → verify succeeds
 *  - tamper detection: modifying body or signature fails verification
 *  - replay protection: old timestamps fall outside the tolerance window
 *  - malformed and missing headers produce the expected machine-readable reasons
 */

import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import {
  computeSignature,
  signWebhook,
  verifyWebhookSignature,
  SIGNATURE_VERSION,
  DEFAULT_TOLERANCE_SECONDS,
} from '../src/utils/webhookSignature';

const SECRET = 'whsec_unit_test_secret';
const BODY = JSON.stringify({ event: 'invoice.settled', invoice_id: 'inv_abc' });

describe('webhookSignature', () => {
  describe('computeSignature', () => {
    it('produces a 64-char lowercase hex HMAC', () => {
      const sig = computeSignature(SECRET, '1700000000', BODY);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same inputs', () => {
      const a = computeSignature(SECRET, '1700000000', BODY);
      const b = computeSignature(SECRET, '1700000000', BODY);
      expect(a).toBe(b);
    });

    it('changes when the body changes', () => {
      const a = computeSignature(SECRET, '1700000000', BODY);
      const b = computeSignature(SECRET, '1700000000', BODY + ' ');
      expect(a).not.toBe(b);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('accepts a freshly signed payload', () => {
      const now = 1_700_000_000;
      const header = signWebhook(SECRET, BODY, now);
      const result = verifyWebhookSignature(SECRET, BODY, header, { now });
      expect(result).toEqual({ valid: true });
    });

    it('returns missing_signature for an undefined header', () => {
      const result = verifyWebhookSignature(SECRET, BODY, undefined);
      expect(result).toEqual({ valid: false, reason: 'missing_signature' });
    });

    it('returns malformed_signature for garbage input', () => {
      const result = verifyWebhookSignature(SECRET, BODY, 'not-a-signature');
      expect(result).toEqual({ valid: false, reason: 'malformed_signature' });
    });

    it('returns unsupported_version when no v1 is present', () => {
      const now = 1_700_000_000;
      const sig = computeSignature(SECRET, String(now), BODY);
      const header = `t=${now},v99=${sig}`;
      const result = verifyWebhookSignature(SECRET, BODY, header, { now });
      expect(result).toEqual({ valid: false, reason: 'unsupported_version' });
    });

    it('returns timestamp_out_of_tolerance when the signature is too old', () => {
      const signedAt = 1_700_000_000;
      const verifyAt = signedAt + DEFAULT_TOLERANCE_SECONDS + 1;
      const header = signWebhook(SECRET, BODY, signedAt);
      const result = verifyWebhookSignature(SECRET, BODY, header, { now: verifyAt });
      expect(result).toEqual({ valid: false, reason: 'timestamp_out_of_tolerance' });
    });

    it('returns signature_mismatch when the body is tampered with', () => {
      const now = 1_700_000_000;
      const header = signWebhook(SECRET, BODY, now);
      const tampered = BODY.replace('inv_abc', 'inv_xyz');
      const result = verifyWebhookSignature(SECRET, tampered, header, { now });
      expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
    });

    it('returns signature_mismatch when the secret differs', () => {
      const now = 1_700_000_000;
      const header = signWebhook(SECRET, BODY, now);
      const result = verifyWebhookSignature('whsec_other', BODY, header, { now });
      expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
    });

    it('tolerates extra unknown keys in the header', () => {
      const now = 1_700_000_000;
      const sig = computeSignature(SECRET, String(now), BODY);
      const header = `t=${now},${SIGNATURE_VERSION}=${sig},extra=ignored`;
      const result = verifyWebhookSignature(SECRET, BODY, header, { now });
      expect(result.valid).toBe(true);
    });

    it('accepts Buffer raw bodies', () => {
      const now = 1_700_000_000;
      const bodyBuffer = Buffer.from(BODY, 'utf8');
      const header = signWebhook(SECRET, bodyBuffer, now);
      const result = verifyWebhookSignature(SECRET, bodyBuffer, header, { now });
      expect(result.valid).toBe(true);
    });

    it('detects a single-byte change in the body (defeats replay-with-edit)', () => {
      const now = 1_700_000_000;
      const header = signWebhook(SECRET, BODY, now);
      const flipped = BODY.slice(0, -1) + 'X';
      const result = verifyWebhookSignature(SECRET, flipped, header, { now });
      expect(result.valid).toBe(false);
    });
  });

  describe('signature comparison', () => {
    it('uses constant-time comparison (length mismatch returns mismatch, never throws)', () => {
      const now = 1_700_000_000;
      const goodSig = computeSignature(SECRET, String(now), BODY);
      const shortHeader = `t=${now},${SIGNATURE_VERSION}=${goodSig.slice(0, 10)}`;
      const result = verifyWebhookSignature(SECRET, BODY, shortHeader, { now });
      expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
    });
  });

  describe('parity with crypto module', () => {
    it('matches a manually-computed HMAC-SHA256 for the same input', () => {
      const now = 1_700_000_000;
      const expected = crypto
        .createHmac('sha256', SECRET)
        .update(`${now}.`)
        .update(BODY)
        .digest('hex');
      const fromHelper = computeSignature(SECRET, String(now), BODY);
      expect(fromHelper).toBe(expected);
    });
  });
});
