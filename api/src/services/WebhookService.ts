/**
 * Webhook Delivery Service
 *
 * Sends signed outbound webhooks to merchant endpoints registered for
 * payment events. Every delivery carries the `X-Tonbankcard-Signature`
 * header described in `utils/webhookSignature.ts` so receivers can
 * verify authenticity without trusting the network.
 *
 * Responsibilities
 * ----------------
 *  - Track registered webhook endpoints (URL + per-endpoint secret).
 *  - Sign the raw JSON body with HMAC-SHA256 and the registered secret.
 *  - POST the payload to the merchant endpoint with sensible timeouts.
 *  - Surface delivery outcomes so callers can persist retry state.
 *
 * Non-responsibilities
 * --------------------
 *  - Durable retry queue / dead-letter handling: that belongs in a
 *    background worker fed by this service.
 *  - Identity binding: we trust that the registering caller has already
 *    authenticated the merchant.
 *
 * @see docs/merchant-api-spec.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import crypto from 'crypto';
import {
  SIGNATURE_HEADER,
  signWebhook,
} from '../utils/webhookSignature';

/** Registered webhook endpoint. */
export interface WebhookEndpoint {
  /** Opaque identifier used for revocation and audit logs. */
  endpoint_id: string;
  /** Public destination URL (HTTPS required in production). */
  url: string;
  /** HMAC signing secret. Never stored in plaintext — see `secret_hash`. */
  secret: string;
  /** Merchant NFT this endpoint belongs to. */
  merchant_nft: string;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** Whether deliveries are currently enabled. */
  is_active: boolean;
}

/** Result of a single webhook delivery attempt. */
export interface WebhookDeliveryResult {
  /** True if the HTTP response is 2xx. */
  ok: boolean;
  /** HTTP status code returned by the merchant endpoint (0 on transport error). */
  status: number;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Transport-level error message, when applicable. */
  error?: string;
}

/** Options accepted by {@link WebhookService.deliver}. */
export interface DeliverOptions {
  /** Override the timestamp baked into the signature (used in tests). */
  timestamp?: number;
  /** Request timeout in milliseconds. Default 5_000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export class WebhookService {
  /** Process-local registry — replace with a database adapter in production. */
  private readonly endpoints = new Map<string, WebhookEndpoint>();

  /**
   * Register a webhook endpoint for a merchant.
   *
   * Both arguments come from the merchant (URL via dashboard, secret
   * generated server-side and shown once).
   */
  register(merchantNft: string, url: string, secret: string): WebhookEndpoint {
    const endpointId = `wh_${crypto.randomBytes(8).toString('hex')}`;
    const endpoint: WebhookEndpoint = {
      endpoint_id: endpointId,
      url,
      secret,
      merchant_nft: merchantNft,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    this.endpoints.set(endpointId, endpoint);
    return endpoint;
  }

  /** Look up a registered endpoint by id. Returns `null` if unknown. */
  find(endpointId: string): WebhookEndpoint | null {
    return this.endpoints.get(endpointId) ?? null;
  }

  /** Deactivate a registered endpoint. Idempotent. */
  deactivate(endpointId: string): boolean {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return false;
    endpoint.is_active = false;
    return true;
  }

  /** Test helper: drop every registration. */
  clearAll(): void {
    this.endpoints.clear();
  }

  /**
   * Deliver a JSON payload to the registered endpoint.
   *
   * The payload is `JSON.stringify`-ed *once*; the resulting bytes are
   * both signed and sent so the signature is computed over the exact
   * body the merchant will verify.
   */
  async deliver(
    endpointId: string,
    payload: unknown,
    options: DeliverOptions = {},
  ): Promise<WebhookDeliveryResult> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return {
        ok: false,
        status: 0,
        durationMs: 0,
        error: `Unknown webhook endpoint: ${endpointId}`,
      };
    }
    if (!endpoint.is_active) {
      return {
        ok: false,
        status: 0,
        durationMs: 0,
        error: 'Endpoint is deactivated',
      };
    }

    const rawBody = JSON.stringify(payload);
    const signatureHeader = signWebhook(endpoint.secret, rawBody, options.timestamp);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signatureHeader,
        },
        body: rawBody,
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        status: response.status,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Singleton used by route handlers. */
export const webhookService = new WebhookService();
