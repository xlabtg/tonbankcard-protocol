/**
 * Unit tests for SDK utilities
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import {
  canonicalInvoiceIdPayload,
  canonicalJson,
  canonicalizeTonAddress,
  generateInvoiceId,
  createPayloadHash,
  formatTBC,
  parseTBC,
  isValidTonAddress,
  shortAddress,
  isExpired,
  formatTimestamp,
  serializeBigInt,
} from '../src/utils';

const sdkM5Fixture = JSON.parse(
  readFileSync(
    join(__dirname, '../../tests/fixtures/sdk-m5-canonical-hashes.json'),
    'utf8'
  )
) as {
  invoice: {
    merchant_nft_friendly: string;
    merchant_nft_raw: string;
    amount_tbc: string;
    order_id: string;
    timestamp: number;
    canonical: string;
    invoice_id: string;
  };
  payload: {
    value: Record<string, unknown> & { amount_tbc: string };
    value_reordered: Record<string, unknown>;
    canonical: string;
    hash_hex: string;
  };
};

function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(64, '0');
}

describe('Utils', () => {
  describe('generateInvoiceId', () => {
    it('should generate deterministic invoice ID', () => {
      const params = {
        merchantNft: Address.parse(
          'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
        ),
        amountTbc: BigInt(10_000_000_000),
        orderId: 'ORDER-123',
        timestamp: 1234567890,
      };

      const id1 = generateInvoiceId(params);
      const id2 = generateInvoiceId(params);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    it('should generate different IDs for different inputs', () => {
      const base = {
        merchantNft: Address.parse(
          'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
        ),
        amountTbc: BigInt(10_000_000_000),
        orderId: 'ORDER-123',
        timestamp: 1234567890,
      };

      const id1 = generateInvoiceId(base);
      const id2 = generateInvoiceId({
        ...base,
        amountTbc: BigInt(20_000_000_000),
      });
      const id3 = generateInvoiceId({ ...base, orderId: 'ORDER-456' });

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });

    it('should use the shared SDK-M5 canonical invoice fixture', () => {
      const params = {
        merchantNft: Address.parse(sdkM5Fixture.invoice.merchant_nft_friendly),
        amountTbc: BigInt(sdkM5Fixture.invoice.amount_tbc),
        orderId: sdkM5Fixture.invoice.order_id,
        timestamp: sdkM5Fixture.invoice.timestamp,
      };

      expect(canonicalizeTonAddress(params.merchantNft)).toBe(
        sdkM5Fixture.invoice.merchant_nft_raw
      );
      expect(canonicalInvoiceIdPayload(params)).toBe(
        sdkM5Fixture.invoice.canonical
      );
      expect(generateInvoiceId(params)).toBe(sdkM5Fixture.invoice.invoice_id);
      expect(
        generateInvoiceId({
          ...params,
          merchantNft: sdkM5Fixture.invoice.merchant_nft_raw,
        })
      ).toBe(sdkM5Fixture.invoice.invoice_id);
    });

    it('should canonicalize empty order ID and max int64 timestamp', () => {
      const params = {
        merchantNft: sdkM5Fixture.invoice.merchant_nft_friendly,
        amountTbc: BigInt(sdkM5Fixture.invoice.amount_tbc),
        orderId: '',
        timestamp: 9223372036854775807n,
      };

      expect(canonicalInvoiceIdPayload(params)).toBe(
        `{"amount_tbc":"${sdkM5Fixture.invoice.amount_tbc}","merchant_nft":"${sdkM5Fixture.invoice.merchant_nft_raw}","order_id":"","timestamp":"9223372036854775807"}`
      );
      expect(generateInvoiceId(params)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should reject unsafe numeric timestamps', () => {
      expect(() =>
        canonicalInvoiceIdPayload({
          merchantNft: sdkM5Fixture.invoice.merchant_nft_friendly,
          amountTbc: BigInt(sdkM5Fixture.invoice.amount_tbc),
          timestamp: Number.MAX_SAFE_INTEGER + 1,
        })
      ).toThrow('safe integer');
    });

    it('should reject invalid merchant NFT addresses', () => {
      expect(() =>
        generateInvoiceId({
          merchantNft: 'not-a-ton-address',
          amountTbc: BigInt(sdkM5Fixture.invoice.amount_tbc),
          orderId: '',
          timestamp: sdkM5Fixture.invoice.timestamp,
        })
      ).toThrow();
    });
  });

  describe('createPayloadHash', () => {
    it('should ignore object key insertion order', () => {
      const payloadA = {
        invoice_id: 'INV-123',
        metadata: {
          order_id: 'ORDER-123',
          customer_id: 'CUSTOMER-1',
        },
      };
      const payloadB = {
        metadata: {
          customer_id: 'CUSTOMER-1',
          order_id: 'ORDER-123',
        },
        invoice_id: 'INV-123',
      };

      expect(hashToHex(createPayloadHash(payloadA))).toBe(
        hashToHex(createPayloadHash(payloadB))
      );
    });

    it('should use the shared SDK-M5 canonical payload fixture', () => {
      expect(canonicalJson(sdkM5Fixture.payload.value)).toBe(
        sdkM5Fixture.payload.canonical
      );
      expect(canonicalJson(sdkM5Fixture.payload.value_reordered)).toBe(
        sdkM5Fixture.payload.canonical
      );
      expect(hashToHex(createPayloadHash(sdkM5Fixture.payload.value))).toBe(
        sdkM5Fixture.payload.hash_hex
      );
      expect(
        hashToHex(createPayloadHash(sdkM5Fixture.payload.value_reordered))
      ).toBe(sdkM5Fixture.payload.hash_hex);
    });

    it('should encode BigInt payload values as decimal strings', () => {
      const withBigIntAmount = {
        ...sdkM5Fixture.payload.value,
        amount_tbc: BigInt(sdkM5Fixture.payload.value.amount_tbc),
      };

      expect(canonicalJson(withBigIntAmount)).toBe(
        sdkM5Fixture.payload.canonical
      );
      expect(hashToHex(createPayloadHash(withBigIntAmount))).toBe(
        sdkM5Fixture.payload.hash_hex
      );
    });

    it('should encode null payload values and reject undefined values', () => {
      expect(canonicalJson({ memo: null, nested: { value: null } })).toBe(
        '{"memo":null,"nested":{"value":null}}'
      );
      expect(createPayloadHash({ memo: null }) > 0n).toBe(true);
      expect(() => canonicalJson({ memo: undefined })).toThrow(
        'undefined values'
      );
      expect(() => createPayloadHash({ memo: undefined })).toThrow(
        'undefined values'
      );
    });
  });

  describe('formatTBC', () => {
    it('should format nanocoins to TBC', () => {
      expect(formatTBC(BigInt(10_500_000_000))).toBe('10.50');
      expect(formatTBC(BigInt(1_000_000_000))).toBe('1.00');
      expect(formatTBC(BigInt(123_456_789))).toBe('0.12');
    });

    it('should handle zero', () => {
      expect(formatTBC(BigInt(0))).toBe('0.00');
    });

    it('should support custom decimals', () => {
      expect(formatTBC(BigInt(10_500_000_000), 4)).toBe('10.5000');
      expect(formatTBC(BigInt(10_500_000_000), 0)).toBe('11');
    });

    it('should preserve values above the JavaScript safe integer limit', () => {
      const nanocoins = 2n ** 53n + 3n;

      const formatted = formatTBC(nanocoins, 9);

      expect(formatted).toBe('9007199.254740995');
      expect(parseTBC(formatted)).toBe(nanocoins);
    });
  });

  describe('parseTBC', () => {
    it('should parse TBC to nanocoins', () => {
      expect(parseTBC('10.50')).toBe(BigInt(10_500_000_000));
      expect(parseTBC('1')).toBe(BigInt(1_000_000_000));
      expect(parseTBC('0.123')).toBe(BigInt(123_000_000));
    });

    it('should handle zero', () => {
      expect(parseTBC('0')).toBe(BigInt(0));
    });

    it('should throw on invalid input', () => {
      expect(() => parseTBC('invalid')).toThrow('Invalid TBC amount');
      expect(() => parseTBC('-10')).toThrow('Invalid TBC amount');
    });
  });

  describe('isValidTonAddress', () => {
    it('should validate correct addresses', () => {
      expect(
        isValidTonAddress('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le')
      ).toBe(true);
      expect(
        isValidTonAddress('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7')
      ).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidTonAddress('invalid')).toBe(false);
      expect(isValidTonAddress('')).toBe(false);
      expect(isValidTonAddress('0x1234')).toBe(false);
    });

    it('should reject addresses with a corrupted CRC16 checksum', () => {
      // Same as the valid address above but with the final character flipped,
      // which invalidates the CRC16 checksum.
      expect(
        isValidTonAddress('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Lf')
      ).toBe(false);
    });

    it('should accept raw address form', () => {
      const raw = Address.parse(
        'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
      ).toRawString();
      expect(isValidTonAddress(raw)).toBe(true);
    });
  });

  describe('shortAddress', () => {
    it('should shorten long addresses', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      const short = shortAddress(addr);
      expect(short).toBe('EQAjHk...3il-Le');
    });

    it('should not shorten short addresses', () => {
      const addr = 'EQAjHk';
      const short = shortAddress(addr);
      expect(short).toBe(addr);
    });

    it('should support custom char count', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      const short = shortAddress(addr, 4);
      expect(short).toBe('EQAj...l-Le');
    });

    it('should accept Address objects', () => {
      const addr = Address.parse(
        'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
      );
      const short = shortAddress(addr);
      expect(short).toContain('...');
    });
  });

  describe('isExpired', () => {
    it('should detect expired timestamps', () => {
      const past = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(isExpired(past)).toBe(true);
    });

    it('should detect non-expired timestamps', () => {
      const future = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      expect(isExpired(future)).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isExpired(undefined)).toBe(false);
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to ISO string', () => {
      const timestamp = 1234567890;
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2009-02-13T23:31:30.000Z');
    });
  });

  describe('serializeBigInt', () => {
    it('should serialize bigint to string', () => {
      const value = BigInt(123456789);
      expect(serializeBigInt(value)).toBe('123456789');
    });

    it('should serialize objects with bigints', () => {
      const obj = {
        amount: BigInt(10_000_000_000),
        count: 5,
        nested: {
          value: BigInt(999),
        },
      };

      const serialized = serializeBigInt(obj);
      expect(serialized).toEqual({
        amount: '10000000000',
        count: 5,
        nested: {
          value: '999',
        },
      });
    });

    it('should serialize arrays with bigints', () => {
      const arr = [BigInt(1), BigInt(2), BigInt(3)];
      expect(serializeBigInt(arr)).toEqual(['1', '2', '3']);
    });

    it('should handle mixed types', () => {
      const value = {
        str: 'hello',
        num: 42,
        big: BigInt(999),
        arr: [1, BigInt(2), 3],
      };

      const serialized = serializeBigInt(value);
      expect(serialized).toEqual({
        str: 'hello',
        num: 42,
        big: '999',
        arr: [1, '2', 3],
      });
    });
  });
});
