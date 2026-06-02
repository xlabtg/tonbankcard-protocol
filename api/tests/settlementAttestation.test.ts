/**
 * Settlement attestation tests (audit finding API-H3, issue #252).
 *
 * The attestation authenticates settlement events as having come from the
 * trusted indexer. These tests verify that:
 *   1. a freshly signed event verifies,
 *   2. any tampering with a signed field invalidates the attestation,
 *   3. a missing/empty attestation is rejected,
 *   4. a wrong secret is rejected,
 *   5. field ordering does not affect the signature (canonicalisation).
 */

import { describe, it, expect } from '@jest/globals';
import {
  SettlementEvent,
  canonicalizeSettlementEvent,
  signSettlementEvent,
  verifySettlementAttestation,
} from '../src/utils/settlementAttestation';

const SECRET = 'trusted-indexer-secret-value-1234567890';

const baseEvent: SettlementEvent = {
  payer_nft: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
  merchant_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  amount_tbc: '1000000000',
  payload_hash: 'a'.repeat(64),
  block_number: 1000,
  tx_hash: '0xabc123',
  timestamp: 1_700_000_000,
};

describe('settlementAttestation', () => {
  it('verifies a freshly signed event', () => {
    const attestation = signSettlementEvent(SECRET, baseEvent);
    expect(verifySettlementAttestation(SECRET, baseEvent, attestation)).toBe(true);
  });

  it('rejects a missing or empty attestation', () => {
    expect(verifySettlementAttestation(SECRET, baseEvent, undefined)).toBe(false);
    expect(verifySettlementAttestation(SECRET, baseEvent, '')).toBe(false);
  });

  it('rejects an attestation produced with a different secret', () => {
    const attestation = signSettlementEvent('some-other-secret-value-0987654321', baseEvent);
    expect(verifySettlementAttestation(SECRET, baseEvent, attestation)).toBe(false);
  });

  it('rejects when any signed field is tampered with', () => {
    const attestation = signSettlementEvent(SECRET, baseEvent);

    const mutations: Array<Partial<SettlementEvent>> = [
      { amount_tbc: '9999999999' },
      { payload_hash: 'b'.repeat(64) },
      { merchant_nft: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7' },
      { payer_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' },
      { block_number: 1001 },
      { tx_hash: '0xdeadbeef' },
      { timestamp: 1_700_000_001 },
    ];

    for (const mutation of mutations) {
      const tampered: SettlementEvent = { ...baseEvent, ...mutation };
      expect(verifySettlementAttestation(SECRET, tampered, attestation)).toBe(false);
    }
  });

  it('is insensitive to field ordering (canonicalisation)', () => {
    const reordered: SettlementEvent = {
      timestamp: baseEvent.timestamp,
      tx_hash: baseEvent.tx_hash,
      block_number: baseEvent.block_number,
      payload_hash: baseEvent.payload_hash,
      amount_tbc: baseEvent.amount_tbc,
      merchant_nft: baseEvent.merchant_nft,
      payer_nft: baseEvent.payer_nft,
    };
    expect(canonicalizeSettlementEvent(reordered)).toBe(
      canonicalizeSettlementEvent(baseEvent)
    );
    expect(signSettlementEvent(SECRET, reordered)).toBe(
      signSettlementEvent(SECRET, baseEvent)
    );
  });
});
