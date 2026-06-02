// Unit tests for EventParser
// Uses real @ton/core cell construction to build realistic transaction data
// matching the Tact contract event schemas

import { describe, it, expect } from '@jest/globals';
import { Address, beginCell, toNano } from '@ton/core';
import { EventParser, OP_CODES } from '../src/parsers/event-parser';
import { AccountState } from '../src/types/events';

// ---------------------------------------------------------------------------
// Helpers to build BOC-encoded message bodies that match Tact's emit() output
// ---------------------------------------------------------------------------

const ADDR_FROM = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
const ADDR_TO   = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7');

/**
 * Build a base64-encoded BOC for an InternalTransferEvent
 *
 * Layout (Tact serialisation):
 *   uint32  op
 *   MsgAddress  from_nft
 *   MsgAddress  to_nft
 *   coins   amount_tbc
 *   uint256 payload_hash
 *   uint32  timestamp
 */
function buildInternalTransferEventBody(
  fromNft: Address,
  toNft: Address,
  amountTbc: bigint,
  payloadHash: bigint,
  timestamp: number
): string {
  const cell = beginCell()
    .storeUint(OP_CODES.INTERNAL_TRANSFER_EVENT, 32)
    .storeAddress(fromNft)
    .storeAddress(toNft)
    .storeCoins(amountTbc)
    .storeUint(payloadHash, 256)
    .storeUint(timestamp, 32)
    .endCell();
  return cell.toBoc().toString('base64');
}

/**
 * Build a base64-encoded BOC for an AccountStateChangedEvent
 *
 * Layout:
 *   uint32  op
 *   MsgAddress  nft_address
 *   uint8   old_state
 *   uint8   new_state
 *   uint32  timestamp
 */
function buildAccountStateChangedBody(
  nftAddress: Address,
  oldState: number,
  newState: number,
  timestamp: number
): string {
  const cell = beginCell()
    .storeUint(OP_CODES.ACCOUNT_STATE_CHANGED, 32)
    .storeAddress(nftAddress)
    .storeUint(oldState, 8)
    .storeUint(newState, 8)
    .storeUint(timestamp, 32)
    .endCell();
  return cell.toBoc().toString('base64');
}

/**
 * Build a base64-encoded BOC for a MerchantPayment event
 *
 * Layout:
 *   uint32  op
 *   MsgAddress  payer_nft
 *   MsgAddress  merchant_nft
 *   coins   amount_tbc
 *   int257  payload_hash
 *   uint32  timestamp
 */
function buildMerchantPaymentBody(
  payerNft: Address,
  merchantNft: Address,
  amountTbc: bigint,
  payloadHash: bigint,
  timestamp: number
): string {
  const cell = beginCell()
    .storeUint(OP_CODES.MERCHANT_PAYMENT, 32)
    .storeAddress(payerNft)
    .storeAddress(merchantNft)
    .storeCoins(amountTbc)
    .storeInt(payloadHash, 257)
    .storeUint(timestamp, 32)
    .endCell();
  return cell.toBoc().toString('base64');
}

/**
 * Build a base64-encoded BOC for a TEP-62 ownership_assigned message
 *
 * Layout:
 *   uint32  op = 0x05138d91
 *   uint64  query_id
 *   MsgAddress  prev_owner
 */
function buildOwnershipAssignedBody(
  queryId: bigint,
  prevOwner: Address
): string {
  const cell = beginCell()
    .storeUint(0x05138d91, 32)
    .storeUint(queryId, 64)
    .storeAddress(prevOwner)
    .endCell();
  return cell.toBoc().toString('base64');
}

// ---------------------------------------------------------------------------
// Helper to construct a minimal TON HTTP API v2 transaction object
// ---------------------------------------------------------------------------

function makeExternalOutMsg(bodyBoc: string): any {
  return {
    destination: '',        // addr_none = Tact emit()
    source: ADDR_FROM.toString(),
    msg_data: { body: bodyBoc },
  };
}

function makeInternalMsg(
  source: string,
  destination: string,
  bodyBoc: string
): any {
  return {
    destination,
    source,
    msg_data: { body: bodyBoc },
  };
}

