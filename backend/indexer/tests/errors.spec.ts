/**
 * Tests for the canonical indexer error codes and request-id middleware.
 *
 * Verifies the wire-format guarantees from `docs/error-codes.md` §3:
 *   - `errorCode` field on every `error` level entry comes from the
 *     `IndexerErrorCode` enum (no free-text codes),
 *   - `makeEventId` composes a stable, parseable identifier,
 *   - `requestIdMiddleware` synthesises a UUID when no header is
 *     supplied and rejects unsafe inbound values that could be used for
 *     log injection / header splitting.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { IndexerErrorCode, makeEventId } from '../src/types/errors';
import {
  requestIdMiddleware,
  REQUEST_ID_HEADER,
} from '../src/api/requestId';

interface CapturedResponse {
  headers: Record<string, string | number>;
  setHeader: (name: string, value: string | number) => void;
}

function makeRes(): CapturedResponse {
  const res: CapturedResponse = {
    headers: {},
    setHeader(name: string, value: string | number) {
      this.headers[name] = value;
    },
  };
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  const base: Record<string, unknown> = {
    headers: {},
    method: 'GET',
    url: '/api/v1/health',
    header: (_name: string) => undefined,
  };
  return { ...base, ...overrides } as unknown as Request;
}

describe('IndexerErrorCode', () => {
  it('exposes the full set of codes documented in error-codes.md §3.1', () => {
    // Indexer worker codes.
    expect(IndexerErrorCode.LATEST_BLOCK_UNAVAILABLE).toBe(
      'INDEXER_LATEST_BLOCK_UNAVAILABLE',
    );
    expect(IndexerErrorCode.BLOCK_FETCH_FAILED).toBe('INDEXER_BLOCK_FETCH_FAILED');
    expect(IndexerErrorCode.BLOCK_PROCESSING_FAILED).toBe(
      'INDEXER_BLOCK_PROCESSING_FAILED',
    );
    expect(IndexerErrorCode.TX_FETCH_FAILED).toBe('INDEXER_TX_FETCH_FAILED');
    expect(IndexerErrorCode.REORG_DETECTED).toBe('INDEXER_REORG_DETECTED');
    expect(IndexerErrorCode.EVENT_STORE_FAILED).toBe('INDEXER_EVENT_STORE_FAILED');
    expect(IndexerErrorCode.SYNC_FAILED).toBe('INDEXER_SYNC_FAILED');

    // API codes.
    expect(IndexerErrorCode.API_REQUEST_FAILED).toBe('API_REQUEST_FAILED');
    expect(IndexerErrorCode.API_NOT_FOUND).toBe('API_NOT_FOUND');
    expect(IndexerErrorCode.API_INVALID_PARAMETER).toBe('API_INVALID_PARAMETER');
    expect(IndexerErrorCode.API_RATE_LIMIT_EXCEEDED).toBe('API_RATE_LIMIT_EXCEEDED');
  });
});

describe('makeEventId', () => {
  it('returns just the block number when nothing else is in scope', () => {
    expect(makeEventId(42)).toBe('42');
  });

  it('joins block + tx when there is no log index', () => {
    expect(makeEventId(7, 'deadbeef')).toBe('7:deadbeef');
  });

  it('joins block + tx + logIndex when all are in scope', () => {
    expect(makeEventId(7, 'deadbeef', 0)).toBe('7:deadbeef:0');
    expect(makeEventId(7, 'deadbeef', 3)).toBe('7:deadbeef:3');
  });
});

describe('requestIdMiddleware (indexer)', () => {
  it('synthesises a UUID when no inbound header is supplied', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(typeof (req as any).requestId).toBe('string');
    expect((req as any).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers[REQUEST_ID_HEADER]).toBe((req as any).requestId);
  });

  it('echoes a safe inbound request id verbatim', () => {
    const supplied = 'edge-7a.42-zz';
    const req = makeReq({
      header: (name: string) => (name === REQUEST_ID_HEADER ? supplied : undefined),
    });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect((req as any).requestId).toBe(supplied);
    expect(res.headers[REQUEST_ID_HEADER]).toBe(supplied);
  });

  it('rejects an unsafe inbound request id and generates a fresh one', () => {
    const malicious = "abc\r\nSet-Cookie: pwn=1";
    const req = makeReq({
      header: (name: string) => (name === REQUEST_ID_HEADER ? malicious : undefined),
    });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect((req as any).requestId).not.toBe(malicious);
    expect((req as any).requestId).toMatch(/^[0-9a-f-]{36}$/);
    // Header must never contain CRLF — that's the whole point of the regex.
    expect(String(res.headers[REQUEST_ID_HEADER])).not.toContain('\r');
    expect(String(res.headers[REQUEST_ID_HEADER])).not.toContain('\n');
  });
});
