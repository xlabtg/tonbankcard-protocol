// Regression tests for INDEXER-H4 — tangled transaction parsing/routing.
//
// These exercise the indexer service's transaction ingestion path with a
// realistic toncenter `getTransactions` payload (an inbound message plus a
// Tact emit() out-message) and assert that:
//
//   1. Routing keys off the real on-chain `in_msg.destination`, not a value the
//      fetch layer synthesized — so an irrelevant account is genuinely skipped
//      and address-encoding differences (raw 0:… vs EQ…) still match.
//   2. Block attribution uses the canonical block height the service is
//      processing (never the unset `transaction.block_number`).
//   3. Event timestamps come from the single reconciled block timestamp, even
//      when the transaction carries a different `utime`.

import { describe, it, expect } from '@jest/globals';
import { Address, beginCell, toNano } from '@ton/core';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerConfig } from '../src/types/config';
import { EventParser, OP_CODES } from '../src/parsers/event-parser';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAYMENT_HUB = Address.parse(
  'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
);
const SENDER = Address.parse(
  'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'
);
const FROM_NFT = SENDER;
const TO_NFT = Address.parse(
  'EQAREREREREREREREREREREREREREREREREREREREREREeYT'
);
const UNTRACKED = Address.parse(
  'EQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIp3C'
);

const silentLogger = pino({ level: 'silent' });

function makeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'https://testnet.toncenter.com/api/v2',
    tonApiKey: '',
    contracts: {
      // Configured in user-friendly bounceable form.
      paymentHub: PAYMENT_HUB.toString(),
      merchantPaymentHub: '',
      transparencyRegistry: '',
      nftCollections: [],
    },
    database: { path: ':memory:' },
    indexer: {
      startBlock: 1,
      pollIntervalMs: 5000,
      batchSize: 10,
      confirmationBlocks: 3,
    },
    api: {
      port: 3000,
      host: 'localhost',
      trustProxy: false,
      trustedProxyCount: 0,
      rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    logging: { level: 'silent', pretty: false },
  } as unknown as IndexerConfig;
}

const stubDb: any = {
  getLatestBlockIndexed: () => 0,
  getBlock: () => null,
  insertBlock: () => {},
  updateLatestBlock: () => {},
  markBlocksConfirmed: () => {},
  handleReorg: () => {},
};

function makeService(): any {
  return new IndexerService(makeConfig(), stubDb, silentLogger) as any;
}

/** Build a Tact emit()'d InternalTransferEvent body (base64 BOC). */
function buildInternalTransferBody(
  amountTbc: bigint,
  payloadHash: bigint,
  tactTimestamp: number
): string {
  return beginCell()
    .storeUint(OP_CODES.INTERNAL_TRANSFER_EVENT, 32)
    .storeAddress(FROM_NFT)
    .storeAddress(TO_NFT)
    .storeCoins(amountTbc)
    .storeUint(payloadHash, 256)
    .storeUint(tactTimestamp, 32)
    .endCell()
    .toBoc()
    .toString('base64');
}

/**
 * A realistic toncenter `getTransactions` result item: an inbound internal
 * message addressed to `accountDestination`, and an external-out (emit())
 * message carrying an InternalTransferEvent.
 */
