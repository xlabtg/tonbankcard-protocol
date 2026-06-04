/**
 * Security secret resolution & validation.
 *
 * Centralises how `API_KEY_SECRET` — the HMAC key used to hash API keys at
 * rest (see `services/ApiKeyService.ts`) — is read from the environment and
 * validated.
 *
 * The goal is to **fail fast** on a misconfigured deployment rather than
 * silently fall back to a publicly known constant. Previously the secret
 * defaulted to the literal `'default-dev-secret'`, so an operator who forgot
 * to set `API_KEY_SECRET` in production would hash every API key with a value
 * anyone can read from the source tree — nullifying the "store only the HMAC"
 * design (audit finding API-H1, issue #250).
 *
 * Policy
 * ------
 * - `NODE_ENV === 'test'`: an unset/empty secret falls back to the fixed,
 *   obviously-non-production {@link TEST_API_KEY_SECRET} so tests have a stable
 *   HMAC key. This is the ONLY place a hardcoded fallback is ever used.
 * - Every other environment (production, development, sandbox, …): the secret
 *   MUST be present, non-empty, not a known weak/default value, and at least
 *   {@link MIN_API_KEY_SECRET_LENGTH} characters long. Otherwise an
 *   {@link InsecureSecretError} is thrown and the process refuses to start.
 */

/** Minimum acceptable length for `API_KEY_SECRET` (characters). */
export const MIN_API_KEY_SECRET_LENGTH = 16;

/**
 * Secrets that must never protect a real deployment. Includes the historical
 * hardcoded fallback and the placeholders shipped in the example env files.
 * Compared case-insensitively.
 */
export const KNOWN_WEAK_API_KEY_SECRETS: ReadonlySet<string> = new Set([
  'default-dev-secret',
  'change-me-to-a-32-byte-random-value',
  'sandbox-do-not-use-in-production-32-bytes',
  'changeme',
  'change-me',
  'secret',
  'password',
]);

/**
 * Deterministic secret used ONLY when `NODE_ENV === 'test'`. Tests need a
 * stable HMAC key so that registration and lookup agree, but must never run
 * with a real secret. This value is intentionally obvious and is never used
 * outside the test environment.
 */
export const TEST_API_KEY_SECRET = 'test-only-api-key-secret-do-not-use-in-prod';

/**
 * Deterministic secret used ONLY when `NODE_ENV === 'test'` for the settlement
 * indexer attestation HMAC (see `utils/settlementAttestation.ts`). Mirrors
 * {@link TEST_API_KEY_SECRET}: stable for tests, obviously non-production, and
 * never used outside the test environment.
 */
export const TEST_SETTLEMENT_INDEXER_SECRET =
  'test-only-settlement-indexer-secret-do-not-use-in-prod';

/**
 * Deterministic secret used ONLY when `NODE_ENV === 'test'` for the webhook
 * signing-secret encryption key (see `utils/secretCipher.ts`). Mirrors
 * {@link TEST_API_KEY_SECRET}: stable for tests, obviously non-production, and
 * never used outside the test environment.
 */
export const TEST_WEBHOOK_SECRET_ENCRYPTION_KEY =
  'test-only-webhook-secret-encryption-key-do-not-use-in-prod';

/** Error thrown when `API_KEY_SECRET` is missing or insecurely configured. */
export class InsecureSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsecureSecretError';
  }
}

function isTestEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * Resolve and validate a strong HMAC secret read from `env[varName]`.
 *
 * Shared core for every server-side secret so the fail-fast policy (reject
 * missing / weak / too-short values outside test mode, deterministic fallback
 * inside it) is implemented in exactly one place.
 *
 * @param env          - Environment to read from
 * @param varName      - Environment variable holding the secret
 * @param testFallback - Deterministic value returned under `NODE_ENV === 'test'`
 *                       when the variable is unset/empty
 * @returns The validated secret
 * @throws {InsecureSecretError} outside test mode when the secret is missing,
 *         empty, a known weak/default value, or shorter than
 *         {@link MIN_API_KEY_SECRET_LENGTH}.
 */
