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
 * Resolve and validate the API key HMAC secret.
 *
 * @param env - Environment to read from (defaults to `process.env`; injectable for tests)
 * @returns The validated secret
 * @throws {InsecureSecretError} outside test mode when the secret is missing,
 *         empty, a known weak/default value, or shorter than
 *         {@link MIN_API_KEY_SECRET_LENGTH}.
 */
export function resolveApiKeySecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = (env.API_KEY_SECRET ?? '').trim();
  const testEnv = isTestEnv(env);

  if (secret === '') {
    if (testEnv) return TEST_API_KEY_SECRET;
    throw new InsecureSecretError(
      'API_KEY_SECRET is not set. Refusing to start: API keys would be hashed ' +
        'with a publicly known constant. Generate a secret with ' +
        '`openssl rand -hex 32` and set API_KEY_SECRET before starting the API.'
    );
  }

  if (KNOWN_WEAK_API_KEY_SECRETS.has(secret.toLowerCase())) {
    if (testEnv) return secret;
    throw new InsecureSecretError(
      'API_KEY_SECRET is set to a known weak/default value. Refusing to start. ' +
        'Generate a unique secret with `openssl rand -hex 32`.'
    );
  }

  if (secret.length < MIN_API_KEY_SECRET_LENGTH) {
    if (testEnv) return secret;
    throw new InsecureSecretError(
      `API_KEY_SECRET is too short (${secret.length} characters). A minimum of ` +
        `${MIN_API_KEY_SECRET_LENGTH} characters is required. Generate one with ` +
        '`openssl rand -hex 32`.'
    );
  }

  return secret;
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
