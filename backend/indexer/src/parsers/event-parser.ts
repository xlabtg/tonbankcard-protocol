// Event parser for Tonbankcard on-chain events
// Parses raw blockchain data into typed events

import { Address, Cell, Slice } from '@ton/core';
import {
  IndexedEvent,
  InternalTransferEvent,
  AccountStateChangedEvent,
  MerchantPaymentEvent,
  NFTOwnershipChangeEvent,
  accountStateFromNumber,
} from '../types/events';

/**
 * Tact message op codes (CRC32 of message type name).
 * These are the 32-bit prefixes Tact encodes at the start of each message cell.
 *
 * Computed as:  crc32("InternalTransferEvent")  etc.
 */
export const OP_CODES = {
  INTERNAL_TRANSFER_EVENT: 0x7cb56db1,   // InternalTransferEvent
  ACCOUNT_STATE_CHANGED: 0x5af8273b,     // AccountStateChangedEvent
  MERCHANT_PAYMENT: 0x3b4c2365,          // MerchantPayment
  NFT_TRANSFER: 0x8fc3fa67,              // NFTTransfer (TEP-62 style used in Tact)
} as const;

/**
 * Parse raw transaction data (TON HTTP API v2 format) and extract events.
 *
 * Tact's `emit()` sends an external out-message (destination = addr_none).
 * The message body cell starts with the 32-bit Tact op code followed by
 * the serialised fields of the message struct.
 *
 * Field layout (TL-B / Tact serialisation):
 *
 * InternalTransferEvent:
 *   uint32  op = 0x7cb56db1
 *   MsgAddressInt  from_nft
 *   MsgAddressInt  to_nft
 *   coins   amount_tbc
 *   uint256 payload_hash
 *   uint32  timestamp
 *
 * AccountStateChangedEvent:
 *   uint32  op = 0x5af8273b
 *   MsgAddressInt  nft_address
 *   uint8   old_state
 *   uint8   new_state
 *   uint32  timestamp
 *
 * MerchantPayment:
 *   uint32  op = 0x3b4c2365
 *   MsgAddressInt  payer_nft
 *   MsgAddressInt  merchant_nft
 *   coins   amount_tbc
 *   int     payload_hash  (stored as int257 in MerchantPaymentHub.tact)
 *   uint32  timestamp
 *
 * NFTTransfer (TEP-62 ownership notification):
 *   uint32  op = 0x05138d91  (standard TEP-62 ownership_assigned op)
 *   uint64  query_id
 *   MsgAddressInt  prev_owner
 *   (rest of payload optional)
 */
export class EventParser {
  /**
   * Parse transaction body to extract event type and data.
   *
   * The `transaction` object is the raw item from TON HTTP API v2
   * `getTransactions` endpoint.  Relevant fields:
   *   transaction.out_msgs  - array of outbound messages
   *     msg.destination     - "" or null for external-out (emit())
   *     msg.msg_data.body   - base64 BOC of message cell
   *     msg.source          - source contract address
   */
  parseTransaction(
    transaction: any,
    contractAddress: string
  ): IndexedEvent[] {
    const events: IndexedEvent[] = [];

    if (!transaction) {
      return events;
    }

    const blockNumber: number = transaction.block_number ?? 0;
    const txHash: string = transaction.hash ?? '';
    const timestamp: number = transaction.utime ?? 0;
    const outMsgs: any[] = transaction.out_msgs ?? [];

    for (let i = 0; i < outMsgs.length; i++) {
      const msg = outMsgs[i];

      try {
        const event = this.parseOutMessage(
          msg,
          contractAddress,
          blockNumber,
          txHash,
          i,
          timestamp
        );
        if (event !== null) {
          events.push(event);
        }
      } catch (err) {
        // Malformed message – skip and continue with the rest
      }
    }

    // Also check in_msg body for emitted events (some API versions put
    // external-out messages differently)
    if (transaction.in_msg) {
      try {
        const event = this.parseOutMessage(
          transaction.in_msg,
          contractAddress,
          blockNumber,
          txHash,
          outMsgs.length,
          timestamp
        );
        if (event !== null) {
          events.push(event);
        }
      } catch (_) {
        // ignore
      }
    }

    return events;
  }

