/**
 * Standalone reproduction of PC-04 / #373 — idempotency-key collision on nested metadata.
 *
 * `before` column: a faithful copy of the pre-fix `generateIdempotencyKey`,
 * which serialised with `JSON.stringify(data, Object.keys(data).sort())`. The
 * second argument is a *replacer array* applied recursively, so every nested
 * key (notably `metadata.*`) is dropped and two requests differing only inside
 * `metadata` hash to the SAME key.
 *
 * `after` column: the REAL, fixed `generateIdempotencyKey` / `canonicalize`
 * imported from `api/src/utils/helpers.ts`, so the contrast is against live
 * code, exactly like the PC-03 reproduction drives the real adapter.
 *
 * | Two requests differing only in `metadata.order_id` |                     |
 * | --- | --- |
 * | **Before the fix** (replacer-array) | **COLLIDE** ❌ — 2nd served as replay of 1st |
 * | **After the fix** (recursive canonicalize) | distinct keys ✅ |
 */

import crypto from 'crypto';
import { describe, it, expect } from '@jest/globals';
import {
  canonicalize,
  generateIdempotencyKey,
} from '../../api/src/utils/helpers';
import type { CreateInvoiceRequest } from '../../api/src/types/invoice';

/** Faithful copy of the PRE-FIX implementation (the bug under test). */
function oldGenerateIdempotencyKey(
  request: CreateInvoiceRequest,
  keyId?: string
): string {
  const data = {
    key_id: keyId ?? null,
    merchant_nft: request.merchant_nft,
    amount_tbc: request.amount_tbc,
    currency: request.currency,
    metadata: request.metadata || {},
    expires_at: request.expires_at ?? null,
  };
  // The replacer array keeps only the listed keys at EVERY level → metadata.* lost.
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

const KEY_ID = 'key_abc123';
const baseRequest: CreateInvoiceRequest = {
  merchant_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  amount_tbc: '1000000000',
  currency: 'TBC',
  expires_at: '2026-01-01T00:00:00.000Z',
};

const reqA: CreateInvoiceRequest = { ...baseRequest, metadata: { order_id: 'A' } };
const reqB: CreateInvoiceRequest = { ...baseRequest, metadata: { order_id: 'B' } };

describe('PC-04 — before the fix (replacer array drops nested metadata)', () => {
  it('COLLIDES: two requests differing only in metadata.order_id share a key', () => {
    expect(oldGenerateIdempotencyKey(reqA, KEY_ID)).toBe(
      oldGenerateIdempotencyKey(reqB, KEY_ID)
    );
  });

  it('proves why: metadata serialises to {} (nested keys are dropped)', () => {
    const data = {
      key_id: KEY_ID,
      merchant_nft: baseRequest.merchant_nft,
      amount_tbc: baseRequest.amount_tbc,
      currency: baseRequest.currency,
      metadata: { order_id: 'A' },
      expires_at: baseRequest.expires_at,
    };
    expect(JSON.stringify(data, Object.keys(data).sort())).toContain('"metadata":{}');
  });
});

describe('PC-04 — after the fix (real canonicalize recurses into metadata)', () => {
  it('produces DISTINCT keys for the same two requests', () => {
    expect(generateIdempotencyKey(reqA, KEY_ID)).not.toBe(
      generateIdempotencyKey(reqB, KEY_ID)
    );
  });

  it('stays invariant to metadata key ordering (idempotency preserved)', () => {
    const ordered: CreateInvoiceRequest = {
      ...baseRequest,
      metadata: { order_id: 'O', description: 'Coffee', customer_email: 'a@b.co' },
    };
    const reordered: CreateInvoiceRequest = {
      ...baseRequest,
      metadata: { customer_email: 'a@b.co', order_id: 'O', description: 'Coffee' },
    };
    expect(generateIdempotencyKey(ordered, KEY_ID)).toBe(
      generateIdempotencyKey(reordered, KEY_ID)
    );
  });

  it('canonicalize keeps the nested difference the replacer array lost', () => {
    expect(canonicalize({ metadata: { order_id: 'A' } })).not.toBe(
      canonicalize({ metadata: { order_id: 'B' } })
    );
  });
});
