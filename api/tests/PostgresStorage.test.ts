/**
 * Regression tests for PostgresInvoiceStorage (CHECK405-M1).
 *
 * Uses a fake `PoolLike` that mimics the `pg` driver's behaviour:
 *   - `jsonb` columns are returned as already-parsed JS objects (not strings).
 *   - `timestamptz` columns are returned as `Date` objects.
 *
 * This pins the round-trip so a future change cannot reintroduce the
 * `JSON.parse(object)` double-parse bug or the timestamp type mismatch.
 */

import { PostgresInvoiceStorage } from '../src/storage/PostgresStorage';
import { Invoice } from '../src/types/invoice';

interface StoredRow {
  invoice_id: string;
  merchant_nft: string;
  amount_tbc: string;
  currency: string;
  status: string;
  metadata: unknown; // stored as jsonb string on write, returned as object on read
  settlement: unknown;
  created_at: unknown;
  expires_at: unknown;
  payment_url: string;
}

/**
 * Fake pool that emulates `pg`:
 *  - on write, `pg` parses the JSON string we pass and stores the object; the
 *    read path then returns that object (never a string). We simulate that by
 *    JSON.parse-ing the value we were handed for the jsonb columns.
 *  - timestamptz values are returned as Date objects.
 */
class FakePgPool {
  private rows = new Map<string, StoredRow>();

  async query(
    text: string,
    values: unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (text.trim().startsWith('INSERT')) {
      const [
        invoice_id,
        merchant_nft,
        amount_tbc,
        currency,
        status,
        metadata,
        settlement,
        created_at,
        expires_at,
        payment_url,
      ] = values as [
        string, string, string, string, string,
        string | null, string | null, string, string, string
      ];

      this.rows.set(invoice_id, {
        invoice_id,
        merchant_nft,
        amount_tbc,
        currency,
        status,
        // pg turns the JSON.stringify'd string back into an object for jsonb.
        metadata: metadata === null ? null : JSON.parse(metadata),
        settlement: settlement === null ? null : JSON.parse(settlement),
        // pg returns timestamptz as Date.
        created_at: new Date(created_at),
        expires_at: new Date(expires_at),
        payment_url,
      });
      return { rows: [] };
    }

    if (text.includes('WHERE invoice_id')) {
      const id = values[0] as string;
      const row = this.rows.get(id);
      return { rows: row ? [row as unknown as Record<string, unknown>] : [] };
    }

    if (text.trim().startsWith('SELECT * FROM invoices')) {
      return {
        rows: Array.from(this.rows.values()) as unknown as Record<
          string,
          unknown
        >[],
      };
    }

    if (text.trim().startsWith('DELETE')) {
      this.rows.delete(values[0] as string);
      return { rows: [] };
    }

    return { rows: [] };
  }
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoice_id: 'inv_123',
    merchant_nft: 'EQmerchant',
    amount_tbc: '1000000000',
    currency: 'TBC',
    status: 'settled',
    metadata: { order_id: 'A-1', description: 'Coffee', qty: 2, paid: true },
    created_at: '2026-07-13T10:00:00.000Z',
    expires_at: '2026-07-13T11:00:00.000Z',
    payment_url: 'ton://transfer/EQ?text=inv_123',
    settlement: {
      payer_nft: 'EQpayer',
      merchant_nft: 'EQmerchant',
      amount_tbc: '1000000000',
      block_number: 42,
      tx_hash: 'abc',
      timestamp: '2026-07-13T10:05:00.000Z',
      payload_hash: 'deadbeef',
      on_chain_verified: true,
      verification_url: 'https://explorer/tx/abc',
    },
    ...overrides,
  };
}

describe('PostgresInvoiceStorage (CHECK405-M1)', () => {
  it('round-trips an invoice with metadata and settlement without throwing', async () => {
    const storage = new PostgresInvoiceStorage(new FakePgPool());
    const invoice = makeInvoice();

    await storage.set(invoice);
    const read = await storage.get('inv_123');

    expect(read).toBeDefined();
    expect(read!.metadata).toEqual(invoice.metadata);
    expect(read!.settlement).toEqual(invoice.settlement);
  });

  it('does not double-parse already-parsed jsonb objects', async () => {
    const storage = new PostgresInvoiceStorage(new FakePgPool());
    await storage.set(makeInvoice());

    // Previously threw "SyntaxError: Unexpected token o in JSON" here.
    await expect(storage.get('inv_123')).resolves.toBeDefined();
  });

  it('normalises timestamptz Date values to ISO strings', async () => {
    const storage = new PostgresInvoiceStorage(new FakePgPool());
    await storage.set(makeInvoice());

    const read = await storage.get('inv_123');
    expect(typeof read!.created_at).toBe('string');
    expect(typeof read!.expires_at).toBe('string');
    expect(read!.created_at).toBe('2026-07-13T10:00:00.000Z');
    expect(read!.expires_at).toBe('2026-07-13T11:00:00.000Z');
  });

  it('handles null metadata / settlement (pending invoice)', async () => {
    const storage = new PostgresInvoiceStorage(new FakePgPool());
    const pending = makeInvoice({
      invoice_id: 'inv_pending',
      status: 'pending',
      metadata: undefined,
      settlement: undefined,
    });

    await storage.set(pending);
    const read = await storage.get('inv_pending');

    expect(read!.metadata).toBeUndefined();
    expect(read!.settlement).toBeUndefined();
  });

  it('round-trips through entries()', async () => {
    const storage = new PostgresInvoiceStorage(new FakePgPool());
    await storage.set(makeInvoice());

    const entries = Array.from(await storage.entries());
    expect(entries).toHaveLength(1);
    const [id, invoice] = entries[0];
    expect(id).toBe('inv_123');
    expect(invoice.metadata).toEqual(makeInvoice().metadata);
    expect(typeof invoice.created_at).toBe('string');
  });

  it('still parses legacy text-stored JSON (string) columns', async () => {
    // Simulate a legacy row where jsonb was stored/returned as text.
    const legacyPool = {
      async query() {
        return {
          rows: [
            {
              invoice_id: 'inv_legacy',
              merchant_nft: 'EQm',
              amount_tbc: '1',
              currency: 'TBC',
              status: 'pending',
              metadata: JSON.stringify({ order_id: 'L-1' }),
              settlement: null,
              created_at: '2026-07-13T10:00:00.000Z',
              expires_at: '2026-07-13T11:00:00.000Z',
              payment_url: 'ton://x',
            },
          ],
        };
      },
    };
    const storage = new PostgresInvoiceStorage(legacyPool as never);
    const read = await storage.get('inv_legacy');
    expect(read!.metadata).toEqual({ order_id: 'L-1' });
  });
});
