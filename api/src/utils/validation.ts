/**
 * Validation Utilities
 *
 * Input validation functions for the Merchant API.
 * Ensures all inputs comply with specification requirements.
 *
 * @see docs/merchant-api-spec.md
 */

import {
  WHITELISTED_NFT_COLLECTIONS,
  CONSTANTS,
  InvoiceMetadata,
} from '../types/invoice';
import { ErrorCode } from '../types/errors';

/**
 * Validation error
 *
 * Always carries a stable `ErrorCode` so the central error handler can
 * map it to the correct HTTP status and envelope without sniffing the
 * message text. The optional `details` field is structured context that
 * is sanitised by `middleware/errorHandler.ts` before being returned
 * to the client.
 */
export class ValidationError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate TON address format
 *
 * TON addresses are base64-encoded with specific format:
 * - Starts with 'E' (mainnet) or 'k' (testnet)
 * - Followed by 'Q' for non-bounceable or 'q' for bounceable
 * - 48 characters total
 *
 * @param address - Address to validate
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    throw new ValidationError(
      ErrorCode.INVALID_NFT_ADDRESS,
      'Address must be a non-empty string',
      { address },
    );
  }

  // Basic format check: EQ followed by 46 base64 characters
  const tonAddressRegex = /^[Ek][Qq][A-Za-z0-9_-]{46}$/;

  if (!tonAddressRegex.test(address)) {
    throw new ValidationError(
      ErrorCode.INVALID_NFT_ADDRESS,
      'Invalid TON address format',
      { address, expected: 'EQxxxxx... (48 characters)' },
    );
  }

  return true;
}

/**
 * Validate NFT address is in whitelisted collections
 *
 * Checks the NFT address against the static whitelist of known collection addresses.
 *
 * Note: Full on-chain verification (querying the NFT item contract to retrieve its
 * collection address and then calling PaymentHub.isCollectionWhitelisted) requires
 * TON SDK integration and should be implemented before production use.
 *
 * @param nftAddress - NFT address to validate
 * @returns true if whitelisted
 * @throws ValidationError if address format is invalid or not in whitelist
 */
export function validateWhitelistedNFT(nftAddress: string): boolean {
  validateTonAddress(nftAddress);

  const isWhitelisted = (
    WHITELISTED_NFT_COLLECTIONS as readonly string[]
  ).includes(nftAddress);

  if (!isWhitelisted) {
    throw new ValidationError(
      ErrorCode.NFT_NOT_WHITELISTED,
      'NFT address is not from a whitelisted collection',
      {
        nftAddress,
      },
    );
  }

  return true;
}

/**
 * Validate TBC amount
 *
 * @param amountTbc - Amount in nanocoins (string)
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateAmount(amountTbc: string): boolean {
  if (!amountTbc || typeof amountTbc !== 'string') {
    throw new ValidationError(
      ErrorCode.INVALID_AMOUNT,
      'Amount must be a non-empty string',
      { amountTbc },
    );
  }

  // Parse as BigInt to handle large numbers
  let amount: bigint;
  try {
    amount = BigInt(amountTbc);
  } catch (error) {
    throw new ValidationError(
      ErrorCode.INVALID_AMOUNT,
      'Amount must be a valid integer',
      { amountTbc, error: (error as Error).message },
    );
  }

  // Must be positive
  if (amount <= BigInt(0)) {
    throw new ValidationError(
      ErrorCode.INVALID_AMOUNT,
      'Amount must be greater than zero',
      { amountTbc, constraint: 'amount_tbc > 0' },
    );
  }

  // Must not exceed maximum
  if (amount > CONSTANTS.MAX_TBC_AMOUNT) {
    throw new ValidationError(
      ErrorCode.INVALID_AMOUNT,
      'Amount exceeds maximum allowed value',
      {
        amountTbc,
        max: CONSTANTS.MAX_TBC_AMOUNT.toString(),
        constraint: `amount_tbc <= 2^120 - 1`,
      },
    );
  }

  return true;
}

/**
 * Validate metadata
 *
 * @param metadata - Metadata object
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateMetadata(metadata?: InvoiceMetadata): boolean {
  if (!metadata) {
    return true; // Metadata is optional
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'Metadata must be an object',
      { metadata },
    );
  }

  // Check field count
  const fields = Object.keys(metadata);
  if (fields.length > CONSTANTS.MAX_METADATA_FIELDS) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      `Metadata cannot have more than ${CONSTANTS.MAX_METADATA_FIELDS} fields`,
      {
        count: fields.length,
        max: CONSTANTS.MAX_METADATA_FIELDS,
      },
    );
  }

  // Check field names (alphanumeric + underscore)
  const validKeyRegex = /^[a-zA-Z0-9_]+$/;
  for (const key of fields) {
    if (!validKeyRegex.test(key)) {
      throw new ValidationError(
        ErrorCode.INVALID_METADATA,
        'Metadata keys must be alphanumeric with underscores',
        { invalidKey: key, pattern: 'a-zA-Z0-9_' },
      );
    }
  }

  // Check values are primitive types
  for (const [key, value] of Object.entries(metadata)) {
    const valueType = typeof value;
    if (
      valueType !== 'string' &&
      valueType !== 'number' &&
      valueType !== 'boolean' &&
      value !== undefined
    ) {
      throw new ValidationError(
        ErrorCode.INVALID_METADATA,
        'Metadata values must be string, number, boolean, or undefined',
        { key, value, type: valueType },
      );
    }
  }

  // Check total size
  const metadataJson = JSON.stringify(metadata);
  const size = new TextEncoder().encode(metadataJson).length;

  if (size > CONSTANTS.MAX_METADATA_SIZE) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      `Metadata size exceeds ${CONSTANTS.MAX_METADATA_SIZE} bytes`,
      {
        size,
        max: CONSTANTS.MAX_METADATA_SIZE,
      },
    );
  }

  return true;
}

/**
 * Validate ISO 8601 timestamp
 *
 * @param timestamp - Timestamp string
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateTimestamp(timestamp: string): boolean {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'Timestamp must be a non-empty string',
      { timestamp },
    );
  }

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'Invalid ISO 8601 timestamp',
      { timestamp, expected: 'YYYY-MM-DDTHH:mm:ss.sssZ' },
    );
  }

  return true;
}

/**
 * Validate expiration timestamp is in the future
 *
 * @param expiresAt - Expiration timestamp (ISO 8601)
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateExpirationTime(expiresAt: string): boolean {
  validateTimestamp(expiresAt);

  const expiryDate = new Date(expiresAt);
  const now = new Date();

  if (expiryDate <= now) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'Expiration time must be in the future',
      {
        expiresAt,
        now: now.toISOString(),
      },
    );
  }

  return true;
}

/**
 * Validate invoice ID format (UUID v4)
 *
 * @param invoiceId - Invoice ID
 * @returns true if valid
 * @throws ValidationError if invalid
 */
export function validateInvoiceId(invoiceId: string): boolean {
  if (!invoiceId || typeof invoiceId !== 'string') {
    throw new ValidationError(
      ErrorCode.INVOICE_NOT_FOUND,
      'Invoice ID must be a non-empty string',
      { invoiceId },
    );
  }

  // UUID v4 format: inv_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Or simple format: inv_<16 hex characters>
  const uuidRegex = /^inv_[a-f0-9]{16}$/;

  if (!uuidRegex.test(invoiceId)) {
    throw new ValidationError(
      ErrorCode.INVOICE_NOT_FOUND,
      'Invalid invoice ID format',
      {
        invoiceId,
        expected: 'inv_<16 hex characters>',
      },
    );
  }

  return true;
}