function makeToncenterTx(
  accountDestination: string,
  txHash: string,
  utime: number,
  bodyBoc: string
): any {
  return {
    '@type': 'raw.transaction',
    utime,
    transaction_id: {
      '@type': 'internal.transactionId',
      lt: '40000000001',
      hash: txHash,
    },
    in_msg: {
      '@type': 'raw.message',
      source: SENDER.toString(),
      destination: accountDestination,
      value: '100000000',
      msg_data: { '@type': 'msg.dataRaw', body: '' },
    },
    out_msgs: [
      {
        '@type': 'raw.message',
        source: accountDestination, // emit() source == the executing account
        destination: '', // addr_none -> external-out (emit)
        value: '0',
        msg_data: { '@type': 'msg.dataRaw', body: bodyBoc },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexerService — INDEXER-H4 transaction routing', () => {
  const BLOCK_NUMBER = 987654;
  const BLOCK_TIMESTAMP = 1700000500;
  const TX_UTIME = 1699999999; // deliberately != block timestamp
  const amountTbc = toNano('7');
  const payloadHash = 0xabcdef1234567890n;

  describe('routing ignores any synthesized top-level destination', () => {
    // INDEXER-H2's fetchBlockTransactions re-tags every transaction with a
    // synthesized `destination: <configAddress>` field. Routing must NOT trust
    // that field — it has to key off the genuine on-chain `in_msg.destination`
    // (INDEXER-H4). These two cases pin that contract from both directions so a
    // future revert to the old circular routing fails loudly.
    it('skips a tx whose synthesized destination is tracked but real account is not', () => {
      const service = makeService();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      // Real account (in_msg.destination) is UNTRACKED, but the synthesized
      // top-level destination falsely claims the tracked PAYMENT_HUB.
      const tx = {
        ...makeToncenterTx(UNTRACKED.toString(), 'txhash-synth', TX_UTIME, body),
        destination: PAYMENT_HUB.toString(),
      };

      const pending = service.collectBlockEvents(
        [tx],
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      // Routing follows the real in_msg.destination → untracked → dropped.
      expect(pending).toHaveLength(0);
    });

    it('processes a tracked tx even when the synthesized destination points elsewhere', () => {
      const service = makeService();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      // Real account (in_msg.destination) is the tracked PAYMENT_HUB, but the
      // synthesized top-level destination wrongly points at an untracked account.
      const tx = {
        ...makeToncenterTx(PAYMENT_HUB.toString(), 'txhash-synth2', TX_UTIME, body),
        destination: UNTRACKED.toString(),
      };

      const pending = service.collectBlockEvents(
        [tx],
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      expect(pending).toHaveLength(1);
      // The routing key resolves to the genuine on-chain account.
      expect(service.getTransactionDestination(tx)).toBe(PAYMENT_HUB.toString());
    });
  });

  describe('collectBlockEvents — routing, block attribution, timestamp', () => {
    it('routes a realistic tx on its real in_msg.destination and stamps block/timestamp', () => {
      const service = makeService();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      const tx = {
        ...makeToncenterTx(PAYMENT_HUB.toString(), 'txhash-h4', TX_UTIME, body),
        hash: 'txhash-h4',
      };

      const pending = service.collectBlockEvents(
        [tx],
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      expect(pending).toHaveLength(1);
      const { event, txHash, logIndex } = pending[0];
      expect(txHash).toBe('txhash-h4');
      expect(logIndex).toBe(0);
      expect(event.eventType).toBe('InternalTransfer');

      // Block attribution: the canonical block height, not 0 / not utime.
      expect(event.blockNumber).toBe(BLOCK_NUMBER);
      // Timestamp: the single reconciled block timestamp, not tx.utime.
      expect(event.timestamp).toBe(BLOCK_TIMESTAMP);
      expect(event.timestamp).not.toBe(TX_UTIME);

      if (event.eventType === 'InternalTransfer') {
        expect(event.fromNft).toBe(FROM_NFT.toString());
        expect(event.toNft).toBe(TO_NFT.toString());
        expect(event.amountTbc).toBe(amountTbc);
      }
    });

    it('skips a transaction whose real account is not a tracked contract', () => {
      const service = makeService();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      // Same emit() payload, but the transaction executed on an untracked
      // account. Under the old circular routing (destination synthesized to the
      // queried address) this would have been processed; now it is correctly
      // dropped because the genuine in_msg.destination is not tracked.
      const tx = makeToncenterTx(
        UNTRACKED.toString(),
        'txhash-untracked',
        TX_UTIME,
        body
      );

      const pending = service.collectBlockEvents(
        [tx],
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      expect(pending).toHaveLength(0);
    });

    it('matches the tracked contract across different address encodings', () => {
      const service = makeService();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      // The on-chain message reports the account in raw `0:<hex>` form while the
      // config holds the user-friendly EQ form. Normalisation must still match.
      const rawDestination = PAYMENT_HUB.toRawString();
      expect(rawDestination).not.toBe(PAYMENT_HUB.toString());

      const tx = makeToncenterTx(
        rawDestination,
        'txhash-raw',
        TX_UTIME,
        body
      );

      const pending = service.collectBlockEvents(
        [tx],
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      expect(pending).toHaveLength(1);
      expect(pending[0].event.blockNumber).toBe(BLOCK_NUMBER);
      expect(pending[0].event.timestamp).toBe(BLOCK_TIMESTAMP);
    });
  });

  describe('EventParser block attribution', () => {
    it('does not read transaction.block_number / utime for attribution', () => {
      const parser = new EventParser();
      const body = buildInternalTransferBody(amountTbc, payloadHash, 12345);
      // A transaction that DOES carry block_number/utime fields — the parser
      // must ignore them in favour of the explicit caller-supplied values.
      const tx = {
        block_number: 11111,
        utime: TX_UTIME,
        hash: 'txhash-attr',
        out_msgs: [
          { source: PAYMENT_HUB.toString(), destination: '', msg_data: { body } },
        ],
      };

      const events = parser.parseTransaction(
        tx,
        PAYMENT_HUB.toString(),
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP
      );

      expect(events).toHaveLength(1);
      expect(events[0].blockNumber).toBe(BLOCK_NUMBER);
      expect(events[0].blockNumber).not.toBe(11111);
      expect(events[0].timestamp).toBe(BLOCK_TIMESTAMP);
      expect(events[0].timestamp).not.toBe(TX_UTIME);
    });
  });
});
