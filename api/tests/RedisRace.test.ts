import { RedisIdempotencyStorage } from '../src/storage/RedisIdempotencyStorage';
test('lost NX and expired winner must retry before reporting acquisition', async () => {
 const client = { set: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('OK'), get: jest.fn().mockResolvedValue(null), del: jest.fn() };
 const record = { invoiceId: 'inv_1', expiresAt: Date.now() + 60000 };
 expect(await new RedisIdempotencyStorage(client).setIfAbsent('key', record)).toBeUndefined();
 expect(client.set).toHaveBeenCalledTimes(2);
});
