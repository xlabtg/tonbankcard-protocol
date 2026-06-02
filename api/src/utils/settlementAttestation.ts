/**
 * Settlement Event Attestation (server side)
 *
 * Authenticates on-chain settlement events submitted to
 * `InvoiceService.processSettlementEvent`. The Merchant API is informational
 * only — the blockchain is the single source of truth — so the API must never
 * accept a caller-supplied event at face value. Only the trusted, authenticated
 * indexer that observes the chain knows the shared `SETTLEMENT_INDEXER_SECRET`,
 * so a valid attestation proves the event originated from that pipeline.
 *
 * Without this guard a forged event was sufficient to flip an invoice to
 * `settled` with `on_chain_verified: true` (audit finding API-H3, issue #252).
 *
 * Attestation format
 * ------------------
 *   attestation = HMAC-SHA256(secret, canonicalize(event))   // hex digest
 *
 * The HMAC covers every field that influences settlement (payer, merchant,
 * amount, payload hash, block, tx hash, timestamp). Tampering with any field
 * invalidates the attestation, so an attacker cannot replay a real attestation
 * against a different amount or invoice.
 *
 * Comparisons use `crypto.timingSafeEqual` to defeat timing oracles, mirroring
 * the webhook signature helper.
 *
 * @see api/src/utils/webhookSignature.ts
 * @see api/src/config/secrets.ts (resolveSettlementIndexerSecret)
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/252
 */

import crypto from 'crypto';

/**
 * Canonical, indexer-observed shape of an on-chain MerchantPayment event.
 *
 * These are exactly the fields the attestation binds, so they are defined here
 * (the single source of truth) and re-used by `InvoiceService`.
 */
export interface SettlementEvent {
  /** Payer NFT address */
  payer_nft: string;
  /** Merchant NFT address */
  merchant_nft: string;
  /** Amount in TBC nanocoins */
  amount_tbc: string;
  /** Hash of payment metadata (matches the invoice) */
  payload_hash: string;
  /** Block number the payment was included in */
  block_number: number;
  /** Transaction hash */
  tx_hash: string;
  /** On-chain timestamp (unix seconds) */
  timestamp: number;
}

/**
 * Deterministically serialise an event so signer and verifier always agree.
 *
 * Keys are sorted (matching `hashMetadata` in `helpers.ts`) so field ordering
 * in the caller's object never changes the signed bytes.
 */
export function canonicalizeSettlementEvent(event: SettlementEvent): string {
  const canonical = {
    amount_tbc: event.amount_tbc,
    block_number: event.block_number,
    merchant_nft: event.merchant_nft,
    payer_nft: event.payer_nft,
    payload_hash: event.payload_hash,
    timestamp: event.timestamp,
    tx_hash: event.tx_hash,
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Produce the attestation a trusted indexer attaches to a settlement event.
 *
 * Exported so the indexer (and tests) can sign events with the shared secret.
 *
 * @param secret - Shared `SETTLEMENT_INDEXER_SECRET`
 * @param event  - The settlement event being reported
 * @returns Lowercase hex HMAC-SHA256 digest
 */
export function signSettlementEvent(secret: string, event: SettlementEvent): string {
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalizeSettlementEvent(event))
    .digest('hex');
}

/**
 * Constant-time hex digest comparison.
 *
 * `crypto.timingSafeEqual` throws when the inputs differ in length, so we
 * short-circuit on length first.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Verify that `attestation` was produced for `event` with `secret`.
 *
 * Returns `false` for a missing, malformed, or mismatched attestation so the
 * caller can reject the event as coming from an untrusted source.
 *
 * @param secret      - Shared `SETTLEMENT_INDEXER_SECRET`
 * @param event       - The settlement event being verified
 * @param attestation - Attestation supplied alongside the event
 */
export function verifySettlementAttestation(
  secret: string,
  event: SettlementEvent,
  attestation: string | undefined
): boolean {
  if (typeof attestation !== 'string' || attestation.length === 0) {
    return false;
  }
  const expected = signSettlementEvent(secret, event);
  return constantTimeEqual(attestation, expected);
}
