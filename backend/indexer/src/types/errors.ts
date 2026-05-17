/**
 * Indexer error codes.
 *
 * Single canonical list of `errorCode` values attached to `pino` `error`
 * level entries and surfaced in API error envelopes. Keeping this list in
 * one place lets operators build alerting rules against a stable
 * vocabulary instead of grepping for free-text messages.
 *
 * @see docs/error-codes.md  (`§3.1 Indexer error codes`)
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 */

export enum IndexerErrorCode {
  /** Could not fetch the latest masterchain block. */
  LATEST_BLOCK_UNAVAILABLE = 'INDEXER_LATEST_BLOCK_UNAVAILABLE',
  /** Lookup or header fetch failed for a specific block. */
  BLOCK_FETCH_FAILED = 'INDEXER_BLOCK_FETCH_FAILED',
  /** Exception while processing a fetched block. */
  BLOCK_PROCESSING_FAILED = 'INDEXER_BLOCK_PROCESSING_FAILED',
  /** Per-contract `getTransactions` HTTP call failed. */
  TX_FETCH_FAILED = 'INDEXER_TX_FETCH_FAILED',
  /** Stored block hash diverges from chain hash. */
  REORG_DETECTED = 'INDEXER_REORG_DETECTED',
  /** Persisting an event into SQLite/Postgres failed. */
  EVENT_STORE_FAILED = 'INDEXER_EVENT_STORE_FAILED',
  /** Top-level `syncBlocks` exception. */
  SYNC_FAILED = 'INDEXER_SYNC_FAILED',

  /** Unhandled exception during HTTP request handling. */
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  /** Route 404. */
  API_NOT_FOUND = 'API_NOT_FOUND',
  /** Client-side input failed validation. */
  API_INVALID_PARAMETER = 'API_INVALID_PARAMETER',
  /** Distributed rate limiter rejected the request. */
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
}

/**
 * Compose an `eventId` for log correlation.
 *
 * Format: `${blockNumber}:${txHash}:${logIndex}`. When only a block is in
 * scope (no transaction), `txHash` and `logIndex` are omitted. The value is
 * intentionally a single opaque string so log shippers can index it as a
 * keyword field without parsing structure.
 */
export function makeEventId(
  blockNumber: number,
  txHash?: string,
  logIndex?: number,
): string {
  if (txHash && logIndex !== undefined) {
    return `${blockNumber}:${txHash}:${logIndex}`;
  }
  if (txHash) {
    return `${blockNumber}:${txHash}`;
  }
  return `${blockNumber}`;
}
