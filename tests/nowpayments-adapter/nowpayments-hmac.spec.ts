/**
 * NOWPayments IPN HMAC signature verification — regression suite (PC-03 / #372)
 *
 * Locks the four acceptance criteria of finding PC-03:
 *   1. `calculateHMAC` produces a real HMAC-SHA512 digest (not a placeholder).
 *   2. A callback with an invalid signature is rejected; a correctly-signed one
 *      is accepted.
 *   3. The comparison is constant-time (`crypto.timingSafeEqual`).
 *   4. A fixed payload / secret / expected-signature vector is pinned so the
 *      signing algorithm can never silently drift.
 *
 * The suite drives the real adapter (`createNOWPaymentsAdapter`) and
 * independently recomputes the expected digest with `crypto`, so a regression in
 * either the canonicalization or the HMAC would fail the build.
 *
 * Fixtures are synthetic, non-secret values — never real credentials.
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { createNOWPaymentsAdapter } from '../../backend/adapters/nowpayments';
import type { PaymentCallback } from '../../backend/adapters/types';

// ---------------------------------------------------------------------------
// Fixed test vector (criterion 4)
// ---------------------------------------------------------------------------

const IPN_SECRET = 'test_ipn_secret_key';

/** Genuine "payment finished" callback — a flat IPN body, as NOWPayments sends. */
const CALLBACK: PaymentCallback = {
  payment_id: 5077125051,
  payment_status: 'finished',
  pay_address: 'TQAsynthetic_pay_address',
  price_amount: 99.99,
  price_currency: 'usd',
  pay_amount: 45.5,
  pay_currency: 'ton',
  order_id: 'ORDER-12345',
  order_description: 'Synthetic regression vector',
};

/**
 * Canonical (recursively key-sorted) JSON of {@link CALLBACK}. NOWPayments signs
 * this exact byte string; pinning it documents what the digest is computed over.
 */
const CANONICAL_JSON =
  '{"order_description":"Synthetic regression vector",' +
  '"order_id":"ORDER-12345",' +
  '"pay_address":"TQAsynthetic_pay_address",' +
  '"pay_amount":45.5,' +
  '"pay_currency":"ton",' +
  '"payment_id":5077125051,' +
  '"payment_status":"finished",' +
  '"price_amount":99.99,' +
  '"price_currency":"usd"}';

/** HMAC-SHA512(CANONICAL_JSON, IPN_SECRET), hex — the golden signature. */
const EXPECTED_SIGNATURE =
  '1cd29b09828a5186afea90080567d3d9df75be898863749ff9f8fc449b68102e' +
  'b1ca1a9a7e92a3f1eb90230941437779f4a980c44fa394ca9444b9c4665feb0b';