  /**
   * Parse a single outbound message.  Returns null if the message is not
   * a recognised protocol event.
   */
  private parseOutMessage(
    msg: any,
    contractAddress: string,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): IndexedEvent | null {
    if (!msg) return null;

    // External-out messages (Tact emit()) have no destination (addr_none).
    // TON HTTP API v2 represents this as destination = "" or null.
    const dest: string = msg.destination ?? '';
    const isExternalOut = dest === '' || dest === null;

    // Get the message body BOC (base64)
    const bodyBoc: string | undefined =
      msg.msg_data?.body ??
      msg.body ??
      undefined;

    if (!bodyBoc) return null;

    // Decode the cell
    let cell: Cell;
    try {
      cell = Cell.fromBase64(bodyBoc);
    } catch (_) {
      return null;
    }

    const slice = cell.beginParse();

    // Need at least 32 bits for the op code
    if (slice.remainingBits < 32) return null;

    const op = slice.loadUint(32);

    if (isExternalOut) {
      // These are Tact emit() events
      switch (op) {
        case OP_CODES.INTERNAL_TRANSFER_EVENT:
          return this.decodeInternalTransferEvent(
            slice, blockNumber, txHash, logIndex, timestamp
          );
        case OP_CODES.ACCOUNT_STATE_CHANGED:
          return this.decodeAccountStateChangedEvent(
            slice, blockNumber, txHash, logIndex, timestamp
          );
        case OP_CODES.MERCHANT_PAYMENT:
          return this.decodeMerchantPaymentEvent(
            slice, blockNumber, txHash, logIndex, timestamp
          );
        default:
          return null;
      }
    } else {
      // Internal message – check for TEP-62 NFT ownership_assigned (0x05138d91)
      // or Tact NFTTransfer op code
      if (op === 0x05138d91 || op === OP_CODES.NFT_TRANSFER) {
        return this.decodeNFTOwnershipChange(
          msg, slice, op, blockNumber, txHash, logIndex, timestamp, contractAddress
        );
      }
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Decoders for individual event types
  // ---------------------------------------------------------------------------

  /**
   * Decode InternalTransferEvent from a Slice (op already consumed).
   *
   * Remaining layout:
   *   MsgAddressInt  from_nft
   *   MsgAddressInt  to_nft
   *   coins          amount_tbc
   *   uint256        payload_hash
   *   uint32         timestamp  (ignored – we use the tx timestamp)
   */
  private decodeInternalTransferEvent(
    slice: Slice,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): InternalTransferEvent | null {
    try {
      const fromNft = slice.loadAddress().toString();
      const toNft = slice.loadAddress().toString();
      const amountTbc = slice.loadCoins();
      const payloadHash = slice.loadUintBig(256);

      return {
        eventType: 'InternalTransfer',
        blockNumber,
        transactionHash: txHash,
        logIndex,
        timestamp,
        fromNft,
        toNft,
        amountTbc,
        payloadHash: '0x' + payloadHash.toString(16).padStart(64, '0'),
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Decode AccountStateChangedEvent from a Slice (op already consumed).
   *
   * Remaining layout:
   *   MsgAddressInt  nft_address
   *   uint8          old_state
   *   uint8          new_state
   *   uint32         timestamp
   */
  private decodeAccountStateChangedEvent(
    slice: Slice,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): AccountStateChangedEvent | null {
    try {
      const nftAddress = slice.loadAddress().toString();
      const oldState = slice.loadUint(8);
      const newState = slice.loadUint(8);

      return {
        eventType: 'AccountStateChanged',
        blockNumber,
        transactionHash: txHash,
        logIndex,
        timestamp,
        nftAddress,
        oldState: accountStateFromNumber(oldState),
        newState: accountStateFromNumber(newState),
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Decode MerchantPayment event from a Slice (op already consumed).
   *
   * Remaining layout:
   *   MsgAddressInt  payer_nft
   *   MsgAddressInt  merchant_nft
   *   coins          amount_tbc
   *   int            payload_hash   (int257 in contract)
   *   uint32         timestamp
   */
  private decodeMerchantPaymentEvent(
    slice: Slice,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): MerchantPaymentEvent | null {
    try {
      const payerNft = slice.loadAddress().toString();
      const merchantNft = slice.loadAddress().toString();
      const amountTbc = slice.loadCoins();
      // payload_hash is stored as plain Int (int257) in MerchantPaymentHub.tact
      const payloadHashInt = slice.loadIntBig(257);
      const payloadHash = payloadHashInt >= 0n
        ? '0x' + payloadHashInt.toString(16).padStart(64, '0')
        : '-0x' + (-payloadHashInt).toString(16).padStart(64, '0');

      return {
        eventType: 'MerchantPayment',
        blockNumber,
        transactionHash: txHash,
        logIndex,
        timestamp,
        payerNft,
        merchantNft,
        amountTbc,
        payloadHash,
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Decode NFT ownership change from TEP-62 ownership_assigned (0x05138d91)
   * or Tact NFTTransfer op.
   *
   * TEP-62 ownership_assigned layout (op already consumed):
   *   uint64         query_id
   *   MsgAddressInt  prev_owner
   *
   * The NFT address is the message source (the NFT item contract).
   * The new owner is the message destination.
   */
  private decodeNFTOwnershipChange(
    msg: any,
    slice: Slice,
    op: number,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number,
    contractAddress: string
  ): NFTOwnershipChangeEvent | null {
    try {
      let nftAddress: string;
      let newOwner: string;
      let oldOwner: string | null = null;
      let collectionAddress: string;

      if (op === 0x05138d91) {
        // TEP-62 ownership_assigned
        slice.loadUint(64); // query_id
        const prevOwnerAddr = slice.loadMaybeAddress();
        oldOwner = prevOwnerAddr ? prevOwnerAddr.toString() : null;

        // NFT item is the source of this message
        nftAddress = msg.source ?? contractAddress;
        // New owner is the destination
        newOwner = msg.destination ?? '';
        // Collection is not directly available from this message;
        // use the contract address as best guess (can be enriched later)
        collectionAddress = contractAddress;
      } else {
        // Tact NFTTransfer op – custom layout, parse best-effort
        // Layout: MsgAddressInt new_owner, MsgAddressInt? response_dest
        newOwner = slice.loadAddress().toString();
        nftAddress = msg.source ?? contractAddress;
        collectionAddress = contractAddress;
      }

      if (!newOwner) return null;

      return {
        eventType: 'NFTOwnershipChange',
        blockNumber,
        transactionHash: txHash,
        logIndex,
        timestamp,
        nftAddress,
        oldOwner,
        newOwner,
        collectionAddress,
      };
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy individual parse methods (kept for backward compatibility)
  // ---------------------------------------------------------------------------

  /**
   * Parse InternalTransferEvent from pre-decoded data
   */
  parseInternalTransfer(
    blockNumber: number,
    transactionHash: string,
    logIndex: number,
    timestamp: number,
    data: any
  ): InternalTransferEvent {
    return {
      eventType: 'InternalTransfer',
      blockNumber,
      transactionHash,
      logIndex,
      timestamp,
      fromNft: this.parseAddress(data.from_nft),
      toNft: this.parseAddress(data.to_nft),
      amountTbc: BigInt(data.amount_tbc),
      payloadHash: this.parseHash(data.payload_hash),
    };
  }

  /**
   * Parse AccountStateChangedEvent from pre-decoded data
   */
  parseAccountStateChanged(
    blockNumber: number,
    transactionHash: string,
    logIndex: number,
    timestamp: number,
    data: any
  ): AccountStateChangedEvent {
    return {
      eventType: 'AccountStateChanged',
      blockNumber,
      transactionHash,
      logIndex,
      timestamp,
      nftAddress: this.parseAddress(data.nft_address),
      oldState: accountStateFromNumber(data.old_state),
      newState: accountStateFromNumber(data.new_state),
    };
  }

  /**
   * Parse MerchantPaymentEvent from pre-decoded data
   */
  parseMerchantPayment(
    blockNumber: number,
    transactionHash: string,
    logIndex: number,
    timestamp: number,
    data: any
  ): MerchantPaymentEvent {
    return {
      eventType: 'MerchantPayment',
      blockNumber,
      transactionHash,
      logIndex,
      timestamp,
      payerNft: this.parseAddress(data.payer_nft),
      merchantNft: this.parseAddress(data.merchant_nft),
      amountTbc: BigInt(data.amount_tbc),
      payloadHash: this.parseHash(data.payload_hash),
    };
  }

  /**
   * Parse NFTOwnershipChangeEvent from pre-decoded data
   */
  parseNFTOwnershipChange(
    blockNumber: number,
    transactionHash: string,
    logIndex: number,
    timestamp: number,
    data: any
  ): NFTOwnershipChangeEvent {
    return {
      eventType: 'NFTOwnershipChange',
      blockNumber,
      transactionHash,
      logIndex,
      timestamp,
      nftAddress: this.parseAddress(data.nft_address),
      oldOwner: data.old_owner ? this.parseAddress(data.old_owner) : null,
      newOwner: this.parseAddress(data.new_owner),
      collectionAddress: this.parseAddress(data.collection_address),
    };
  }

  /**
   * Helper: Parse TON address to string
   */
  private parseAddress(addr: any): string {
    if (typeof addr === 'string') {
      return addr;
    }
    if (addr instanceof Address) {
      return addr.toString();
    }
    return addr.toString();
  }

  /**
   * Helper: Parse hash to string
   */
  private parseHash(hash: any): string {
    if (typeof hash === 'string') {
      return hash;
    }
    if (typeof hash === 'bigint' || typeof hash === 'number') {
      return '0x' + hash.toString(16).padStart(64, '0');
    }
    return hash.toString();
  }

  /**
   * Identify event type from transaction message
   */
  identifyEventType(_message: any, _contractAddress: string): string | null {
    return null;
  }

  /**
   * Parse cell data into structured event data
   */
  parseCellData(cell: Cell): any {
    const _slice = cell.beginParse();
    return {};
  }
}

/**
 * Event type identifiers (op codes or message signatures)
 * These should match the actual on-chain event structures
 */
export const EVENT_SIGNATURES = {
  INTERNAL_TRANSFER: 'InternalTransferEvent',
  ACCOUNT_STATE_CHANGED: 'AccountStateChangedEvent',
  MERCHANT_PAYMENT: 'MerchantPayment',
  NFT_OWNERSHIP_CHANGE: 'NFTTransfer',
};
