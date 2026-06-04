/**
 * Validation Tests
 *
 * Unit tests for input validation functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateTonAddress,
  validateWhitelistedNFT,
  validateAmount,
  validateMetadata,
  validateTimestamp,
  validateExpirationTime,
  validateInvoiceId,
  ValidationError,
} from '../src/utils/validation';
import { ErrorCode, WHITELISTED_NFT_COLLECTIONS } from '../src/types/invoice';

describe('Validation Utilities', () => {
  describe('validateTonAddress', () => {
    it('should accept valid TON address', () => {
      const validAddress = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      expect(() => validateTonAddress(validAddress)).not.toThrow();
    });

    it('should reject empty address', () => {
      expect(() => validateTonAddress('')).toThrow(ValidationError);
      expect(() => validateTonAddress('')).toThrow(
        'Address must be a non-empty string',
      );
    });

    it('should reject invalid format', () => {
      expect(() => validateTonAddress('invalid')).toThrow(ValidationError);
      expect(() => validateTonAddress('invalid')).toThrow(
        'Invalid TON address format',
      );
    });

    it('should reject address with wrong length', () => {
      const shortAddress = 'EQAbc123';
      expect(() => validateTonAddress(shortAddress)).toThrow(ValidationError);
    });
  });

  describe('validateWhitelistedNFT', () => {
    it('should accept NFT address from whitelisted collection (Series 7777)', () => {
      const whitelistedAddress = WHITELISTED_NFT_COLLECTIONS[0];
      expect(() => validateWhitelistedNFT(whitelistedAddress)).not.toThrow();
      expect(validateWhitelistedNFT(whitelistedAddress)).toBe(true);
    });

    it('should accept NFT address from whitelisted collection (Series 8888)', () => {
      const whitelistedAddress = WHITELISTED_NFT_COLLECTIONS[1];
      expect(() => validateWhitelistedNFT(whitelistedAddress)).not.toThrow();
      expect(validateWhitelistedNFT(whitelistedAddress)).toBe(true);
    });

    it('should reject valid TON address not in whitelist', () => {
      const nonWhitelistedAddress =
        'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      expect(() => validateWhitelistedNFT(nonWhitelistedAddress)).toThrow(
        ValidationError,
      );
    });

    it('should reject non-whitelisted address with NFT_NOT_WHITELISTED error code', () => {
      const nonWhitelistedAddress =
        'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      try {
        validateWhitelistedNFT(nonWhitelistedAddress);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBe(
          ErrorCode.NFT_NOT_WHITELISTED,
        );
        expect((error as ValidationError).message).toBe(
          'NFT address is not from a whitelisted collection',
        );
      }
    });

    it('should reject invalid TON address format before whitelist check', () => {
      expect(() => validateWhitelistedNFT('invalid')).toThrow(ValidationError);
      try {
        validateWhitelistedNFT('invalid');
      } catch (error) {
        expect((error as ValidationError).code).toBe(
          ErrorCode.INVALID_NFT_ADDRESS,
        );
      }
    });

    it('should reject empty address', () => {
      expect(() => validateWhitelistedNFT('')).toThrow(ValidationError);
    });

    it('error details should include the rejected address but not the full whitelist', () => {
      const nonWhitelistedAddress =
        'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      try {
        validateWhitelistedNFT(nonWhitelistedAddress);
      } catch (error) {
        expect((error as ValidationError).details).toMatchObject({
          nftAddress: nonWhitelistedAddress,
        });
        expect((error as ValidationError).details).not.toHaveProperty(
          'whitelistedCollections',
        );
      }
    });
  });

  describe('validateAmount', () => {
    it('should accept valid positive amount', () => {
      expect(() => validateAmount('1000000000')).not.toThrow();
      expect(() => validateAmount('1')).not.toThrow();
    });

    it('should reject zero amount', () => {
      expect(() => validateAmount('0')).toThrow(ValidationError);
      expect(() => validateAmount('0')).toThrow(
        'Amount must be greater than zero',
      );
    });

    it('should reject negative amount', () => {
      expect(() => validateAmount('-100')).toThrow(ValidationError);
    });

    it('should reject non-numeric amount', () => {
      expect(() => validateAmount('abc')).toThrow(ValidationError);
      expect(() => validateAmount('abc')).toThrow(
        'Amount must be a valid integer',
      );
    });

    it('should reject amount exceeding maximum', () => {
      const maxAmount = (2n ** 120n - 1n).toString();
      const tooLarge = (2n ** 120n).toString();

      expect(() => validateAmount(maxAmount)).not.toThrow();
      expect(() => validateAmount(tooLarge)).toThrow(ValidationError);
      expect(() => validateAmount(tooLarge)).toThrow(
        'Amount exceeds maximum allowed value',
      );
    });
  });

  describe('validateMetadata', () => {
    it('should accept valid metadata', () => {
      const metadata = {
        order_id: 'ORDER-123',
        description: 'Test order',
        amount: 100,
        active: true,
      };
      expect(() => validateMetadata(metadata)).not.toThrow();
    });

    it('should accept empty metadata', () => {
      expect(() => validateMetadata(undefined)).not.toThrow();
      expect(() => validateMetadata({})).not.toThrow();
    });

    it('should reject too many fields', () => {
      const metadata: any = {};
      for (let i = 0; i < 11; i++) {
        metadata[`field${i}`] = 'value';
      }

      expect(() => validateMetadata(metadata)).toThrow(ValidationError);
      expect(() => validateMetadata(metadata)).toThrow(
        'cannot have more than 10 fields',
      );
    });

    it('should reject invalid field names', () => {
      const metadata = {
        'invalid-key': 'value', // Hyphens not allowed
      };

      expect(() => validateMetadata(metadata)).toThrow(ValidationError);
      expect(() => validateMetadata(metadata)).toThrow(
        'must be alphanumeric with underscores',
      );
    });

    it('should reject invalid value types', () => {
      const metadata = {
        nested: { object: 'not allowed' },
      };

      expect(() => validateMetadata(metadata as any)).toThrow(ValidationError);
      expect(() => validateMetadata(metadata as any)).toThrow(
        'must be string, number, boolean',
      );
    });

    it('should reject metadata exceeding size limit', () => {
      const largeString = 'x'.repeat(2000);
      const metadata = {
        large_field: largeString,
      };

      expect(() => validateMetadata(metadata)).toThrow(ValidationError);
      expect(() => validateMetadata(metadata)).toThrow('Metadata size exceeds');
    });
  });

  describe('validateTimestamp', () => {
    it('should accept valid ISO 8601 timestamp', () => {
      const validTimestamp = new Date().toISOString();
      expect(() => validateTimestamp(validTimestamp)).not.toThrow();
    });

    it('should reject invalid timestamp', () => {
      expect(() => validateTimestamp('invalid')).toThrow(ValidationError);
      expect(() => validateTimestamp('invalid')).toThrow(
        'Invalid ISO 8601 timestamp',
      );
    });

    it('should reject empty timestamp', () => {
      expect(() => validateTimestamp('')).toThrow(ValidationError);
    });
  });

  describe('validateExpirationTime', () => {
    it('should accept future timestamp', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(() => validateExpirationTime(future)).not.toThrow();
    });

    it('should reject past timestamp', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(() => validateExpirationTime(past)).toThrow(ValidationError);
      expect(() => validateExpirationTime(past)).toThrow(
        'Expiration time must be in the future',
      );
    });

    it('should reject current timestamp', () => {
      const now = new Date().toISOString();
      expect(() => validateExpirationTime(now)).toThrow(ValidationError);
    });
  });

  describe('validateInvoiceId', () => {
    it('should accept valid invoice ID', () => {
      const validId = 'inv_9f3a7b2c1d4e5f6a';
      expect(() => validateInvoiceId(validId)).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => validateInvoiceId('invalid')).toThrow(ValidationError);
      expect(() => validateInvoiceId('invalid')).toThrow(
        'Invalid invoice ID format',
      );
    });

    it('should reject missing prefix', () => {
      expect(() => validateInvoiceId('9f3a7b2c1d4e5f6a')).toThrow(
        ValidationError,
      );
    });

    it('should reject wrong length', () => {
      expect(() => validateInvoiceId('inv_123')).toThrow(ValidationError);
    });
  });
});
