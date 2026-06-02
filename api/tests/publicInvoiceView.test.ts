/**
 * Public Invoice View Tests (audit finding API-H4)
 *
 * Regression coverage for issue #253: the unauthenticated
 * `GET /v1/invoice/:invoice_id` endpoint must NOT leak merchant identity
 * (`merchant_nft`), arbitrary metadata (which may carry customer PII such
 * as `customer_email` / `order_id`), or settlement details.
 *
 * The full invoice is only available through the authenticated
 * `GET /v1/invoice/:invoice_id/detail` route, restricted to the owning
 * merchant.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/253
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { invoiceService } from '../src/services/InvoiceService';
import { apiKeyService } from '../src/services/ApiKeyService';
import { getInvoice, getInvoiceDetail } from '../src/routes/invoiceRoutes';
import { CreateInvoiceRequest, ErrorCode, Invoice } from '../src/types/invoice';

const MERCHANT_NFT = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'; // Series 7777
const OTHER_MERCHANT_NFT = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'; // Series 8888
const API_KEY = 'tbck_test_h4_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
const OTHER_API_KEY = 'tbck_test_h4_other_9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k';

const PII_METADATA = {
  order_id: 'ORDER-SECRET-42',
  customer_email: 'victim@example.com',
  description: 'Sensitive purchase',
};

function makeReq(invoiceId: string, authHeader?: string): Request {
  return {
    params: { invoice_id: invoiceId },
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

interface MockRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
  setHeader: (name: string, value: string) => void;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

async function seedInvoice(): Promise<Invoice> {
  const request: CreateInvoiceRequest = {
    merchant_nft: MERCHANT_NFT,
    amount_tbc: '1000000000',
    currency: 'TBC',
    metadata: { ...PII_METADATA },
  };
  return invoiceService.createInvoice(request, API_KEY);
}

describe('API-H4: public invoice endpoint does not leak merchant data / PII', () => {
  beforeEach(() => {
    apiKeyService.clearAll();
    apiKeyService.registerKey(API_KEY, MERCHANT_NFT);
    apiKeyService.registerKey(OTHER_API_KEY, OTHER_MERCHANT_NFT);
  });

  describe('GET /v1/invoice/:invoice_id (unauthenticated)', () => {
    it('returns only payer-facing fields', async () => {
      const created = await seedInvoice();
      const res = makeRes();

      await getInvoice(makeReq(created.invoice_id), res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        invoice_id: created.invoice_id,
        amount_tbc: created.amount_tbc,
        currency: 'TBC',
        status: 'pending',
        created_at: created.created_at,
        expires_at: created.expires_at,
        payment_url: created.payment_url,
      });
    });

    it('does not expose merchant_nft, metadata, PII, or settlement', async () => {
      const created = await seedInvoice();
      const res = makeRes();

      await getInvoice(makeReq(created.invoice_id), res as unknown as Response);

      const body = res.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('merchant_nft');
      expect(body).not.toHaveProperty('metadata');
      expect(body).not.toHaveProperty('settlement');

      // No PII anywhere in the serialized response.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(MERCHANT_NFT);
      expect(serialized).not.toContain('customer_email');
      expect(serialized).not.toContain(PII_METADATA.customer_email);
      expect(serialized).not.toContain('order_id');
      expect(serialized).not.toContain(PII_METADATA.order_id);
    });
  });

  describe('GET /v1/invoice/:invoice_id/detail (authenticated)', () => {
    it('returns the full invoice to the owning merchant', async () => {
      const created = await seedInvoice();
      const res = makeRes();

      await getInvoiceDetail(
        makeReq(created.invoice_id, `Bearer ${API_KEY}`),
        res as unknown as Response,
      );

      expect(res.statusCode).toBe(200);
      const body = res.body as Invoice;
      expect(body.merchant_nft).toBe(MERCHANT_NFT);
      expect(body.metadata).toEqual(PII_METADATA);
    });

    it('rejects an unauthenticated request', async () => {
      const created = await seedInvoice();
      const res = makeRes();

      await getInvoiceDetail(makeReq(created.invoice_id), res as unknown as Response);

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe(ErrorCode.INVALID_API_KEY);
    });

    it("rejects a key bound to a different merchant", async () => {
      const created = await seedInvoice();
      const res = makeRes();

      await getInvoiceDetail(
        makeReq(created.invoice_id, `Bearer ${OTHER_API_KEY}`),
        res as unknown as Response,
      );

      expect(res.statusCode).toBe(403);
      expect((res.body as any).error.code).toBe(ErrorCode.UNAUTHORIZED_MERCHANT);
    });
  });
});
