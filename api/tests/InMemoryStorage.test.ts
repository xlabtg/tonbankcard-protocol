/**
 * InMemoryStorage Tests
 *
 * Verifies that `InMemoryInvoiceStorage` and `InMemoryIdempotencyStorage`
 * correctly implement the `IInvoiceStorage` and `IIdempotencyStorage`
 * contracts.
 *
 * These tests also serve as a compliance suite: any production storage
 * adapter (PostgresStorage, RedisIdempotencyStorage, …) should pass the
 * same assertions when substituted here.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  InMemoryInvoiceStorage,
  InMemoryIdempotencyStorage,
} from '../src/storage/InMemoryStorage';
import { Invoice } from '../src/types/invoice';
import {
  IIdempotencyStorage,
  IInvoiceStorage,
  IdempotencyRecord,
} from '../src/storage/IStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvoice(partial: Partial<Invoice> = {}): Invoice {
  return {
    invoice_id: 'inv_0123456789abcdef',
    merchant_nft: 'EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
    amount_tbc: '1000000000',
    currency: 'TBC',
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    payment_url: 'https://wallet.tonbankcard.io/pay/inv_0123456789abcdef',
    ...partial,
  };
}

class DurableInvoiceStorage implements IInvoiceStorage {
  private readonly store = new Map<string, Invoice>();

  async set(invoice: Invoice): Promise<void> {
    this.store.set(invoice.invoice_id, invoice);
  }

  async get(invoiceId: string): Promise<Invoice | undefined> {
    return this.store.get(invoiceId);
  }

  async delete(invoiceId: string): Promise<void> {
    this.store.delete(invoiceId);
  }

  async entries(): Promise<Iterable<[string, Invoice]>> {
    return this.store.entries();
  }
}

class DurableIdempotencyStorage implements IIdempotencyStorage {
  private readonly store = new Map<string, IdempotencyRecord>();

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    this.store.set(key, record);
  }

  async setIfAbsent(
    key: string,
    record: IdempotencyRecord,
  ): Promise<IdempotencyRecord | undefined> {
    const existing = this.store.get(key);
    if (existing && existing.expiresAt >= Date.now()) {
      return existing;
    }
    if (existing) {
      this.store.delete(key);
    }
    this.store.set(key, record);
    return undefined;
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.store.get(key);
    if (record && record.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ---------------------------------------------------------------------------
// IInvoiceStorage — InMemoryInvoiceStorage
// ---------------------------------------------------------------------------

describe('InMemoryInvoiceStorage', () => {
  let storage: InMemoryInvoiceStorage;

  beforeEach(() => {
    storage = new InMemoryInvoiceStorage();
  });

  it('should store and retrieve an invoice', async () => {
    const invoice = makeInvoice();
    await storage.set(invoice);

    const retrieved = await storage.get(invoice.invoice_id);
    expect(retrieved).toEqual(invoice);
  });

  it('should return undefined for a missing invoice', async () => {
    const result = await storage.get('inv_does_not_exist__0000');
    expect(result).toBeUndefined();
  });

  it('should overwrite an existing invoice on set', async () => {
    const invoice = makeInvoice();
    await storage.set(invoice);

    const updated: Invoice = { ...invoice, status: 'settled' };
    await storage.set(updated);

    const retrieved = await storage.get(invoice.invoice_id);
    expect(retrieved?.status).toBe('settled');
  });

  it('should delete an invoice', async () => {
    const invoice = makeInvoice();
    await storage.set(invoice);

    await storage.delete(invoice.invoice_id);

    const result = await storage.get(invoice.invoice_id);
    expect(result).toBeUndefined();
  });

  it('should silently ignore delete of a non-existent invoice', async () => {
    await expect(
      storage.delete('inv_does_not_exist__0000'),
    ).resolves.not.toThrow();
  });

  it('should iterate over all stored invoices via entries()', async () => {
    const invoice1 = makeInvoice({
      invoice_id: 'inv_aaaaaaaaaaaaaaaa',
      amount_tbc: '1000000000',
    });
    const invoice2 = makeInvoice({
      invoice_id: 'inv_bbbbbbbbbbbbbbbb',
      amount_tbc: '2000000000',
    });

    await storage.set(invoice1);
    await storage.set(invoice2);

    const entries = await storage.entries();
    const ids = [...entries].map(([id]) => id);

    expect(ids).toContain('inv_aaaaaaaaaaaaaaaa');
    expect(ids).toContain('inv_bbbbbbbbbbbbbbbb');
    expect(ids).toHaveLength(2);
  });

  it('should return empty entries when no invoices are stored', async () => {
    const entries = await storage.entries();
    expect([...entries]).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IIdempotencyStorage — InMemoryIdempotencyStorage
// ---------------------------------------------------------------------------

describe('InMemoryIdempotencyStorage', () => {
  let storage: InMemoryIdempotencyStorage;

  beforeEach(() => {
    storage = new InMemoryIdempotencyStorage();
  });

  it('should store and retrieve an idempotency record', async () => {
    const record: IdempotencyRecord = {
      invoiceId: 'inv_0123456789abcdef',
      expiresAt: Date.now() + 60_000,
    };

    await storage.set('key_abc', record);

    const retrieved = await storage.get('key_abc');
    expect(retrieved).toEqual(record);
  });

  it('should atomically keep the first active record on setIfAbsent', async () => {
    const initial: IdempotencyRecord = {
      invoiceId: 'inv_initial_________',
      expiresAt: Date.now() + 60_000,
    };
    const duplicate: IdempotencyRecord = {
      invoiceId: 'inv_duplicate_______',
      expiresAt: Date.now() + 60_000,
    };

    await expect(
      storage.setIfAbsent('key_abc', initial),
    ).resolves.toBeUndefined();
    await expect(storage.setIfAbsent('key_abc', duplicate)).resolves.toEqual(
      initial,
    );
    await expect(storage.get('key_abc')).resolves.toEqual(initial);
  });

  it('should replace an expired record on setIfAbsent', async () => {
    const expired: IdempotencyRecord = {
      invoiceId: 'inv_expired_________',
      expiresAt: Date.now() - 1,
    };
    const replacement: IdempotencyRecord = {
      invoiceId: 'inv_replacement_____',
      expiresAt: Date.now() + 60_000,
    };

    await storage.set('key_abc', expired);

    await expect(
      storage.setIfAbsent('key_abc', replacement),
    ).resolves.toBeUndefined();
    await expect(storage.get('key_abc')).resolves.toEqual(replacement);
  });

  it('should return undefined for a missing key', async () => {
    const result = await storage.get('key_does_not_exist');
    expect(result).toBeUndefined();
  });

  it('should treat an expired record as absent', async () => {
    const record: IdempotencyRecord = {
      invoiceId: 'inv_0123456789abcdef',
      expiresAt: Date.now() - 1, // already expired
    };

    await storage.set('key_expired', record);

    const result = await storage.get('key_expired');
    expect(result).toBeUndefined();
  });

  it('should overwrite an existing record on set', async () => {
    const initial: IdempotencyRecord = {
      invoiceId: 'inv_old_____________',
      expiresAt: Date.now() + 60_000,
    };
    await storage.set('key_abc', initial);

    const updated: IdempotencyRecord = {
      invoiceId: 'inv_new_____________',
      expiresAt: Date.now() + 60_000,
    };
    await storage.set('key_abc', updated);

    const result = await storage.get('key_abc');
    expect(result?.invoiceId).toBe('inv_new_____________');
  });

  it('should delete an idempotency record', async () => {
    const record: IdempotencyRecord = {
      invoiceId: 'inv_0123456789abcdef',
      expiresAt: Date.now() + 60_000,
    };

    await storage.set('key_abc', record);
    await storage.delete('key_abc');

    const result = await storage.get('key_abc');
    expect(result).toBeUndefined();
  });

  it('should silently ignore delete of a non-existent key', async () => {
    await expect(storage.delete('key_does_not_exist')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// InvoiceService storage injection
// ---------------------------------------------------------------------------

import { InvoiceService } from '../src/services/InvoiceService';
import { ApiKeyService } from '../src/services/ApiKeyService';
import { CreateInvoiceRequest } from '../src/types/invoice';

describe('InvoiceService with injected storage', () => {
  const TEST_API_KEY = 'tbck_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  const TEST_MERCHANT_NFT = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'; // Series 7777 (whitelisted)

  let keyService: ApiKeyService;

  beforeEach(() => {
    keyService = new ApiKeyService();
    keyService.registerKey(TEST_API_KEY, TEST_MERCHANT_NFT);
  });

  const validRequest: CreateInvoiceRequest = {
    merchant_nft: TEST_MERCHANT_NFT,
    amount_tbc: '1000000000',
    currency: 'TBC',
    metadata: { order_id: 'ORDER-STORAGE-TEST' },
  };

  it('should use injected storage so invoices survive service scope', async () => {
    const invoiceStorage = new InMemoryInvoiceStorage();
    const idempotencyStorage = new InMemoryIdempotencyStorage();

    // Create invoice through service A
    const serviceA = new InvoiceService(
      keyService,
      invoiceStorage,
      idempotencyStorage,
    );
    const created = await serviceA.createInvoice(validRequest, TEST_API_KEY);

    // Retrieve invoice through a different service instance sharing the same storage
    const serviceB = new InvoiceService(
      keyService,
      invoiceStorage,
      idempotencyStorage,
    );
    const retrieved = await serviceB.getInvoice(created.invoice_id);

    expect(retrieved.invoice_id).toBe(created.invoice_id);
    expect(retrieved.status).toBe('pending');
  });

  it('two services with independent storage should NOT share data', async () => {
    const serviceA = new InvoiceService(
      keyService,
      new InMemoryInvoiceStorage(),
      new InMemoryIdempotencyStorage(),
    );
    const serviceB = new InvoiceService(
      keyService,
      new InMemoryInvoiceStorage(),
      new InMemoryIdempotencyStorage(),
    );

    const created = await serviceA.createInvoice(validRequest, TEST_API_KEY);

    await expect(serviceB.getInvoice(created.invoice_id)).rejects.toThrow(
      'Invoice not found',
    );
  });

  it('default constructor should use in-memory storage', async () => {
    // Constructed without arguments — should still work (in-memory defaults)
    // The default keyService singleton has no registered keys, so we register one first
    const { apiKeyService: defaultKeyService } =
      await import('../src/services/ApiKeyService');
    defaultKeyService.registerKey(TEST_API_KEY, TEST_MERCHANT_NFT);

    const service = new InvoiceService();
    const invoice = await service.createInvoice(validRequest, TEST_API_KEY);
    const retrieved = await service.getInvoice(invoice.invoice_id);

    expect(retrieved.invoice_id).toBe(invoice.invoice_id);

    defaultKeyService.clearAll();
  });

  it('should fail production readiness when default in-memory storage is configured', () => {
    const service = new InvoiceService(
      keyService,
      new InMemoryInvoiceStorage(),
      new InMemoryIdempotencyStorage(),
    );

    expect(() =>
      service.assertProductionStorageConfigured({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow(
      'Persistent invoice and idempotency storage are required in production',
    );
  });

  it('should pass production readiness with injected durable storage adapters', () => {
    const service = new InvoiceService(
      keyService,
      new DurableInvoiceStorage(),
      new DurableIdempotencyStorage(),
    );

    expect(() =>
      service.assertProductionStorageConfigured({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('should deduplicate concurrent identical creates through atomic idempotency storage', async () => {
    const invoiceStorage = new InMemoryInvoiceStorage();
    const idempotencyStorage = new InMemoryIdempotencyStorage();
    const service = new InvoiceService(
      keyService,
      invoiceStorage,
      idempotencyStorage,
    );

    const invoices = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.createInvoice(validRequest, TEST_API_KEY),
      ),
    );
    const invoiceIds = new Set(invoices.map((invoice) => invoice.invoice_id));
    const storedInvoices = [...(await invoiceStorage.entries())];

    expect(invoiceIds.size).toBe(1);
    expect(storedInvoices).toHaveLength(1);
    expect(storedInvoices[0][0]).toBe(invoices[0].invoice_id);
  });
});
