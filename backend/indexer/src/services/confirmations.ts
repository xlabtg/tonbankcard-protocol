// Canonical confirmation-depth definition (INDEXER-H1, issue #254).
//
// Historically three different formulas for "confirmed" coexisted: the sync
// cutoff (`chainHead - K`), `markBlocksConfirmed` (which subtracted the depth a
// second time, leaving a band of genuinely confirmed blocks flagged
// unconfirmed), and the API (`latestBlockIndexed - block_number`). They could
// disagree for the same block.
//
// A block at height `blockNumber` has `chainHeadSeqno - blockNumber`
// confirmations — the standard blockchain meaning: the number of blocks built
// on top of it. It is confirmed once that depth reaches `confirmationBlocks`.
// `chainHeadSeqno` is the latest masterchain head the indexer has observed,
// persisted in `indexer_state.latest_chain_seqno`. Both the indexer (when it
// sets the `blocks.confirmed` flag) and the API (when it reports payment
// status) call these helpers, so the two can never drift.

/**
 * Number of confirmations for a block: how many blocks sit on top of it on the
 * observed canonical chain. Clamped at 0 (a block at or above the head — which
 * should not happen for an indexed block — reports 0, never a negative count).
 */
export function confirmationDepth(
  chainHeadSeqno: number,
  blockNumber: number
): number {
  return Math.max(0, chainHeadSeqno - blockNumber);
}

/**
 * Whether a block meets the required confirmation depth.
 */
export function isBlockConfirmed(
  chainHeadSeqno: number,
  blockNumber: number,
  confirmationBlocks: number
): boolean {
  return confirmationDepth(chainHeadSeqno, blockNumber) >= confirmationBlocks;
}
