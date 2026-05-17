import { describe, it, expect, jest } from '@jest/globals';
import {
  HttpsClient,
  HttpsOnlyError,
  type CertificateValidator,
} from '../../src/lib/network/httpsClient';

function fakeResponse(): Response {
  return new Response('ok', { status: 200 });
}

function makeFetch(): jest.Mock<typeof fetch> {
  return jest.fn<typeof fetch>(async () => fakeResponse());
}

describe('HttpsClient', () => {
  it('rejects non-HTTPS URLs', async () => {
    const client = new HttpsClient({ fetchImpl: makeFetch() });
    await expect(client.fetch('http://insecure.example.com')).rejects.toBeInstanceOf(
      HttpsOnlyError,
    );
  });

  it('rejects file and javascript URLs', async () => {
    const client = new HttpsClient({ fetchImpl: makeFetch() });
    await expect(client.fetch('file:///etc/passwd')).rejects.toBeInstanceOf(HttpsOnlyError);
    await expect(client.fetch('javascript:alert(1)')).rejects.toBeInstanceOf(
      HttpsOnlyError,
    );
  });

  it('forwards HTTPS requests to the supplied fetch implementation', async () => {
    const fetchImpl = makeFetch();
    const client = new HttpsClient({ fetchImpl });
    const res = await client.fetch('https://api.tonbankcard.app/health');
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.tonbankcard.app/health',
      expect.any(Object),
    );
  });

  it('exposes configured pins for matching hosts only', () => {
    const client = new HttpsClient({
      pins: [
        { host: 'api.tonbankcard.app', sha256Pins: ['AAAA', 'BBBB'] },
      ],
    });
    expect(client.hasPinsFor('api.tonbankcard.app')).toBe(true);
    expect(client.pinsFor('api.tonbankcard.app')).toEqual(['AAAA', 'BBBB']);
    expect(client.hasPinsFor('other.example.com')).toBe(false);
    expect(client.pinsFor('other.example.com')).toEqual([]);
  });

  it('calls the certificate validator with every configured pin', async () => {
    const validator = jest.fn<CertificateValidator>();
    const client = new HttpsClient({
      fetchImpl: makeFetch(),
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA', 'BBBB'] }],
      certificateValidator: validator,
    });
    await client.fetch('https://api.tonbankcard.app/health');
    expect(validator).toHaveBeenCalledTimes(2);
    expect(validator).toHaveBeenNthCalledWith(1, 'api.tonbankcard.app', 'AAAA');
    expect(validator).toHaveBeenNthCalledWith(2, 'api.tonbankcard.app', 'BBBB');
  });

  it('lets validator failures abort the request', async () => {
    const fetchImpl = makeFetch();
    const validator = jest.fn<CertificateValidator>(() => {
      throw new Error('pin mismatch');
    });
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA'] }],
      certificateValidator: validator,
    });
    await expect(
      client.fetch('https://api.tonbankcard.app/health'),
    ).rejects.toThrow(/pin mismatch/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
