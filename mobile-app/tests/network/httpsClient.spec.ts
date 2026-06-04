import { describe, it, expect, jest } from '@jest/globals';
import {
  CertificatePinningError,
  HttpsClient,
  HttpsOnlyError,
  type CertificateFingerprintProvider,
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

  it('validates pinned hosts against the live certificate fingerprint', async () => {
    const fetchImpl = makeFetch();
    const certificateFingerprintProvider = jest.fn<CertificateFingerprintProvider>(
      async () => 'BBBB',
    );
    const validator = jest.fn<CertificateValidator>();
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA', 'BBBB'] }],
      certificateFingerprintProvider,
      certificateValidator: validator,
    });
    await client.fetch('https://api.tonbankcard.app/health');
    expect(certificateFingerprintProvider).toHaveBeenCalledTimes(1);
    expect(certificateFingerprintProvider).toHaveBeenCalledWith(
      'api.tonbankcard.app',
      'https://api.tonbankcard.app/health',
      expect.any(Object),
    );
    expect(validator).toHaveBeenCalledTimes(1);
    expect(validator).toHaveBeenCalledWith('api.tonbankcard.app', 'BBBB');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects pinned hosts whose live fingerprint does not match configured pins', async () => {
    const fetchImpl = makeFetch();
    const certificateFingerprintProvider = jest.fn<CertificateFingerprintProvider>(
      async () => 'CCCC',
    );
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA', 'BBBB'] }],
      certificateFingerprintProvider,
    });
    await expect(
      client.fetch('https://api.tonbankcard.app/health'),
    ).rejects.toBeInstanceOf(CertificatePinningError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed for pinned hosts when no live fingerprint is available', async () => {
    const fetchImpl = makeFetch();
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA'] }],
    });
    await expect(
      client.fetch('https://api.tonbankcard.app/health'),
    ).rejects.toBeInstanceOf(CertificatePinningError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('leaves unpinned hosts permissive', async () => {
    const fetchImpl = makeFetch();
    const certificateFingerprintProvider = jest.fn<CertificateFingerprintProvider>(
      async () => 'CCCC',
    );
    const validator = jest.fn<CertificateValidator>();
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA'] }],
      certificateFingerprintProvider,
      certificateValidator: validator,
    });
    await expect(client.fetch('https://other.example.com/health')).resolves.toHaveProperty(
      'status',
      200,
    );
    expect(certificateFingerprintProvider).not.toHaveBeenCalled();
    expect(validator).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lets validator failures abort the request', async () => {
    const fetchImpl = makeFetch();
    const certificateFingerprintProvider = jest.fn<CertificateFingerprintProvider>(
      async () => 'AAAA',
    );
    const validator = jest.fn<CertificateValidator>(() => {
      throw new Error('pin mismatch');
    });
    const client = new HttpsClient({
      fetchImpl,
      pins: [{ host: 'api.tonbankcard.app', sha256Pins: ['AAAA'] }],
      certificateFingerprintProvider,
      certificateValidator: validator,
    });
    await expect(
      client.fetch('https://api.tonbankcard.app/health'),
    ).rejects.toThrow(/pin mismatch/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
