/**
 * Sandbox-mode middleware for the Merchant API.
 *
 * When the API is started with `TONBANKCARD_SANDBOX=true` (or `NODE_ENV=sandbox`)
 * the following relaxations apply:
 *
 * 1. Every response carries `X-Tonbankcard-Environment: sandbox` so clients
 *    can verify they are not accidentally talking to production.
 *    (Acceptance criterion §6 of issue #124.)
 *
 * 2. `POST /v1/invoice/create` accepts an empty Authorization header. When
 *    none is provided, the middleware injects a deterministic, well-known
 *    sandbox API key bound to a published "default merchant NFT" so that
 *    integrators can hit the endpoint with one `curl` call.
 *    (Functional requirement §5.1 of issue #124.)
 *
 * 3. A read-only `/v1/sandbox/info` endpoint is exposed so SDKs and humans
 *    can discover the active sandbox configuration: faucet URL, default
 *    merchant NFT, supported test card IDs, reset cadence, etc.
 *
 * The middleware is **inert** in production builds (`isSandboxMode()` → false).
 * The header is the only side effect ever emitted in production.
 *
 * Security notes
 * --------------
 * - The sandbox API key is public because the sandbox is a public testnet —
 *   there are no real funds to protect. The key still uses the canonical
 *   `tbc_test_<32hex>` shape so the normal key-format checks exercise the
 *   same code path as merchant-issued keys.
 * - The middleware never elevates production keys; the bypass only activates
 *   when `isSandboxMode()` is true.
 * - The default merchant NFT used by the sandbox is documented in
 *   `docs/sandbox.md` and must point at a sandbox account that holds zero
 *   real value.
 */

import type { Request, Response, NextFunction, Express } from 'express';
import { apiKeyService } from '../services/ApiKeyService';
import { isValidApiKeyFormat } from '../utils/apiKeyGenerator';

/** Header sent on every sandbox response. */
export const SANDBOX_HEADER = 'X-Tonbankcard-Environment';
export const SANDBOX_HEADER_VALUE = 'sandbox';

/**
 * Public, well-known sandbox API key. Documented in `docs/sandbox.md`.
 * Anyone may use it; the sandbox is rate-limited like any other tenant.
 */
export const PUBLIC_SANDBOX_API_KEY =
  'tbc_test_a3f8c2e91d4b7a6e5c3f8d2a1b9e4c7d';

/** Default merchant NFT bound to {@link PUBLIC_SANDBOX_API_KEY}. */
export const PUBLIC_SANDBOX_MERCHANT_NFT =
  process.env.SANDBOX_DEFAULT_MERCHANT_NFT ??
  'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Where to point integrators for free testnet TBC. */
export const PUBLIC_SANDBOX_FAUCET_URL =
  process.env.SANDBOX_FAUCET_URL ??
  'https://sandbox.api.tonbankcard.com/faucet';

export const PUBLIC_SANDBOX_BASE_URL =
  process.env.SANDBOX_BASE_URL ?? 'https://sandbox.api.tonbankcard.com';

export const SANDBOX_RESET_CADENCE =
  process.env.SANDBOX_RESET_CADENCE ?? 'weekly';

export const SANDBOX_TEST_NFT_CARDS = (
  process.env.SANDBOX_TEST_NFT_CARDS ??
  '0:1111111111111111111111111111111111111111111111111111111111111111,0:2222222222222222222222222222222222222222222222222222222222222222'
)
  .split(',')
  .map((card) => card.trim())
  .filter(Boolean);

/**
 * Whether the API is running in sandbox mode. Pure environment check so the
 * server entry point can branch on it before mounting routes.
 */
export function isSandboxMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.TONBANKCARD_SANDBOX !== undefined) {
    return ['1', 'true', 'yes', 'on'].includes(
      env.TONBANKCARD_SANDBOX.toLowerCase(),
    );
  }
  return env.NODE_ENV === 'sandbox';
}

/**
 * Ensure the public sandbox API key is registered.
 *
 * Idempotent: if a key with the same plaintext is already in the registry
 * (e.g. because the server hot-reloaded), the existing record is reused.
 * Exported for tests so they can re-register after `clearAll()`.
 */
export function ensureSandboxKeyRegistered(): void {
  if (!isValidApiKeyFormat(PUBLIC_SANDBOX_API_KEY)) {
    throw new Error(
      'Configured public sandbox API key does not match the canonical format',
    );
  }

  try {
    apiKeyService.findAndValidateKey(PUBLIC_SANDBOX_API_KEY);
  } catch {
    apiKeyService.registerApiKey(
      PUBLIC_SANDBOX_API_KEY,
      PUBLIC_SANDBOX_MERCHANT_NFT,
      ['invoice:create', 'invoice:read', 'invoice:status'],
    );
  }
}

/**
 * Middleware that stamps the sandbox header on every response.
 *
 * Idempotent: applied early in the pipeline so even error paths carry the
 * header, which means clients can rely on it as a cheap environment check.
 */
export function sandboxHeaderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader(SANDBOX_HEADER, SANDBOX_HEADER_VALUE);
  next();
}

/**
 * Middleware that lets sandbox callers omit the Authorization header on
 * authenticated endpoints. If the header is missing we inject the public
 * sandbox API key so the downstream `authenticateWithPermission` middleware
 * keeps the exact same shape as production.
 *
 * Has no effect if the caller did supply an Authorization header — we never
 * overwrite an explicit credential.
 */
export function sandboxAnonymousAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.headers.authorization) {
    req.headers.authorization = `Bearer ${PUBLIC_SANDBOX_API_KEY}`;
  }
  next();
}

export interface SandboxInfo {
  environment: 'sandbox';
  network: string;
  baseUrl: string;
  faucetUrl: string;
  defaultMerchantNft: string;
  defaultSandboxApiKey: string;
  testNftCards: string[];
  resetCadence: string;
  /** Documentation entry point for sandbox-specific limitations. */
  docs: string;
  notice: string;
}

export function buildSandboxInfo(): SandboxInfo {
  return {
    environment: 'sandbox',
    network: process.env.TON_NETWORK ?? 'testnet',
    baseUrl: PUBLIC_SANDBOX_BASE_URL,
    faucetUrl: PUBLIC_SANDBOX_FAUCET_URL,
    defaultMerchantNft: PUBLIC_SANDBOX_MERCHANT_NFT,
    defaultSandboxApiKey: PUBLIC_SANDBOX_API_KEY,
    testNftCards: SANDBOX_TEST_NFT_CARDS,
    resetCadence: SANDBOX_RESET_CADENCE,
    docs: 'https://github.com/xlabtg/tonbankcard-protocol/blob/main/docs/sandbox.md',
    notice:
      'Sandbox: no real funds, no production data, rate-limited. Test data may be reset on a regular cadence.',
  };
}

/**
 * Install sandbox routes / middleware. Call from the server entry point
 * before `setupInvoiceRoutes`.
 *
 * No-op when `isSandboxMode()` returns false; safe to call unconditionally.
 */
export function installSandboxMode(app: Express): boolean {
  if (!isSandboxMode()) return false;
  ensureSandboxKeyRegistered();
  app.use(sandboxHeaderMiddleware);
  app.use(sandboxAnonymousAuthMiddleware);
  app.get('/v1/sandbox/info', (_req: Request, res: Response) => {
    res.status(200).json(buildSandboxInfo());
  });
  return true;
}
