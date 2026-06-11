/**
 * Idempotency-key / canonical-serialisation tests (audit finding PC-04, issue #373).
 *
 * `generateIdempotencyKey` previously serialised its payload with
 * `JSON.stringify(data, Object.keys(data).sort())`. The second argument is a
 * *replacer array* that `JSON.stringify` applies recursively, so only the
 * listed top-level keys survive and every nested key (notably `metadata.*`) is
 * dropped. Two requests differing only inside `metadata` therefore produced the
 * SAME idempotency key, and the second create was wrongly served as a replay of
 * the first.
 *
 * These tests verify the fix (a recursive `canonicalize`) against the issue's
 * acceptance criteria:
 *   1. requests differing in any nested field (including `metadata.*`) produce
 *      DISTINCT keys,
 *   2. requests identical up to key ordering produce the SAME key,
 *   3. `canonicalize` recurses (the property the replacer-array shortcut lacked),
 *   4. `hashMetadata` — which shares `canonicalize` — is byte-for-byte
 *      unchanged for the flat metadata it hashes (pinned golden vector), so
 *      on-chain payload-hash matching is not affected.
 */

import { describe, it, expect } from '@jest/globals';
import {
  canonicalize,
  generateIdempotencyKey,
  hashMetadata,
} from '../src/utils/helpers';
import { CreateInvoiceRequest } from '../src/types/invoice';

const KEY_ID = 'key_abc123';

const baseRequest: CreateInvoiceRequest = {
  merchant_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  amount_tbc: '1000000000',
  currency: 'TBC',
  expires_at: '2026-01-01T00:00:00.000Z',
};

describe('generateIdempotencyKey (PC-04: nested-metadata collision)', () => {
  it('produces DISTINCT keys when only a nested metadata field differs', () => {
    const a: CreateInvoiceRequest = { ...baseRequest, metadata: { order_id: 'A' } };
    const b: CreateInvoiceRequest = { ...baseRequest, metadata: { order_id: 'B' } };

    expect(generateIdempotencyKey(a, KEY_ID)).not.toBe(
      generateIdempotencyKey(b, KEY_ID)
    );
  });

  it('distinguishes EVERY nested metadata field, not just order_id', () => {
    const variants: Array<CreateInvoiceRequest['metadata']> = [
      { order_id: 'X', description: 'first' },
      { order_id: 'X', description: 'second' },
      { order_id: 'X', customer_email: 'a@example.com' },
      { order_id: 'X', customer_email: 'b@example.com' },
      { order_id: 'X', arbitrary_field: 'one' },
      { order_id: 'X', arbitrary_field: 'two' },
      { order_id: 'X', numeric_field: 1 },
      { order_id: 'X', numeric_field: 2 },
      { order_id: 'X', bool_field: true },
      { order_id: 'X', bool_field: false },
    ];

    const keys = variants.map((metadata) =>
      generateIdempotencyKey({ ...baseRequest, metadata }, KEY_ID)
    );

    // Every distinct metadata must yield a distinct key — no collisions.
    expect(new Set(keys).size).toBe(variants.length);
  });

  it('is INVARIANT to metadata key ordering (same logical request → same key)', () => {
    const a: CreateInvoiceRequest = {
      ...baseRequest,
      metadata: { order_id: 'O-1', description: 'Coffee', customer_email: 'a@b.co' },
    };
    const b: CreateInvoiceRequest = {
      ...baseRequest,
      metadata: { customer_email: 'a@b.co', order_id: 'O-1', description: 'Coffee' },
    };

    expect(generateIdempotencyKey(a, KEY_ID)).toBe(generateIdempotencyKey(b, KEY_ID));
  });

  it('is INVARIANT to top-level request field ordering', () => {
    const ordered: CreateInvoiceRequest = {
      merchant_nft: baseRequest.merchant_nft,
      amount_tbc: baseRequest.amount_tbc,
      currency: 'TBC',
      expires_at: baseRequest.expires_at,
      metadata: { order_id: 'O-2' },
    };
    const reordered: CreateInvoiceRequest = {
      metadata: { order_id: 'O-2' },
      expires_at: baseRequest.expires_at,
      currency: 'TBC',
      amount_tbc: baseRequest.amount_tbc,
      merchant_nft: baseRequest.merchant_nft,
    };

    expect(generateIdempotencyKey(ordered, KEY_ID)).toBe(
      generateIdempotencyKey(reordered, KEY_ID)
    );
  });

  it('keeps identical requests stable (idempotency still works)', () => {
    const metadata = { order_id: 'STABLE', description: 'same' };
    expect(generateIdempotencyKey({ ...baseRequest, metadata }, KEY_ID)).toBe(
      generateIdempotencyKey({ ...baseRequest, metadata: { ...metadata } }, KEY_ID)
    );
  });

  it('scopes the key to the API key id and to expires_at', () => {
    const req: CreateInvoiceRequest = { ...baseRequest, metadata: { order_id: 'Z' } };

    // Different key id → different namespace.
    expect(generateIdempotencyKey(req, 'key_one')).not.toBe(
      generateIdempotencyKey(req, 'key_two')
    );
    // Different expiry → different key (audit finding API-M2).
    expect(
      generateIdempotencyKey({ ...req, expires_at: '2026-01-01T00:00:00.000Z' }, KEY_ID)
    ).not.toBe(
      generateIdempotencyKey({ ...req, expires_at: '2026-02-01T00:00:00.000Z' }, KEY_ID)
    );
  });
});

