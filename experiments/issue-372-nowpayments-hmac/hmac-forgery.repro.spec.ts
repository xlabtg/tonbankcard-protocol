/**
 * Issue #372 / PC-03 — NOWPayments IPN HMAC forgery reproduction
 *
 * Standalone, self-contained behavioural reproduction of the PC-03 finding:
 * `backend/adapters/nowpayments.ts` verified IPN callbacks with a *placeholder*
 * digest — `hmac_placeholder_${data.length}_${secret.length}` — instead of a
 * real HMAC. That value depends only on two string *lengths* (never on the
 * secret's bytes) and is even leaked verbatim inside every legitimate callback,
 * so an attacker can forge a "payment finished" IPN that passes
 * `verifyCallback()` without ever knowing the IPN secret. A forged settlement
 * then credits a merchant's NFT Account for a payment that never happened.
 *
 * This spec inlines the EXACT pre-fix verifier for the "before" column and runs
 * the REAL adapter (`createNOWPaymentsAdapter`) for the "after" column, so the
 * contrast is demonstrated against live production code.
 *
 * Everything here uses synthetic, non-secret fixtures — never real credentials.
 */

import { createHmac } from 'crypto';

import { createNOWPaymentsAdapter } from '../../backend/adapters';
import type { PaymentCallback } from '../../backend/adapters';

// ---------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------

const IPN_SECRET = 'test_ipn_secret_key';

/** A legitimate "payment finished" callback (flat IPN body, as NOWPayments sends). */
const GENUINE_CALLBACK: PaymentCallback = {
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
 * Golden vector: HMAC-SHA512, keyed by IPN_SECRET, over the canonical
 * (recursively key-sorted) JSON of GENUINE_CALLBACK, hex-encoded. Hard-coded so
 * any change to the signing algorithm is caught, not silently absorbed.
 */
const GOLDEN_SIGNATURE =
  '1cd29b09828a5186afea90080567d3d9df75be898863749ff9f8fc449b68102e' +
  'b1ca1a9a7e92a3f1eb90230941437779f4a980c44fa394ca9444b9c4665feb0b';

// ---------------------------------------------------------------------------
// "Before": the exact pre-fix verifier, reproduced verbatim
// ---------------------------------------------------------------------------

/**
 * Faithful copy of the pre-fix `verifyCallback` + its helpers (the vulnerable
 * code as it shipped). `calculateHMAC` was a placeholder and the payload was
 * `JSON.stringify`-ed without canonicalization.
 */
function oldVerifyCallback(
  payload: string | PaymentCallback,
  signature: string,
  secret: string
): boolean {
  const payloadString =
    typeof payload === 'string' ? payload : JSON.stringify(payload);

  // old calculateHMAC — placeholder, depends only on two lengths
  const expected = `hmac_placeholder_${payloadString.length}_${secret.length}`;

  // old constantTimeCompare
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// "After": helpers that produce a genuine NOWPayments-style signature
// ---------------------------------------------------------------------------

/** Recursive key sort identical to the adapter's canonicalization. */
function canonicalize(payload: PaymentCallback): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sort((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(payload));
}

/** Real HMAC-SHA512 hex digest over the canonical body — what a genuine callback carries. */
function realSignature(payload: PaymentCallback, secret: string): string {
  return createHmac('sha512', secret)
    .update(canonicalize(payload), 'utf8')
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PC-03 / #372 — NOWPayments IPN HMAC verification', () => {
  const adapter = createNOWPaymentsAdapter('dummy-api-key', IPN_SECRET);

  describe('BEFORE the fix — the placeholder is trivially forgeable', () => {
    test('an attacker forges a "finished" IPN without knowing the secret', () => {
      // 1. The attacker observes ONE genuine callback's signature. The
      //    placeholder format leaks secret.length verbatim in its suffix.
      const genuineString = JSON.stringify(GENUINE_CALLBACK);
      const observedSignature = `hmac_placeholder_${genuineString.length}_${IPN_SECRET.length}`;
      const leakedSecretLength = Number(observedSignature.split('_').pop());
      expect(leakedSecretLength).toBe(IPN_SECRET.length);

      // 2. The attacker crafts a NEW malicious "finished" payment they never made.
      const forged: PaymentCallback = {
        ...GENUINE_CALLBACK,
        payment_id: 9999999999,
        order_id: 'ATTACKER-ORDER',
        pay_amount: 1_000_000,
      };
      const forgedString = JSON.stringify(forged);

      // 3. Using only public info (their own payload length + the leaked secret
      //    length) — and no secret bytes — they compute a matching signature.
      const forgedSignature = `hmac_placeholder_${forgedString.length}_${leakedSecretLength}`;

      // The vulnerable verifier ACCEPTS the forgery. This is PC-03.
      expect(oldVerifyCallback(forged, forgedSignature, IPN_SECRET)).toBe(true);
    });

    test('the placeholder ignores the secret bytes entirely', () => {
      const payloadString = JSON.stringify(GENUINE_CALLBACK);
      const sigWithRealSecret = `hmac_placeholder_${payloadString.length}_${IPN_SECRET.length}`;
      // A completely different secret of the same length yields the SAME value.
      const differentSecret = 'X'.repeat(IPN_SECRET.length);
      expect(oldVerifyCallback(GENUINE_CALLBACK, sigWithRealSecret, differentSecret)).toBe(true);
    });
  });

  describe('AFTER the fix — real HMAC-SHA512 verification', () => {
    test('rejects the forged placeholder-style signature', () => {
      const forged: PaymentCallback = {
        ...GENUINE_CALLBACK,
        payment_id: 9999999999,
        order_id: 'ATTACKER-ORDER',
        pay_amount: 1_000_000,
      };
      const forgedString = JSON.stringify(forged);
      const forgedSignature = `hmac_placeholder_${forgedString.length}_${IPN_SECRET.length}`;
      expect(adapter.verifyCallback(forged, forgedSignature)).toBe(false);
    });

    test('rejects a right-length but wrong-bytes guess', () => {
      const attackerGuess = 'a'.repeat(128); // correct HMAC-SHA512 hex length, wrong bytes
      expect(adapter.verifyCallback(GENUINE_CALLBACK, attackerGuess)).toBe(false);
    });

    test('accepts a correctly HMAC-SHA512-signed callback', () => {
      const signature = realSignature(GENUINE_CALLBACK, IPN_SECRET);
      expect(adapter.verifyCallback(GENUINE_CALLBACK, signature)).toBe(true);
    });

    test('matches the hard-coded golden vector (locks the algorithm)', () => {
      // Re-derived digest and the literal must agree...
      expect(realSignature(GENUINE_CALLBACK, IPN_SECRET)).toBe(GOLDEN_SIGNATURE);
      // ...and the live adapter must accept exactly that digest.
      expect(adapter.verifyCallback(GENUINE_CALLBACK, GOLDEN_SIGNATURE)).toBe(true);
    });

    test('verifies regardless of JSON key order (canonicalization)', () => {
      // A raw-string payload whose keys are in a different order than sorted.
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
      expect(adapter.verifyCallback(scrambled, GOLDEN_SIGNATURE)).toBe(true);
    });

    test('rejects a single-byte tampered signature', () => {
      const sig = realSignature(GENUINE_CALLBACK, IPN_SECRET);
      const tampered = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
      expect(adapter.verifyCallback(GENUINE_CALLBACK, tampered)).toBe(false);
    });

    test('rejects an empty signature without throwing', () => {
      expect(adapter.verifyCallback(GENUINE_CALLBACK, '')).toBe(false);
    });
  });
});
