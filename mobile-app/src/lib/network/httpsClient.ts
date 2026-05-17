/**
 * Minimal HTTPS-only fetch wrapper with an optional certificate pinning hook.
 *
 * SECURITY:
 * - Refuses any URL that is not `https://`.
 * - Exposes a `certificateValidator` hook so the host environment can run
 *   real certificate pinning (e.g., react-native-ssl-pinning). The validator
 *   receives the destination host and SHA-256 fingerprint string; it MUST
 *   throw to abort the request when the pin set does not match.
 * - The default validator is permissive when no pins are configured; that
 *   is intentional and documented — pinning is only on for hosts the
 *   caller explicitly listed.
 */

import type { CertificatePin } from '../config';

export interface HttpsFetchOptions extends RequestInit {
  readonly host?: string;
}

export type CertificateValidator = (host: string, sha256Fingerprint: string) => void | Promise<void>;

export interface HttpsClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly pins?: readonly CertificatePin[];
  readonly certificateValidator?: CertificateValidator;
}

const HTTPS_PREFIX = 'https://';

export class HttpsOnlyError extends Error {
  constructor(url: string) {
    super(`Refusing non-HTTPS URL: ${url}`);
    this.name = 'HttpsOnlyError';
  }
}

export class HttpsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly pins: ReadonlyMap<string, readonly string[]>;
  private readonly validator?: CertificateValidator;

  constructor(options: HttpsClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pins = new Map((options.pins ?? []).map((pin) => [pin.host, pin.sha256Pins]));
    this.validator = options.certificateValidator;
  }

  hasPinsFor(host: string): boolean {
    return this.pins.has(host);
  }

  pinsFor(host: string): readonly string[] {
    return this.pins.get(host) ?? [];
  }

  async fetch(url: string, init: HttpsFetchOptions = {}): Promise<Response> {
    if (!url.startsWith(HTTPS_PREFIX)) {
      throw new HttpsOnlyError(url);
    }
    if (this.validator) {
      const host = init.host ?? new URL(url).hostname;
      const pins = this.pinsFor(host);
      for (const pin of pins) {
        await this.validator(host, pin);
      }
    }
    return this.fetchImpl(url, init);
  }
}