describe('canonicalize', () => {
  it('sorts keys at EVERY nesting level (recursive), unlike a replacer array', () => {
    const nestedA = { metadata: { z: 1, a: 2 } };
    const nestedB = { metadata: { a: 2, z: 1 } };
    expect(canonicalize(nestedA)).toBe(canonicalize(nestedB));
    expect(canonicalize(nestedA)).toBe('{"metadata":{"a":2,"z":1}}');
  });

  it('preserves nested differences that the replacer-array shortcut dropped', () => {
    expect(canonicalize({ metadata: { order_id: 'A' } })).not.toBe(
      canonicalize({ metadata: { order_id: 'B' } })
    );

    // Demonstrate the original bug for contrast: the replacer array keeps only
    // top-level keys, so both nested payloads collapse to `metadata:{}`.
    const buggy = (v: object) => JSON.stringify(v, Object.keys(v).sort());
    expect(buggy({ metadata: { order_id: 'A' } })).toBe(
      buggy({ metadata: { order_id: 'B' } })
    );
  });

  it('preserves array element order', () => {
    expect(canonicalize({ tags: ['b', 'a', 'c'] })).toBe('{"tags":["b","a","c"]}');
    expect(canonicalize(['b', 'a'])).not.toBe(canonicalize(['a', 'b']));
  });

  it('omits undefined-valued object properties but renders array holes as null', () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalize([1, undefined, 2])).toBe('[1,null,2]');
  });

  it('matches JSON.stringify for flat objects (backward-compatible serialisation)', () => {
    const flatCases: Record<string, unknown>[] = [
      { invoice_id: 'inv_1', order_id: 'A', description: 'hello' },
      { invoice_id: 'inv_2', b: 2, a: 1, c: true },
      { invoice_id: 'inv_3', order_id: undefined, description: 'only desc' },
      { '10': 'x', '2': 'y', invoice_id: 'inv_5' },
      { invoice_id: 'inv_6', note: 'q"uote', emoji: '🎉' },
    ];
    for (const c of flatCases) {
      expect(canonicalize(c)).toBe(JSON.stringify(c, Object.keys(c).sort()));
    }
  });
});

describe('hashMetadata (PC-04: shares canonicalize, behaviour unchanged)', () => {
  // Golden vector computed with the PRE-FIX implementation
  // `JSON.stringify(metadata, Object.keys(metadata).sort())`. The fix must keep
  // this digest stable so on-chain payload-hash matching is unaffected.
  const GOLDEN_METADATA = {
    invoice_id: 'inv_0123456789abcdef',
    order_id: 'ORDER-42',
    description: 'Coffee',
    customer_email: 'a@b.co',
  };
  const GOLDEN_HASH =
    '89f36b355ef06a200c83dde7bcf999995452b843d9a84f750bc62a73551f9bf5';

  it('still produces the pre-fix golden hash for flat metadata', () => {
    expect(hashMetadata(GOLDEN_METADATA)).toBe(GOLDEN_HASH);
  });

  it('is insensitive to metadata key ordering', () => {
    const reordered = {
      customer_email: 'a@b.co',
      description: 'Coffee',
      order_id: 'ORDER-42',
      invoice_id: 'inv_0123456789abcdef',
    };
    expect(hashMetadata(reordered)).toBe(GOLDEN_HASH);
  });
});