function makeTransaction(outMsgs: any[], blockNumber = 1, txHash = 'txhash1', utime = 1700000000): any {
  return {
    block_number: blockNumber,
    hash: txHash,
    utime,
    out_msgs: outMsgs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventParser', () => {
  const parser = new EventParser();
  const CONTRACT_ADDR = ADDR_FROM.toString();

  // Block attribution and the event timestamp are now supplied explicitly by
  // the caller (INDEXER-H4). These tests derive them from the synthetic
  // transaction's `block_number`/`utime` metadata so the existing assertions
  // about per-event blockNumber/timestamp still describe the contract: the
  // parser stamps events with exactly the values it is handed.
  const parse = (tx: any, contractAddress: string = CONTRACT_ADDR) =>
    parser.parseTransaction(
      tx,
      contractAddress,
      tx?.block_number ?? 0,
      tx?.utime ?? 0
    );

  // -------------------------------------------------------------------------
  describe('parseTransaction – empty / invalid input', () => {
    it('returns empty array for null transaction', () => {
      expect(parse(null, CONTRACT_ADDR)).toEqual([]);
    });

    it('returns empty array for transaction with no out_msgs', () => {
      const tx = makeTransaction([]);
      expect(parse(tx, CONTRACT_ADDR)).toEqual([]);
    });

    it('returns empty array when out_msg has no body', () => {
      const tx = makeTransaction([{ destination: '', source: CONTRACT_ADDR }]);
      expect(parse(tx, CONTRACT_ADDR)).toEqual([]);
    });

    it('returns empty array for unknown op code', () => {
      // Build a cell with an unknown op code
      const cell = beginCell().storeUint(0xdeadbeef, 32).endCell();
      const msg = makeExternalOutMsg(cell.toBoc().toString('base64'));
      const tx = makeTransaction([msg]);
      expect(parse(tx, CONTRACT_ADDR)).toEqual([]);
    });

    it('returns empty array for malformed base64 body', () => {
      const msg = { destination: '', source: CONTRACT_ADDR, msg_data: { body: 'not-valid-base64!!!' } };
      const tx = makeTransaction([msg]);
      expect(parse(tx, CONTRACT_ADDR)).toEqual([]);
    });

    it('returns empty array for body that is too short (< 32 bits)', () => {
      // 1 byte = 8 bits
      const cell = beginCell().storeUint(0xff, 8).endCell();
      const msg = makeExternalOutMsg(cell.toBoc().toString('base64'));
      const tx = makeTransaction([msg]);
      expect(parse(tx, CONTRACT_ADDR)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('InternalTransferEvent', () => {
    const amountTbc = toNano('10');
    const payloadHash = 0xabcdef1234567890n;
    const timestamp = 1700000000;

    it('parses a valid InternalTransferEvent from external-out message', () => {
      const bodyBoc = buildInternalTransferEventBody(ADDR_FROM, ADDR_TO, amountTbc, payloadHash, timestamp);
      const msg = makeExternalOutMsg(bodyBoc);
      const tx = makeTransaction([msg], 42, 'hash_transfer', 1700000000);

      const events = parse(tx, CONTRACT_ADDR);

      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('InternalTransfer');
      if (ev.eventType === 'InternalTransfer') {
        expect(ev.blockNumber).toBe(42);
        expect(ev.transactionHash).toBe('hash_transfer');
        expect(ev.logIndex).toBe(0);
        expect(ev.timestamp).toBe(1700000000);
        expect(ev.fromNft).toBe(ADDR_FROM.toString());
        expect(ev.toNft).toBe(ADDR_TO.toString());
        expect(ev.amountTbc).toBe(amountTbc);
        expect(ev.payloadHash).toMatch(/^0x/);
        expect(ev.payloadHash.toLowerCase()).toContain('abcdef1234567890');
      }
    });

    it('ignores InternalTransferEvent in internal message (non-emit)', () => {
      // Same body but sent as internal message (destination != "")
      const bodyBoc = buildInternalTransferEventBody(ADDR_FROM, ADDR_TO, amountTbc, payloadHash, timestamp);
      const msg = makeInternalMsg(ADDR_FROM.toString(), ADDR_TO.toString(), bodyBoc);
      const tx = makeTransaction([msg]);

      // Internal messages with InternalTransferEvent op are not treated as
      // emitted events – they would be treated as NFT/ownership ops only
      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(0);
    });

    it('assigns correct logIndex when multiple events present', () => {
      const bodyBoc = buildInternalTransferEventBody(ADDR_FROM, ADDR_TO, amountTbc, payloadHash, timestamp);
      const tx = makeTransaction([
        makeExternalOutMsg(bodyBoc),
        makeExternalOutMsg(bodyBoc),
      ]);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(2);
      expect(events[0].logIndex).toBe(0);
      expect(events[1].logIndex).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('AccountStateChangedEvent', () => {
    it('parses ACTIVE -> FROZEN state change', () => {
      const bodyBoc = buildAccountStateChangedBody(ADDR_FROM, 0, 1, 1700000001);
      const msg = makeExternalOutMsg(bodyBoc);
      const tx = makeTransaction([msg], 10, 'hash_state', 1700000001);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('AccountStateChanged');
      if (ev.eventType === 'AccountStateChanged') {
        expect(ev.nftAddress).toBe(ADDR_FROM.toString());
        expect(ev.oldState).toBe(AccountState.ACTIVE);
        expect(ev.newState).toBe(AccountState.FROZEN);
        expect(ev.blockNumber).toBe(10);
      }
    });

    it('parses FROZEN -> COLLATERAL_LOCKED state change', () => {
      const bodyBoc = buildAccountStateChangedBody(ADDR_TO, 1, 2, 1700000002);
      const msg = makeExternalOutMsg(bodyBoc);
      const tx = makeTransaction([msg]);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('AccountStateChanged');
      if (ev.eventType === 'AccountStateChanged') {
        expect(ev.oldState).toBe(AccountState.FROZEN);
        expect(ev.newState).toBe(AccountState.COLLATERAL_LOCKED);
      }
    });

    it('parses COLLATERAL_LOCKED -> CLOSED state change', () => {
      const bodyBoc = buildAccountStateChangedBody(ADDR_FROM, 2, 3, 1700000003);
      const events = parse(makeTransaction([makeExternalOutMsg(bodyBoc)]), CONTRACT_ADDR);
      expect(events[0].eventType).toBe('AccountStateChanged');
      if (events[0].eventType === 'AccountStateChanged') {
        expect(events[0].oldState).toBe(AccountState.COLLATERAL_LOCKED);
        expect(events[0].newState).toBe(AccountState.CLOSED);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('MerchantPayment event', () => {
    it('parses a valid MerchantPayment event', () => {
      const amountTbc = toNano('5');
      const payloadHash = 0x1111222233334444n;
      const bodyBoc = buildMerchantPaymentBody(ADDR_FROM, ADDR_TO, amountTbc, payloadHash, 1700000010);
      const msg = makeExternalOutMsg(bodyBoc);
      const tx = makeTransaction([msg], 55, 'hash_merchant', 1700000010);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('MerchantPayment');
      if (ev.eventType === 'MerchantPayment') {
        expect(ev.payerNft).toBe(ADDR_FROM.toString());
        expect(ev.merchantNft).toBe(ADDR_TO.toString());
        expect(ev.amountTbc).toBe(amountTbc);
        expect(ev.payloadHash).toMatch(/^0x/);
        expect(ev.blockNumber).toBe(55);
        expect(ev.transactionHash).toBe('hash_merchant');
      }
    });

    it('handles zero payload hash', () => {
      const bodyBoc = buildMerchantPaymentBody(ADDR_FROM, ADDR_TO, 1000n, 0n, 0);
      const events = parse(makeTransaction([makeExternalOutMsg(bodyBoc)]), CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('MerchantPayment');
    });
  });

  // -------------------------------------------------------------------------
  describe('NFTOwnershipChange event (TEP-62 ownership_assigned)', () => {
    it('parses a TEP-62 ownership_assigned message', () => {
      const prevOwner = ADDR_FROM;
      const nftSource = ADDR_TO.toString();
      const newOwnerAddr = ADDR_FROM.toString();
      const bodyBoc = buildOwnershipAssignedBody(12345n, prevOwner);
      const msg = makeInternalMsg(nftSource, newOwnerAddr, bodyBoc);
      const tx = makeTransaction([msg], 77, 'hash_nft', 1700000020);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('NFTOwnershipChange');
      if (ev.eventType === 'NFTOwnershipChange') {
        expect(ev.nftAddress).toBe(nftSource);
        expect(ev.newOwner).toBe(newOwnerAddr);
        expect(ev.oldOwner).toBe(prevOwner.toString());
        expect(ev.blockNumber).toBe(77);
        expect(ev.transactionHash).toBe('hash_nft');
      }
    });

    it('handles minting (no previous owner) – null addr', () => {
      // Build ownership_assigned with addr_none as prev_owner
      const cell = beginCell()
        .storeUint(0x05138d91, 32)
        .storeUint(0n, 64)
        .storeAddress(null)  // addr_none
        .endCell();
      const bodyBoc = cell.toBoc().toString('base64');
      const msg = makeInternalMsg(ADDR_TO.toString(), ADDR_FROM.toString(), bodyBoc);
      const tx = makeTransaction([msg]);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.eventType).toBe('NFTOwnershipChange');
      if (ev.eventType === 'NFTOwnershipChange') {
        expect(ev.oldOwner).toBeNull();
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('Mixed events in a single transaction', () => {
    it('parses multiple different events from one transaction', () => {
      const transferBoc = buildInternalTransferEventBody(ADDR_FROM, ADDR_TO, toNano('1'), 1n, 0);
      const stateBoc = buildAccountStateChangedBody(ADDR_FROM, 0, 1, 0);
      const merchantBoc = buildMerchantPaymentBody(ADDR_FROM, ADDR_TO, toNano('2'), 2n, 0);

      const tx = makeTransaction([
        makeExternalOutMsg(transferBoc),
        makeExternalOutMsg(stateBoc),
        makeExternalOutMsg(merchantBoc),
      ]);

      const events = parse(tx, CONTRACT_ADDR);
      expect(events).toHaveLength(3);

      const types = events.map((e) => e.eventType);
      expect(types).toContain('InternalTransfer');
      expect(types).toContain('AccountStateChanged');
      expect(types).toContain('MerchantPayment');

      // Verify log indices are sequential
      expect(events[0].logIndex).toBe(0);
      expect(events[1].logIndex).toBe(1);
      expect(events[2].logIndex).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('Legacy parseInternalTransfer', () => {
    it('creates InternalTransferEvent from raw data', () => {
      const ev = parser.parseInternalTransfer(1, 'tx1', 0, 1000, {
        from_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        to_nft: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
        amount_tbc: '5000000000',
        payload_hash: '0xabcd',
      });
      expect(ev.eventType).toBe('InternalTransfer');
      expect(ev.amountTbc).toBe(5000000000n);
    });
  });

  describe('Legacy parseMerchantPayment', () => {
    it('creates MerchantPaymentEvent from raw data', () => {
      const ev = parser.parseMerchantPayment(2, 'tx2', 0, 2000, {
        payer_nft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        merchant_nft: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
        amount_tbc: '1000000000',
        payload_hash: 0xdeadbeef,
      });
      expect(ev.eventType).toBe('MerchantPayment');
      expect(ev.amountTbc).toBe(1000000000n);
    });
  });

  describe('Legacy parseAccountStateChanged', () => {
    it('creates AccountStateChangedEvent from raw data', () => {
      const ev = parser.parseAccountStateChanged(3, 'tx3', 0, 3000, {
        nft_address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        old_state: 0,
        new_state: 1,
      });
      expect(ev.eventType).toBe('AccountStateChanged');
      expect(ev.oldState).toBe(AccountState.ACTIVE);
      expect(ev.newState).toBe(AccountState.FROZEN);
    });
  });

  describe('Legacy parseNFTOwnershipChange', () => {
    it('creates NFTOwnershipChangeEvent from raw data', () => {
      const ev = parser.parseNFTOwnershipChange(4, 'tx4', 0, 4000, {
        nft_address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
        old_owner: null,
        new_owner: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
        collection_address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
      });
      expect(ev.eventType).toBe('NFTOwnershipChange');
      expect(ev.oldOwner).toBeNull();
    });
  });
});
