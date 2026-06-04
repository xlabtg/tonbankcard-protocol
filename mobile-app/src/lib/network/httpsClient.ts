/**
 * Minimal HTTPS-only fetch wrapper with an optional certificate pinning hook.
 *
 * SECURITY:
 * - Refuses any URL that is not `https://`.
 * - Exposes a `certificateFingerprintProvider` hook so the host environment
 *   can extract the live server certificate SPKI SHA-256 fingerprint
 *   (e.g., via react-native-ssl-pinning). Pinned hosts fail closed when no
 *   live fingerprint is available or when it does not match the configured
 *   pin set.
 * - Exposes a `certificateValidator` hook for host-specific checks after
 *   the live fingerprint has matched the configured pin set. The validator
 *   receives the destination host and live SHA-256 fingerprint string; it
 *   MUST throw to abort the request when an additional policy check fails.
 * - The default validator is permissive when no pins are configured; that
 *   is intentional and documented — pinning is only on for hosts the
 *   caller explicitly listed.
 */

import type { CertificatePin } from '../config';

export interface HttpsFetchOptions extends RequestInit {
  readonly host?: string;
}

export type CertificateValidator = (
  host: string,
  sha256Fingerprint: string,
) => void | Promise<void>;
export type CertificateFingerprintProvider = (
  host: string,
  url: string,
  init: HttpsFetchOptions,
) => string | null | undefined | Promise<string | null | undefined>;

export interface HttpsClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly pins?: readonly CertificatePin[];
  readonly certificateFingerprintProvider?: CertificateFingerprintProvider;
  readonly certificateValidator?: CertificateValidator;
}

export class HttpsOnlyError extends Error {
  constructor(url: string) {
    super(`Refusing non-HTTPS URL: ${url}`);
    this.name = 'HttpsOnlyError';
  }
}

export class CertificatePinningError extends Error {
  constructor(host: string, reason: string) {
    super(`Certificate pinning failed for ${host}: ${reason}`);
    this.name = 'CertificatePinningError';
  }
}

export class HttpsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly pins: ReadonlyMap<string, readonly string[]>;
  private readonly fingerprintProvider?: CertificateFingerprintProvider;
  private readonly validator?: CertificateValidator;

  constructor(options: HttpsClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pins = new Map((options.pins ?? []).map((pin) => [pin.host, pin.sha256Pins]));
    this.fingerprintProvider = options.certificateFingerprintProvider;
    this.validator = options.certificateValidator;
  }

  hasPinsFor(host: string): boolean {
    return this.pins.has(host);
  }

  pinsFor(host: string): readonly string[] {
    return this.pins.get(host) ?? [];
  }

  async fetch(url: string, init: HttpsFetchOptions = {}): Promise<Response> {
    let parsed: URL;
    try {
      if (url !== url.trim() || url.includes('\\')) {
        throw new Error('URL contains ambiguous formatting');
      }
      parsed = new URL(url);
    } catch {
      throw new HttpsOnlyError(url);
    }
    if (parsed.protocol !== 'https:') {
      throw new HttpsOnlyError(url);
    }
    const host = init.host ?? parsed.hostname;
    const pins = this.pinsFor(host);
    if (pins.length > 0) {
      if (!this.fingerprintProvider) {
        throw new CertificatePinningError(host, 'live certificate fingerprint is unavailable');
      }
      const liveFingerprint = await this.fingerprintProvider(host, url, init);
      if (!liveFingerprint) {
        throw new CertificatePinningError(host, 'live certificate fingerprint is unavailable');
      }
      if (!pins.includes(liveFingerprint)) {
        throw new CertificatePinningError(
          host,
          'live certificate fingerprint does not match configured pins',
        );
      }
      if (this.validator) {
        await this.validator(host, liveFingerprint);
      }
    }
    return this.fetchImpl(url, init);
  }
}
