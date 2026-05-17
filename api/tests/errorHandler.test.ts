/**
 * Tests for the standardised error-handling middleware.
 *
 * Verifies the wire-format guarantees from `docs/error-codes.md`:
 *   - every response carries `{ error: { code, message, details? } }`,
 *   - HTTP status comes from the canonical `ErrorCode` → status table,
 *   - production `details` never contains stack traces or raw exception
 *     text,
 *   - request IDs flow from header in → header out and into the error
 *     envelope so operators can correlate the client report with the
 *     server log entry.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../src/utils/validation';
import { ErrorCode, getHttpStatusForErrorCode } from '../src/types/errors';
import {
  sendErrorResponse,
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
} from '../src/middleware/errorHandler';
import { requestIdMiddleware, REQUEST_ID_HEADER } from '../src/middleware/requestId';

interface CapturedResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  headersSent: boolean;
  status: (code: number) => CapturedResponse;
  json: (body: any) => CapturedResponse;
  setHeader: (name: string, value: string) => void;
}

function makeRes(): CapturedResponse {
  const res: CapturedResponse = {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  const base: Record<string, unknown> = {
    method: 'GET',
    url: '/v1/invoice/x',
    originalUrl: '/v1/invoice/x',
    headers: {},
    header: (_name: string) => undefined,
  };
  return { ...base, ...overrides } as unknown as Request;
}

describe('requestIdMiddleware', () => {
  it('synthesises a request id when none is supplied', () => {
    const headerStore: Record<string, string | undefined> = {};
    const req = makeReq({
      header: (name: string) => headerStore[name],
    });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(typeof (req as any).requestId).toBe('string');
    expect((req as any).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers[REQUEST_ID_HEADER]).toBe((req as any).requestId);
  });

  it('echoes a safe inbound request id', () => {
    const supplied = 'edge-abc.123';
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
    const malicious = "abc\r\nSet-Cookie: evil=1";
    const req = makeReq({
      header: (name: string) => (name === REQUEST_ID_HEADER ? malicious : undefined),
    });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res as unknown as Response, next as unknown as NextFunction);

    expect((req as any).requestId).not.toBe(malicious);
    expect((req as any).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('sendErrorResponse', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('emits the standard envelope for a ValidationError', () => {
    const req = makeReq();
    (req as any).requestId = 'req-1';
    const res = makeRes();

    sendErrorResponse(
      req,
      res as unknown as Response,
      new ValidationError(ErrorCode.INVALID_AMOUNT, 'Amount must be greater than zero', {
        amountTbc: '-1',
      }),
    );

    expect(res.statusCode).toBe(getHttpStatusForErrorCode(ErrorCode.INVALID_AMOUNT));
    expect(res.body).toEqual({
      error: {
        code: ErrorCode.INVALID_AMOUNT,
        message: 'Amount must be greater than zero',
        details: { amountTbc: '-1' },
      },
    });
  });

  it('strips stack/cause/error fields from details before they leave the process', () => {
    const req = makeReq();
    const res = makeRes();

    sendErrorResponse(
      req,
      res as unknown as Response,
      new ValidationError(ErrorCode.INVALID_AMOUNT, 'bad', {
        amountTbc: '0',
        // these MUST NOT make it out
        error: 'SyntaxError: Cannot parse "0n"',
        stack: 'at /home/secret/path.ts:42',
        cause: { sql: 'SELECT * FROM users' },
      }),
    );

    expect(res.body.error.details).toEqual({ amountTbc: '0' });
    expect(res.body.error.details.error).toBeUndefined();
    expect(res.body.error.details.stack).toBeUndefined();
    expect(res.body.error.details.cause).toBeUndefined();
  });

  it('does not expose internal exception text in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Force module to re-evaluate IS_PRODUCTION by re-requiring it.
    jest.resetModules();
    const reloaded = require('../src/middleware/errorHandler') as typeof import('../src/middleware/errorHandler');
    try {
      const req = makeReq();
      (req as any).requestId = 'req-prod';
      const res = makeRes();

      reloaded.sendErrorResponse(
        req,
        res as unknown as Response,
        new Error('connect ECONNREFUSED 10.0.0.1:5432'),
      );

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(res.body.error.message).toBe('Internal server error');
      // Production envelope never includes the raw exception text.
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.1');
      // The requestId, however, is fine to return.
      expect(res.body.error.details?.requestId).toBe('req-prod');
    } finally {
      process.env.NODE_ENV = original;
      jest.resetModules();
    }
  });
});

describe('errorHandlerMiddleware', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns the standard envelope for unhandled exceptions', () => {
    const req = makeReq();
    const res = makeRes();

    errorHandlerMiddleware(
      new Error('boom'),
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('does nothing when headers have already been sent', () => {
    const req = makeReq();
    const res = makeRes();
    res.headersSent = true;

    errorHandlerMiddleware(
      new Error('too late'),
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    expect(res.body).toBeNull();
  });
});

describe('notFoundHandlerMiddleware', () => {
  it('returns 404 with the standard envelope', () => {
    const req = makeReq({ originalUrl: '/v1/does/not/exist' });
    const res = makeRes();

    notFoundHandlerMiddleware(req, res as unknown as Response);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe(ErrorCode.INVOICE_NOT_FOUND);
    expect(typeof res.body.error.message).toBe('string');
  });
});
