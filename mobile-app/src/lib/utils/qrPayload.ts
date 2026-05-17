/**
 * QR-payload parser for incoming payment intents scanned from a merchant
 * device.
 *
 * SECURITY:
 * - The parser validates the recipient address before returning a structured
 *   payload, so the UI never displays an unvalidated address as actionable.
 * - This is intent ONLY. The user's wallet is still the sole signer.
 */

import { isValidTonAddress } from '@tonbankcard/mobile-core';
import { parseTonLink, type ParsedTonLink } from '../tonconnect/deepLink';

export interface ScannedPayment {
  readonly recipient: string;
  readonly amountNanocoins?: string;
  readonly memo?: string;
  readonly returnUrl?: string;
}

export function parseScannedPayment(raw: string): ScannedPayment | null {
  const direct = tryParseTonLink(raw);
  if (direct) {
    return direct;
  }
  if (isValidTonAddress(raw.trim())) {
    return { recipient: raw.trim() };
  }
  return null;
}

function tryParseTonLink(raw: string): ScannedPayment | null {
  const parsed: ParsedTonLink | null = parseTonLink(raw.trim());
  if (!parsed) {
    return null;
  }
  if (!isValidTonAddress(parsed.recipient)) {
    return null;
  }
  if (parsed.amount && !/^\d+$/.test(parsed.amount)) {
    return null;
  }
  return {
    recipient: parsed.recipient,
    amountNanocoins: parsed.amount,
    memo: parsed.text,
    returnUrl: parsed.returnUrl,
  };
}