function resolveStrongSecret(
  env: NodeJS.ProcessEnv,
  varName: string,
  testFallback: string
): string {
  const secret = (env[varName] ?? '').trim();
  const testEnv = isTestEnv(env);

  if (secret === '') {
    if (testEnv) return testFallback;
    throw new InsecureSecretError(
      `${varName} is not set. Refusing to start: this secret protects a security ` +
        'boundary and must not fall back to a publicly known constant. Generate a ' +
        `secret with \`openssl rand -hex 32\` and set ${varName} before starting the API.`
    );
  }

  if (KNOWN_WEAK_API_KEY_SECRETS.has(secret.toLowerCase())) {
    if (testEnv) return secret;
    throw new InsecureSecretError(
      `${varName} is set to a known weak/default value. Refusing to start. ` +
        'Generate a unique secret with `openssl rand -hex 32`.'
    );
  }

  if (secret.length < MIN_API_KEY_SECRET_LENGTH) {
    if (testEnv) return secret;
    throw new InsecureSecretError(
      `${varName} is too short (${secret.length} characters). A minimum of ` +
        `${MIN_API_KEY_SECRET_LENGTH} characters is required. Generate one with ` +
        '`openssl rand -hex 32`.'
    );
  }

  return secret;
}

/**
 * Resolve and validate the API key HMAC secret.
 *
 * @param env - Environment to read from (defaults to `process.env`; injectable for tests)
 * @returns The validated secret
 * @throws {InsecureSecretError} outside test mode when the secret is missing,
 *         empty, a known weak/default value, or shorter than
 *         {@link MIN_API_KEY_SECRET_LENGTH}.
 */
export function resolveApiKeySecret(env: NodeJS.ProcessEnv = process.env): string {
  return resolveStrongSecret(env, 'API_KEY_SECRET', TEST_API_KEY_SECRET);
}

/**
 * Resolve and validate the settlement indexer attestation secret.
 *
 * This HMAC key authenticates settlement events submitted to
 * `InvoiceService.processSettlementEvent`. Only the trusted, authenticated
 * indexer knows it, so a forged event from any other source cannot flip an
 * invoice to `settled` (audit finding API-H3, issue #252). The same fail-fast
 * policy as {@link resolveApiKeySecret} applies.
 *
 * @param env - Environment to read from (defaults to `process.env`; injectable for tests)
 * @returns The validated secret
 * @throws {InsecureSecretError} outside test mode when the secret is missing,
 *         empty, a known weak/default value, or shorter than
 *         {@link MIN_API_KEY_SECRET_LENGTH}.
 */
export function resolveSettlementIndexerSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  return resolveStrongSecret(
    env,
    'SETTLEMENT_INDEXER_SECRET',
    TEST_SETTLEMENT_INDEXER_SECRET
  );
}

/**
 * Resolve and validate the webhook signing-secret encryption key.
 *
 * Webhook signing secrets are symmetric HMAC keys: the API must recover the
 * plaintext at delivery time to sign the payload, so they cannot be one-way
 * hashed. Instead they are encrypted at rest with AES-256-GCM (see
 * `utils/secretCipher.ts`), keyed by the value resolved here. A leak of the
 * endpoint store therefore exposes only ciphertext, not the raw secrets
 * (audit finding API-M1, issue #269). The same fail-fast policy as
 * {@link resolveApiKeySecret} applies.
 *
 * @param env - Environment to read from (defaults to `process.env`; injectable for tests)
 * @returns The validated key material
 * @throws {InsecureSecretError} outside test mode when the key is missing,
 *         empty, a known weak/default value, or shorter than
 *         {@link MIN_API_KEY_SECRET_LENGTH}.
 */
export function resolveWebhookSecretEncryptionKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  return resolveStrongSecret(
    env,
    'WEBHOOK_SECRET_ENCRYPTION_KEY',
    TEST_WEBHOOK_SECRET_ENCRYPTION_KEY
  );
}

/**
 * Assert at boot that the API key secret is securely configured.
 *
 * Call this from the server entry point before accepting traffic so a
 * misconfigured deployment fails fast instead of running with predictable,
 * forgeable API-key hashes.
 *
 * @throws {InsecureSecretError} when the secret is insecurely configured.
 */
export function assertApiKeySecretConfigured(env: NodeJS.ProcessEnv = process.env): void {
  resolveApiKeySecret(env);
}