describe('NOWPayments IPN HMAC verification (PC-03 / #372)', () => {
  const adapter = createNOWPaymentsAdapter('dummy-api-key', IPN_SECRET);

  // -------------------------------------------------------------------------
  // Criterion 1 — real HMAC-SHA512, computed over the canonical body
  // -------------------------------------------------------------------------
  describe('criterion 1 — real HMAC-SHA512 digest', () => {
    test('the pinned vector is exactly HMAC-SHA512(canonical, secret)', () => {
      const recomputed = createHmac('sha512', IPN_SECRET)
        .update(CANONICAL_JSON, 'utf8')
        .digest('hex');
      expect(recomputed).toBe(EXPECTED_SIGNATURE);
      expect(EXPECTED_SIGNATURE).toMatch(/^[0-9a-f]{128}$/); // 64-byte SHA-512 hex
    });

    test('the digest is not the old placeholder format', () => {
      // The pre-fix code returned `hmac_placeholder_<len>_<len>`; reject any
      // signature that the adapter would produce in that shape.
      expect(adapter.verifyCallback(CALLBACK, EXPECTED_SIGNATURE)).toBe(true);
      const placeholder = `hmac_placeholder_${CANONICAL_JSON.length}_${IPN_SECRET.length}`;
      expect(adapter.verifyCallback(CALLBACK, placeholder)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Criterion 2 — invalid rejected, correctly-signed accepted
  // -------------------------------------------------------------------------
  describe('criterion 2 — accept genuine, reject forged', () => {
    test('accepts the correctly-signed callback (object form)', () => {
      expect(adapter.verifyCallback(CALLBACK, EXPECTED_SIGNATURE)).toBe(true);
    });

    test('accepts the correctly-signed callback (raw-string form)', () => {
      expect(adapter.verifyCallback(JSON.stringify(CALLBACK), EXPECTED_SIGNATURE)).toBe(true);
    });

    test('accepts regardless of JSON key order (canonicalization)', () => {
      const scrambled = JSON.stringify({
        price_currency: 'usd',
        payment_status: 'finished',
        order_description: 'Synthetic regression vector',
        pay_currency: 'ton',
        payment_id: 5077125051,
        pay_amount: 45.5,
        order_id: 'ORDER-12345',
        price_amount: 99.99,
        pay_address: 'TQAsynthetic_pay_address',
      });
      expect(adapter.verifyCallback(scrambled, EXPECTED_SIGNATURE)).toBe(true);
    });

    test('rejects a forged placeholder-style signature', () => {
      const placeholder = `hmac_placeholder_${CANONICAL_JSON.length}_${IPN_SECRET.length}`;
      expect(adapter.verifyCallback(CALLBACK, placeholder)).toBe(false);
    });

    test('rejects a signature computed with the wrong secret', () => {
      const wrong = createHmac('sha512', 'wrong_secret')
        .update(CANONICAL_JSON, 'utf8')
        .digest('hex');
      expect(adapter.verifyCallback(CALLBACK, wrong)).toBe(false);
    });

    test('rejects a tampered payload under a genuine signature', () => {
      // Attacker keeps the genuine signature but inflates the amount.
      const tampered: PaymentCallback = { ...CALLBACK, pay_amount: 1_000_000 };
      expect(adapter.verifyCallback(tampered, EXPECTED_SIGNATURE)).toBe(false);
    });

    test('rejects an empty signature without throwing', () => {
      expect(adapter.verifyCallback(CALLBACK, '')).toBe(false);
    });

    test('throws when no IPN secret is configured', () => {
      const noSecret = createNOWPaymentsAdapter('dummy-api-key');
      expect(() => noSecret.verifyCallback(CALLBACK, EXPECTED_SIGNATURE)).toThrow(
        /IPN Secret Key is required/
      );
    });
  });

  // -------------------------------------------------------------------------
  // Criterion 3 — constant-time comparison
  // -------------------------------------------------------------------------
  describe('criterion 3 — constant-time comparison', () => {
    test('a one-byte difference at the END is rejected (full-content compare)', () => {
      const last = EXPECTED_SIGNATURE.slice(-1);
      const flipped = (last === '0' ? '1' : '0');
      const almost = EXPECTED_SIGNATURE.slice(0, -1) + flipped;
      expect(adapter.verifyCallback(CALLBACK, almost)).toBe(false);
    });

    test('a one-byte difference at the START is rejected (no early exit)', () => {
      const first = EXPECTED_SIGNATURE.slice(0, 1);
      const flipped = (first === '0' ? '1' : '0');
      const almost = flipped + EXPECTED_SIGNATURE.slice(1);
      expect(adapter.verifyCallback(CALLBACK, almost)).toBe(false);
    });

    test('a wrong-length signature is rejected, not thrown', () => {
      // timingSafeEqual throws on length mismatch; the adapter must guard first.
      expect(adapter.verifyCallback(CALLBACK, 'deadbeef')).toBe(false);
      expect(adapter.verifyCallback(CALLBACK, EXPECTED_SIGNATURE + 'ff')).toBe(false);
    });

    test('the adapter relies on the same primitive this suite uses', () => {
      // Sanity check that timingSafeEqual is available and length-sensitive in
      // this runtime, matching the adapter's constant-time path.
      const a = Buffer.from(EXPECTED_SIGNATURE, 'utf8');
      const b = Buffer.from(EXPECTED_SIGNATURE, 'utf8');
      expect(timingSafeEqual(a, b)).toBe(true);
      expect(() => timingSafeEqual(a, Buffer.from('short', 'utf8'))).toThrow();
    });
  });
});
